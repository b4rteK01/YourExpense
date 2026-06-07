from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

#response
  
class UserResponse(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True

class ExpenseResponse(BaseModel):
    id: int
    amount: float
    description: str
    date: datetime
    user_id: int
    category_id: int

    class Config:
        from_attributes = True

class IncomeResponse(BaseModel):
    id: int
    amount: float
    description: str
    date: datetime
    user_id: int

    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    id: int
    name: str
    user_id: int

    class Config:
        from_attributes = True

class BudgetResponse(BaseModel):
    id: int
    monthly_limit: float
    user_id: int

    class Config:
        from_attributes = True

#create

class ExpenseCreate(BaseModel):
    amount: float = Field(gt=0)
    description: str
    category_id: int

class IncomeCreate(BaseModel):
    amount: float = Field(gt=0)
    description: str

class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)

class BudgetCreate(BaseModel):
    monthly_limit: float = Field(gt=0)

#update

class ExpenseUpdate(BaseModel):
    amount: float = Field(gt=0)
    description: str