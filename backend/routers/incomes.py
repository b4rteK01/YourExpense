from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import Income, User
from schemas import (
    IncomeCreate,
    IncomeResponse
)

from .security import (
    get_current_user,
    get_db
)

router = APIRouter()


@router.post("/incomes", response_model=IncomeResponse)
def add_income(
    income_data: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    income = Income(
        amount=income_data.amount,
        description=income_data.description,
        user_id=current_user.id
    )

    db.add(income)
    db.commit()
    db.refresh(income)

    return income


@router.get("/incomes")
def get_incomes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    incomes = (
        db.query(Income)
        .filter(Income.user_id == current_user.id)
        .order_by(desc(Income.id))
        .all()
    )

    return incomes


@router.delete("/incomes/{income_id}")
def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    income = db.query(Income).filter(
        Income.id == income_id,
        Income.user_id == current_user.id
    ).first()

    if not income:
        raise HTTPException(
            status_code=404,
            detail="Nie znaleziono"
        )

    db.delete(income)
    db.commit()

    return {"message": "Usunięto"}