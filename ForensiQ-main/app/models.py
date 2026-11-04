from app import db
from datetime import datetime


class Investigation(db.Model):
    __tablename__ = "investigations"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), default="Active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    assets = db.relationship(
        "Asset", backref="investigation", cascade="all, delete-orphan"
    )
    links = db.relationship(
        "Link", backref="investigation", cascade="all, delete-orphan"
    )
    evidence = db.relationship(
        "Evidence", backref="investigation", cascade="all, delete-orphan"
    )
    analysts = db.relationship(
        "Analyst", backref="investigation", cascade="all, delete-orphan"
    )


class Asset(db.Model):
    __tablename__ = "assets"

    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(
        db.Integer, db.ForeignKey("investigations.id"), nullable=False
    )

    asset_id = db.Column(db.String(30), nullable=False)
    asset_name = db.Column(db.String(150), nullable=False)
    asset_type = db.Column(db.String(80), nullable=False)
    importance_score = db.Column(db.Integer, nullable=False)
    is_root = db.Column(db.Boolean, default=False)

    __table_args__ = (
        db.UniqueConstraint(
            "investigation_id", "asset_id", name="unique_asset_per_investigation"
        ),
    )


class Link(db.Model):
    __tablename__ = "links"

    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(
        db.Integer, db.ForeignKey("investigations.id"), nullable=False
    )

    link_id = db.Column(db.String(30), nullable=False)
    source_asset_id = db.Column(db.String(30), nullable=False)
    target_asset_id = db.Column(db.String(30), nullable=False)
    cost = db.Column(db.Float, nullable=False)
    is_accessible = db.Column(db.Boolean, default=True)

    __table_args__ = (
        db.UniqueConstraint(
            "investigation_id", "link_id", name="unique_link_per_investigation"
        ),
    )


class Evidence(db.Model):
    __tablename__ = "evidence"

    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(
        db.Integer, db.ForeignKey("investigations.id"), nullable=False
    )

    evidence_id = db.Column(db.String(30), nullable=False)
    asset_id = db.Column(db.String(30), nullable=False)
    description = db.Column(db.Text, nullable=False)
    examination_hours = db.Column(db.Integer, nullable=False)
    estimated_value = db.Column(db.Float, nullable=False)

    __table_args__ = (
        db.UniqueConstraint(
            "investigation_id",
            "evidence_id",
            name="unique_evidence_per_investigation",
        ),
    )


class Analyst(db.Model):
    __tablename__ = "analysts"

    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(
        db.Integer, db.ForeignKey("investigations.id"), nullable=False
    )

    analyst_id = db.Column(db.String(30), nullable=False)
    analyst_name = db.Column(db.String(120), nullable=False)
    capacity_hours = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.UniqueConstraint(
            "investigation_id",
            "analyst_id",
            name="unique_analyst_per_investigation",
        ),
    )