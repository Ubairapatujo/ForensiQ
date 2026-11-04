import pytest
from app import create_app, db
from app.models import Investigation


@pytest.fixture
def client():
    app = create_app(test_config={
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"
    })

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client
        with app.app_context():
            db.drop_all()


def test_all_11_page_routes(client):
    """
    Smoke test verifying that all 11 frontend pages return HTTP 200 OK
    and render without Jinja2 template errors.
    """
    routes = [
        ("/", "Dashboard"),
        ("/dashboard", "Dashboard"),
        ("/investigations", "Investigations"),
        ("/assets", "Assets"),
        ("/connections", "Connections"),
        ("/evidence", "Evidence"),
        ("/analysts", "Analysts"),
        ("/network", "Network Explorer"),
        ("/analysis", "Algorithm Analysis"),
        ("/simulation", "Failure Simulation"),
        ("/sensitivity", "Sensitivity Analysis"),
        ("/reports", "Reports"),
    ]

    for path, expected_text in routes:
        response = client.get(path)
        assert response.status_code == 200, f"Route {path} failed with {response.status_code}"
        assert expected_text.encode("utf-8") in response.data, f"Text '{expected_text}' not in {path}"
        assert b"ForensiQ" in response.data


def test_investigation_crud_api(client):
    """
    Test investigation creation, reading, updating, and deletion via API.
    """
    # 1. Create Investigation
    create_res = client.post(
        "/api/investigations",
        json={"name": "Cyber Incident 404", "description": "Intrusion analysis", "status": "Active"},
    )
    assert create_res.status_code == 201
    created_data = create_res.get_json()
    assert "investigation" in created_data
    inv_id = created_data["investigation"]["id"]
    assert created_data["investigation"]["name"] == "Cyber Incident 404"

    # 2. Get All Investigations
    list_res = client.get("/api/investigations")
    assert list_res.status_code == 200
    all_invs = list_res.get_json()
    assert len(all_invs) == 1
    assert all_invs[0]["id"] == inv_id

    # 3. Get Single Investigation
    get_res = client.get(f"/api/investigations/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.get_json()["name"] == "Cyber Incident 404"

    # 4. Update Investigation
    update_res = client.put(
        f"/api/investigations/{inv_id}",
        json={"name": "Cyber Incident 404 (Resolved)", "status": "Completed"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.get_json()
    assert updated_data["investigation"]["name"] == "Cyber Incident 404 (Resolved)"
    assert updated_data["investigation"]["status"] == "Completed"

    # 5. Delete Investigation
    del_res = client.delete(f"/api/investigations/{inv_id}")
    assert del_res.status_code == 200

    # 6. Verify Deleted (404)
    after_del_res = client.get(f"/api/investigations/{inv_id}")
    assert after_del_res.status_code == 404


def test_investigation_validation_errors(client):
    """
    Test server-side validation error handling on investigations.
    """
    # Empty name should fail
    res1 = client.post("/api/investigations", json={"name": "", "status": "Active"})
    assert res1.status_code == 400
    assert "required" in res1.get_json()["error"].lower()

    # Invalid status should fail
    res2 = client.post("/api/investigations", json={"name": "Valid Name", "status": "UnknownStatus"})
    assert res2.status_code == 400
    assert "status" in res2.get_json()["error"].lower()

    # Non-existent ID for update should return 404
    res3 = client.put("/api/investigations/9999", json={"name": "Nonexistent"})
    assert res3.status_code == 404


def test_assets_crud_and_validations(client):
    """
    Test Phase 3 Asset management: root constraints, importance score, and cascading checks.
    """
    # Create investigation
    inv_res = client.post("/api/investigations", json={"name": "Asset Test Inv", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    # 1. First asset MUST be root asset (non-root should fail with 400)
    bad_root_res = client.post(
        f"/api/investigations/{inv_id}/assets",
        json={"asset_id": "A01", "asset_name": "Laptop", "asset_type": "Computer", "importance_score": 10, "is_root": False}
    )
    assert bad_root_res.status_code == 400
    assert "root" in bad_root_res.get_json()["error"].lower()

    # 2. Creating root asset succeeds (201)
    a1_res = client.post(
        f"/api/investigations/{inv_id}/assets",
        json={"asset_id": "A01", "asset_name": "Laptop", "asset_type": "Computer", "importance_score": 10, "is_root": True}
    )
    assert a1_res.status_code == 201

    # 3. Duplicate asset ID returns 409
    dup_res = client.post(
        f"/api/investigations/{inv_id}/assets",
        json={"asset_id": "A01", "asset_name": "Another Laptop", "asset_type": "Computer", "importance_score": 5, "is_root": False}
    )
    assert dup_res.status_code == 409

    # 4. Importance score out of bounds (1..10) returns 400
    bad_imp_res = client.post(
        f"/api/investigations/{inv_id}/assets",
        json={"asset_id": "A02", "asset_name": "Phone", "asset_type": "Mobile", "importance_score": 15, "is_root": False}
    )
    assert bad_imp_res.status_code == 400

    # 5. Create valid second asset
    a2_res = client.post(
        f"/api/investigations/{inv_id}/assets",
        json={"asset_id": "A02", "asset_name": "Phone", "asset_type": "Mobile", "importance_score": 8, "is_root": False}
    )
    assert a2_res.status_code == 201

    # 6. Read all assets
    list_res = client.get(f"/api/investigations/{inv_id}/assets")
    assert list_res.status_code == 200
    assert len(list_res.get_json()) == 2

    # 7. Designating A02 as root demotes A01 automatically
    update_root_res = client.put(
        f"/api/investigations/{inv_id}/assets/A02",
        json={"is_root": True}
    )
    assert update_root_res.status_code == 200
    a1_check = client.get(f"/api/investigations/{inv_id}/assets/A01").get_json()
    a2_check = client.get(f"/api/investigations/{inv_id}/assets/A02").get_json()
    assert a1_check["is_root"] is False
    assert a2_check["is_root"] is True

    # 8. Deleting root asset while other assets exist returns 409
    del_root_res = client.delete(f"/api/investigations/{inv_id}/assets/A02")
    assert del_root_res.status_code == 409

    # 9. Deleting non-root asset succeeds
    del_non_root = client.delete(f"/api/investigations/{inv_id}/assets/A01")
    assert del_non_root.status_code == 200


def test_links_crud_and_validations(client):
    """
    Test Phase 3 Link management: self-connection rejection, non-negative cost, accessibility.
    """
    inv_res = client.post("/api/investigations", json={"name": "Links Test Inv", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    # Create two assets
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A1", "asset_name": "Server", "asset_type": "Server", "importance_score": 9, "is_root": True})
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A2", "asset_name": "Router", "asset_type": "Network", "importance_score": 7, "is_root": False})

    # 1. Self-link rejected (400)
    self_link = client.post(
        f"/api/investigations/{inv_id}/links",
        json={"link_id": "L1", "source_asset_id": "A1", "target_asset_id": "A1", "cost": 3.0}
    )
    assert self_link.status_code == 400
    assert "different" in self_link.get_json()["error"].lower()

    # 2. Negative cost rejected (400)
    neg_cost = client.post(
        f"/api/investigations/{inv_id}/links",
        json={"link_id": "L1", "source_asset_id": "A1", "target_asset_id": "A2", "cost": -2.0}
    )
    assert neg_cost.status_code == 400

    # 3. Create valid link (201)
    link_res = client.post(
        f"/api/investigations/{inv_id}/links",
        json={"link_id": "L1", "source_asset_id": "A1", "target_asset_id": "A2", "cost": 4.5, "is_accessible": True}
    )
    assert link_res.status_code == 201

    # 4. Duplicate link ID rejected (409)
    dup_link = client.post(
        f"/api/investigations/{inv_id}/links",
        json={"link_id": "L1", "source_asset_id": "A2", "target_asset_id": "A1", "cost": 1.0}
    )
    assert dup_link.status_code == 409

    # 5. Asset cannot be deleted while referenced by link (409)
    del_asset = client.delete(f"/api/investigations/{inv_id}/assets/A2")
    assert del_asset.status_code == 409

    # 6. Delete link succeeds
    del_link = client.delete(f"/api/investigations/{inv_id}/links/L1")
    assert del_link.status_code == 200


def test_evidence_crud_and_validations(client):
    """
    Test Phase 3 Evidence management: positive hours, non-negative value, asset foreign key.
    """
    inv_res = client.post("/api/investigations", json={"name": "Evidence Test Inv", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A1", "asset_name": "Workstation", "asset_type": "Computer", "importance_score": 8, "is_root": True})

    # 1. Nonexistent asset returns 400
    bad_asset = client.post(
        f"/api/investigations/{inv_id}/evidence",
        json={"evidence_id": "E1", "asset_id": "NONEXISTENT", "description": "Log", "examination_hours": 3, "estimated_value": 50.0}
    )
    assert bad_asset.status_code == 400

    # 2. Hours <= 0 returns 400
    zero_hours = client.post(
        f"/api/investigations/{inv_id}/evidence",
        json={"evidence_id": "E1", "asset_id": "A1", "description": "Log", "examination_hours": 0, "estimated_value": 50.0}
    )
    assert zero_hours.status_code == 400

    # 3. Value < 0 returns 400
    neg_val = client.post(
        f"/api/investigations/{inv_id}/evidence",
        json={"evidence_id": "E1", "asset_id": "A1", "description": "Log", "examination_hours": 2, "estimated_value": -10.0}
    )
    assert neg_val.status_code == 400

    # 4. Valid evidence creation (201)
    ev_res = client.post(
        f"/api/investigations/{inv_id}/evidence",
        json={"evidence_id": "E1", "asset_id": "A1", "description": "System Event Log", "examination_hours": 4, "estimated_value": 85.0}
    )
    assert ev_res.status_code == 201

    # 5. Delete evidence
    del_ev = client.delete(f"/api/investigations/{inv_id}/evidence/E1")
    assert del_ev.status_code == 200


def test_analysts_crud_and_validations(client):
    """
    Test Phase 3 Analyst management: max 3 analysts, capacity 1–16, unique capacities.
    """
    inv_res = client.post("/api/investigations", json={"name": "Analyst Test Inv", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    # 1. Capacity out of 1..16 bounds returns 400
    bad_cap = client.post(
        f"/api/investigations/{inv_id}/analysts",
        json={"analyst_id": "AN01", "analyst_name": "Analyst 1", "capacity_hours": 20}
    )
    assert bad_cap.status_code == 400

    # 2. Add Analyst 1 (capacity 8)
    a1 = client.post(
        f"/api/investigations/{inv_id}/analysts",
        json={"analyst_id": "AN01", "analyst_name": "Analyst 1", "capacity_hours": 8}
    )
    assert a1.status_code == 201

    # 3. Duplicate capacity returns 409
    dup_cap = client.post(
        f"/api/investigations/{inv_id}/analysts",
        json={"analyst_id": "AN02", "analyst_name": "Analyst 2", "capacity_hours": 8}
    )
    assert dup_cap.status_code == 409
    assert "unique" in dup_cap.get_json()["error"].lower()

    # 4. Add Analyst 2 (capacity 12) & Analyst 3 (capacity 16)
    a2 = client.post(f"/api/investigations/{inv_id}/analysts", json={"analyst_id": "AN02", "analyst_name": "Analyst 2", "capacity_hours": 12})
    a3 = client.post(f"/api/investigations/{inv_id}/analysts", json={"analyst_id": "AN03", "analyst_name": "Analyst 3", "capacity_hours": 16})
    assert a2.status_code == 201
    assert a3.status_code == 201

    # 5. 4th Analyst rejected with 409 (maximum 3 analysts)
    a4 = client.post(
        f"/api/investigations/{inv_id}/analysts",
        json={"analyst_id": "AN04", "analyst_name": "Analyst 4", "capacity_hours": 4}
    )
    assert a4.status_code == 409
    assert "three" in a4.get_json()["error"].lower()

    # 6. Delete analyst
    del_an = client.delete(f"/api/investigations/{inv_id}/analysts/AN03")
    assert del_an.status_code == 200
    assert len(client.get(f"/api/investigations/{inv_id}/analysts").get_json()) == 2


def test_network_graph_api(client):
    """
    Test Phase 4 PyVis network graph generation endpoint.
    """
    # 1. Non-existent investigation returns 404
    res_404 = client.get("/api/investigations/9999/network-graph")
    assert res_404.status_code == 404

    # 2. Setup investigation with assets and links
    inv_res = client.post("/api/investigations", json={"name": "Network Graph Test", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "NET_A1", "asset_name": "Gateway", "asset_type": "Server", "importance_score": 9, "is_root": True})
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "NET_A2", "asset_name": "Workstation", "asset_type": "Workstation", "importance_score": 6, "is_root": False})
    client.post(f"/api/investigations/{inv_id}/links", json={"link_id": "NET_L1", "source_asset_id": "NET_A1", "target_asset_id": "NET_A2", "cost": 3.5, "is_accessible": True})

    # 3. GET /api/investigations/<id>/network-graph returns 200 HTML with PyVis vis.js markup
    res = client.get(f"/api/investigations/{inv_id}/network-graph")
    assert res.status_code == 200
    assert "text/html" in res.content_type
    assert b"vis-network" in res.data or b"vis.Network" in res.data or b"mynetwork" in res.data
    assert b"NET_A1" in res.data
    assert b"NET_A2" in res.data

    # 4. Empty investigation returns clean "No Forensic Assets" placeholder HTML
    empty_inv_res = client.post("/api/investigations", json={"name": "Empty Inv", "status": "Active"})
    empty_id = empty_inv_res.get_json()["investigation"]["id"]
    res_empty = client.get(f"/api/investigations/{empty_id}/network-graph")
    assert res_empty.status_code == 200
    assert b"No Forensic Assets in this Investigation" in res_empty.data


def test_investigation_cascade_deletion(client):
    """
    Test cascade deletion of child records when investigation is deleted.
    """
    inv_res = client.post("/api/investigations", json={"name": "Cascade Test Case", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    # Add asset, analyst
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "CAS_A1", "asset_name": "Root", "asset_type": "Server", "importance_score": 10, "is_root": True})
    client.post(f"/api/investigations/{inv_id}/analysts", json={"analyst_id": "CAS_AN1", "analyst_name": "Analyst", "capacity_hours": 8})

    # Delete investigation
    del_res = client.delete(f"/api/investigations/{inv_id}")
    assert del_res.status_code == 200

    # Sub-resources now return 404
    assert client.get(f"/api/investigations/{inv_id}/assets").status_code == 404
    assert client.get(f"/api/investigations/{inv_id}/analysts").status_code == 404


def test_run_analysis_api_and_contracts(client):
    """
    Test Phase 4 run-analysis API integration, Kruskal MSF, DFS reachability,
    and Multiple Knapsack allocations with exact API contracts.
    """
    inv_res = client.post("/api/investigations", json={"name": "Optimization Case", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    # Preconditions check: < 2 assets returns 400
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A1", "asset_name": "DC", "asset_type": "Server", "importance_score": 10, "is_root": True})
    res_err1 = client.post(f"/api/investigations/{inv_id}/run-analysis")
    assert res_err1.status_code == 400

    # Add second and third asset
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A2", "asset_name": "Fileserver", "asset_type": "Server", "importance_score": 7, "is_root": False})
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A3", "asset_name": "Laptop", "asset_type": "Workstation", "importance_score": 5, "is_root": False})

    # Links: A1-A2 accessible, A2-A3 accessible
    client.post(f"/api/investigations/{inv_id}/links", json={"link_id": "L1", "source_asset_id": "A1", "target_asset_id": "A2", "cost": 4.0, "is_accessible": True})
    client.post(f"/api/investigations/{inv_id}/links", json={"link_id": "L2", "source_asset_id": "A2", "target_asset_id": "A3", "cost": 2.5, "is_accessible": True})

    # Evidence on assets
    client.post(f"/api/investigations/{inv_id}/evidence", json={"evidence_id": "E1", "asset_id": "A1", "description": "Auth Logs", "examination_hours": 3, "estimated_value": 75.0})
    client.post(f"/api/investigations/{inv_id}/evidence", json={"evidence_id": "E2", "asset_id": "A2", "description": "SAM Database", "examination_hours": 4, "estimated_value": 95.0})

    # Preconditions check: 0 analysts returns 400
    res_err2 = client.post(f"/api/investigations/{inv_id}/run-analysis")
    assert res_err2.status_code == 400
    assert "analysts" in res_err2.get_json()["error"].lower()

    # Add 2 analysts
    client.post(f"/api/investigations/{inv_id}/analysts", json={"analyst_id": "AN1", "analyst_name": "Lead Analyst", "capacity_hours": 8})
    client.post(f"/api/investigations/{inv_id}/analysts", json={"analyst_id": "AN2", "analyst_name": "Junior Analyst", "capacity_hours": 12})

    # Execute run-analysis
    res_success = client.post(f"/api/investigations/{inv_id}/run-analysis")
    assert res_success.status_code == 200
    data = res_success.get_json()

    # Verify all 8 response fields
    assert "selected_links" in data
    assert "total_access_cost" in data
    assert "reachable_assets" in data
    assert "unreachable_assets" in data
    assert "eligible_evidence" in data
    assert "maximum_evidence_value" in data
    assert "allocation" in data
    assert data["message"] == "Algorithm analysis completed successfully"

    # Verify values
    assert len(data["selected_links"]) == 2
    assert data["total_access_cost"] == 6.5
    assert "A1" in data["reachable_assets"]
    assert "A2" in data["reachable_assets"]
    assert "A3" in data["reachable_assets"]
    assert len(data["unreachable_assets"]) == 0
    assert data["maximum_evidence_value"] == 170.0  # 75 + 95 both fit within 8 and 12 capacity
    assert "Lead Analyst" in data["allocation"]
    assert "Junior Analyst" in data["allocation"]


def test_simulation_api_and_contracts(client):
    """
    Test Phase 5 Failure Simulation endpoint contracts and error validations.
    """
    inv_res = client.post("/api/investigations", json={"name": "Sim Case", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    # Add 4 assets
    for aid, imp, is_r in [("A1", 10, True), ("A2", 8, False), ("A3", 6, False), ("A4", 4, False)]:
        client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": aid, "asset_name": f"Node {aid}", "asset_type": "Server", "importance_score": imp, "is_root": is_r})

    # Add 4 links
    links_data = [
        ("L1", "A1", "A2", 2.0, True),
        ("L2", "A2", "A3", 3.0, True),
        ("L3", "A3", "A4", 4.0, True),
        ("L4", "A1", "A4", 5.0, True),
    ]
    for lid, s, t, cost, acc in links_data:
        client.post(f"/api/investigations/{inv_id}/links", json={"link_id": lid, "source_asset_id": s, "target_asset_id": t, "cost": cost, "is_accessible": acc})

    # 1. Non-list failed_link_ids returns 400
    res_bad1 = client.post(f"/api/investigations/{inv_id}/simulate", json={"failed_link_ids": "L1,L2,L3"})
    assert res_bad1.status_code == 400

    # 2. Less than 3 links returns 400
    res_bad2 = client.post(f"/api/investigations/{inv_id}/simulate", json={"failed_link_ids": ["L1", "L2"]})
    assert res_bad2.status_code == 400
    assert "three" in res_bad2.get_json()["error"].lower()

    # 3. More than 3 links returns 400
    res_bad3 = client.post(f"/api/investigations/{inv_id}/simulate", json={"failed_link_ids": ["L1", "L2", "L3", "L4"]})
    assert res_bad3.status_code == 400

    # 4. Valid simulation with exactly 3 accessible links returns 200
    res_valid = client.post(f"/api/investigations/{inv_id}/simulate", json={"failed_link_ids": ["L1", "L2", "L3"]})
    assert res_valid.status_code == 200
    data = res_valid.get_json()

    # Verify all contract fields
    assert "failed_link_ids" in data
    assert "updated_forest" in data
    assert "updated_cost" in data
    assert "incremental_cost" in data
    assert "incremental_forest" in data
    assert "incremental_time_ms" in data
    assert "recomputation_time_ms" in data
    assert "costs_match" in data
    assert "reachable_assets" in data
    assert "unreachable_assets" in data

    assert data["failed_link_ids"] == ["L1", "L2", "L3"]
    assert isinstance(data["costs_match"], bool)
    assert isinstance(data["incremental_time_ms"], (int, float))
    assert isinstance(data["recomputation_time_ms"], (int, float))


def test_sensitivity_api_and_contracts(client):
    """
    Test Phase 5 Sensitivity Analysis endpoint contracts and logic.
    """
    inv_res = client.post("/api/investigations", json={"name": "Sensitivity Case", "status": "Active"})
    inv_id = inv_res.get_json()["investigation"]["id"]

    # Add 4 assets: A1 root (imp 10), A2 (imp 9), A3 (imp 8), A4 (imp 3)
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A1", "asset_name": "DC", "asset_type": "Server", "importance_score": 10, "is_root": True})
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A2", "asset_name": "Database", "asset_type": "Server", "importance_score": 9, "is_root": False})
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A3", "asset_name": "Web", "asset_type": "Server", "importance_score": 8, "is_root": False})
    client.post(f"/api/investigations/{inv_id}/assets", json={"asset_id": "A4", "asset_name": "Terminal", "asset_type": "Workstation", "importance_score": 3, "is_root": False})

    # Add links
    client.post(f"/api/investigations/{inv_id}/links", json={"link_id": "L1", "source_asset_id": "A1", "target_asset_id": "A2", "cost": 2.0, "is_accessible": True})
    client.post(f"/api/investigations/{inv_id}/links", json={"link_id": "L2", "source_asset_id": "A1", "target_asset_id": "A3", "cost": 3.0, "is_accessible": True})
    client.post(f"/api/investigations/{inv_id}/links", json={"link_id": "L3", "source_asset_id": "A1", "target_asset_id": "A4", "cost": 4.0, "is_accessible": True})

    # Add evidence and analyst
    client.post(f"/api/investigations/{inv_id}/evidence", json={"evidence_id": "E1", "asset_id": "A4", "description": "Terminal Dump", "examination_hours": 3, "estimated_value": 50.0})
    client.post(f"/api/investigations/{inv_id}/analysts", json={"analyst_id": "AN1", "analyst_name": "Examiner", "capacity_hours": 8})

    # Execute sensitivity analysis
    res = client.post(f"/api/investigations/{inv_id}/sensitivity")
    assert res.status_code == 200
    data = res.get_json()

    # Verify all contract keys
    assert "removed_assets" in data
    assert "total_access_cost" in data
    assert "selected_links" in data
    assert "reachable_assets" in data
    assert "unreachable_assets" in data
    assert "maximum_evidence_value" in data
    assert "allocation" in data

    # Verify the 2 highest-importance non-root assets (A2, A3) were removed
    assert len(data["removed_assets"]) == 2
    assert "A2" in data["removed_assets"]
    assert "A3" in data["removed_assets"]
    assert "A1" not in data["removed_assets"]  # Root asset must be preserved
    assert "A1" in data["reachable_assets"]



