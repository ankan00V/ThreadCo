from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS communications CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS channel_stub_logs CASCADE;"))
    conn.commit()
print("Dropped successfully")
