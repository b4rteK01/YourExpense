from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Budget, Category, Expense, Income, User
from schemas import UserCreate, UserLogin, UserPasswordUpdate
from .security import (
    pwd_context,
    create_access_token,
    get_current_user,
    get_db
)

router = APIRouter()

#POST /register
#POST /login

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Użytkownik już istnieje"
        )

    hashed_password = pwd_context.hash(user.password)

    user = User(
        email=user.email,
        password=hashed_password
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Użytkownik utworzony",
        "user_id": user.id
    }

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Nieprawidłowe dane"
        )

    valid_password = pwd_context.verify(
        user.password,
        existing_user.password
    )

    if not valid_password:
        raise HTTPException(
            status_code=401,
            detail="Nieprawidłowe dane"
        )

    access_token = create_access_token(
        data={"sub": existing_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.patch("/me/password")
def change_password(
    password_data: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.password = pwd_context.hash(password_data.new_password)
    db.commit()

    return {
        "message": "Haslo zmienione"
    }

@router.delete("/me")
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Expense).filter(Expense.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.query(Income).filter(Income.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.query(Budget).filter(Budget.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.query(Category).filter(Category.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.delete(current_user)
    db.commit()

    return {
        "message": "Konto usuniete"
    }
