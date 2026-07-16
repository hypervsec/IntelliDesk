from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import find_similar_tickets


router = APIRouter(
    prefix="/tickets",
    tags=["Tickets"],
)


@router.get(
    "",
    response_model=list[schemas.TicketResponse],
)
def list_tickets(
    db: Session = Depends(get_db),
):
    query = (
        select(models.Ticket)
        .order_by(models.Ticket.created_at.desc())
    )

    return db.scalars(query).all()


@router.post(
    "",
    response_model=schemas.TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ticket(
    ticket_data: schemas.TicketCreate,
    db: Session = Depends(get_db),
):
    ticket = models.Ticket(
        title=ticket_data.title,
        description=ticket_data.description,
        requester_name=ticket_data.requester_name,
        department=ticket_data.department,
        category=ticket_data.category,
        subcategory=ticket_data.subcategory,
        priority=ticket_data.priority,
        status="open",
    )

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return ticket


@router.get(
    "/ai-feedback/stats",
    response_model=schemas.FeedbackStatsResponse,
)
def get_feedback_stats(
    db: Session = Depends(get_db),
):
    query = select(
        func.count(models.Ticket.ticket_id)
        .filter(
            models.Ticket.ai_feedback.is_not(None)
        )
        .label("total_feedback"),

        func.sum(
            case(
                (
                    models.Ticket.ai_feedback == "accepted",
                    1,
                ),
                else_=0,
            )
        ).label("accepted_count"),

        func.sum(
            case(
                (
                    models.Ticket.ai_feedback == "rejected",
                    1,
                ),
                else_=0,
            )
        ).label("rejected_count"),
    )

    result = db.execute(query).one()

    total_feedback = int(
        result.total_feedback or 0
    )

    accepted_count = int(
        result.accepted_count or 0
    )

    rejected_count = int(
        result.rejected_count or 0
    )

    if total_feedback == 0:
        acceptance_rate = 0.0
    else:
        acceptance_rate = round(
            accepted_count / total_feedback * 100,
            2,
        )

    return {
        "total_feedback": total_feedback,
        "accepted_count": accepted_count,
        "rejected_count": rejected_count,
        "acceptance_rate": acceptance_rate,
    }


@router.get(
    "/dashboard/summary",
    response_model=schemas.DashboardSummaryResponse,
)
def get_dashboard_summary(
    db: Session = Depends(get_db),
):
    query = select(
        func.count(
            models.Ticket.ticket_id
        ).label("total_tickets"),

        func.sum(
            case(
                (
                    models.Ticket.status == "open",
                    1,
                ),
                else_=0,
            )
        ).label("open_tickets"),

        func.sum(
            case(
                (
                    models.Ticket.status == "resolved",
                    1,
                ),
                else_=0,
            )
        ).label("resolved_tickets"),

        func.sum(
            case(
                (
                    models.Ticket.status == "closed",
                    1,
                ),
                else_=0,
            )
        ).label("closed_tickets"),

        func.count(
            models.Ticket.ticket_id
        ).filter(
            models.Ticket.ai_recommendation.is_not(None)
        ).label("ai_recommendation_count"),

        func.avg(
            models.Ticket.ai_confidence_score
        ).label("average_ai_confidence"),
    )

    result = db.execute(query).one()

    total_tickets = int(
        result.total_tickets or 0
    )

    open_tickets = int(
        result.open_tickets or 0
    )

    resolved_tickets = int(
        result.resolved_tickets or 0
    )

    closed_tickets = int(
        result.closed_tickets or 0
    )

    ai_recommendation_count = int(
        result.ai_recommendation_count or 0
    )

    average_ai_confidence = round(
        float(result.average_ai_confidence or 0),
        4,
    )

    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "resolved_tickets": resolved_tickets,
        "closed_tickets": closed_tickets,
        "ai_recommendation_count": ai_recommendation_count,
        "average_ai_confidence": average_ai_confidence,
    }
