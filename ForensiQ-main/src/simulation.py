
from src.kruskal import kruskal_msf, find_reachable_assets, DisjointSet
from time import perf_counter


def simulate_link_failures(assets, links, failed_link_ids):
    """
    Simulate links becoming unavailable during an investigation.
    Recalculate the Minimum Spanning Forest and reachability.
    """

    if not isinstance(failed_link_ids, list) or not 1 <= len(failed_link_ids) <= 3:
        raise ValueError("Select one to three failed link IDs.")
    if any(not isinstance(link_id, str) or not link_id.strip() for link_id in failed_link_ids):
        raise ValueError("Failed link IDs must be nonempty strings.")

    if len(failed_link_ids) != len(set(failed_link_ids)):
        raise ValueError("Duplicate failed link IDs are not allowed.")

    # Validate failed link IDs
    existing_ids = set(links["link_id"])
    unknown_ids = set(failed_link_ids) - existing_ids

    if unknown_ids:
        raise ValueError(
            f"Unknown link IDs: {sorted(unknown_ids)}"
        )

    failed_rows = links[links["link_id"].isin(failed_link_ids)]
    if not failed_rows["is_accessible"].all():
        raise ValueError("Failed links must currently be accessible.")

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

    # Full recomputation on the modified graph.
    recompute_start = perf_counter()
    updated_forest, updated_cost = kruskal_msf(assets, updated_links)
    recomputation_time_ms = (perf_counter() - recompute_start) * 1000

    # Incremental update: retain surviving old-tree edges and use
    # minimum-cost replacement edges to reconnect their components.
    initial_forest, _ = kruskal_msf(assets, links)
    incremental_start = perf_counter()
    failed_set = set(failed_link_ids)
    surviving_tree = [edge for edge in initial_forest if edge["link_id"] not in failed_set]
    dsu = DisjointSet(assets["asset_id"].tolist())
    for edge in surviving_tree:
        dsu.union(edge["source_asset_id"], edge["target_asset_id"])

    importance = dict(zip(assets["asset_id"], assets["importance_score"]))
    candidates = updated_links[updated_links["is_accessible"] == True].to_dict(orient="records")
    candidates.sort(key=lambda edge: (
        edge["cost"],
        -(importance[edge["source_asset_id"]] + importance[edge["target_asset_id"]]),
        edge["link_id"]
    ))
    incremental_forest = list(surviving_tree)
    for edge in candidates:
        if dsu.union(edge["source_asset_id"], edge["target_asset_id"]):
            incremental_forest.append(edge)
    incremental_cost = sum(edge["cost"] for edge in incremental_forest)
    incremental_time_ms = (perf_counter() - incremental_start) * 1000
    costs_match = abs(incremental_cost - updated_cost) < 1e-8
    if not costs_match:
        raise ValueError("Incremental result differs from full recomputation.")

    # Recalculate reachability
    reachable, unreachable = find_reachable_assets(
        assets, updated_forest, root
    )

    return {
        "failed_link_ids": list(failed_link_ids),
        "updated_links": updated_links,
        "updated_forest": updated_forest,
        "updated_cost": updated_cost,
        "incremental_forest": incremental_forest,
        "incremental_cost": incremental_cost,
        "incremental_time_ms": incremental_time_ms,
        "recomputation_time_ms": recomputation_time_ms,
        "costs_match": costs_match,
        "reachable_assets": reachable,
        "unreachable_assets": unreachable
    }
