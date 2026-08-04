import os

import json
from typing import List

from fastapi import Query, status, WebSocket, WebSocketDisconnect, APIRouter, Depends, UploadFile, File, HTTPException
from jose import jwt, JWTError
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
import shutil

from app.auth import SECRET_KEY, ALGORITHM
from app.connection_manager import manager
from app.database import AsyncSessionLocal, get_db
from app.models import Message
from app.schemas import MessageSchema


router = APIRouter(tags=["Chat"])


@router.get("/api/messages/{other_user_id}", response_model=List[MessageSchema])
async def get_chat_history(
        other_user_id: int,
        current_user_id: int = Query(...),
        db: AsyncSession = Depends(get_db)
):
    stmt = select(Message).where(
        or_(
            and_(Message.sender_id == current_user_id, Message.receiver_id == other_user_id),
            and_(Message.sender_id == other_user_id, Message.receiver_id == current_user_id)
        )
    ).order_by(Message.timestamp.asc())

    result = await db.execute(stmt)
    return result.scalars().all()


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        username: str = payload.get("sub")
        if user_id is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message_json = json.loads(data)
            receiver_id = int(message_json["receiver_id"])
            content = message_json["content"]

            async with AsyncSessionLocal() as db:
                db_message = Message(
                    sender_id=user_id,
                    receiver_id=receiver_id,
                    content=content
                )
                db.add(db_message)
                await db.commit()
                await db.refresh(db_message)

                payload_to_send = {
                    "id": db_message.id,
                    "sender_id": user_id,
                    "sender_username": username,
                    "receiver_id": receiver_id,
                    "content": content,
                    "timestamp": db_message.timestamp.isoformat()
                }

            await manager.send_to_user(receiver_id, payload_to_send)
            await manager.send_personal_message(payload_to_send, websocket)

    except WebSocketDisconnect:
        manager.disconnect(user_id)


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed_types = ["image/jpeg", "image/png", "video/mp4", "audio/mpeg", "audio/webm", "audio/ogg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")

    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"file_url": f"/uploads/{unique_filename}", "type": file.content_type}