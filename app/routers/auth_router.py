import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password, create_access_token, verify_password, get_current_user
from app.database import get_db
from app.models import User, Workspace
from app.schemas import (
    UserResponse, UserCreate, Token,
    WorkspaceCreate, WorkspaceResponse,
    GuestOnboardRequest, GuestOnboardResponse
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
        db: AsyncSession = Depends(get_db),
        current_user: Optional[User] = Depends(get_current_user)
):
    if current_user and current_user.workspace_id:
        # Multi-tenant isolation: only show users/guests in the same workspace
        result = await db.execute(
            select(User).where(User.workspace_id == current_user.workspace_id)
        )
        return result.scalars().all()

    # Fallback to all users if not in a workspace or not logged in
    users = await db.execute(select(User))
    return users.scalars().all()


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="This username already exists")

    new_user = User(
        username=user_data.username,
        hashed_password=hash_password(user_data.password),
        is_guest=False
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/workspaces", response_model=WorkspaceResponse)
async def create_workspace(
        workspace_data: WorkspaceCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Generate unique api key
    api_key = f"gy_live_{uuid.uuid4().hex}"

    new_workspace = Workspace(
        name=workspace_data.name,
        api_key=api_key,
        allowed_domains=workspace_data.allowed_domains or "*"
    )
    db.add(new_workspace)
    await db.commit()
    await db.refresh(new_workspace)

    # Associate user with workspace
    current_user.workspace_id = new_workspace.id
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return new_workspace


@router.get("/workspaces/my", response_model=Optional[WorkspaceResponse])
async def get_my_workspace(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if not current_user.workspace_id:
        return None

    result = await db.execute(
        select(Workspace).where(Workspace.id == current_user.workspace_id)
    )
    return result.scalars().first()


@router.post("/widget/onboard", response_model=GuestOnboardResponse)
async def onboard_guest(
        onboard_data: GuestOnboardRequest,
        db: AsyncSession = Depends(get_db)
):
    # Validate API Key
    result = await db.execute(
        select(Workspace).where(Workspace.api_key == onboard_data.api_key)
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(status_code=400, detail="Invalid API Key")

    guest_uuid = onboard_data.guest_uuid
    guest_user = None

    if guest_uuid:
        # Try to find existing guest
        username_candidate = f"guest_{guest_uuid}"
        user_result = await db.execute(
            select(User).where(
                User.username == username_candidate,
                User.workspace_id == workspace.id
            )
        )
        guest_user = user_result.scalars().first()

    if not guest_user:
        # Generate new guest
        guest_uuid = str(uuid.uuid4())
        username_candidate = f"guest_{guest_uuid}"

        # Simple random password for guests
        random_pwd = uuid.uuid4().hex

        guest_user = User(
            username=username_candidate,
            hashed_password=hash_password(random_pwd),
            is_guest=True,
            workspace_id=workspace.id
        )
        db.add(guest_user)
        await db.commit()
        await db.refresh(guest_user)

    # Create access token for the guest
    access_token = create_access_token(
        data={"sub": guest_user.username, "user_id": guest_user.id}
    )

    return {
        "token": access_token,
        "guest_user_id": guest_user.id,
        "guest_username": guest_user.username,
        "guest_uuid": guest_uuid
    }


@router.get("/workspaces/operators", response_model=List[UserResponse])
async def get_workspace_operators(
        api_key: str,
        db: AsyncSession = Depends(get_db)
):
    # Get workspace
    ws_res = await db.execute(select(Workspace).where(Workspace.api_key == api_key))
    ws = ws_res.scalars().first()
    if not ws:
        raise HTTPException(status_code=400, detail="Invalid API Key")

    res = await db.execute(
        select(User).where(User.workspace_id == ws.id, User.is_guest == False)
    )
    return res.scalars().all()


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")

    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}
