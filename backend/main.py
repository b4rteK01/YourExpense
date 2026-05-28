from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from schemas import UserCreate, UserLogin
from database import engine, SessionLocal
from datetime import datetime, timedelta, timezone
from models import Base, Expense, Category, Budget, User
from passlib.context import CryptContext
from jose import jwt, JWTError

app = FastAPI()

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    credentials_exception = HTTPException(
        status_code=401,
        detail="Nie można zweryfikować użytkownika"
    )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email = payload.get("sub")

        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise credentials_exception

    return user

@app.post("/expenses")
def add_expense(
    amount: float, 
    description: str,
    category_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    expense = Expense(
        amount=amount, 
        description=description, 
        user_id=current_user.id, 
        category_id=category_id)
    
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

@app.delete("/expenses/{expense_id}")
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
        return {"error": "Nie znaleziono"}
    
    db.delete(expense)
    db.commit()
    
    return {"message": "Usunięto"}

@app.put("/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    amount: float, 
    description: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)    
):
    
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id  == current_user.id      
).first()
    
    if not expense:
        return {"error": "Nie znaleziono"}
    
    expense.amount = amount
    expense.description = description
    
    db.commit()
    db.refresh(expense)
    
    return expense

@app.get("/expenses/recent")
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

@app.post("/categories")
def add_category(
    name: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)    
):
    
    category = Category(
        name=name, 
        user_id=current_user.id
    )
    
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return category

@app.get("/categories")
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    return db.query(Category).filter(
        Category.user_id == current_user.id
    ).all()

@app.get("/stats")
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

@app.get("/stats/categories")
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
    return stats

@app.get("/stats/monthly")
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

@app.get("/stats/largest")
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
        return {"message": "Brak wydatków"}
    
    return expense

@app.post("/budget")
def set_budget(
    monthly_limit: float, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()
    
    if budget:
        budget.monthly_limit = monthly_limit
    else:
        budget = Budget(
            monthly_limit=monthly_limit, 
            user_id=current_user.id
        )
        db.add(budget)
        
    db.commit()
    db.refresh(budget)
    return budget

@app.get("/budget/status")
def budget_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()

    if not budget:
        return {"error": "Brak budżetu"}

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

@app.get("/dashboard")
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

        "largest_expense": largest,

        "category_stats": categories
    }

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    
    existing_user = db.query(User).filter(User.email == user.email). first()
    if existing_user:
        return {"error": "Użytkownik już istnieje"}
    
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

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    
    existing_user = db.query(User).filter(User.email == user.email).first()
    
    if not existing_user:
        return {"error": "Nieprawidłowe dane"}

    valid_password = pwd_context.verify(
        user.password,
        existing_user.password
    )

    if not valid_password:
        return {"error": "Nieprawidłowe dane"}

    access_token = create_access_token(
        data={"sub": existing_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@app.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user