from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Category, Expense, User

from schemas import (
    CategoryCreate,
    CategoryResponse
)

from .security import (
    get_current_user,
    pwd_context,
    create_access_token,
    get_db
)

router = APIRouter()

#POST /categories
#GET /categories

@router.post("/categories", response_model=CategoryResponse)
def add_category(
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)    
):
    
    category = Category(
        name=category_data.name,
        user_id=current_user.id
    )
    
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return category

@router.get("/categories", response_model=list[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    return db.query(Category).filter(
        Category.user_id == current_user.id
    ).all()

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    category = (
        db.query(Category)
        .filter(
            Category.id == category_id,
            Category.user_id == current_user.id
        )
        .first()
    )

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Kategoria nie istnieje"
        )

    used_by_expense = db.query(Expense).filter(
        Expense.category_id == category_id,
        Expense.user_id == current_user.id
    ).first()

    if used_by_expense:
        raise HTTPException(
            status_code=400,
            detail="Nie mozna usunac kategorii przypisanej do wydatkow"
        )

    db.delete(category)
    db.commit()

    return {
        "message": "Kategoria usunięta"
    }
