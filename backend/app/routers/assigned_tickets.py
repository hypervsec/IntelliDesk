from __future__ import annotations

import math

from fastapi import (
    APIRouter,
    Depends,
    Query,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .auth import get_current_staff_account
from .ticket_pagination import (
    PaginatedTicketResponse,
    SortType,
    TicketFilterOptionsResponse,
    apply_common_filters,
    apply_ticket_filters,
    apply_ticket_sorting,
    clean_option_values,
)


router = APIRouter(
    prefix="/tickets/assigned-to-me",
    tags=["Assigned Tickets"],
)


def apply_assigned_technician_filter(
    query,
    technician_name: str,
):
    normalized_technician_name = (
        technician_name.strip().lower()
    )

    return query.where(
        func.lower(
            func.trim(
                models.Ticket.assigned_technician
            )
        )
        == normalized_technician_name
    )


@router.get(
    "/filter-options",
    response_model=TicketFilterOptionsResponse,
)
def get_assigned_ticket_filter_options(
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
    current_account: models.Account = Depends(
        get_current_staff_account
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

    category_query = (
        apply_assigned_technician_filter(
            query=category_query,
            technician_name=
                current_account.full_name,
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

    department_query = (
        apply_assigned_technician_filter(
            query=department_query,
            technician_name=
                current_account.full_name,
        )
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
def list_assigned_tickets(
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
    current_account: models.Account = Depends(
        get_current_staff_account
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

    count_query = (
        apply_assigned_technician_filter(
            query=count_query,
            technician_name=
                current_account.full_name,
        )
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

    ticket_query = (
        apply_assigned_technician_filter(
            query=ticket_query,
            technician_name=
                current_account.full_name,
        )
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