from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter()

@router.get("/summary")
def workbench_summary(db: Session = Depends(get_db)):
    """Return a simple summary for the workbench page.
    In a real implementation this could aggregate campaign, customer,
    and segment stats. Here we provide a placeholder.
    """
    # Example placeholder data
    return {
        "status": "ok",
        "message": "Workbench summary placeholder",
        "counts": {
            "customers": db.execute("SELECT COUNT(*) FROM customers").scalar(),
            "segments": db.execute("SELECT COUNT(*) FROM segments").scalar(),
            "campaigns": db.execute("SELECT COUNT(*) FROM campaigns").scalar(),
        },
    }
