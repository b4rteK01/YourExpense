from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Category, User

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