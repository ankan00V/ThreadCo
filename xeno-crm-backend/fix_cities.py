import random
from app.database import SessionLocal
from app.models import Customer

CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Ludhiana", "Jaipur"]

def main():
    db = SessionLocal()
    customers = db.query(Customer).all()
    print(f"Loaded {len(customers)} customers.")
    for c in customers:
        c.city = random.choice(CITIES)
    db.commit()
    print("Updated cities and committed!")

if __name__ == "__main__":
    main()
