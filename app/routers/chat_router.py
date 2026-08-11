import os
import json
import uuid
import shutil
from typing import List

from fastapi import Query, status, WebSocket, WebSocketDisconnect, APIRouter, Depends, UploadFile, File, HTTPException
from jose import jwt, JWTError
from sqlalchemy import or_, and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

import asyncio
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
    # Mark messages sent from other_user_id to current_user_id as read
    try:
        update_stmt = update(Message).where(
            and_(
                Message.sender_id == other_user_id,
                Message.receiver_id == current_user_id,
                Message.is_read == False
            )
        ).values(is_read=True)
        await db.execute(update_stmt)
        await db.commit()
    except Exception as e:
        print(f"Error marking messages as read: {e}")

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
        online_users_list = await manager.get_online_users()
        await manager.send_personal_message(
            {
                "type": "presence_list",
                "online_users": online_users_list
            },
            websocket
        )
    except Exception as e:
        print(f"Error sending presence list: {e}")

    await manager.broadcast({
        "type": "presence",
        "user_id": user_id,
        "status": "online"
    })

    async with AsyncSessionLocal() as db:
        try:
            update_stmt = update(Message).where(
                and_(Message.receiver_id == user_id, Message.is_delivered == False)
            ).values(is_delivered=True)
            await db.execute(update_stmt)
            await db.commit()

            await manager.broadcast({
                "type": "delivered_receipt",
                "receiver_id": user_id
            })
        except Exception as e:
            print(f"Error updating message delivery status on connect: {e}")

    try:
        while True:
            data = await websocket.receive_text()
            message_json = json.loads(data)

            msg_type_event = message_json.get("type")

            if msg_type_event == "ping":
                await manager.send_personal_message({"type": "pong"}, websocket)
                continue

            elif msg_type_event == "typing":
                receiver_id = int(message_json.get("receiver_id"))
                is_typing = bool(message_json.get("is_typing", False))
                await manager.send_to_user(receiver_id, {
                    "type": "typing",
                    "sender_id": user_id,
                    "is_typing": is_typing
                })
                continue

            elif msg_type_event == "read":
                sender_id = int(message_json.get("sender_id"))
                async with AsyncSessionLocal() as db:
                    update_stmt = update(Message).where(
                        and_(
                            Message.sender_id == sender_id,
                            Message.receiver_id == user_id,
                            Message.is_read == False
                        )
                    ).values(is_read=True)
                    await db.execute(update_stmt)
                    await db.commit()

                await manager.send_to_user(sender_id, {
                    "type": "read",
                    "receiver_id": user_id
                })
                continue

            elif msg_type_event == "call_user":
                receiver_id = int(message_json.get("receiver_id"))
                offer = message_json.get("offer")
                await manager.send_to_user(receiver_id, {
                    "type": "call_user",
                    "sender_id": user_id,
                    "offer": offer
                })
                continue

            elif msg_type_event == "answer_call":
                receiver_id = int(message_json.get("receiver_id"))
                answer = message_json.get("answer")
                await manager.send_to_user(receiver_id, {
                    "type": "answer_call",
                    "sender_id": user_id,
                    "answer": answer
                })
                continue

            elif msg_type_event == "ice_candidate":
                receiver_id = int(message_json.get("receiver_id"))
                candidate = message_json.get("candidate")
                await manager.send_to_user(receiver_id, {
                    "type": "ice_candidate",
                    "sender_id": user_id,
                    "candidate": candidate
                })
                continue

            elif msg_type_event == "hangup":
                receiver_id = int(message_json.get("receiver_id"))
                await manager.send_to_user(receiver_id, {
                    "type": "hangup",
                    "sender_id": user_id
                })
                continue

            receiver_id = int(message_json["receiver_id"])
            content = message_json["content"]
            message_format = message_json.get("msgType") or message_json.get("message_type") or "text"
            client_msg_id = message_json.get("client_msg_id")

            async with AsyncSessionLocal() as db:
                db_message = None
                if client_msg_id:
                    stmt = select(Message).where(Message.client_msg_id == client_msg_id)
                    res = await db.execute(stmt)
                    db_message = res.scalars().first()

                if db_message is None:
                    # Message does not exist, safe to create
                    is_receiver_online = receiver_id in manager.active_connections
                    db_message = Message(
                        sender_id=user_id,
                        receiver_id=receiver_id,
                        content=content,
                        message_type=message_format,
                        client_msg_id=client_msg_id,
                        is_delivered=is_receiver_online,
                        is_read=False
                    )
                    db.add(db_message)
                    await db.commit()
                    await db.refresh(db_message)

                payload_to_send = {
                    "type": "message",
                    "id": db_message.id,
                    "sender_id": user_id,
                    "sender_username": username,
                    "receiver_id": receiver_id,
                    "content": content,
                    "message_type": message_format,
                    "client_msg_id": client_msg_id,
                    "is_delivered": db_message.is_delivered,
                    "is_read": db_message.is_read,
                    "timestamp": db_message.timestamp.isoformat()
                }

            await manager.send_to_user(receiver_id, payload_to_send)
            await manager.send_personal_message(payload_to_send, websocket)

            async with AsyncSessionLocal() as db:
                from app.models import User, Widget
                sender_res = await db.execute(select(User).where(User.id == user_id))
                sender_user = sender_res.scalars().first()
                if sender_user and sender_user.is_guest and sender_user.workspace_id:
                    # get workspace widget
                    widget_res = await db.execute(
                        select(Widget).where(Widget.workspace_id == sender_user.workspace_id)
                    )
                    widget = widget_res.scalars().first()
                    if widget and widget.is_ai_active:
                        asyncio.create_task(
                            handle_ai_auto_response(user_id, username, receiver_id, content, db_message.id)
                        )

    except WebSocketDisconnect:
        await manager.disconnect(user_id)
        await manager.broadcast({
            "type": "presence",
            "user_id": user_id,
            "status": "offline"
        })
    except Exception as e:
        print(f"WebSocket error in user {user_id}: {e}")
        await manager.disconnect(user_id)
        await manager.broadcast({
            "type": "presence",
            "user_id": user_id,
            "status": "offline"
        })


