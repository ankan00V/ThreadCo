from app.database import SessionLocal
from app.models import Customer
db = SessionLocal()
names = ["Diya Kumar", "Aisha Das", "Divya Bhat", "Nikhil Agarwal", "Nikhil Chauhan"]
for name in names:
    c = db.query(Customer).filter(Customer.name == name).first()
    if c:
        print(f"{c.name}: {c.total_orders} orders, ₹{c.total_spent}, tags: {c.tags}")
