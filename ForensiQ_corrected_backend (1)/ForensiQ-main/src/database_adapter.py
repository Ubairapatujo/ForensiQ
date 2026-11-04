import pandas as pd


def convert_to_dataframes(assets, links, evidence, analysts):
    """
    Convert SQLAlchemy database records into
    Pandas DataFrames for algorithm execution.
    """

    assets_df = pd.DataFrame([
        {
            "asset_id": a.asset_id,
            "asset_name": a.asset_name,
            "asset_type": a.asset_type,
            "importance_score": a.importance_score,
            "is_root": a.is_root
        }
        for a in assets
    ], columns=["asset_id", "asset_name", "asset_type", "importance_score", "is_root"])

    links_df = pd.DataFrame([
        {
            "link_id": l.link_id,
            "source_asset_id": l.source_asset_id,
            "target_asset_id": l.target_asset_id,
            "cost": l.cost,
            "is_accessible": l.is_accessible
        }
        for l in links
    ], columns=["link_id", "source_asset_id", "target_asset_id", "cost", "is_accessible"])

    evidence_df = pd.DataFrame([
        {
            "evidence_id": e.evidence_id,
            "asset_id": e.asset_id,
            "description": e.description,
            "examination_hours": e.examination_hours,
            "estimated_value": e.estimated_value
        }
        for e in evidence
    ], columns=["evidence_id", "asset_id", "description", "examination_hours", "estimated_value"])

    analysts_df = pd.DataFrame([
        {
            "analyst_id": a.analyst_id,
            "analyst_name": a.analyst_name,
            "capacity_hours": a.capacity_hours
        }
        for a in analysts
    ], columns=["analyst_id", "analyst_name", "capacity_hours"])

    return assets_df, links_df, evidence_df, analysts_df
from src.kruskal import kruskal_msf, find_reachable_assets


def execute_kruskal_analysis(assets_df, links_df):
    """
    Execute Kruskal MSF and DFS reachability analysis.
    """

    root_assets = assets_df.loc[
        assets_df["is_root"], "asset_id"
    ].tolist()

    if len(root_assets) != 1:
        raise ValueError("Exactly one root asset is required.")

    root = root_assets[0]

    selected_links, total_cost = kruskal_msf(
        assets_df, links_df
    )

    reachable, unreachable = find_reachable_assets(
        assets_df, selected_links, root
    )

    return {
        "selected_links": selected_links,
        "total_cost": total_cost,
        "reachable_assets": reachable,
        "unreachable_assets": unreachable
    }
from src.knapsack_dp import multiple_knapsack_dp


def execute_knapsack_analysis(evidence_df, analysts_df):
    """
    Execute Multiple Knapsack Dynamic Programming.
    """

    maximum_value, allocation = multiple_knapsack_dp(
        evidence_df, analysts_df
    )

    return {
        "maximum_value": maximum_value,
        "allocation": allocation
    }
from src.simulation import simulate_link_failures


def execute_simulation(assets_df, links_df, failed_link_ids):
    """
    Execute link failure simulation.
    """

    return simulate_link_failures(
        assets_df,
        links_df,
        failed_link_ids
    )
from src.sensitivity import run_sensitivity_analysis


def execute_sensitivity_analysis(
    assets_df,
    links_df,
    analysts_df,
    evidence_df
):
    """
    Execute sensitivity analysis.
    """

    return run_sensitivity_analysis(
        assets_df,
        links_df,
        analysts_df,
        evidence_df
    )