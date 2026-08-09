import asyncio
import json
import uuid
import os
import logging
from typing import Dict, List, Optional, Callable
from fastapi import WebSocket

logger = logging.getLogger("goftyar.pubsub")
logging.basicConfig(level=logging.INFO)


class PubSubAdapter:
    async def connect(self):
        pass

    async def publish(self, message: dict):
        pass

    async def start_listening(self, callback: Callable[[dict], None]):
        pass

    async def disconnect(self):
        pass

    async def add_online_user(self, user_id: int):
        pass

    async def remove_online_user(self, user_id: int):
        pass

    async def get_online_users(self) -> List[int]:
        return []


class LocalPubSubAdapter(PubSubAdapter):
    """
    Fallback in-memory PubSub for local development without Redis.
    """
    def __init__(self):
        self.callbacks: List[Callable[[dict], None]] = []
        self.online_users = set()

    async def connect(self):
        logger.info("Using LocalPubSubAdapter (fallback in-memory).")

    async def publish(self, message: dict):
        for cb in self.callbacks:
            # Run callback in background task to avoid blocking
            asyncio.create_task(cb(message))

    async def start_listening(self, callback: Callable[[dict], None]):
        self.callbacks.append(callback)

    async def disconnect(self):
        self.callbacks.clear()

    async def add_online_user(self, user_id: int):
        self.online_users.add(user_id)

    async def remove_online_user(self, user_id: int):
        self.online_users.discard(user_id)

    async def get_online_users(self) -> List[int]:
        return list(self.online_users)


class RedisPubSubAdapter(PubSubAdapter):
    """
    Redis PubSub adapter for multi-instance production scale.
    """
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis_client = None
        self.pubsub = None
        self.listener_task: Optional[asyncio.Task] = None
        self.channel = "goftyar_pubsub_channel"

    async def connect(self):
        import redis.asyncio as aioredis
        self.redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
        # Ping to verify connection
        await self.redis_client.ping()
        logger.info(f"Connected to Redis at {self.redis_url} for PubSub.")

    async def publish(self, message: dict):
        if self.redis_client:
            await self.redis_client.publish(self.channel, json.dumps(message))

    async def start_listening(self, callback: Callable[[dict], None]):
        self.pubsub = self.redis_client.pubsub()
        await self.pubsub.subscribe(self.channel)

        async def listen():
            try:
                async for message in self.pubsub.listen():
                    if message["type"] == "message":
                        try:
                            data = json.loads(message["data"])
                            await callback(data)
                        except Exception as e:
                            logger.error(f"Error parsing Redis message: {e}")
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Redis PubSub listener error: {e}")

        self.listener_task = asyncio.create_task(listen())

    async def disconnect(self):
        if self.listener_task:
            self.listener_task.cancel()
            try:
                await self.listener_task
            except asyncio.CancelledError:
                pass
        if self.pubsub:
            await self.pubsub.unsubscribe(self.channel)
            await self.pubsub.close()
        if self.redis_client:
            await self.redis_client.close()

    async def add_online_user(self, user_id: int):
        if self.redis_client:
            try:
                await self.redis_client.sadd("goftyar_online_users", user_id)
            except Exception as e:
                logger.error(f"Redis sadd error: {e}")

    async def remove_online_user(self, user_id: int):
        if self.redis_client:
            try:
                await self.redis_client.srem("goftyar_online_users", user_id)
            except Exception as e:
                logger.error(f"Redis srem error: {e}")

    async def get_online_users(self) -> List[int]:
        if self.redis_client:
            try:
                members = await self.redis_client.smembers("goftyar_online_users")
                return [int(m) for m in members]
            except Exception as e:
                logger.error(f"Redis smembers error: {e}")
        return []


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.instance_id = str(uuid.uuid4())

        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            self.pubsub_adapter: PubSubAdapter = RedisPubSubAdapter(redis_url)
        else:
            self.pubsub_adapter = LocalPubSubAdapter()

    async def init_pubsub(self):
        try:
            await self.pubsub_adapter.connect()
            await self.pubsub_adapter.start_listening(self._handle_pubsub_message)
        except Exception as e:
            logger.warning(f"Failed to connect to Redis. Falling back to local in-memory PubSub. Error: {e}")
            self.pubsub_adapter = LocalPubSubAdapter()
            await self.pubsub_adapter.connect()
            await self.pubsub_adapter.start_listening(self._handle_pubsub_message)

    async def _handle_pubsub_message(self, message: dict):
        target_user_id = message.get("target_user_id")
        broadcast = message.get("broadcast", False)
        payload = message.get("payload")

        if not payload:
            return

        if broadcast:
            for user_id, websocket in list(self.active_connections.items()):
                try:
                    await websocket.send_json(payload)
                except Exception:
                    await self.disconnect(user_id)
        elif target_user_id is not None:
            user_id = int(target_user_id)
            if user_id in self.active_connections:
                websocket = self.active_connections[user_id]
                try:
                    await websocket.send_json(payload)
                except Exception:
                    await self.disconnect(user_id)

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        await self.pubsub_adapter.add_online_user(user_id)

    async def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        await self.pubsub_adapter.remove_online_user(user_id)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def send_to_user(self, receiver_id: int, message: Dict):
        pubsub_payload = {
            "target_user_id": receiver_id,
            "broadcast": False,
            "sender_instance_id": self.instance_id,
            "payload": message
        }
        await self.pubsub_adapter.publish(pubsub_payload)

    async def broadcast(self, message: dict):
        pubsub_payload = {
            "target_user_id": None,
            "broadcast": True,
            "sender_instance_id": self.instance_id,
            "payload": message
        }
        await self.pubsub_adapter.publish(pubsub_payload)

    async def get_online_users(self) -> List[int]:
        # Merge local tracking with adapter tracking for safety
        remote_users = await self.pubsub_adapter.get_online_users()
        local_users = list(self.active_connections.keys())
        return list(set(remote_users + local_users))


manager = ConnectionManager()
