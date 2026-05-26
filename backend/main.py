from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
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
def get_expenses(
    category_id: int = None, 
    start_date: str = None,
    end_date: str = None,
    search: str = None,
    limit: int = 10,
    offset: int = 0,
    sort_by: str = "id",
    order: str = "desc",
    db: Session = Depends(get_db)
):
    query = db.query(Expense)

    if category_id:
        query = query.filter(Expense.category_id == category_id)
        
    if start_date:
        query = query.filter(Expense.date >= start_date)

    if end_date:
        query = query.filter(Expense.date <= end_date)

    if search:
        query = query.filter(Expense.description.contains(search))

    sortable_columns = {
        "id": Expense.id,
        "amount": Expense.amount,
        "date": Expense.date
    }
    
    sort_column = sortable_columns.get(sort_by, Expense.id)
    
    if order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    expenses = query.offset(offset).limit(limit).all()
    
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

@app.get("/stats/largest")
def largest_expense(db: Session = Depends(get_db)):
    expense = (
        db.query(Expense)
        .order_by(desc(Expense.amount))
        .first()
    )
    if not expense:
        return {"message": "Brak wydatków"}
    
    return expense

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

@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    
    monthly = db.query(
        func.sum(Expense.amount).label("total_spent"),
        func.count(Expense.id).label("expenses_count"),
        func.avg(Expense.amount).label("average_expense"),
    ).first()

    largest = (
        db.query(Expense)
        .order_by(desc(Expense.amount))
        .first()
    )

    budget = db.query(Budget).filter(Budget.user_id == 1).first()

    total_spent = monthly.total_spent or 0
    
    remaining = 0
    exceeded = False

    if budget:
        remaining = budget.monthly_limit - total_spent
        exceeded = total_spent > budget.monthly_limit

    categories = (
        db.query(
            Category.name,
            func.sum(Expense.amount).label("total")
        )
        .join(Expense, Expense.category_id == Category.id)
        .group_by(Category.name)
        .all()
    )

    return {
        "monthly_stats": {
            "total_spent": total_spent,
            "expenses_count": monthly.expenses_count or 0,
            "average_expense": monthly.average_expense or 0,
        },

        "budget_status": {
            "monthly_limit": budget.monthly_limit if budget else 0,
            "remaining": remaining,
            "exceeded": exceeded
        },

        "largest_expense": largest,

        "category_stats": categories
    }

@app.get("/expenses/recent")
def recent_expenses(db: Session = Depends(get_db)):
    expenses = (
        db.query(Expense)
        .order_by(desc(Expense.id))
        .limit(5)
        .all()
    )

    return expenses