@router.get(
    "/dashboard/categories",
    response_model=list[schemas.CategoryStatsItem],
)
def get_category_stats(
    db: Session = Depends(get_db),
):
    query = (
        select(
            func.coalesce(
                models.Ticket.category,
                "Belirtilmemiş",
            ).label("category"),
            func.count(
                models.Ticket.ticket_id
            ).label("ticket_count"),
        )
        .group_by(
            func.coalesce(
                models.Ticket.category,
                "Belirtilmemiş",
            )
        )
        .order_by(
            func.count(
                models.Ticket.ticket_id
            ).desc()
        )
    )

    results = db.execute(query).all()

    return [
        {
            "category": row.category,
            "ticket_count": int(row.ticket_count),
        }
        for row in results
    ]
@router.get(
    "/dashboard/statuses",
    response_model=list[schemas.StatusStatsItem],
)
def get_status_stats(
    db: Session = Depends(get_db),
):
    query = (
        select(
            models.Ticket.status.label("status"),
            func.count(
                models.Ticket.ticket_id
            ).label("ticket_count"),
        )
        .group_by(
            models.Ticket.status
        )
        .order_by(
            func.count(
                models.Ticket.ticket_id
            ).desc()
        )
    )

    results = db.execute(query).all()

    return [
        {
            "status": row.status,
            "ticket_count": int(row.ticket_count),
        }
        for row in results
    ]

@router.get(
    "/dashboard/priorities",
    response_model=list[schemas.PriorityStatsItem],
)
def get_priority_stats(
    db: Session = Depends(get_db),
):
    query = (
        select(
            models.Ticket.priority.label("priority"),
            func.count(
                models.Ticket.ticket_id
            ).label("ticket_count"),
        )
        .group_by(
            models.Ticket.priority
        )
        .order_by(
            func.count(
                models.Ticket.ticket_id
            ).desc()
        )
    )

    results = db.execute(query).all()

    return [
        {
            "priority": row.priority,
            "ticket_count": int(row.ticket_count),
        }
        for row in results
    ]
@router.get(
    "/dashboard/daily",
    response_model=list[schemas.DailyTicketStatsItem],
)
def get_daily_ticket_stats(
    db: Session = Depends(get_db),
):
    start_date = datetime.now().date() - timedelta(days=6)

    query = (
        select(
            func.date(
                models.Ticket.created_at
            ).label("ticket_date"),
            func.count(
                models.Ticket.ticket_id
            ).label("ticket_count"),
        )
        .where(
            models.Ticket.created_at >= start_date
        )
        .group_by(
            func.date(models.Ticket.created_at)
        )
        .order_by(
            func.date(models.Ticket.created_at)
        )
    )

    results = db.execute(query).all()

    counts_by_date = {
        row.ticket_date: int(row.ticket_count)
        for row in results
    }

    return [
        {
            "date": (
                start_date + timedelta(days=day)
            ).isoformat(),
            "ticket_count": counts_by_date.get(
                start_date + timedelta(days=day),
                0,
            ),
        }
        for day in range(7)
    ]
@router.get(
    "/dashboard/departments",
    response_model=list[schemas.DepartmentStatsItem],
)
def get_department_stats(
    db: Session = Depends(get_db),
):
    department_value = func.coalesce(
        models.Ticket.department,
        "Belirtilmemiş",
    )

    query = (
        select(
            department_value.label("department"),
            func.count(
                models.Ticket.ticket_id
            ).label("ticket_count"),
        )
        .group_by(department_value)
        .order_by(
            func.count(
                models.Ticket.ticket_id
            ).desc()
        )
    )

    results = db.execute(query).all()

    return [
        {
            "department": row.department,
            "ticket_count": int(row.ticket_count),
        }
        for row in results
    ]
           
@router.get(
    "/{ticket_id}",
    response_model=schemas.TicketResponse,
)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
):
    ticket = db.get(
        models.Ticket,
        ticket_id,
    )

    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket bulunamadı.",
        )

    return ticket


