from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import engine, SessionLocal
from models import Base, Expense, Category, Budget

app = FastAPI()

Base. metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/expenses")
def add_expense(amount: float, description: str,category_id: int, db: Session = Depends(get_db)):
    expense = Expense(amount=amount, description=description, user_id=1, category_id=category_id)
    
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense

@app.get("/expenses")
def get_expenses(category_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Expense)

    if category_id:
        query = query.filter(Expense.category_id == category_id)
        expenses = query.all()
        return expenses

@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    
    if not expense:
        return {"error": "Nie znaleziono"}
    
    db.delete(expense)
    db.commit()
    return {"message": "Usunięto"}

@app.put("/expenses/{expense_id}")
def update_expense(expense_id: int, amount: float, description: str, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    
    if not expense:
        return {"error": "Nie znaleziono"}
    
    expense.amount = amount
    expense.description = description
    
    db.commit()
    db.refresh(expense)
    return expense

@app.post("/categories")
def add_category(name: str, db: Session = Depends(get_db)):
    category = Category(name=name, user_id=1)
    
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

@app.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    expenses = db.query(Expense).all()
    total = sum(exp.amount for exp in expenses)
    count = len(expenses)
    return{
        "total": total,
        "count": count
    }

@app.get("/stats/categories")
def category_stats(db: Session = Depends(get_db)):
    stats = (
        db.query(
            Category.name,
            func.sum(Expense.amount).label("total")
        )
        .join(Expense, Expense.category_id == Category.id)
        .group_by(Category.name)
        .all()
    )
    return stats

@app.get("/stats/monthly")
def monthly_stats(db: Session = Depends(get_db)):
    stats = db.query(
        func.sum(Expense.amount).label("total_spent"),
        func.count(Expense.id).label("expenses_count"),
        func.avg(Expense.amount).label("average_expense")
    ).first()

    return {
        "total_spent": stats.total_spent or 0,
        "expenses_count": stats.expenses_count or 0,
        "average_expense": stats.average_expense or 0
    }

@app.post("/budget")
def set_budget(monthly_limit: float, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.user_id == 1).first()
    
    if budget:
        budget.monthly_limit = monthly_limit
    else:
        budget = Budget(monthly_limit=monthly_limit, user_id=1)
        db.add(budget)
        
    db.commit()
    db.refresh(budget)
    return budget

@app.get("/budget/status")
def budget_status(db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.user_id == 1).first()

    if not budget:
        return {"error:" "Brak budżetu"}

    expenses = db.query(Expense).filter(Expense.user_id == 1).all()
    
    spent = sum(exp.amount for exp in expenses)
    
    remaining = budget.monthly_limit - spent
    
    exceeded = spent > budget.monthly_limit

    return {
        "monthly_limit": budget.monthly_limit,
        "spent": spent,
        "remaining": remaining,
        "exceeded": exceeded
    }