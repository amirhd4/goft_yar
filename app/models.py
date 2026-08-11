from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import Integer, String, DateTime, Text, ForeignKey, Boolean, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def get_utc_now():
    return datetime.now(timezone.utc)


widget_agent_assignments = Table(
    "widget_agent_assignments",
    Base.metadata,
    Column("widget_id", Integer, ForeignKey("widgets.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
)


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    allowed_domains: Mapped[str] = mapped_column(String(255), default="*", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now)

    users = relationship("User", back_populates="workspace", cascade="all, delete-orphan")
    widgets = relationship("Widget", back_populates="workspace", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("workspaces.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now)

    workspace = relationship("Workspace", back_populates="users")
    assigned_widgets = relationship("Widget", secondary=widget_agent_assignments, back_populates="agents")


class Widget(Base):
    __tablename__ = "widgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workspace_id: Mapped[int] = mapped_column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    theme_color: Mapped[str] = mapped_column(String(20), default="#2563eb", nullable=False)
    allowed_domains: Mapped[str] = mapped_column(String(255), default="*", nullable=False)
    is_ai_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now)

    workspace = relationship("Workspace", back_populates="widgets")
    agents = relationship("User", secondary=widget_agent_assignments, back_populates="assigned_widgets")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str] = mapped_column(String(20), default="text")
    client_msg_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=True)
    is_delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
