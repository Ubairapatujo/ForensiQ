
from src.data_loader import prepare_data
from src.kruskal import kruskal_msf, find_reachable_assets
from src.knapsack_dp import multiple_knapsack_dp


# Load and validate project data
assets, links, analysts, evidence = prepare_data()

# Run Kruskal's algorithm
selected_links, total_cost = kruskal_msf(assets, links)

# Display selected connections
print("\n----- KRUSKAL ALGORITHM RESULTS -----")

for link in selected_links:
    print(
        link["link_id"],
        ":",
        link["source_asset_id"],
        "->",
        link["target_asset_id"],
        "| Cost:",
        link["cost"]
    )

# Display total access cost
print("\nTotal Access Cost:", total_cost)

print("\nTotal Selected Links:", len(selected_links))
# Get the root asset ID
root = assets.loc[assets["is_root"], "asset_id"].iloc[0]

# Find reachable and unreachable assets
reachable, unreachable = find_reachable_assets(
    assets, selected_links, root
)

# Display root asset
print("\n----- ASSET REACHABILITY RESULTS -----")

print("\nRoot Asset:", root)

# Display reachable assets
print("\nReachable Assets:")

for asset in reachable:
    print(asset)

# Display unreachable assets
print("\nUnreachable Assets:")

for asset in unreachable:
    print(asset)

# Filter evidence belonging to reachable assets
eligible_evidence = evidence[
    evidence["asset_id"].isin(reachable)
]

print("\nTotal Eligible Evidence:", len(eligible_evidence))
# Run Multiple Knapsack DP
maximum_value, allocation = multiple_knapsack_dp(
    eligible_evidence, analysts
)

# Display allocation results
print("\n----- KNAPSACK DP RESULTS -----")

print("\nMaximum Evidence Value:", maximum_value)

for analyst, assigned_items in allocation.items():

    print("\n", analyst)

    total_hours = 0

    for item in assigned_items:

        print(
            item["evidence_id"],
            "| Hours:", item["examination_hours"],
            "| Value:", item["estimated_value"]
        )

        total_hours += item["examination_hours"]

    print("Total Assigned Hours:", total_hours)