async def handle_ai_auto_response(guest_id: int, guest_username: str, operator_id: int, guest_message: str, db_msg_id: int):
    await asyncio.sleep(2)

    await manager.send_to_user(guest_id, {
        "type": "typing",
        "sender_id": operator_id,
        "is_typing": True
    })

    await asyncio.sleep(2)

    rtl_chars = set("ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی")
    is_persian = any(char in rtl_chars for char in guest_message)

    if is_persian:
        ai_responses = [
            "سلام! من دستیار هوشمند گفت‌یار هستم. چطور می‌توانم به شما کمک کنم؟ 😊",
            "پیام شما دریافت شد. در حال حاضر اپراتورهای ما مشغول هستند؛ من آماده پاسخگویی به سوالات شما هستم.",
            "ممنون از پیام شما. لطفاً منتظر بمانید تا همکاران ما به شما متصل شوند، یا اگر سوالی دارید همینجا بپرسید.",
            "خوشحالم که با ما ارتباط برقرار کردید. برای راهنمایی دقیق‌تر لطفا جزئیات بیشتری ارسال فرمایید."
        ]
    else:
        ai_responses = [
            "Hello! I am the Goftyar AI assistant. How can I help you today? 😊",
            "Your message has been received. Our agents are currently busy, but I'm here to assist you in the meantime.",
            "Thank you for reaching out! Please wait a moment while I connect you to an agent, or ask me any questions.",
            "Great to chat with you! Please let me know if you need any specific information."
        ]

    content = ai_responses[db_msg_id % len(ai_responses)]

    await manager.send_to_user(guest_id, {
        "type": "typing",
        "sender_id": operator_id,
        "is_typing": False
    })

    async with AsyncSessionLocal() as db:
        ai_msg_id = f"ai-{uuid.uuid4().hex}"
        db_message = Message(
            sender_id=operator_id,
            receiver_id=guest_id,
            content=content,
            message_type="text",
            client_msg_id=ai_msg_id,
            is_delivered=True,
            is_read=False
        )
        db.add(db_message)
        await db.commit()
        await db.refresh(db_message)

        payload_to_send = {
            "type": "message",
            "id": db_message.id,
            "sender_id": operator_id,
            "sender_username": "AI Assistant",
            "receiver_id": guest_id,
            "content": content,
            "message_type": "text",
            "client_msg_id": ai_msg_id,
            "is_delivered": True,
            "is_read": False,
            "timestamp": db_message.timestamp.isoformat()
        }

    await manager.send_to_user(guest_id, payload_to_send)
    await manager.send_to_user(operator_id, payload_to_send)


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
