
import json
from pathlib import Path
from bot.storage import upsert_user
from dataclasses import dataclass

@dataclass
class DummyUser:
    id: int
    username: str
    first_name: str
    last_name: str

settings_path = Path("data/users.json")
dummy = DummyUser(id=999999999, username="testuser", first_name="Test", last_name="User")

print("Upserting user...")
upsert_user(settings_path, dummy)
print("Done. Checking file...")

with open(settings_path, "r", encoding="utf-8") as f:
    users = json.load(f)
    print(f"Total users: {len(users)}")
    last_user = users[-1]
    print(f"Last user: {last_user}")
