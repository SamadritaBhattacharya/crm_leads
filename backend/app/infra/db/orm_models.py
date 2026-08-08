"""SQLAlchemy 2.0 declarative models — mirrors the DDL in Tech Spec §3
exactly. Schema changes happen via Alembic only (Engineering Rules §4);
these classes describe the schema for querying, they don't create it
(`Base.metadata.create_all()` is never called against a real database).
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import BigInteger, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.domain.models import AdminRole, Company, LeadSource, LeadStatus, SurveyType


class Base(DeclarativeBase):
    pass


# create_type=False: the enum types are created by the Alembic migration
# (CREATE TYPE ...), not by SQLAlchemy metadata — see alembic/versions.
LeadSourceEnum = PGEnum(
    LeadSource,
    name="lead_source",
    create_type=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
)
LeadStatusEnum = PGEnum(
    LeadStatus,
    name="lead_status",
    create_type=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
)
CompanyEnum = PGEnum(
    Company,
    name="company",
    create_type=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
)
SurveyTypeEnum = PGEnum(
    SurveyType,
    name="survey_type",
    create_type=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
)


class LeadORM(Base):
    __tablename__ = "leads"
    __table_args__ = (
        Index("idx_leads_status", "status"),
        Index("idx_leads_email", "email"),
        Index("idx_leads_created_at", "created_at"),
        Index("idx_leads_source", "source"),
        Index("idx_leads_assigned_to", "assigned_to"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    source: Mapped[LeadSource] = mapped_column(LeadSourceEnum, nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    property_address: Mapped[str | None] = mapped_column(Text)
    property_type: Mapped[str | None] = mapped_column(String(100))
    purpose: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[LeadStatus] = mapped_column(
        LeadStatusEnum, nullable=False, server_default=LeadStatus.new.value
    )
    assigned_to: Mapped[str | None] = mapped_column(String(100))
    page_url: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    # Additive per Engineering Rules §1 (OCP) — see alembic/versions/0004_*.
    company: Mapped[Company | None] = mapped_column(CompanyEnum)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    date_of_valuation: Mapped[date | None] = mapped_column()
    file_no: Mapped[str | None] = mapped_column(String(100))
    survey_type: Mapped[SurveyType | None] = mapped_column(SurveyTypeEnum)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    # Maintained by a Postgres trigger (trg_leads_updated_at), not application code
    # (Engineering Rules §4) — SQLAlchemy never assigns this column on UPDATE.
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    notes: Mapped[list["LeadNoteORM"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )


class LeadNoteORM(Base):
    __tablename__ = "lead_notes"
    __table_args__ = (Index("idx_lead_notes_lead_id", "lead_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
    )
    author: Mapped[str] = mapped_column(String(100), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    lead: Mapped[LeadORM] = relationship(back_populates="notes")


class AdminUserORM(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default=AdminRole.staff.value)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, server_default="")
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
