import pandas as pd
import pytest
from src.database_adapter import convert_to_dataframes
from src.simulation import simulate_link_failures


def test_empty_adapter_preserves_columns():
    assets, links, evidence, analysts = convert_to_dataframes([], [], [], [])
    assert "is_root" in assets.columns
    assert "is_accessible" in links.columns
    assert "asset_id" in evidence.columns
    assert "capacity_hours" in analysts.columns


def test_simulation_rejects_more_than_three_links():
    assets = pd.DataFrame([{"asset_id": "A", "importance_score": 2, "is_root": True}])
    links = pd.DataFrame(columns=["link_id", "source_asset_id", "target_asset_id", "cost", "is_accessible"])
    with pytest.raises(ValueError, match="one to three"):
        simulate_link_failures(assets, links, ["L1", "L2", "L3", "L4"])
