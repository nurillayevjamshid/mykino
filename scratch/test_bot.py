
import asyncio
from unittest.mock import AsyncMock, MagicMock
from bot.main import start
from bot.config import load_settings

async def test_start():
    settings = load_settings()
    message = AsyncMock()
    message.from_user = MagicMock()
    message.from_user.id = 123456789
    message.from_user.username = "newuser"
    message.from_user.first_name = "New"
    message.from_user.last_name = "User"
    message.text = "/start"
    message.chat.id = 123456789
    
    print("Testing /start for a new user...")
    await start(message, settings)
    print("Called start function.")
    
    # Check if answer was called
    for call in message.answer.call_args_list:
        print(f"Bot answered: {call.args[0]}")

if __name__ == "__main__":
    asyncio.run(test_start())
