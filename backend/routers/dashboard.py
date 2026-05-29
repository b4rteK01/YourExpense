from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import SessionLocal
from models import Expense, Budget, Category, User

from schemas import ExpenseResponse

from .security import (
    get_current_user,
    pwd_context,
    create_access_token,
    get_db
)

router = APIRouter()

#GET /dashboard
#GET /stats
#GET /stats/categories
#GET /stats/monthly
#GET /stats/largest
    
@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    monthly = db.query(
        func.sum(Expense.amount).label("total_spent"),
        func.count(Expense.id).label("expenses_count"),
        func.avg(Expense.amount).label("average_expense"),
    ).filter(
        Expense.user_id == current_user.id
    ).first()

    largest = (
        db.query(Expense)
        .filter(Expense.user_id == current_user.id)
        .order_by(desc(Expense.amount))
        .first()
    )

    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()

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
        .filter(Expense.user_id == current_user.id)
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

        "largest_expense": {
            "id": largest.id,
            "amount": largest.amount,
            "description": largest.description,
            "category_id": largest.category_id,
        } if largest else None,

        "category_stats": [
            {
                "category": category,
                "total": total
            }
            for category, total in categories
        ]
    }

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    stats = db.query(
    func.sum(Expense.amount).label("total"),
    func.count(Expense.id).label("count")
).filter(
    Expense.user_id == current_user.id
).first()

    return {
    "total": stats.total or 0,
    "count": stats.count or 0
}

@router.get("/stats/categories")
def category_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    stats = (
        db.query(
            Category.name,
            func.sum(Expense.amount).label("total")
        )
        .join(Expense, Expense.category_id == Category.id)
        .filter(Expense.user_id == current_user.id)
        .group_by(Category.name)
        .all()
    )

    return [
        {
            "category": row.name,
            "total": row.total
        }
        for row in stats
    ]

@router.get("/stats/monthly")
def monthly_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    stats = db.query(
        func.sum(Expense.amount).label("total_spent"),
        func.count(Expense.id).label("expenses_count"),
        func.avg(Expense.amount).label("average_expense")
    ).filter(
    Expense.user_id == current_user.id
    ).first()

    return {
        "total_spent": stats.total_spent or 0,
        "expenses_count": stats.expenses_count or 0,
        "average_expense": stats.average_expense or 0
    }

@router.get("/stats/largest", response_model=ExpenseResponse)
def largest_expense(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    expense = (
        db.query(Expense).filter(
                Expense.user_id == current_user.id
        )
        .order_by(desc(Expense.amount))
        .first()
    )
    if not expense:
        raise HTTPException(
        status_code=404,
        detail="Brak wydatków"
    )
    
    return expense