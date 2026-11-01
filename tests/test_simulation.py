
import unittest
import pandas as pd

from src.simulation import simulate_link_failures
from src.kruskal import kruskal_msf


class TestSimulation(unittest.TestCase):

    def setUp(self):
        self.assets = pd.DataFrame([
            ["A01", "Root", 10, True],
            ["A02", "Asset 2", 8, False],
            ["A03", "Asset 3", 7, False],
            ["A04", "Asset 4", 6, False]
        ], columns=[
            "asset_id", "asset_name",
            "importance_score", "is_root"
        ])

        self.links = pd.DataFrame([
            ["L01", "A01", "A02", 2, True],
            ["L02", "A02", "A03", 3, True],
            ["L03", "A03", "A04", 4, True],
            ["L04", "A01", "A04", 8, True]
        ], columns=[
            "link_id", "source_asset_id",
            "target_asset_id", "cost", "is_accessible"
        ])

    def test_three_link_failures(self):
        result = simulate_link_failures(
            self.assets, self.links,
            ["L01", "L02", "L03"]
        )

        self.assertEqual(
            result["failed_link_ids"],
            ["L01", "L02", "L03"]
        )

        self.assertFalse(
            result["updated_links"]
            .set_index("link_id")
            .loc[["L01", "L02", "L03"], "is_accessible"]
            .any()
        )

    def test_empty_failed_ids(self):
        with self.assertRaises(ValueError):
            simulate_link_failures(
                self.assets, self.links, []
            )

    def test_unknown_link_id(self):
        with self.assertRaises(ValueError):
            simulate_link_failures(
                self.assets, self.links, ["L99"]
            )

    def test_duplicate_failed_ids(self):
        with self.assertRaises(ValueError):
            simulate_link_failures(
                self.assets, self.links, ["L01", "L01"]
            )

    def test_forest_matches_kruskal_recomputation(self):
        failed_ids = ["L01", "L02"]

        result = simulate_link_failures(
            self.assets, self.links, failed_ids
        )

        expected_forest, expected_cost = kruskal_msf(
            self.assets, result["updated_links"]
        )

        actual_ids = sorted(
            link["link_id"]
            for link in result["updated_forest"]
        )

        expected_ids = sorted(
            link["link_id"]
            for link in expected_forest
        )

        self.assertEqual(actual_ids, expected_ids)
        self.assertEqual(result["updated_cost"], expected_cost)


if __name__ == "__main__":
    unittest.main()
