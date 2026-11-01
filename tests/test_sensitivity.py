
import unittest

from src.data_loader import prepare_data
from src.sensitivity import run_sensitivity_analysis


class TestSensitivityAnalysis(unittest.TestCase):

    def setUp(self):
        (
            self.assets,
            self.links,
            self.analysts,
            self.evidence
        ) = prepare_data()

    def test_two_highest_non_root_assets_removed(self):

        result = run_sensitivity_analysis(
            self.assets,
            self.links,
            self.analysts,
            self.evidence
        )

        # A02 and A06 have the highest non-root importance.
        self.assertEqual(
            result["removed_assets"],
            ["A02", "A06"]
        )

    def test_root_asset_is_preserved(self):

        result = run_sensitivity_analysis(
            self.assets,
            self.links,
            self.analysts,
            self.evidence
        )

        self.assertIn(
            "A01",
            result["updated_assets"]["asset_id"].tolist()
        )

    def test_incident_links_are_removed(self):

        result = run_sensitivity_analysis(
            self.assets,
            self.links,
            self.analysts,
            self.evidence
        )

        for _, link in result["updated_links"].iterrows():
            self.assertNotIn(
                link["source_asset_id"],
                result["removed_assets"]
            )
            self.assertNotIn(
                link["target_asset_id"],
                result["removed_assets"]
            )

    def test_associated_evidence_is_removed(self):

        result = run_sensitivity_analysis(
            self.assets,
            self.links,
            self.analysts,
            self.evidence
        )

        remaining_asset_ids = result[
            "updated_evidence"
        ]["asset_id"].tolist()

        for asset_id in result["removed_assets"]:
            self.assertNotIn(asset_id, remaining_asset_ids)

    def test_original_data_is_unchanged(self):

        original_assets = self.assets.copy(deep=True)
        original_links = self.links.copy(deep=True)
        original_evidence = self.evidence.copy(deep=True)

        run_sensitivity_analysis(
            self.assets,
            self.links,
            self.analysts,
            self.evidence
        )

        self.assertTrue(self.assets.equals(original_assets))
        self.assertTrue(self.links.equals(original_links))
        self.assertTrue(self.evidence.equals(original_evidence))


if __name__ == "__main__":
    unittest.main()
