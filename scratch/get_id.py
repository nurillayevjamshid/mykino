
import asyncio
from aiogram import Bot
from bot.config import load_settings

async def get_channel_id():
    settings = load_settings()
    bot = Bot(token=settings.bot_token)
    try:
        chat = await bot.get_chat("@mykinoplay")
        print(f"Channel ID for @mykinoplay: {chat.id}")
        print(f"Channel Username: {chat.username}")
    except Exception as e:
        print(f"Error getting channel ID: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(get_channel_id())
