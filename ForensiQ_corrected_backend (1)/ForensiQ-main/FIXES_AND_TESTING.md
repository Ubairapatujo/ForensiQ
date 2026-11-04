# ForensiQ correction notes

This is a corrected copy of the supplied project, not a change to GitHub.

## Changes
- API validation: asset importance 1–10, analyst capacity 1–16, evidence hours >0, reject non-finite costs and values.
- Adapter: preserve required columns for empty SQLAlchemy collections.
- Analysis: return a 400 error for fewer than two assets.
- Simulation API: requires exactly three accessible links as specified in the proposal. The underlying simulation function still accepts 1–3 links to preserve existing algorithm tests.
- Simulation algorithm: retain unaffected tree edges, reconnect with sorted replacement edges, verify minimum total cost against full recomputation and report measured times.
- Added regression tests for adapter and invalid simulation count.

## Verification limitations
Python syntax compilation passed. Full pytest and Flask integration tests could not be run in the packaging environment because Flask and pandas were not installed and package download was unavailable. Run `pip install -r requirements.txt pytest` and `python -m pytest -q` locally.

## Still to do
- HTML/Jinja routes and frontend pages are not part of this backend correction.
- CSV import/export and reports remain Member 4 work.
- End-to-end Flask/API testing and performance measurements are needed.
- Existing database rows created under older validation rules should be reviewed before analysis.
