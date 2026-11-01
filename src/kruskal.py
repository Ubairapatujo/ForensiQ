
class DisjointSet:
    """
    Manage connected components using DSU.
    """

    def __init__(self, assets):
        self.parent = {asset: asset for asset in assets}
        self.rank = {asset: 0 for asset in assets}

    def find(self, asset):
        """
        Find the root parent using path compression.
        """

        if asset not in self.parent:
            raise ValueError(f"Unknown asset: {asset}")

        if self.parent[asset] != asset:
            self.parent[asset] = self.find(self.parent[asset])

        return self.parent[asset]

    def union(self, asset1, asset2):
        """
        Join two different components using union by rank.
        """

        root1 = self.find(asset1)
        root2 = self.find(asset2)

        if root1 == root2:
            return False

        if self.rank[root1] < self.rank[root2]:
            self.parent[root1] = root2

        elif self.rank[root1] > self.rank[root2]:
            self.parent[root2] = root1

        else:
            self.parent[root2] = root1
            self.rank[root1] += 1

        return True


def kruskal_msf(assets, links):
    """
    Build a Minimum Spanning Forest using Kruskal's algorithm.
    """

    asset_ids = assets["asset_id"].tolist()

    if len(asset_ids) != len(set(asset_ids)):
        raise ValueError("Duplicate asset IDs are not allowed.")

    importance = dict(
        zip(assets["asset_id"], assets["importance_score"])
    )

    dsu = DisjointSet(asset_ids)

    # Select accessible links only
    available_links = links[
        links["is_accessible"] == True
    ].to_dict(orient="records")

    # Validate link endpoints
    for link in available_links:
        source = link["source_asset_id"]
        target = link["target_asset_id"]

        if source not in dsu.parent or target not in dsu.parent:
            raise ValueError(
                f"Link {link['link_id']} references an unknown asset."
            )

    # Deterministic sorting with project tie-breaking rules
    available_links.sort(
        key=lambda link: (
            link["cost"],
            -(
                importance[link["source_asset_id"]]
                + importance[link["target_asset_id"]]
            ),
            link["link_id"]
        )
    )

    selected_links = []
    total_cost = 0

    # Process links
    for link in available_links:

        source = link["source_asset_id"]
        target = link["target_asset_id"]

        if dsu.union(source, target):
            selected_links.append(link)
            total_cost += link["cost"]

    return selected_links, total_cost


def find_reachable_assets(assets, selected_links, root):
    """
    Find assets reachable from root using DFS.
    """

    asset_ids = assets["asset_id"].tolist()

    if root not in asset_ids:
        raise ValueError("Root asset does not exist.")

    adjacency = {
        asset: [] for asset in asset_ids
    }

    # Build adjacency list
    for link in selected_links:

        source = link["source_asset_id"]
        target = link["target_asset_id"]

        if source not in adjacency or target not in adjacency:
            raise ValueError(
                f"Link {link['link_id']} references an unknown asset."
            )

        adjacency[source].append(target)
        adjacency[target].append(source)

    visited = set()
    stack = [root]

    # DFS traversal
    while stack:

        current = stack.pop()

        if current not in visited:

            visited.add(current)

            for neighbour in adjacency[current]:

                if neighbour not in visited:
                    stack.append(neighbour)

    reachable = [
        asset for asset in asset_ids if asset in visited
    ]

    unreachable = [
        asset for asset in asset_ids if asset not in visited
    ]

    return reachable, unreachable
