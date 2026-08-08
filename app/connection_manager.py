import json
import asyncio
from typing import Dict, List, Callable, Awaitable
from fastapi import WebSocket


class PubSubAdapter:
    """
    Scale-ready pluggable Pub/Sub adapter to broadcast messages across multiple instances.
    Provides direct pluggability for Redis Pub/Sub, RabbitMQ, or generic brokers.
    """
    def __init__(self):
        self._subscribers: List[Callable[[dict], Awaitable[None]]] = []

    def subscribe(self, callback: Callable[[dict], Awaitable[None]]):
        self._subscribers.append(callback)

    async def publish(self, channel: str, message: dict):
        # Simulated Pub/Sub behavior for distributed scale (e.g. Redis backend)
        # In a multi-node production setup:
        #   await redis_client.publish(channel, json.dumps(message))
        # Locally, we trigger registered local subscribers directly:
        wrapped_msg = {"channel": channel, "payload": message}
        await self._trigger_subscribers(wrapped_msg)

    async def _trigger_subscribers(self, message: dict):
        tasks = []
        for subscriber in self._subscribers:
            tasks.append(subscriber(message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.pubsub = PubSubAdapter()
        # Subscribe to connection manager's cross-instance pubsub channel
        self.pubsub.subscribe(self._handle_cross_instance_message)

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def send_to_user(self, receiver_id: int, message: Dict):
        """
        Send a message to a user. If the user is connected locally, dispatch it.
        Otherwise, publish to cross-instance Pub/Sub so other active nodes can deliver it.
        """
        if receiver_id in self.active_connections:
            websocket = self.active_connections[receiver_id]
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(receiver_id)
        else:
            # Publish cross-instance to deliver on another node
            await self.pubsub.publish(f"user_{receiver_id}", message)

    async def broadcast(self, message: dict):
        """
        Broadcast a message to all online users on this instance,
        and publish cross-instance to inform other server instances.
        """
        # Distribute locally
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(user_id)

        # Publish cross-instance so other instances broadcast to their connections
        await self.pubsub.publish("global_broadcast", message)

    async def _handle_cross_instance_message(self, wrapped_msg: dict):
        channel = wrapped_msg.get("channel", "")
        payload = wrapped_msg.get("payload", {})

        if channel.startswith("user_"):
            try:
                user_id = int(channel.split("_")[1])
                if user_id in self.active_connections:
                    websocket = self.active_connections[user_id]
                    await websocket.send_json(payload)
            except Exception:
                pass
        elif channel == "global_broadcast":
            for user_id, websocket in list(self.active_connections.items()):
                try:
                    await websocket.send_json(payload)
                except Exception:
                    self.disconnect(user_id)

    def get_online_users(self) -> List[int]:
        return list(self.active_connections.keys())


manager = ConnectionManager()
