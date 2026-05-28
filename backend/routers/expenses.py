from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from database import SessionLocal
from models import Expense, User
from schemas import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate
)

from .security import (
    get_current_user,
    get_db
)
router = APIRouter()

#POST /expenses
#GET /expenses
#PUT /expenses/{expense_id}
#DELETE /expenses/{expense_id}
#GET /expenses/recent

@router.post("/expenses", response_model=ExpenseResponse)
def add_expense(
    expense_data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    expense = Expense(
    amount=expense_data.amount,
    description=expense_data.description,
    user_id=current_user.id,
    category_id=expense_data.category_id
)
    
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense

@router.get("/expenses")
def get_expenses(
    category_id: int = None, 
    start_date: str = None,
    end_date: str = None,
    search: str = None,
    limit: int = 10,
    offset: int = 0,
    sort_by: str = "id",
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    query = db.query(Expense).filter(
        Expense.user_id == current_user.id
    )

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

    total = query.count()

    expenses = query.offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": expenses
    }

@router.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id
    ).first()
    
    if not expense:
        raise HTTPException(
        status_code=404,
        detail="Nie znaleziono"
    )
    
    db.delete(expense)
    db.commit()
    
    return {"message": "Usunięto"}

@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)    
):
    
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id  == current_user.id      
).first()
    
    if not expense:
        raise HTTPException(
        status_code=404,
        detail="Nie znaleziono"
    )
    
    expense.amount = expense_data.amount
    expense.description = expense_data.description
    
    db.commit()
    db.refresh(expense)
    
    return expense

@router.get("/expenses/recent", response_model=list[ExpenseResponse])
def recent_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    expenses = (
        db.query(Expense).filter(
            Expense.user_id == current_user.id
        )
        .order_by(desc(Expense.id))
        .limit(5)
        .all()
    )

    return expenses
