from app.database import engine
from sqlalchemy import text
with engine.connect() as c:
    print(c.execute(text("SELECT status, count(*) FROM communications GROUP BY status")).fetchall())
    print(c.execute(text("SELECT * FROM channel_stub_logs LIMIT 1")).fetchall())
