from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password, create_access_token, verify_password
from app.database import get_db
from app.models import User
from app.schemas import UserResponse, UserCreate, Token

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(db: AsyncSession = Depends(get_db)):
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
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")

    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/workspace/api-keys", tags=["Workspace"])
async def generate_workspace_api_key(workspace_name: str = Query(..., min_length=2)):
    """
    Generate an API key for external widget authorization, bound to a specific workspace.
    """
    api_key = f"gy_live_{uuid.uuid4().hex}"
    return {
        "workspace": workspace_name,
        "api_key": api_key,
        "allowed_origins": ["*"],
        "status": "active"
    }
