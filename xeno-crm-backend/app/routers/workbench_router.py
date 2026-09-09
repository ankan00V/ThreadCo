from fastapi import APIRouter, Depends
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/summary")
def workbench_summary(db: Session = Depends(get_db)):
    """Placeholder endpoint for the Data Workbench UI.
    Returns a simple health‑check style payload that the frontend can use
    to verify the backend route is wired correctly.
    """
    return {"status": "ok", "message": "Workbench endpoint ready"}
