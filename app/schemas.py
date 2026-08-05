from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True


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
