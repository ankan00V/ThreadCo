import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

from app.models import Campaign, Communication

load_dotenv()
db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_cleanup():
    db = SessionLocal()
    try:
        campaigns_to_delete = db.query(Campaign).filter(
            Campaign.status.in_(["draft", "sending", "running"])
        ).all()
        
        deleted_count = 0
        for camp in campaigns_to_delete:
            print(f"Deleting Campaign: {camp.name} ({camp.status})")
            db.query(Communication).filter(Communication.campaign_id == camp.id).delete(synchronize_session=False)
            db.delete(camp)
            deleted_count += 1
            
        db.commit()
        print(f"Cleanup finished. Deleted {deleted_count} campaigns.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_cleanup()
