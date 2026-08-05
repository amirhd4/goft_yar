import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# Use SQLite as fallback if PostgreSQL is not configured/available
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./goftyar.db"
)

# SQLite requires different arguments (e.g. check_same_thread=False is not needed for asyncpg but safe for sqlite)
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["timeout"] = 30

engine = create_async_engine(DATABASE_URL, echo=True, connect_args=connect_args)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
