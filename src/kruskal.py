
class DisjointSet:
    """
    Manage connected components using DSU.
    """

    def __init__(self, assets):
        # Initially, every asset is its own parent
        self.parent = {asset: asset for asset in assets}

        # Initially, every component has rank zero
        self.rank = {asset: 0 for asset in assets}

    def find(self, asset):
        """
        Find the root parent of an asset.
        Path compression makes future searches faster.
        """

        if self.parent[asset] != asset:
            self.parent[asset] = self.find(self.parent[asset])

        return self.parent[asset]

    def union(self, asset1, asset2):
        """
        Join two different components.
        Union by rank keeps the tree balanced.
        """

        root1 = self.find(asset1)
        root2 = self.find(asset2)

        # Both assets already belong to the same component
        if root1 == root2:
            return False

        # Attach the smaller rank tree under the larger one
        if self.rank[root1] < self.rank[root2]:
            self.parent[root1] = root2

        elif self.rank[root1] > self.rank[root2]:
            self.parent[root2] = root1

        else:
            self.parent[root2] = root1
            self.rank[root1] += 1

        return True


def kruskal_mst(assets, links):
    """
    Build a minimum spanning forest using Kruskal's algorithm.
    """

    # Get all asset IDs
    asset_ids = assets["asset_id"].tolist()

    # Store asset importance scores
    importance = dict(
        zip(assets["asset_id"], assets["importance_score"])
    )

    # Create DSU for all assets
    dsu = DisjointSet(asset_ids)

    # Remove inaccessible links before processing
    available_links = links[
        links["is_accessible"] == True
    ].to_dict(orient="records")

    # Sort links using the project's tie-breaking rule
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

    # Store selected links
    selected_links = []

    # Store the total access cost
    total_cost = 0

    # Process links in sorted order
    for link in available_links:

        source = link["source_asset_id"]
        target = link["target_asset_id"]

        # Add the link only if it connects different components
        if dsu.union(source, target):

            selected_links.append(link)

            total_cost += link["cost"]

    return selected_links, total_cost
def find_reachable_assets(assets, selected_links, root):
    """
    Find all assets reachable from the root using DFS.
    """

    # Create an empty adjacency list for every asset
    adjacency = {
        asset: [] for asset in assets["asset_id"]
    }

    # Add selected links in both directions
    for link in selected_links:
        source = link["source_asset_id"]
        target = link["target_asset_id"]

        adjacency[source].append(target)
        adjacency[target].append(source)

    # Keep track of visited assets
    visited = set()

    # Use a stack for DFS traversal
    stack = [root]

    while stack:

        current = stack.pop()

        # Visit an asset only once
        if current not in visited:

            visited.add(current)

            # Add unvisited neighbours to the stack
            for neighbour in adjacency[current]:

                if neighbour not in visited:
                    stack.append(neighbour)

    # Keep the original CSV order
    reachable = [
        asset for asset in assets["asset_id"]
        if asset in visited
    ]

    unreachable = [
        asset for asset in assets["asset_id"]
        if asset not in visited
    ]

    return reachable, unreachable