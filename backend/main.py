from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, SessionLocal
from models import Base, User
from schemas import UserResponse

from routers.auth import router as auth_router
from routers.security import get_current_user
from routers.expenses import router as expenses_router
from routers.categories import router as categories_router
from routers.budget import router as budget_router
from routers.dashboard import router as dashboard_router
from routers.incomes import router as incomes_router
from routers.transactions import router as transactions_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:15500",
        "http://localhost:15500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@app.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

app.include_router(auth_router)
app.include_router(expenses_router)
app.include_router(categories_router)
app.include_router(budget_router)
app.include_router(dashboard_router)
app.include_router(incomes_router)
app.include_router(transactions_router)
