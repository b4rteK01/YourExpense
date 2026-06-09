from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from datetime import datetime, time

from database import SessionLocal
from models import Expense, Income, User
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

def parse_date_boundary(value: str, end_of_day: bool = False):
    if not value:
        return None

    if len(value) == 10:
        parsed_date = datetime.strptime(value, "%Y-%m-%d").date()
        parsed = datetime.combine(
            parsed_date,
            time.max if end_of_day else time.min
        )
        return parsed

    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S")

    return parsed

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
    if expense_data.date:
        expense.date = expense_data.date
    
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
    amount_min: float = None,
    amount_max: float = None,
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
        query = query.filter(Expense.date >= parse_date_boundary(start_date))

    if end_date:
        query = query.filter(Expense.date <= parse_date_boundary(end_date, True))

    if search:
        query = query.filter(Expense.description.contains(search))

    if amount_min is not None:
        query = query.filter(Expense.amount >= amount_min)

    if amount_max is not None:
        query = query.filter(Expense.amount <= amount_max)

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

@router.get("/transactions")
def get_transactions(
    transaction_type: str = None,
    category_id: int = None,
    start_date: str = None,
    end_date: str = None,
    search: str = None,
    amount_min: float = None,
    amount_max: float = None,
    limit: int = 10,
    offset: int = 0,
    sort_by: str = "date",
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start = parse_date_boundary(start_date) if start_date else None
    end = parse_date_boundary(end_date, True) if end_date else None
    transactions = []

    if transaction_type in (None, "", "expense"):
        expense_query = db.query(Expense).filter(Expense.user_id == current_user.id)

        if category_id:
            expense_query = expense_query.filter(Expense.category_id == category_id)

        if start:
            expense_query = expense_query.filter(Expense.date >= start)

        if end:
            expense_query = expense_query.filter(Expense.date <= end)

        if search:
            expense_query = expense_query.filter(Expense.description.contains(search))

        if amount_min is not None:
            expense_query = expense_query.filter(Expense.amount >= amount_min)

        if amount_max is not None:
            expense_query = expense_query.filter(Expense.amount <= amount_max)

        for expense in expense_query.all():
            transactions.append({
                "id": expense.id,
                "amount": expense.amount,
                "description": expense.description,
                "date": expense.date,
                "user_id": expense.user_id,
                "category_id": expense.category_id,
                "type": "expense"
            })

    if transaction_type in (None, "", "income") and not category_id:
        income_query = db.query(Income).filter(Income.user_id == current_user.id)

        if start:
            income_query = income_query.filter(Income.date >= start)

        if end:
            income_query = income_query.filter(Income.date <= end)

        if search:
            income_query = income_query.filter(Income.description.contains(search))

        if amount_min is not None:
            income_query = income_query.filter(Income.amount >= amount_min)

        if amount_max is not None:
            income_query = income_query.filter(Income.amount <= amount_max)

        for income in income_query.all():
            transactions.append({
                "id": income.id,
                "amount": income.amount,
                "description": income.description,
                "date": income.date,
                "user_id": income.user_id,
                "category_id": None,
                "type": "income"
            })

    sortable_fields = {
        "amount": "amount",
        "date": "date",
        "id": "id"
    }
    sort_field = sortable_fields.get(sort_by, "date")
    reverse = order != "asc"

    transactions.sort(
        key=lambda item: item[sort_field] if item[sort_field] is not None else 0,
        reverse=reverse
    )

    total = len(transactions)
    page_items = transactions[offset:offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": page_items
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
