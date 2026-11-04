"""
Seed Sample Case Utility for ForensiQ
Populates the local SQLite database with the standard benchmark dataset from data/*.csv.
Useful for testing the dashboard, network explorer, and algorithm analysis engines.
"""

from app import create_app, db
from app.models import Investigation, Asset, Link, Evidence, Analyst
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


def seed_sample_case():
    app = create_app()

    with app.app_context():
        # Check if sample case already exists
        existing = Investigation.query.filter_by(name="Operation Starlight - Financial Breach").first()
        if existing:
            print(f"Sample investigation already exists (ID: {existing.id}). Skipping.")
            return existing.id

        print("Creating sample investigation: 'Operation Starlight - Financial Breach'...")
        inv = Investigation(
            name="Operation Starlight - Financial Breach",
            description="Corporate server compromise involving suspect laptops, mobile exfiltration, and cloud accounts.",
            status="Active"
        )
        db.session.add(inv)
        db.session.commit()
        inv_id = inv.id
        print(f"Investigation created with ID: {inv_id}")

        # 1. Assets
        assets_csv = pd.read_csv(DATA_DIR / "assets.csv")
        # Ensure root asset is inserted first to satisfy business rule
        assets_csv = assets_csv.sort_values(by="is_root", ascending=False)
        for _, row in assets_csv.iterrows():
            asset = Asset(
                investigation_id=inv_id,
                asset_id=str(row["asset_id"]).strip(),
                asset_name=str(row["asset_name"]).strip(),
                asset_type=str(row["asset_type"]).strip(),
                importance_score=int(row["importance_score"]),
                is_root=bool(row["is_root"])
            )
            db.session.add(asset)
        db.session.commit()
        print(f"Added {len(assets_csv)} assets.")

        # 2. Links
        links_csv = pd.read_csv(DATA_DIR / "links.csv")
        for _, row in links_csv.iterrows():
            link = Link(
                investigation_id=inv_id,
                link_id=str(row["link_id"]).strip(),
                source_asset_id=str(row["source_asset_id"]).strip(),
                target_asset_id=str(row["target_asset_id"]).strip(),
                cost=float(row["cost"]),
                is_accessible=bool(row["is_accessible"])
            )
            db.session.add(link)
        db.session.commit()
        print(f"Added {len(links_csv)} links.")

        # 3. Evidence
        evidence_csv = pd.read_csv(DATA_DIR / "evidence.csv")
        for _, row in evidence_csv.iterrows():
            ev = Evidence(
                investigation_id=inv_id,
                evidence_id=str(row["evidence_id"]).strip(),
                asset_id=str(row["asset_id"]).strip(),
                description=str(row["description"]).strip(),
                examination_hours=int(row["examination_hours"]),
                estimated_value=float(row["estimated_value"])
            )
            db.session.add(ev)
        db.session.commit()
        print(f"Added {len(evidence_csv)} evidence items.")

        # 4. Analysts
        analysts_csv = pd.read_csv(DATA_DIR / "analysts.csv")
        for _, row in analysts_csv.iterrows():
            an = Analyst(
                investigation_id=inv_id,
                analyst_id=str(row["analyst_id"]).strip(),
                analyst_name=str(row["analyst_name"]).strip(),
                capacity_hours=int(row["capacity_hours"])
            )
            db.session.add(an)
        db.session.commit()
        print(f"Added {len(analysts_csv)} analysts.")

        print(f"Sample case #{inv_id} seeded successfully!")
        return inv_id


if __name__ == "__main__":
    seed_sample_case()
