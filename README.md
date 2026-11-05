# ForensiQ — Intelligent Digital Forensics Investigation System

An algorithm-driven digital forensics investigation system designed to analyze digital asset networks, identify accessible evidence, and optimize evidence allocation among forensic analysts.

**Stack:** Python → Flask REST API → SQLite → HTML / CSS / JavaScript

![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Flask](https://img.shields.io/badge/Flask-Backend-black)
![SQLite](https://img.shields.io/badge/Database-SQLite-blue)
![Algorithms](https://img.shields.io/badge/Algorithms-Kruskal%20%7C%20DFS%20%7C%20Knapsack-orange)
![Testing](https://img.shields.io/badge/Tests-35%20Passed-brightgreen)
![Project](https://img.shields.io/badge/Domain-Digital%20Forensics-purple)

---

## Overview

ForensiQ is a digital forensics investigation system developed to make forensic evidence analysis more structured, efficient, and algorithmically optimized.

Digital forensic investigations often involve multiple connected devices, evidence sources, network links, and analysts with limited investigation capacities. Manually evaluating these connections and allocating evidence can become difficult as the investigation grows.

ForensiQ addresses these challenges by combining graph algorithms and dynamic programming techniques.

The system models digital assets as a graph, identifies minimum-cost connections using Kruskal's algorithm, determines accessible assets through Depth-First Search (DFS), and allocates eligible evidence among multiple analysts using a Multiple Knapsack Dynamic Programming approach.

It also includes sensitivity analysis and link failure simulation to evaluate how changes in the investigation network can affect its results.

**The primary objective is to demonstrate how Design and Analysis of Algorithms (DAA) concepts can be applied to a practical cybersecurity and digital forensics scenario.**

---

## Architecture at a Glance

ForensiQ follows a modular architecture in which the frontend communicates with the Flask application, while the backend processes investigation data and executes algorithmic operations.

```text
        User Interface
        HTML / CSS / JavaScript
                 |
                 | HTTP Requests
                 v
        Flask Application
          (Routes / APIs)
                 |
          +------+------+
          |             |
          v             v
     SQLAlchemy     Algorithm Layer
          |             |
          v        +----+---------+
       SQLite      |              |
                  Kruskal       DFS
                     |            |
                     +-----+------+
                           |
                           v
                    Evidence Filtering
                           |
                           v
                    Multiple Knapsack
                           |
                           v
                    Investigation Results
                           |
                           v
                    Dashboard / Reports
```

---

## Key Features

### 1. Forensic Network Analysis
- Represents digital assets as nodes in a graph.
- Models connections between assets using weighted links.
- Identifies minimum-cost network connections.
- Supports investigation of disconnected network components.

### 2. Asset Reachability
- Uses DFS to explore assets connected to the investigation's root asset.
- Identifies accessible and inaccessible assets.
- Ensures evidence from inaccessible assets is excluded from eligible allocation.

### 3. Evidence Management
- Maintains structured evidence records.
- Associates evidence with digital assets.
- Considers evidence values during allocation.
- Supports investigation-specific evidence analysis.

### 4. Analyst Resource Allocation
- Uses Multiple Knapsack Dynamic Programming.
- Considers the available capacity of each forensic analyst.
- Maximizes the total value of allocated evidence.
- Prevents duplicate allocation of evidence items.

### 5. Sensitivity Analysis
- Evaluates changes in investigation results when network nodes are removed.
- Helps assess the importance of individual assets.
- Supports comparison of alternative investigation scenarios.

### 6. Link Failure Simulation
- Simulates link failure scenarios.
- Evaluates how failed connections affect network accessibility.
- Helps analyze the impact of network disruptions on forensic investigations.

### 7. Interactive Dashboard and Reports
- Presents investigation results through a graphical interface.
- Provides network and evidence analysis views.
- Displays analyst allocation and investigation information.
- Organizes results into reports.

---

## Algorithms Used

ForensiQ implements three core algorithmic techniques, supported by additional analysis and simulation modules.

### 1. Kruskal's Algorithm — Minimum Spanning Forest

Kruskal's algorithm identifies a minimum-cost set of connections between digital assets without creating cycles.

ForensiQ uses this algorithm to construct a Minimum Spanning Forest (MSF) from the weighted investigation network.

**Purpose:**
- Minimize the total cost of selected network connections.
- Identify cost-efficient links between digital assets.
- Support disconnected network components.

**Approach:**
1. Sort network links by their weights.
2. Examine links in ascending order of cost.
3. Select a link if it does not create a cycle.
4. Continue until the minimum spanning forest is constructed.

**Time Complexity:** \(O(E \log E)\), where \(E\) represents the number of edges.

### 2. Depth-First Search (DFS) — Asset Reachability

DFS is used to determine which digital assets are reachable from the selected root asset.

It traverses the investigation network and identifies accessible assets.

**Purpose:**
- Determine accessible digital assets.
- Identify unreachable assets.
- Filter evidence according to asset accessibility.

**Approach:**
1. Start traversal from the root asset.
2. Visit connected and unvisited assets.
3. Continue exploring each reachable path.
4. Record all reachable assets.

**Time Complexity:** \(O(V + E)\), where \(V\) represents vertices and \(E\) represents edges.

### 3. Multiple Knapsack — Dynamic Programming

The Multiple Knapsack algorithm allocates eligible evidence items among multiple forensic analysts while respecting their individual capacities.

Each evidence item has an associated value and resource requirement.

**Purpose:**
- Maximize the total allocated evidence value.
- Respect individual analyst capacity constraints.
- Prevent duplicate allocation.
- Improve evidence distribution among analysts.

**Approach:**
1. Identify evidence items eligible for allocation.
2. Retrieve the available capacity of each analyst.
3. Evaluate possible evidence allocation combinations.
4. Use dynamic programming to determine an optimal allocation.
5. Return the selected evidence items and total allocated value.

**Complexity:** Depends on the number of evidence items, analysts, and capacity dimensions used in the DP implementation.

---

## Additional Analysis Modules

### Sensitivity Analysis

The sensitivity module evaluates how changes in the investigation network affect the resulting analysis.

It includes node-removal scenarios to examine how removing individual assets can influence network connectivity and investigation outcomes.

### Link Failure Simulation

The simulation module evaluates scenarios in which selected network links become unavailable.

It helps determine how connection failures affect asset reachability and the overall investigation network.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Python | Core programming language |
| Flask | Backend application and REST API |
| Flask-SQLAlchemy | Database integration and ORM |
| SQLite | Relational database |
| Pandas | Data processing and DataFrame operations |
| NumPy | Numerical operations |
| HTML5 | Frontend structure |
| CSS3 | Interface styling |
| JavaScript | Frontend interactions and API communication |
| PyVis | Network visualization |
| Pytest | Automated testing |

---

## Project Structure

```text
ForensiQ_corrected_backend (1)/
│
├── app/
│   ├── static/
│   │   ├── css/                 # Application stylesheets
│   │   ├── js/                  # Frontend JavaScript
│   │   │   ├── analysis.js
│   │   │   ├── sensitivity.js
│   │   │   ├── reports.js
│   │   │   └── network.js
│   │   └── vendor/              # Third-party frontend libraries
│   │
│   ├── templates/               # HTML application pages
│   ├── __init__.py              # Flask application factory
│   ├── models.py                # SQLAlchemy database models
│   └── routes.py                # Page routes and REST API endpoints
│
├── data/
│   ├── analysts.csv             # Sample analyst data
│   ├── assets.csv               # Sample digital asset data
│   ├── evidence.csv             # Sample evidence records
│   └── links.csv                # Connections between digital assets
│
├── instance/
│   └── forensiq.db              # SQLite database
│
├── src/
│   ├── data_loader.py           # CSV data loading and validation
│   ├── database_adapter.py      # Database-to-DataFrame conversion
│   ├── kruskal.py               # Kruskal's algorithm and DFS reachability
│   ├── knapsack_dp.py           # Multiple Knapsack dynamic programming
│   ├── sensitivity.py           # Sensitivity analysis
│   └── simulation.py            # Link failure simulation
│
├── tests/
│   ├── test_frontend_routes.py  # Frontend routes and API tests
│   ├── test_knapsack.py         # Knapsack algorithm tests
│   ├── test_kruskal.py          # Kruskal and reachability tests
│   ├── test_regressions.py      # Regression tests
│   ├── test_sensitivity.py      # Sensitivity analysis tests
│   └── test_simulation.py       # Simulation tests
│
├── app.py                       # Application entry point
├── main.py                      # CLI algorithm runner
├── seed_sample_case.py          # Sample investigation seeding
├── requirements.txt             # Python dependencies
├── BACKEND_WORK_SUMMARY.md      # Backend implementation summary
└── FIXES_AND_TESTING.md         # Fixes and testing documentation
```

---

## Backend Architecture

The backend follows a modular structure that separates application routing, database operations, and algorithm implementations.

### Application Layer
- **Flask Application Factory (`app/__init__.py`):** Initializes the Flask application, database integration, models, and routes.
- **Routes (`app/routes.py`):** Handles application pages and REST API requests.
- **Models (`app/models.py`):** Defines the SQLAlchemy models used to represent investigations, assets, links, evidence, and analysts.

### Algorithm Layer
The `src/` directory contains the core algorithm implementations.

- **Data Loader:** Loads and validates investigation data from CSV files.
- **Kruskal:** Constructs a minimum spanning forest.
- **DFS Reachability:** Identifies assets accessible from the investigation root.
- **Multiple Knapsack:** Optimizes evidence allocation among analysts.
- **Sensitivity:** Evaluates network changes through node-removal analysis.
- **Simulation:** Evaluates the impact of link failures.

### Database Layer
ForensiQ uses SQLite with Flask-SQLAlchemy to store and manage investigation information.

The database models include:

- Investigation
- Asset
- Link
- Evidence
- Analyst

---

## Database and Sample Data

ForensiQ uses SQLite as its relational database.

The project also includes CSV files containing sample investigation data.

| File | Description |
|---|---|
| `analysts.csv` | Analyst information and available capacities |
| `assets.csv` | Digital assets involved in an investigation |
| `evidence.csv` | Evidence items and their associated values |
| `links.csv` | Weighted connections between digital assets |

The data loader processes the CSV files, while the database adapter supports conversion of stored investigation data into DataFrames for algorithmic processing.

---

## Investigation Workflow

The system follows a structured workflow to process forensic investigation data.

```text
Load Investigation Data
          |
          v
Validate Assets, Links, Evidence and Analysts
          |
          v
Construct Minimum Spanning Forest
          |
          v
Determine Reachable Assets using DFS
          |
          v
Filter Eligible Evidence
          |
          v
Allocate Evidence using Multiple Knapsack
          |
          v
Generate Investigation Results
          |
          v
Sensitivity Analysis / Link Failure Simulation
```

---

## API and Application Layer

The Flask application provides page routes and REST API endpoints for communication between the frontend and backend.

The application layer supports operations related to:

- Investigation management
- Asset management
- Evidence management
- Analyst information
- Network analysis
- Evidence allocation
- Sensitivity analysis
- Link failure simulation
- Reports and investigation results

The exact endpoints and request formats are defined in `app/routes.py`.

---

## Installation and Setup

### Prerequisites

- Python 3.10 or later
- Git
- pip

### 1. Clone the Repository

```bash
git clone https://github.com/Ubairapatujo/ForensiQ.git
cd ForensiQ
```

### 2. Select the Required Branch

For the original/core backend:

```bash
git switch main
```

For the separately maintained UI-integrated version:

```bash
git switch front-end
```

**Note:** The two branches are intentionally maintained separately. Select the version you want to work with before running the application.

### 3. Create a Virtual Environment

**Windows PowerShell:**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Running the Application

### Start the Flask Web Application

From the project directory, run:

```bash
flask --app "app:create_app()" run --debug
```

The application will be available at:

```text
http://127.0.0.1:5000
```

### Run the Algorithm Workflow

To execute the command-line algorithm workflow:

```bash
python main.py
```

The CLI runner processes investigation data and executes the configured algorithmic workflow.

---

## Testing

ForensiQ includes an automated test suite covering its core algorithms, application routes, API functionality, and regression checks.

Run all tests using:

```bash
python -m pytest -v
```

### Test Coverage

| Test Module | Coverage |
|---|---|
| `test_frontend_routes.py` | Application routes and API tests |
| `test_knapsack.py` | Evidence allocation and capacity constraints |
| `test_kruskal.py` | Minimum spanning forest and DFS reachability |
| `test_regressions.py` | Regression testing |
| `test_sensitivity.py` | Sensitivity analysis |
| `test_simulation.py` | Link failure simulation |

<details>
<summary><strong>Latest recorded test results</strong></summary>

```text
35 passed
11 warnings
```

All 35 automated tests passed in the recorded verification run.

The warnings were deprecation warnings and did not cause test failures.

</details>

---

## Git Branch Strategy

ForensiQ maintains two separate development branches to preserve the original backend implementation while supporting the separately updated UI-integrated version.

| Branch | Purpose |
|---|---|
| `main` | Maintains the original/core backend implementation. |
| `front-end` | Contains UI improvements and its separately updated backend integration. |

### Branch Separation

The branches are intentionally kept separate rather than automatically merging their changes.

- `main` preserves the original backend version.
- `front-end` contains the updated UI-integrated version.
- Changes are committed and pushed to their respective branches independently.
- A future integration should involve reviewing and selectively transferring the required changes.

This approach helps preserve the original backend while allowing independent UI development.

---

## Project Objectives

- Apply Design and Analysis of Algorithms concepts to digital forensics.
- Minimize the cost of forensic network connections.
- Identify accessible digital assets.
- Exclude evidence from inaccessible assets.
- Optimize evidence allocation among forensic analysts.
- Analyze network sensitivity and link failure scenarios.
- Present investigation results through a structured application interface.

---

## Future Enhancements

Potential future improvements include:

- Enhanced interactive forensic network visualization.
- Additional investigation scenarios and datasets.
- Expanded reporting and export functionality.
- Improved database and investigation management.
- Additional algorithmic optimization and performance analysis.
- Further automated testing and deployment support.

---

## Academic Information

**Project Name:** ForensiQ  
**Domain:** Cybersecurity / Digital Forensics  
**Course:** Design and Analysis of Algorithms (DAA)  
**Institution:** NED University of Engineering & Technology  
**Project Type:** Collaborative Academic Project

---

## Contributors

## Team

| Name | GitHub | Role |
|---|---|---|
| **Ubaira Patujo** | [@Ubairapatujo](https://github.com/Ubairapatujo) | **Repository Owner** |
| Ammarah Farooqi | [@Ammarahfarooqi](https://github.com/Ammarahfarooqi) | Collaborator |
| Saad Khan | [@Saadkhan0811](https://github.com/Saadkhan0811) | Collaborator |
| Syed Talal Bin Rizwan | [@SYEDTALALBINRIZWAN2006](https://github.com/SYEDTALALBINRIZWAN2006) | Collaborator |


**ForensiQ — Bringing Algorithmic Intelligence to Digital Forensics.**