@router.put(
    "/{ticket_id}",
    response_model=schemas.TicketResponse,
)
def update_ticket(
    ticket_id: int,
    ticket_data: schemas.TicketUpdate,
    db: Session = Depends(get_db),
):
    ticket = db.get(
        models.Ticket,
        ticket_id,
    )

    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket bulunamadı.",
        )

    update_data = ticket_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(ticket, field, value)

    now = datetime.now()

    if ticket_data.status == "resolved":
        ticket.resolved_at = now

    elif ticket_data.status == "closed":
        ticket.closed_at = now

        if ticket.resolved_at is None:
            ticket.resolved_at = now

    ticket.updated_at = now

    db.commit()
    db.refresh(ticket)

    return ticket


@router.post(
    "/{ticket_id}/similar",
    response_model=list[schemas.SimilarTicketResponse],
)
def get_similar_tickets(
    ticket_id: int,
    db: Session = Depends(get_db),
):
    ticket = db.get(
        models.Ticket,
        ticket_id,
    )

    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket bulunamadı.",
        )

    query_text = (
        f"Konu: {ticket.title}\n"
        f"Açıklama: {ticket.description or ''}"
    )

    return find_similar_tickets(
        query_text=query_text,
        limit=5,
    )


@router.post(
    "/{ticket_id}/recommendation",
    response_model=schemas.RecommendationResponse,
)
def create_recommendation(
    ticket_id: int,
    db: Session = Depends(get_db),
):
    ticket = db.get(
        models.Ticket,
        ticket_id,
    )

    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket bulunamadı.",
        )

    query_text = (
        f"Konu: {ticket.title}\n"
        f"Açıklama: {ticket.description or ''}"
    )

    similar_tickets = find_similar_tickets(
        query_text=query_text,
        limit=5,
    )

    if not similar_tickets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benzer geçmiş ticket bulunamadı.",
        )

    best_match = similar_tickets[0]
    confidence_score = best_match["similarity"]

    if confidence_score < 0.60:
        recommendation = (
            "Yeterli güven seviyesinde benzer bir geçmiş kayıt "
            "bulunamadı.\n\n"
            "Bu ticketın IT personeli tarafından manuel olarak "
            "incelenmesi önerilir."
        )

        source_request_ids = []

    else:
        recommendation = (
            "Geçmiş kayıtlar incelendi.\n\n"
            f"En benzer geçmiş sorun: "
            f"{best_match['subject'] or 'Belirtilmemiş'}\n"
            f"Önerilen çözüm: "
            f"{best_match['resolution']}\n"
            f"Benzerlik oranı: "
            f"%{confidence_score * 100:.2f}"
        )

        source_request_ids = [
            item["request_id"]
            for item in similar_tickets
        ]

    ticket.ai_recommendation = recommendation
    ticket.ai_confidence_score = confidence_score

    # Yeni öneri oluşturulduğunda eski geri bildirim temizlenir.
    ticket.ai_feedback = None
    ticket.ai_feedback_note = None
    ticket.ai_feedback_at = None

    ticket.updated_at = datetime.now()

    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket.ticket_id,
        "recommendation": recommendation,
        "confidence_score": confidence_score,
        "source_request_ids": source_request_ids,
    }


@router.post(
    "/{ticket_id}/feedback",
    response_model=schemas.TicketFeedbackResponse,
)
def create_ticket_feedback(
    ticket_id: int,
    feedback_data: schemas.TicketFeedbackCreate,
    db: Session = Depends(get_db),
):
    ticket = db.get(
        models.Ticket,
        ticket_id,
    )

    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket bulunamadı.",
        )

    if ticket.ai_recommendation is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu ticket için henüz AI önerisi oluşturulmamış.",
        )

    feedback_time = datetime.now()

    ticket.ai_feedback = feedback_data.feedback
    ticket.ai_feedback_note = feedback_data.note
    ticket.ai_feedback_at = feedback_time
    ticket.updated_at = feedback_time

    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket.ticket_id,
        "feedback": ticket.ai_feedback,
        "note": ticket.ai_feedback_note,
        "feedback_at": ticket.ai_feedback_at,
    }