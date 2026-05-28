from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Budget, Expense, User

from schemas import (
    BudgetCreate,
    BudgetResponse
)

from .security import (
    get_current_user,
    pwd_context,
    create_access_token,
    get_db
)

router = APIRouter()

#POST /budget
#GET /budget/status

@router.post("/budget", response_model=BudgetResponse)
def set_budget(
    budget_data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()
    
    if budget:
        budget.monthly_limit = budget_data.monthly_limit
    else:
        budget = Budget(
            monthly_limit=budget_data.monthly_limit, 
            user_id=current_user.id
        )
        db.add(budget)
        
    db.commit()
    db.refresh(budget)
    return budget

@router.get("/budget/status")
def budget_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()

    if not budget:
        raise HTTPException(
        status_code=404,
        detail="Brak budżetu"
    )

    expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id
    ).all()
    
    spent = sum(exp.amount for exp in expenses)
    
    remaining = budget.monthly_limit - spent
    
    exceeded = spent > budget.monthly_limit

    return {
        "monthly_limit": budget.monthly_limit,
        "spent": spent,
        "remaining": remaining,
        "exceeded": exceeded
    }