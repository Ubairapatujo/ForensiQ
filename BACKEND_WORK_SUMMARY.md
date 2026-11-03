# ForensiQ — Backend & Algorithm Integration Work Summary

## 1. Backend Setup
- Flask backend application setup and verified.
- Application factory tested successfully.
- Python compilation checks completed successfully.
- Backend server started successfully.

## 2. CRUD APIs Implemented
CRUD routes are available for:
- Investigations
- Assets
- Links
- Evidence
- Analysts

## 3. Additional Improvements and Validations

### Asset Validation
- First asset must be the root asset.
- Creating a new root asset automatically demotes the previous root.
- The only root asset cannot be unset.
- Root asset cannot be deleted while other assets exist.

### Analyst Validation
- Analyst capacity must be unique.
- Unique capacity validation applies during creation and updates.
- Maximum of three analysts is enforced.

## 4. Algorithm Implementation

The following algorithms and functionalities were implemented:

- **Kruskal's Minimum Spanning Forest (MSF):** Selects links with minimum total access cost.
- **DFS Reachability:** Identifies reachable and unreachable assets from the root asset.
- **Multiple Knapsack DP:** Allocates eligible evidence among analysts according to their examination capacities.
- **Link Failure Simulation:** Evaluates how failed links affect network connectivity.
- **Sensitivity Analysis:** Evaluates the impact of asset changes on network connectivity and evidence allocation.

## 5. Database and Algorithm Integration
- Created `src/database_adapter.py`.
- Converted SQLAlchemy database records into Pandas DataFrames.
- Connected database records with the implemented algorithm functions.
- Algorithms fetch the current investigation data whenever they are executed.
- Supports dynamically added assets, links, evidence, and analysts.

## 6. Algorithm API Endpoints

Three additional Flask API endpoints were implemented:

- `POST /api/investigations/<id>/run-analysis`
- `POST /api/investigations/<id>/simulate`
- `POST /api/investigations/<id>/sensitivity`

These endpoints execute the algorithms using the selected investigation's database records and return results in JSON format.

## 7. Testing Completed
- Backend application startup verified.
- Investigations GET API returned HTTP 200.
- Asset root validation scenarios tested successfully.
- Analyst uniqueness and maximum limit tested successfully.
- Database-to-DataFrame conversion tested.
- Kruskal and DFS integration tested.
- Knapsack integration tested.
- Link failure simulation tested.
- Sensitivity analysis tested.
- All three algorithm API endpoints tested successfully.
- All 21 unit tests passed.

## 8. GitHub Updates
- Backend and algorithm integration changes committed and pushed to GitHub.
- Latest commit: `c4badbd`
- Commit message: `Integrate algorithms with Flask database APIs`

## 9. Current Status

**Completed:**
- Backend setup and CRUD implementation.
- Asset and analyst validation.
- Algorithm implementation.
- Database and algorithm integration.
- Three algorithm API endpoints.
- Unit and API testing.

**Remaining:**
- Frontend integration.
- Network visualization and result dashboards.
- End-to-end testing.
- Deployment.

**Note:** The simulation currently evaluates link failures without permanently modifying database records. Run Analysis also enforces a limit of 1–3 analysts, while the algorithms require exactly one root asset. Sensitivity analysis requires at least two non-root assets.
