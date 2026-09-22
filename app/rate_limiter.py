import time
from typing import Dict, List, Tuple


class MessageRateLimiter:
    """
    Sliding window / Token bucket rate limiter for WebSocket messaging with duplicate
    content detection to prevent bot automation and chat flooding.
    """

    def __init__(
        self,
        capacity: int = 5,
        refill_rate: float = 1.0,  # 1 token per second
        duplicate_limit: int = 3,
        duplicate_window: float = 5.0
    ):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.duplicate_limit = duplicate_limit
        self.duplicate_window = duplicate_window
        self.user_buckets: Dict[int, dict] = {}

    def check_rate_limit(self, user_id: int, content: str) -> Tuple[bool, str]:
        """
        Checks if a user is sending messages too fast or spamming duplicates.
        Returns (is_allowed: bool, reason: str).
        """
        now = time.time()

        if user_id not in self.user_buckets:
            self.user_buckets[user_id] = {
                "tokens": float(self.capacity),
                "last_update": now,
                "recent_contents": []
            }

        bucket = self.user_buckets[user_id]

        # Refill tokens
        elapsed = now - bucket["last_update"]
        bucket["last_update"] = now
        bucket["tokens"] = min(float(self.capacity), bucket["tokens"] + elapsed * self.refill_rate)

        # 1. Content size check
        if len(content) > 4000:
            return False, "حجم پیام بیش از حد مجاز است (حداکثر ۴۰۰۰ کاراکتر)."

        # 2. Token bucket rate check
        if bucket["tokens"] < 1.0:
            return False, "تعداد پیام‌های شما زیاد است. لطفاً چند ثانیه صبر کنید."

        # 3. Duplicate spam check
        recent = [
            (ts, txt) for (ts, txt) in bucket["recent_contents"]
            if now - ts <= self.duplicate_window
        ]

        duplicate_count = sum(1 for (ts, txt) in recent if txt == content)
        if duplicate_count >= self.duplicate_limit:
            bucket["recent_contents"] = recent
            return False, "پیام تکراری شناسایی شد. لطفاً از ارسال متوالی پیام‌های یکسان خودداری کنید."

        # Consume 1 token and record content timestamp
        bucket["tokens"] -= 1.0
        recent.append((now, content))
        bucket["recent_contents"] = recent

        return True, ""

    def clear_user(self, user_id: int):
        self.user_buckets.pop(user_id, None)


ws_rate_limiter = MessageRateLimiter()
