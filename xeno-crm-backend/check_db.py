from app.database import SessionLocal
from app.models import Customer
db = SessionLocal()
c = db.query(Customer).filter(Customer.total_orders > 0).first()
if c:
    print(f"Found customer with {c.total_orders} orders!")
else:
    print("NO CUSTOMER HAS ORDERS!")
