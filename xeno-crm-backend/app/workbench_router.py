import time
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

router = APIRouter()

class QueryRequest(BaseModel):
    query: str

@router.get("/summary")
def workbench_summary(db: Session = Depends(get_db)):
    """Return a simple summary for the workbench page."""
    return {
        "status": "ok",
        "message": "Workbench endpoint ready",
        "counts": {
            "customers": db.execute(text("SELECT COUNT(*) FROM customers")).scalar(),
            "segments": db.execute(text("SELECT COUNT(*) FROM segments")).scalar(),
            "campaigns": db.execute(text("SELECT COUNT(*) FROM campaigns")).scalar(),
        },
    }

@router.post("/query")
def execute_query(request: QueryRequest, db: Session = Depends(get_db)):
    """Execute a raw SQL query and return results + execution time."""
    query = request.query.strip()
    
    # Basic safety check for read-only (not bulletproof, but good for demo)
    if not query.upper().startswith("SELECT") and not query.upper().startswith("EXPLAIN"):
        raise HTTPException(status_code=400, detail="Only SELECT or EXPLAIN queries are allowed in the Workbench.")
    
    try:
        start_time = time.time()
        result = db.execute(text(query))
        
        # Fetch rows if it returns data
        rows = []
        columns = []
        if result.returns_rows:
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchmany(100)] # Limit to 100 for UI
        
        execution_time_ms = round((time.time() - start_time) * 1000, 2)
        
        # If it's a SELECT, also try to get the EXPLAIN ANALYZE plan
        explain_plan = []
        if query.upper().startswith("SELECT"):
            try:
                explain_result = db.execute(text(f"EXPLAIN ANALYZE {query}"))
                explain_plan = [row[0] for row in explain_result.fetchall()]
            except Exception:
                pass # Ignore if explain fails (e.g. SQLite doesn't support EXPLAIN ANALYZE in the same way, but Postgres does)

        return {
            "columns": columns,
            "rows": rows,
            "execution_time_ms": execution_time_ms,
            "explain_plan": explain_plan
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
