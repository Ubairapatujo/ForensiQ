
from src.kruskal import kruskal_msf, find_reachable_assets


def simulate_link_failures(assets, links, failed_link_ids):
    """
    Simulate links becoming unavailable during an investigation.
    Recalculate the Minimum Spanning Forest and reachability.
    """

    if not failed_link_ids:
        raise ValueError("At least one failed link ID is required.")

    if len(failed_link_ids) != len(set(failed_link_ids)):
        raise ValueError("Duplicate failed link IDs are not allowed.")

    # Validate failed link IDs
    existing_ids = set(links["link_id"])
    unknown_ids = set(failed_link_ids) - existing_ids

    if unknown_ids:
        raise ValueError(
            f"Unknown link IDs: {sorted(unknown_ids)}"
        )

    # Validate root asset
    root_assets = assets.loc[
        assets["is_root"], "asset_id"
    ].tolist()

    if len(root_assets) != 1:
        raise ValueError(
            "Exactly one root asset is required."
        )

    root = root_assets[0]

    # Create a copy so original data remains unchanged
    updated_links = links.copy()

    # Mark failed links as inaccessible
    updated_links.loc[
        updated_links["link_id"].isin(failed_link_ids),
        "is_accessible"
    ] = False

    # Recalculate Minimum Spanning Forest
    updated_forest, updated_cost = kruskal_msf(
        assets, updated_links
    )

    # Recalculate reachability
    reachable, unreachable = find_reachable_assets(
        assets, updated_forest, root
    )

    return {
        "failed_link_ids": list(failed_link_ids),
        "updated_links": updated_links,
        "updated_forest": updated_forest,
        "updated_cost": updated_cost,
        "reachable_assets": reachable,
        "unreachable_assets": unreachable
    }
