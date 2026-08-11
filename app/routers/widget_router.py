from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from urllib.parse import urlparse

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Workspace, Widget
from app.schemas import WidgetCreate, WidgetUpdate, WidgetResponse, UserResponse

router = APIRouter(prefix="/api/widgets", tags=["Widgets"])


@router.get("", response_model=List[WidgetResponse])
async def get_widgets(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User has no workspace assigned")

    result = await db.execute(
        select(Widget)
        .where(Widget.workspace_id == current_user.workspace_id)
        .options(selectinload(Widget.agents))
    )
    return result.scalars().all()


@router.post("", response_model=WidgetResponse)
async def create_widget(
        widget_data: WidgetCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User has no workspace assigned")

    new_widget = Widget(
        workspace_id=current_user.workspace_id,
        name=widget_data.name,
        theme_color=widget_data.theme_color or "#2563eb",
        allowed_domains=widget_data.allowed_domains or "*",
        is_ai_active=widget_data.is_ai_active or False
    )

    if widget_data.agent_ids:
        agent_result = await db.execute(
            select(User).where(
                User.id.in_(widget_data.agent_ids),
                User.workspace_id == current_user.workspace_id,
                User.is_guest == False
            )
        )
        agents = agent_result.scalars().all()
        new_widget.agents = list(agents)

    db.add(new_widget)
    await db.commit()
    await db.refresh(new_widget)

    res = await db.execute(
        select(Widget)
        .where(Widget.id == new_widget.id)
        .options(selectinload(Widget.agents))
    )
    return res.scalars().first()


@router.put("/{widget_id}", response_model=WidgetResponse)
async def update_widget(
        widget_id: int,
        widget_data: WidgetUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User has no workspace assigned")

    result = await db.execute(
        select(Widget)
        .where(Widget.id == widget_id, Widget.workspace_id == current_user.workspace_id)
        .options(selectinload(Widget.agents))
    )
    widget = result.scalars().first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    if widget_data.name is not None:
        widget.name = widget_data.name
    if widget_data.theme_color is not None:
        widget.theme_color = widget_data.theme_color
    if widget_data.allowed_domains is not None:
        widget.allowed_domains = widget_data.allowed_domains
    if widget_data.is_ai_active is not None:
        widget.is_ai_active = widget_data.is_ai_active

    if widget_data.agent_ids is not None:
        if widget_data.agent_ids:
            agent_result = await db.execute(
                select(User).where(
                    User.id.in_(widget_data.agent_ids),
                    User.workspace_id == current_user.workspace_id,
                    User.is_guest == False
                )
            )
            widget.agents = list(agent_result.scalars().all())
        else:
            widget.agents = []

    db.add(widget)
    await db.commit()
    await db.refresh(widget)

    return widget


@router.delete("/{widget_id}")
async def delete_widget(
        widget_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User has no workspace assigned")

    result = await db.execute(
        select(Widget)
        .where(Widget.id == widget_id, Widget.workspace_id == current_user.workspace_id)
    )
    widget = result.scalars().first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    await db.delete(widget)
    await db.commit()
    return {"message": "Widget deleted successfully"}


@router.get("/config", response_model=WidgetResponse)
async def get_widget_config(
        api_key: str = Query(...),
        origin: Optional[str] = Header(None),
        referer: Optional[str] = Header(None),
        db: AsyncSession = Depends(get_db)
):
    ws_res = await db.execute(select(Workspace).where(Workspace.api_key == api_key))
    ws = ws_res.scalars().first()
    if not ws:
        raise HTTPException(status_code=404, detail="Invalid API Key")

    widget_res = await db.execute(
        select(Widget)
        .where(Widget.workspace_id == ws.id)
        .options(selectinload(Widget.agents))
    )
    widget = widget_res.scalars().first()
    if not widget:
        widget = Widget(
            workspace_id=ws.id,
            name="Default Widget",
            theme_color="#2563eb",
            allowed_domains="*",
            is_ai_active=False
        )
        db.add(widget)
        await db.commit()
        await db.refresh(widget)

        widget_res = await db.execute(
            select(Widget)
            .where(Widget.id == widget.id)
            .options(selectinload(Widget.agents))
        )
        widget = widget_res.scalars().first()

    allowed = widget.allowed_domains.strip()
    if allowed != "*":
        domains = [d.strip().lower() for d in allowed.split(",")]
        client_origin = None

        if origin:
            client_origin = urlparse(origin).netloc.lower()
        elif referer:
            client_origin = urlparse(referer).netloc.lower()

        if client_origin and ":" in client_origin:
            client_origin = client_origin.split(":")[0]

        if client_origin and client_origin not in ["localhost", "127.0.0.1"]:
            if client_origin not in domains:
                raise HTTPException(status_code=403, detail="Origin not allowed for this Widget API Key")

    return widget
