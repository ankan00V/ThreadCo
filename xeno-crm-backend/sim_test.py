import asyncio
from app.routers.channel_stub import simulate_message_lifecycle

async def test():
    await simulate_message_lifecycle("dummy_camp", "dummy_cust", "dummy_ext")

asyncio.run(test())
