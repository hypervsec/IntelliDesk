from __future__ import annotations

import math
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    Query,
)
from pydantic import BaseModel
from sqlalchemy import (
    case,
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db


SortType = Literal[
    "newest",
    "oldest",
    "priority_high",
    "priority_low",
]


router = APIRouter(
    prefix="/tickets",
    tags=["Ticket Pagination"],
)


class PaginatedTicketResponse(BaseModel):
    items: list[schemas.TicketResponse]
    total_items: int
    total_pages: int
    current_page: int
    page_size: int


class TicketFilterOptionsResponse(BaseModel):
    categories: list[str]
    departments: list[str]


class TicketFormOptionsResponse(BaseModel):
    departments: list[str]
    categories: list[str]
    subcategories: list[str]


def apply_common_filters(
    query,
    search: str | None,
    ticket_status: schemas.StatusType | None,
    priority: schemas.PriorityType | None,
):
    if search and search.strip():
        search_term = f"%{search.strip()}%"

        query = query.where(
            or_(
                models.Ticket.title.ilike(
                    search_term
                ),
                models.Ticket.description.ilike(
                    search_term
                ),
                models.Ticket.requester_name.ilike(
                    search_term
                ),
                models.Ticket.department.ilike(
                    search_term
                ),
                models.Ticket.category.ilike(
                    search_term
                ),
                models.Ticket.subcategory.ilike(
                    search_term
                ),
                models.Ticket.assigned_technician.ilike(
                    search_term
                ),
                models.Ticket.resolution.ilike(
                    search_term
                ),
            )
        )

    if ticket_status:
        query = query.where(
            models.Ticket.status
            == ticket_status
        )

    if priority:
        query = query.where(
            models.Ticket.priority
            == priority
        )

    return query


def apply_ticket_filters(
    query,
    search: str | None,
    ticket_status: schemas.StatusType | None,
    priority: schemas.PriorityType | None,
    category: str | None,
    department: str | None,
):
    query = apply_common_filters(
        query=query,
        search=search,
        ticket_status=ticket_status,
        priority=priority,
    )

    if category and category.strip():
        query = query.where(
            func.trim(
                models.Ticket.category
            )
            == category.strip()
        )

    if department and department.strip():
        query = query.where(
            func.trim(
                models.Ticket.department
            )
            == department.strip()
        )

    return query


def apply_ticket_sorting(
    query,
    sort: SortType,
):
    priority_order = case(
        (
            models.Ticket.priority
            == "critical",
            4,
        ),
        (
            models.Ticket.priority
            == "high",
            3,
        ),
        (
            models.Ticket.priority
            == "medium",
            2,
        ),
        (
            models.Ticket.priority
            == "low",
            1,
        ),
        else_=0,
    )

    if sort == "oldest":
        return query.order_by(
            models.Ticket.created_at.asc(),
            models.Ticket.ticket_id.asc(),
        )

    if sort == "priority_high":
        return query.order_by(
            priority_order.desc(),
            models.Ticket.created_at.desc(),
            models.Ticket.ticket_id.desc(),
        )

    if sort == "priority_low":
        return query.order_by(
            priority_order.asc(),
            models.Ticket.created_at.desc(),
            models.Ticket.ticket_id.desc(),
        )

    return query.order_by(
        models.Ticket.created_at.desc(),
        models.Ticket.ticket_id.desc(),
    )


def clean_option_values(
    values: list[str | None],
) -> list[str]:
    cleaned_values = []
    seen_values = set()

    for value in values:
        if not value:
            continue

        cleaned_value = value.strip()

        if not cleaned_value:
            continue

        normalized_value = (
            cleaned_value.casefold()
        )

        if normalized_value in seen_values:
            continue

        seen_values.add(normalized_value)
        cleaned_values.append(cleaned_value)

    return sorted(
        cleaned_values,
        key=lambda item: item.casefold(),
    )


@router.get(
    "/form-options",
    response_model=TicketFormOptionsResponse,
)
def get_ticket_form_options(
    department: str | None = Query(
        default=None,
        max_length=150,
    ),
    category: str | None = Query(
        default=None,
        max_length=150,
    ),
    db: Session = Depends(get_db),
):
    department_query = (
        select(models.Ticket.department)
        .where(
            models.Ticket.department.is_not(
                None
            )
        )
        .where(
            func.trim(
                models.Ticket.department
            )
            != ""
        )
        .distinct()
    )

    departments = clean_option_values(
        list(
            db.scalars(
                department_query
            ).all()
        )
    )

    category_query = (
        select(models.Ticket.category)
        .where(
            models.Ticket.category.is_not(
                None
            )
        )
        .where(
            func.trim(
                models.Ticket.category
            )
            != ""
        )
    )

    if department and department.strip():
        category_query = (
            category_query.where(
                func.trim(
                    models.Ticket.department
                )
                == department.strip()
            )
        )

    category_query = (
        category_query.distinct()
    )

    categories = clean_option_values(
        list(
            db.scalars(
                category_query
            ).all()
        )
    )

    subcategory_query = (
        select(models.Ticket.subcategory)
        .where(
            models.Ticket.subcategory.is_not(
                None
            )
        )
        .where(
            func.trim(
                models.Ticket.subcategory
            )
            != ""
        )
    )

    if department and department.strip():
        subcategory_query = (
            subcategory_query.where(
                func.trim(
                    models.Ticket.department
                )
                == department.strip()
            )
        )

    if category and category.strip():
        subcategory_query = (
            subcategory_query.where(
                func.trim(
                    models.Ticket.category
                )
                == category.strip()
            )
        )

    subcategory_query = (
        subcategory_query.distinct()
    )

    subcategories = clean_option_values(
        list(
            db.scalars(
                subcategory_query
            ).all()
        )
    )

    return {
        "departments": departments,
        "categories": categories,
        "subcategories": subcategories,
    }


@router.get(
    "/filter-options",
    response_model=TicketFilterOptionsResponse,
)
def get_ticket_filter_options(
    search: str | None = Query(
        default=None,
        max_length=200,
    ),
    ticket_status:
        schemas.StatusType | None = Query(
            default=None,
            alias="status",
        ),
    priority:
        schemas.PriorityType | None = Query(
            default=None,
        ),
    category: str | None = Query(
        default=None,
        max_length=150,
    ),
    department: str | None = Query(
        default=None,
        max_length=150,
    ),
    db: Session = Depends(get_db),
):
    category_query = (
        select(models.Ticket.category)
        .where(
            models.Ticket.category.is_not(
                None
            )
        )
        .where(
            func.trim(
                models.Ticket.category
            )
            != ""
        )
    )

    category_query = apply_common_filters(
        query=category_query,
        search=search,
        ticket_status=ticket_status,
        priority=priority,
    )

    if department and department.strip():
        category_query = (
            category_query.where(
                func.trim(
                    models.Ticket.department
                )
                == department.strip()
            )
        )

    category_query = (
        category_query.distinct()
    )

    department_query = (
        select(models.Ticket.department)
        .where(
            models.Ticket.department.is_not(
                None
            )
        )
        .where(
            func.trim(
                models.Ticket.department
            )
            != ""
        )
    )

    department_query = apply_common_filters(
        query=department_query,
        search=search,
        ticket_status=ticket_status,
        priority=priority,
    )

    if category and category.strip():
        department_query = (
            department_query.where(
                func.trim(
                    models.Ticket.category
                )
                == category.strip()
            )
        )

    department_query = (
        department_query.distinct()
    )

    categories = clean_option_values(
        list(
            db.scalars(
                category_query
            ).all()
        )
    )

    departments = clean_option_values(
        list(
            db.scalars(
                department_query
            ).all()
        )
    )

    return {
        "categories": categories,
        "departments": departments,
    }


@router.get(
    "/paged",
    response_model=PaginatedTicketResponse,
)
def list_paginated_tickets(
    search: str | None = Query(
        default=None,
        max_length=200,
    ),
    ticket_status:
        schemas.StatusType | None = Query(
            default=None,
            alias="status",
        ),
    priority:
        schemas.PriorityType | None = Query(
            default=None,
        ),
    category: str | None = Query(
        default=None,
        max_length=150,
    ),
    department: str | None = Query(
        default=None,
        max_length=150,
    ),
    sort: SortType = Query(
        default="newest",
    ),
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
):
    count_query = select(
        func.count(
            models.Ticket.ticket_id
        )
    )

    count_query = apply_ticket_filters(
        query=count_query,
        search=search,
        ticket_status=ticket_status,
        priority=priority,
        category=category,
        department=department,
    )

    total_items = int(
        db.scalar(count_query) or 0
    )

    total_pages = max(
        1,
        math.ceil(
            total_items / page_size
        ),
    )

    safe_page = min(
        page,
        total_pages,
    )

    offset = (
        safe_page - 1
    ) * page_size

    ticket_query = select(
        models.Ticket
    )

    ticket_query = apply_ticket_filters(
        query=ticket_query,
        search=search,
        ticket_status=ticket_status,
        priority=priority,
        category=category,
        department=department,
    )

    ticket_query = apply_ticket_sorting(
        query=ticket_query,
        sort=sort,
    )

    ticket_query = (
        ticket_query
        .offset(offset)
        .limit(page_size)
    )

    tickets = list(
        db.scalars(
            ticket_query
        ).all()
    )

    return {
        "items": tickets,
        "total_items": total_items,
        "total_pages": total_pages,
        "current_page": safe_page,
        "page_size": page_size,
    }