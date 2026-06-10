from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from models import Expense, Income, Category, User
from .security import get_current_user, get_db

router = APIRouter()


@router.get("/transactions")
def get_transactions(
    transaction_type: str = None,   # "expense" | "income" | None = wszystkie
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
    results = []

    # ── Wydatki ──────────────────────────────────────────────
    if transaction_type in (None, "", "expense"):
        q = db.query(Expense).filter(Expense.user_id == current_user.id)

        if category_id:
            q = q.filter(Expense.category_id == category_id)
        if start_date:
            q = q.filter(Expense.date >= start_date)
        if end_date:
            q = q.filter(Expense.date <= end_date)
        if search:
            q = q.filter(Expense.description.contains(search))
        if amount_min is not None:
            q = q.filter(Expense.amount >= amount_min)
        if amount_max is not None:
            q = q.filter(Expense.amount <= amount_max)

        for exp in q.all():
            cat = db.query(Category).filter(Category.id == exp.category_id).first()
            results.append({
                "id": exp.id,
                "type": "expense",
                "amount": exp.amount,
                "description": exp.description,
                "date": exp.date.isoformat() if exp.date else None,
                "category_id": exp.category_id,
                "category_name": cat.name if cat else "Brak kategorii",
                "user_id": exp.user_id,
            })

    # ── Dochody ──────────────────────────────────────────────
    if transaction_type in (None, "", "income"):
        q = db.query(Income).filter(Income.user_id == current_user.id)

        if start_date:
            q = q.filter(Income.date >= start_date)
        if end_date:
            q = q.filter(Income.date <= end_date)
        if search:
            q = q.filter(Income.description.contains(search))
        if amount_min is not None:
            q = q.filter(Income.amount >= amount_min)
        if amount_max is not None:
            q = q.filter(Income.amount <= amount_max)

        for inc in q.all():
            results.append({
                "id": inc.id,
                "type": "income",
                "amount": inc.amount,
                "description": inc.description,
                "date": inc.date.isoformat() if inc.date else None,
                "category_id": None,
                "category_name": "Dochód",
                "user_id": inc.user_id,
            })

    # ── Sortowanie ────────────────────────────────────────────
    reverse = (order == "desc")
    if sort_by == "amount":
        results.sort(key=lambda x: x["amount"], reverse=reverse)
    else:  # domyślnie date
        results.sort(key=lambda x: (x["date"] or ""), reverse=reverse)

    total = len(results)
    page_items = results[offset: offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": page_items,
    }
