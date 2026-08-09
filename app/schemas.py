from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    is_guest: bool = False
    workspace_id: Optional[int] = None

    class Config:
        from_attributes = True


class WorkspaceCreate(BaseModel):
    name: str
    allowed_domains: Optional[str] = "*"


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    api_key: str
    allowed_domains: str
    created_at: datetime

    class Config:
        from_attributes = True


class GuestOnboardRequest(BaseModel):
    api_key: str
    guest_uuid: Optional[str] = None


class GuestOnboardResponse(BaseModel):
    token: str
    guest_user_id: int
    guest_username: str
    guest_uuid: str


class Token(BaseModel):
    access_token: str
    token_type: str


class MessageSchema(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    message_type: str
    client_msg_id: Optional[str] = None
    is_delivered: bool
    is_read: bool
    timestamp: datetime

    class Config:
        from_attributes = True
