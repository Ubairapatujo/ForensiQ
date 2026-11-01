
import pandas as pd
from pathlib import Path


# Get the main project folder
BASE_DIR = Path(__file__).resolve().parent.parent

# Store the location of CSV files
DATA_DIR = BASE_DIR / "data"


def load_csv_files():
    """
    Load all four CSV files into memory.
    """

    try:
        assets = pd.read_csv(DATA_DIR / "assets.csv")
        links = pd.read_csv(DATA_DIR / "links.csv")
        analysts = pd.read_csv(DATA_DIR / "analysts.csv")
        evidence = pd.read_csv(DATA_DIR / "evidence.csv")

        print("All CSV files loaded successfully!")

        return assets, links, analysts, evidence

    except FileNotFoundError as error:
        raise FileNotFoundError(
            f"CSV file not found: {error.filename}"
        )


def validate_columns(data, required_columns, file_name):
    """
    Check that all required columns exist.
    """

    missing = set(required_columns) - set(data.columns)

    if missing:
        raise ValueError(
            f"{file_name} is missing columns: {missing}"
        )


def validate_data(assets, links, analysts, evidence):
    """
    Validate all input data before running algorithms.
    """

    # Required columns for each CSV file
    validate_columns(
        assets,
        ["asset_id", "asset_name", "asset_type",
         "importance_score", "is_root"],
        "assets.csv"
    )

    validate_columns(
        links,
        ["link_id", "source_asset_id", "target_asset_id",
         "cost", "is_accessible"],
        "links.csv"
    )

    validate_columns(
        analysts,
        ["analyst_id", "analyst_name", "capacity_hours"],
        "analysts.csv"
    )

    validate_columns(
        evidence,
        ["evidence_id", "asset_id", "description",
         "examination_hours", "estimated_value"],
        "evidence.csv"
    )

    # Check duplicate IDs
    if assets["asset_id"].duplicated().any():
        raise ValueError("Duplicate asset IDs found!")

    if links["link_id"].duplicated().any():
        raise ValueError("Duplicate link IDs found!")

    if analysts["analyst_id"].duplicated().any():
        raise ValueError("Duplicate analyst IDs found!")

    if evidence["evidence_id"].duplicated().any():
        raise ValueError("Duplicate evidence IDs found!")

    # Check that exactly one root asset exists
    if assets["is_root"].sum() != 1:
        raise ValueError("Exactly one root asset is required!")

    # Check importance scores
    if not assets["importance_score"].between(1, 10).all():
        raise ValueError("Importance scores must be between 1 and 10!")

    # Check link costs
    if (links["cost"] < 0).any():
        raise ValueError("Link costs cannot be negative!")

    # Check that links do not connect an asset to itself
    if (links["source_asset_id"] == links["target_asset_id"]).any():
        raise ValueError("Self-links are not allowed!")

    # Check that link references exist
    asset_ids = set(assets["asset_id"])

    if not set(links["source_asset_id"]).issubset(asset_ids):
        raise ValueError("Unknown source asset ID in links!")

    if not set(links["target_asset_id"]).issubset(asset_ids):
        raise ValueError("Unknown target asset ID in links!")

    # Check analyst capacities
    capacities = analysts["capacity_hours"]

    if not capacities.between(1, 16).all():
        raise ValueError("Analyst hours must be between 1 and 16!")

    if not capacities.is_unique:
        raise ValueError("Analyst capacities must be distinct!")

    if len(analysts) > 3:
        raise ValueError("Maximum three analysts are allowed!")

    # Check evidence references
    if not set(evidence["asset_id"]).issubset(asset_ids):
        raise ValueError("Unknown asset ID in evidence!")

    # Check examination hours
    if (evidence["examination_hours"] <= 0).any():
        raise ValueError("Examination hours must be positive!")

    if (evidence["examination_hours"] % 1 != 0).any():
        raise ValueError("Examination hours must be whole numbers!")

    # Check estimated evidence values
    if (evidence["estimated_value"] < 0).any():
        raise ValueError("Evidence values cannot be negative!")

    print("All data validation checks passed!")

    return True


def prepare_data():
    """
    Load CSV files and validate them.
    """

    assets, links, analysts, evidence = load_csv_files()

    validate_data(assets, links, analysts, evidence)

    return assets, links, analysts, evidence
