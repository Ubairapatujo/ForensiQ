
from src.kruskal import kruskal_msf, find_reachable_assets
from src.knapsack_dp import multiple_knapsack_dp


def run_sensitivity_analysis(assets, links, analysts, evidence):
    """
    Remove the two highest-importance non-root assets
    and recalculate the investigation results.
    """

    # Validate root asset
    root_assets = assets.loc[
        assets["is_root"], "asset_id"
    ].tolist()

    if len(root_assets) != 1:
        raise ValueError(
            "Exactly one root asset is required."
        )

    root = root_assets[0]

    # Get non-root assets
    non_root_assets = assets[
        assets["asset_id"] != root
    ].copy()

    if len(non_root_assets) < 2:
        raise ValueError(
            "At least two non-root assets are required."
        )

    # Select two highest-importance assets
    # Asset ID provides deterministic tie-breaking
    removed_assets = non_root_assets.sort_values(
        by=["importance_score", "asset_id"],
        ascending=[False, True]
    ).head(2)

    removed_ids = removed_assets["asset_id"].tolist()

    # Remove selected assets
    updated_assets = assets[
        ~assets["asset_id"].isin(removed_ids)
    ].copy()

    # Remove links connected to removed assets
    updated_links = links[
        ~links["source_asset_id"].isin(removed_ids)
        & ~links["target_asset_id"].isin(removed_ids)
    ].copy()

    # Remove associated evidence
    updated_evidence = evidence[
        ~evidence["asset_id"].isin(removed_ids)
    ].copy()

    # Recalculate Minimum Spanning Forest
    selected_links, total_cost = kruskal_msf(
        updated_assets, updated_links
    )

    # Recalculate reachability
    reachable, unreachable = find_reachable_assets(
        updated_assets, selected_links, root
    )

    # Select evidence from reachable assets only
    eligible_evidence = updated_evidence[
        updated_evidence["asset_id"].isin(reachable)
    ].copy()

    # Recalculate evidence allocation
    maximum_value, allocation = multiple_knapsack_dp(
        eligible_evidence, analysts
    )

    return {
        "removed_assets": removed_ids,
        "updated_assets": updated_assets,
        "updated_links": updated_links,
        "updated_evidence": updated_evidence,
        "selected_links": selected_links,
        "total_cost": total_cost,
        "reachable_assets": reachable,
        "unreachable_assets": unreachable,
        "eligible_evidence": eligible_evidence,
        "maximum_value": maximum_value,
        "allocation": allocation
    }
