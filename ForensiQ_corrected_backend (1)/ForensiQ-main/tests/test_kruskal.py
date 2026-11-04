
import unittest
import pandas as pd

from src.kruskal import kruskal_msf, find_reachable_assets


class TestKruskal(unittest.TestCase):

    def setUp(self):
        self.assets = pd.DataFrame([
            ["A", "Asset A", 10],
            ["B", "Asset B", 9],
            ["C", "Asset C", 1],
            ["D", "Asset D", 5]
        ], columns=[
            "asset_id", "asset_name", "importance_score"
        ])

        self.links = pd.DataFrame([
            ["L03", "A", "C", 2, True],
            ["L02", "A", "B", 2, True],
            ["L01", "B", "C", 2, True],
            ["L04", "C", "D", 3, False],
            ["L05", "C", "D", 4, True]
        ], columns=[
            "link_id", "source_asset_id",
            "target_asset_id", "cost", "is_accessible"
        ])

    def test_tie_breaking(self):
        selected, total_cost = kruskal_msf(
            self.assets, self.links
        )

        selected_ids = [
            link["link_id"] for link in selected
        ]

        # Higher combined importance gets priority
        self.assertEqual(
            selected_ids,
            ["L02", "L03", "L05"]
        )

        self.assertEqual(total_cost, 8)

    def test_inaccessible_links_ignored(self):
        selected, total_cost = kruskal_msf(
            self.assets, self.links
        )

        selected_ids = [
            link["link_id"] for link in selected
        ]

        self.assertNotIn("L04", selected_ids)

    def test_disconnected_forest(self):
        links = self.links[
            self.links["link_id"] != "L05"
        ]

        selected, total_cost = kruskal_msf(
            self.assets, links
        )

        self.assertEqual(len(selected), 2)
        self.assertEqual(total_cost, 4)

    def test_dfs_reachability(self):
        links = self.links[
            self.links["link_id"] != "L05"
        ]

        selected, _ = kruskal_msf(
            self.assets, links
        )

        reachable, unreachable = find_reachable_assets(
            self.assets, selected, "A"
        )

        self.assertEqual(
            reachable, ["A", "B", "C"]
        )

        self.assertEqual(
            unreachable, ["D"]
        )


if __name__ == "__main__":
    unittest.main()
