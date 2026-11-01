
import unittest
import pandas as pd

from src.knapsack_dp import multiple_knapsack_dp


class TestKnapsack(unittest.TestCase):

    def setUp(self):
        self.analysts = pd.DataFrame([
            ["AN01", "Analyst A", 5],
            ["AN02", "Analyst B", 5],
            ["AN03", "Analyst C", 5]
        ], columns=[
            "analyst_id", "analyst_name", "capacity_hours"
        ])

    def test_maximum_value(self):
        evidence = pd.DataFrame([
            ["E01", "A01", "Evidence 1", 5, 50],
            ["E02", "A02", "Evidence 2", 4, 40],
            ["E03", "A03", "Evidence 3", 3, 30],
            ["E04", "A04", "Evidence 4", 2, 20]
        ], columns=[
            "evidence_id", "asset_id", "description",
            "examination_hours", "estimated_value"
        ])

        maximum_value, allocation = multiple_knapsack_dp(
            evidence, self.analysts
        )

        self.assertEqual(maximum_value, 140)

    def test_capacity_limits(self):
        evidence = pd.DataFrame([
            ["E01", "A01", "Evidence 1", 4, 60],
            ["E02", "A02", "Evidence 2", 4, 50],
            ["E03", "A03", "Evidence 3", 3, 40]
        ], columns=[
            "evidence_id", "asset_id", "description",
            "examination_hours", "estimated_value"
        ])

        maximum_value, allocation = multiple_knapsack_dp(
            evidence, self.analysts
        )

        for analyst_name, items in allocation.items():
            total_hours = sum(
                item["examination_hours"] for item in items
            )

            capacity = self.analysts.loc[
                self.analysts["analyst_name"] == analyst_name,
                "capacity_hours"
            ].iloc[0]

            self.assertLessEqual(total_hours, capacity)

    def test_evidence_not_duplicated(self):
        evidence = pd.DataFrame([
            ["E01", "A01", "Evidence 1", 3, 50],
            ["E02", "A02", "Evidence 2", 2, 40],
            ["E03", "A03", "Evidence 3", 4, 60]
        ], columns=[
            "evidence_id", "asset_id", "description",
            "examination_hours", "estimated_value"
        ])

        maximum_value, allocation = multiple_knapsack_dp(
            evidence, self.analysts
        )

        assigned_ids = [
            item["evidence_id"]
            for items in allocation.values()
            for item in items
        ]

        self.assertEqual(
            len(assigned_ids), len(set(assigned_ids))
        )

    def test_empty_evidence(self):
        evidence = pd.DataFrame(columns=[
            "evidence_id", "asset_id", "description",
            "examination_hours", "estimated_value"
        ])

        maximum_value, allocation = multiple_knapsack_dp(
            evidence, self.analysts
        )

        self.assertEqual(maximum_value, 0)

    def test_single_analyst(self):
        one_analyst = self.analysts.iloc[:1].copy()

        evidence = pd.DataFrame([
            ["E01", "A01", "Evidence 1", 3, 50],
            ["E02", "A02", "Evidence 2", 2, 40],
            ["E03", "A03", "Evidence 3", 1, 30]
        ], columns=[
            "evidence_id", "asset_id", "description",
            "examination_hours", "estimated_value"
        ])

        maximum_value, allocation = multiple_knapsack_dp(
            evidence, one_analyst
        )

        self.assertEqual(maximum_value, 90)
        self.assertEqual(len(allocation["Analyst A"]), 2)

    def test_two_analysts(self):
        two_analysts = self.analysts.iloc[:2].copy()

        evidence = pd.DataFrame([
            ["E01", "A01", "Evidence 1", 5, 60],
            ["E02", "A02", "Evidence 2", 5, 50],
            ["E03", "A03", "Evidence 3", 3, 40]
        ], columns=[
            "evidence_id", "asset_id", "description",
            "examination_hours", "estimated_value"
        ])

        maximum_value, allocation = multiple_knapsack_dp(
            evidence, two_analysts
        )

        self.assertEqual(maximum_value, 110)

        self.assertEqual(
            set(allocation.keys()),
            {"Analyst A", "Analyst B"}
        )

    def test_more_than_three_analysts(self):
        four_analysts = pd.concat(
            [self.analysts, pd.DataFrame([
                ["AN04", "Analyst D", 5]
            ], columns=[
                "analyst_id", "analyst_name", "capacity_hours"
            ])],
            ignore_index=True
        )

        evidence = pd.DataFrame([
            ["E01", "A01", "Evidence 1", 2, 50]
        ], columns=[
            "evidence_id", "asset_id", "description",
            "examination_hours", "estimated_value"
        ])

        with self.assertRaises(ValueError):
            multiple_knapsack_dp(
                evidence, four_analysts
            )


if __name__ == "__main__":
    unittest.main()
