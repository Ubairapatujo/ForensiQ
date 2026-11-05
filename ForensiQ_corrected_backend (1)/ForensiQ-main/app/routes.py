from flask import Blueprint, request, jsonify, render_template, current_app
import math
from app import db
from app.models import Investigation, Asset, Link, Evidence, Analyst

from src.database_adapter import (
    convert_to_dataframes,
    execute_kruskal_analysis,
    execute_knapsack_analysis,
    execute_simulation,
    execute_sensitivity_analysis
)

main = Blueprint("main", __name__)


# ==============================
# FRONTEND PAGE ROUTES (HTML)
# ==============================

@main.route("/", methods=["GET"])
@main.route("/dashboard", methods=["GET"])
def dashboard_page():
    return render_template("dashboard.html", active_page="dashboard")


@main.route("/investigations", methods=["GET"])
def investigations_page():
    return render_template("investigations.html", active_page="investigations")


@main.route("/assets", methods=["GET"])
def assets_page():
    return render_template("assets.html", active_page="assets")


@main.route("/connections", methods=["GET"])
def connections_page():
    return render_template("connections.html", active_page="connections")


@main.route("/evidence", methods=["GET"])
def evidence_page():
    return render_template("evidence.html", active_page="evidence")


@main.route("/analysts", methods=["GET"])
def analysts_page():
    return render_template("analysts.html", active_page="analysts")


@main.route("/network", methods=["GET"])
def network_page():
    return render_template("network.html", active_page="network")


@main.route("/analysis", methods=["GET"])
def analysis_page():
    return render_template("analysis.html", active_page="analysis")


@main.route("/simulation", methods=["GET"])
def simulation_page():
    return render_template("simulation.html", active_page="simulation")


@main.route("/sensitivity", methods=["GET"])
def sensitivity_page():
    return render_template("sensitivity.html", active_page="sensitivity")


@main.route("/reports", methods=["GET"])
def reports_page():
    return render_template("reports.html", active_page="reports")



# CREATE: Add a new investigation
@main.route("/api/investigations", methods=["POST"])
def create_investigation():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    name = data.get("name")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Investigation name is required"}), 400

    status = data.get("status", "Active")

    if status not in ["Active", "Completed", "Archived"]:
        return jsonify({"error": "Invalid investigation status"}), 400

    investigation = Investigation(
        name=name.strip(),
        description=data.get("description"),
        status=status
    )

    db.session.add(investigation)
    db.session.commit()

    return jsonify({
        "message": "Investigation created successfully",
        "investigation": {
            "id": investigation.id,
            "name": investigation.name,
            "description": investigation.description,
            "status": investigation.status,
            "created_at": investigation.created_at.isoformat()
        }
    }), 201


# READ: Get all investigations
@main.route("/api/investigations", methods=["GET"])
def get_investigations():
    investigations = Investigation.query.order_by(
        Investigation.id.desc()
    ).all()

    result = []

    for item in investigations:
        result.append({
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "status": item.status,
            "created_at": item.created_at.isoformat()
        })

    return jsonify(result), 200


# READ: Get one investigation
@main.route("/api/investigations/<int:investigation_id>", methods=["GET"])
def get_investigation(investigation_id):
    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    return jsonify({
        "id": investigation.id,
        "name": investigation.name,
        "description": investigation.description,
        "status": investigation.status,
        "created_at": investigation.created_at.isoformat()
    }), 200


# UPDATE: Edit an investigation
@main.route("/api/investigations/<int:investigation_id>", methods=["PUT"])
def update_investigation(investigation_id):
    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    if "name" in data:
        if not isinstance(data["name"], str) or not data["name"].strip():
            return jsonify({"error": "Name cannot be empty"}), 400
        investigation.name = data["name"].strip()

    if "description" in data:
        investigation.description = data["description"]

    if "status" in data:
        if data["status"] not in ["Active", "Completed", "Archived"]:
            return jsonify({"error": "Invalid investigation status"}), 400
        investigation.status = data["status"]

    db.session.commit()

    return jsonify({
        "message": "Investigation updated successfully",
        "investigation": {
            "id": investigation.id,
            "name": investigation.name,
            "description": investigation.description,
            "status": investigation.status,
            "created_at": investigation.created_at.isoformat()
        }
    }), 200


# DELETE: Delete an investigation
@main.route("/api/investigations/<int:investigation_id>", methods=["DELETE"])
def delete_investigation(investigation_id):
    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    db.session.delete(investigation)
    db.session.commit()

    return jsonify({
        "message": "Investigation deleted successfully"
    }), 200


# ==============================
# ASSET MANAGEMENT APIs
# ==============================



def asset_to_dict(asset):
    return {
        "asset_id": asset.asset_id,
        "asset_name": asset.asset_name,
        "asset_type": asset.asset_type,
        "importance_score": asset.importance_score,
        "is_root": asset.is_root,
        "investigation_id": asset.investigation_id
    }


# CREATE ASSET
@main.route(
    "/api/investigations/<int:investigation_id>/assets",
    methods=["POST"]
)
def create_asset(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    asset_id = data.get("asset_id")
    asset_name = data.get("asset_name")
    asset_type = data.get("asset_type")
    importance = data.get("importance_score")
    is_root = data.get("is_root", False)

    if not all(
        isinstance(value, str) and value.strip()
        for value in [asset_id, asset_name, asset_type]
    ):
        return jsonify({
            "error": "asset_id, asset_name and asset_type are required"
        }), 400

    if type(importance) is not int or not 1 <= importance <= 10:
        return jsonify({
            "error": "importance_score must be an integer from 1 to 10"
        }), 400

    if type(is_root) is not bool:
        return jsonify({"error": "is_root must be true or false"}), 400

    existing = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=asset_id.strip()
    ).first()

    if existing:
        return jsonify({"error": "Asset ID already exists"}), 409

    # Enforce exactly one root asset per investigation.
    existing_root = Asset.query.filter_by(
        investigation_id=investigation_id,
        is_root=True
    ).first()

    existing_assets = Asset.query.filter_by(
        investigation_id=investigation_id
    ).first()

    if existing_assets is None and is_root is False:
        return jsonify({
            "error": "The first asset must be the root asset"
        }), 400

    if is_root and existing_root:
        existing_root.is_root = False

    asset = Asset(
        investigation_id=investigation_id,
        asset_id=asset_id.strip(),
        asset_name=asset_name.strip(),
        asset_type=asset_type.strip(),
        importance_score=importance,
        is_root=is_root
    )

    db.session.add(asset)
    db.session.commit()

    return jsonify({
        "message": "Asset created successfully",
        "asset": asset_to_dict(asset)
    }), 201


# READ ALL ASSETS
@main.route(
    "/api/investigations/<int:investigation_id>/assets",
    methods=["GET"]
)
def get_assets(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    assets = Asset.query.filter_by(
        investigation_id=investigation_id
    ).all()

    return jsonify([asset_to_dict(a) for a in assets]), 200


# READ ONE ASSET
@main.route(
    "/api/investigations/<int:investigation_id>/assets/<string:asset_id>",
    methods=["GET"]
)
def get_asset(investigation_id, asset_id):

    asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=asset_id
    ).first()

    if asset is None:
        return jsonify({"error": "Asset not found"}), 404

    return jsonify(asset_to_dict(asset)), 200


# UPDATE ASSET
@main.route(
    "/api/investigations/<int:investigation_id>/assets/<string:asset_id>",
    methods=["PUT"]
)
def update_asset(investigation_id, asset_id):

    asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=asset_id
    ).first()

    if asset is None:
        return jsonify({"error": "Asset not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    if "asset_name" in data:
        if not isinstance(data["asset_name"], str) or not data["asset_name"].strip():
            return jsonify({"error": "Invalid asset name"}), 400
        asset.asset_name = data["asset_name"].strip()

    if "asset_type" in data:
        if not isinstance(data["asset_type"], str) or not data["asset_type"].strip():
            return jsonify({"error": "Invalid asset type"}), 400
        asset.asset_type = data["asset_type"].strip()

    if "importance_score" in data:
        value = data["importance_score"]
        if type(value) is not int or not 1 <= value <= 10:
            return jsonify({"error": "Importance score must be from 1 to 10"}), 400
        asset.importance_score = value

    if "is_root" in data:
        new_root_status = data["is_root"]

        if type(new_root_status) is not bool:
            return jsonify({
                "error": "is_root must be true or false"
            }), 400

        if new_root_status:
            # Selecting a new root automatically demotes the old root.
            existing_root = Asset.query.filter(
                Asset.investigation_id == investigation_id,
                Asset.is_root.is_(True),
                Asset.id != asset.id
            ).first()

            if existing_root:
                existing_root.is_root = False

            asset.is_root = True

        else:
            # Do not allow removing the only root.
            other_root = Asset.query.filter(
                Asset.investigation_id == investigation_id,
                Asset.is_root.is_(True),
                Asset.id != asset.id
            ).first()

            if asset.is_root and other_root is None:
                return jsonify({
                    "error": "An investigation must have exactly one root asset"
                }), 400

            asset.is_root = False
    

    db.session.commit()

    return jsonify({
        "message": "Asset updated successfully",
        "asset": asset_to_dict(asset)
    }), 200


# DELETE ASSET
@main.route(
    "/api/investigations/<int:investigation_id>/assets/<string:asset_id>",
    methods=["DELETE"]
)
def delete_asset(investigation_id, asset_id):

    asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=asset_id
    ).first()

    if asset is None:
        return jsonify({"error": "Asset not found"}), 404

    # Prevent deleting an asset that is referenced by links or evidence.
    from app.models import Link, Evidence

    linked = Link.query.filter(
        Link.investigation_id == investigation_id,
        db.or_(
            Link.source_asset_id == asset_id,
            Link.target_asset_id == asset_id
        )
    ).first()

    has_evidence = Evidence.query.filter_by(
        investigation_id=investigation_id,
        asset_id=asset_id
    ).first()

    if linked or has_evidence:
        return jsonify({
            "error": "Cannot delete asset while links or evidence reference it"
        }), 409
    
    if asset.is_root:
        other_assets = Asset.query.filter(
            Asset.investigation_id == investigation_id,
            Asset.id != asset.id
        ).count()

        if other_assets > 0:
            return jsonify({
                "error": "Select another root asset before deleting this asset"
            }), 409
        
    db.session.delete(asset)
    db.session.commit()

    return jsonify({"message": "Asset deleted successfully"}), 200

# ==============================
# LINK MANAGEMENT APIs
# ==============================


def link_to_dict(link):
    return {
        "link_id": link.link_id,
        "source_asset_id": link.source_asset_id,
        "target_asset_id": link.target_asset_id,
        "cost": link.cost,
        "is_accessible": link.is_accessible,
        "investigation_id": link.investigation_id
    }


# CREATE LINK
@main.route(
    "/api/investigations/<int:investigation_id>/links",
    methods=["POST"]
)
def create_link(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    link_id = data.get("link_id")
    source_id = data.get("source_asset_id")
    target_id = data.get("target_asset_id")
    cost = data.get("cost")
    is_accessible = data.get("is_accessible", True)

    if not all(
        isinstance(value, str) and value.strip()
        for value in [link_id, source_id, target_id]
    ):
        return jsonify({
            "error": "link_id, source_asset_id and target_asset_id are required"
        }), 400

    if source_id.strip() == target_id.strip():
        return jsonify({
            "error": "Source and target assets must be different"
        }), 400

    if type(cost) not in [int, float] or not math.isfinite(cost) or cost < 0:
        return jsonify({
            "error": "Cost must be a non-negative number"
        }), 400

    if type(is_accessible) is not bool:
        return jsonify({
            "error": "is_accessible must be true or false"
        }), 400

    existing = Link.query.filter_by(
        investigation_id=investigation_id,
        link_id=link_id.strip()
    ).first()

    if existing:
        return jsonify({"error": "Link ID already exists"}), 409

    source_asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=source_id.strip()
    ).first()

    target_asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=target_id.strip()
    ).first()

    if source_asset is None or target_asset is None:
        return jsonify({
            "error": "Both source and target assets must exist in this investigation"
        }), 400

    link = Link(
        investigation_id=investigation_id,
        link_id=link_id.strip(),
        source_asset_id=source_id.strip(),
        target_asset_id=target_id.strip(),
        cost=cost,
        is_accessible=is_accessible
    )

    db.session.add(link)
    db.session.commit()

    return jsonify({
        "message": "Link created successfully",
        "link": link_to_dict(link)
    }), 201


# READ ALL LINKS
@main.route(
    "/api/investigations/<int:investigation_id>/links",
    methods=["GET"]
)
def get_links(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    links = Link.query.filter_by(
        investigation_id=investigation_id
    ).all()

    return jsonify([link_to_dict(link) for link in links]), 200


# READ ONE LINK
@main.route(
    "/api/investigations/<int:investigation_id>/links/<string:link_id>",
    methods=["GET"]
)
def get_link(investigation_id, link_id):

    link = Link.query.filter_by(
        investigation_id=investigation_id,
        link_id=link_id
    ).first()

    if link is None:
        return jsonify({"error": "Link not found"}), 404

    return jsonify(link_to_dict(link)), 200

# UPDATE LINK
@main.route(
    "/api/investigations/<int:investigation_id>/links/<string:link_id>",
    methods=["PUT"]
)
def update_link(investigation_id, link_id):

    link = Link.query.filter_by(
        investigation_id=investigation_id,
        link_id=link_id
    ).first()

    if link is None:
        return jsonify({"error": "Link not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    source_id = data.get("source_asset_id", link.source_asset_id)
    target_id = data.get("target_asset_id", link.target_asset_id)

    if not isinstance(source_id, str) or not source_id.strip():
        return jsonify({"error": "Invalid source asset ID"}), 400

    if not isinstance(target_id, str) or not target_id.strip():
        return jsonify({"error": "Invalid target asset ID"}), 400

    source_id = source_id.strip()
    target_id = target_id.strip()

    if source_id == target_id:
        return jsonify({
            "error": "Source and target assets must be different"
        }), 400

    source_asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=source_id
    ).first()

    target_asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=target_id
    ).first()

    if source_asset is None or target_asset is None:
        return jsonify({
            "error": "Both source and target assets must exist in this investigation"
        }), 400

    if "cost" in data:
        cost = data["cost"]

        if type(cost) not in [int, float] or not math.isfinite(cost) or cost < 0:
            return jsonify({
                "error": "Cost must be a non-negative number"
            }), 400

        link.cost = cost

    if "is_accessible" in data:
        if type(data["is_accessible"]) is not bool:
            return jsonify({
                "error": "is_accessible must be true or false"
            }), 400

        link.is_accessible = data["is_accessible"]

    link.source_asset_id = source_id
    link.target_asset_id = target_id

    db.session.commit()

    return jsonify({
        "message": "Link updated successfully",
        "link": link_to_dict(link)
    }), 200


# DELETE LINK
@main.route(
    "/api/investigations/<int:investigation_id>/links/<string:link_id>",
    methods=["DELETE"]
)
def delete_link(investigation_id, link_id):

    link = Link.query.filter_by(
        investigation_id=investigation_id,
        link_id=link_id
    ).first()

    if link is None:
        return jsonify({"error": "Link not found"}), 404

    db.session.delete(link)
    db.session.commit()

    return jsonify({
        "message": "Link deleted successfully"
    }), 200

# ==============================
# EVIDENCE MANAGEMENT APIs
# ==============================


def evidence_to_dict(evidence):
    return {
        "evidence_id": evidence.evidence_id,
        "asset_id": evidence.asset_id,
        "description": evidence.description,
        "examination_hours": evidence.examination_hours,
        "estimated_value": evidence.estimated_value,
        "investigation_id": evidence.investigation_id
    }


# CREATE EVIDENCE
@main.route(
    "/api/investigations/<int:investigation_id>/evidence",
    methods=["POST"]
)
def create_evidence(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    evidence_id = data.get("evidence_id")
    asset_id = data.get("asset_id")
    description = data.get("description")
    hours = data.get("examination_hours")
    value = data.get("estimated_value")

    if not all(
        isinstance(v, str) and v.strip()
        for v in [evidence_id, asset_id, description]
    ):
        return jsonify({
            "error": "evidence_id, asset_id and description are required"
        }), 400

    if type(hours) is not int or hours <= 0:
        return jsonify({
            "error": "examination_hours must be a positive integer"
        }), 400

    if type(value) not in [int, float] or not math.isfinite(value) or value < 0:
        return jsonify({
            "error": "estimated_value must be a non-negative number"
        }), 400

    asset = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=asset_id.strip()
    ).first()

    if asset is None:
        return jsonify({
            "error": "Asset not found in this investigation"
        }), 400

    existing = Evidence.query.filter_by(
        investigation_id=investigation_id,
        evidence_id=evidence_id.strip()
    ).first()

    if existing:
        return jsonify({"error": "Evidence ID already exists"}), 409

    evidence = Evidence(
        investigation_id=investigation_id,
        evidence_id=evidence_id.strip(),
        asset_id=asset_id.strip(),
        description=description.strip(),
        examination_hours=hours,
        estimated_value=value
    )

    db.session.add(evidence)
    db.session.commit()

    return jsonify({
        "message": "Evidence created successfully",
        "evidence": evidence_to_dict(evidence)
    }), 201


# READ ALL EVIDENCE
@main.route(
    "/api/investigations/<int:investigation_id>/evidence",
    methods=["GET"]
)
def get_all_evidence(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    evidence_list = Evidence.query.filter_by(
        investigation_id=investigation_id
    ).all()

    return jsonify([
        evidence_to_dict(item) for item in evidence_list
    ]), 200


# READ ONE EVIDENCE
@main.route(
    "/api/investigations/<int:investigation_id>/evidence/<string:evidence_id>",
    methods=["GET"]
)
def get_evidence(investigation_id, evidence_id):

    evidence = Evidence.query.filter_by(
        investigation_id=investigation_id,
        evidence_id=evidence_id
    ).first()

    if evidence is None:
        return jsonify({"error": "Evidence not found"}), 404

    return jsonify(evidence_to_dict(evidence)), 200


# UPDATE EVIDENCE
@main.route(
    "/api/investigations/<int:investigation_id>/evidence/<string:evidence_id>",
    methods=["PUT"]
)
def update_evidence(investigation_id, evidence_id):

    evidence = Evidence.query.filter_by(
        investigation_id=investigation_id,
        evidence_id=evidence_id
    ).first()

    if evidence is None:
        return jsonify({"error": "Evidence not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    if "asset_id" in data:
        asset_id = data["asset_id"]

        if not isinstance(asset_id, str) or not asset_id.strip():
            return jsonify({"error": "Invalid asset ID"}), 400

        asset_id = asset_id.strip()

        asset = Asset.query.filter_by(
            investigation_id=investigation_id,
            asset_id=asset_id
        ).first()

        if asset is None:
            return jsonify({
                "error": "Asset not found in this investigation"
            }), 400

        evidence.asset_id = asset_id

    if "description" in data:
        if not isinstance(data["description"], str) or not data["description"].strip():
            return jsonify({"error": "Invalid description"}), 400

        evidence.description = data["description"].strip()

    if "examination_hours" in data:
        hours = data["examination_hours"]

        if type(hours) is not int or hours <= 0:
            return jsonify({
                "error": "examination_hours must be a positive integer"
            }), 400

        evidence.examination_hours = hours

    if "estimated_value" in data:
        value = data["estimated_value"]

        if type(value) not in [int, float] or not math.isfinite(value) or value < 0:
            return jsonify({
                "error": "estimated_value must be a non-negative number"
            }), 400

        evidence.estimated_value = value

    db.session.commit()

    return jsonify({
        "message": "Evidence updated successfully",
        "evidence": evidence_to_dict(evidence)
    }), 200


# DELETE EVIDENCE
@main.route(
    "/api/investigations/<int:investigation_id>/evidence/<string:evidence_id>",
    methods=["DELETE"]
)
def delete_evidence(investigation_id, evidence_id):

    evidence = Evidence.query.filter_by(
        investigation_id=investigation_id,
        evidence_id=evidence_id
    ).first()

    if evidence is None:
        return jsonify({"error": "Evidence not found"}), 404

    db.session.delete(evidence)
    db.session.commit()

    return jsonify({
        "message": "Evidence deleted successfully"
    }), 200

# ==============================
# ANALYST MANAGEMENT APIs
# ==============================


def analyst_to_dict(analyst):
    return {
        "analyst_id": analyst.analyst_id,
        "analyst_name": analyst.analyst_name,
        "capacity_hours": analyst.capacity_hours,
        "investigation_id": analyst.investigation_id
    }


# CREATE ANALYST
@main.route(
    "/api/investigations/<int:investigation_id>/analysts",
    methods=["POST"]
)
def create_analyst(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    analyst_id = data.get("analyst_id")
    analyst_name = data.get("analyst_name")
    capacity = data.get("capacity_hours")

    if not isinstance(analyst_id, str) or not analyst_id.strip():
        return jsonify({"error": "Analyst ID is required"}), 400

    if not isinstance(analyst_name, str) or not analyst_name.strip():
        return jsonify({"error": "Analyst name is required"}), 400

    if type(capacity) is not int or not 1 <= capacity <= 16:
        return jsonify({
            "error": "capacity_hours must be an integer from 1 to 16"
        }), 400
    
    # Maximum three analysts per investigation.
    analyst_count = Analyst.query.filter_by(
        investigation_id=investigation_id
    ).count()

    if analyst_count >= 3:
        return jsonify({
            "error": "Maximum three analysts are allowed per investigation"
        }), 409

    # Capacity must be unique within the investigation.
    existing_capacity = Analyst.query.filter_by(
        investigation_id=investigation_id,
        capacity_hours=capacity
    ).first()

    if existing_capacity:
        return jsonify({
            "error": "Each analyst must have a unique capacity"
        }), 409
    
    existing = Analyst.query.filter_by(
        investigation_id=investigation_id,
        analyst_id=analyst_id.strip()
    ).first()

    if existing:
        return jsonify({"error": "Analyst ID already exists"}), 409

    analyst = Analyst(
        investigation_id=investigation_id,
        analyst_id=analyst_id.strip(),
        analyst_name=analyst_name.strip(),
        capacity_hours=capacity
    )

    db.session.add(analyst)
    db.session.commit()

    return jsonify({
        "message": "Analyst created successfully",
        "analyst": analyst_to_dict(analyst)
    }), 201


# READ ALL ANALYSTS
@main.route(
    "/api/investigations/<int:investigation_id>/analysts",
    methods=["GET"]
)
def get_analysts(investigation_id):

    investigation = db.session.get(Investigation, investigation_id)

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    analysts = Analyst.query.filter_by(
        investigation_id=investigation_id
    ).all()

    return jsonify([
        analyst_to_dict(item) for item in analysts
    ]), 200


# READ ONE ANALYST
@main.route(
    "/api/investigations/<int:investigation_id>/analysts/<string:analyst_id>",
    methods=["GET"]
)
def get_analyst(investigation_id, analyst_id):

    analyst = Analyst.query.filter_by(
        investigation_id=investigation_id,
        analyst_id=analyst_id
    ).first()

    if analyst is None:
        return jsonify({"error": "Analyst not found"}), 404

    return jsonify(analyst_to_dict(analyst)), 200


# UPDATE ANALYST
@main.route(
    "/api/investigations/<int:investigation_id>/analysts/<string:analyst_id>",
    methods=["PUT"]
)
def update_analyst(investigation_id, analyst_id):

    analyst = Analyst.query.filter_by(
        investigation_id=investigation_id,
        analyst_id=analyst_id
    ).first()

    if analyst is None:
        return jsonify({"error": "Analyst not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON body required"}), 400

    if "analyst_name" in data:
        name = data["analyst_name"]

        if not isinstance(name, str) or not name.strip():
            return jsonify({"error": "Invalid analyst name"}), 400

        analyst.analyst_name = name.strip()

    if "capacity_hours" in data:
        capacity = data["capacity_hours"]

        if type(capacity) is not int or not 1 <= capacity <= 16:
            return jsonify({
                "error": "capacity_hours must be an integer from 1 to 16"
            }), 400

        existing_capacity = Analyst.query.filter(
            Analyst.investigation_id == investigation_id,
            Analyst.capacity_hours == capacity,
            Analyst.id != analyst.id
        ).first()

        if existing_capacity:
            return jsonify({
                "error": "Each analyst must have a unique capacity"
            }), 409

        analyst.capacity_hours = capacity

    db.session.commit()

    return jsonify({
        "message": "Analyst updated successfully",
        "analyst": analyst_to_dict(analyst)
    }), 200


# DELETE ANALYST
@main.route(
    "/api/investigations/<int:investigation_id>/analysts/<string:analyst_id>",
    methods=["DELETE"]
)
def delete_analyst(investigation_id, analyst_id):

    analyst = Analyst.query.filter_by(
        investigation_id=investigation_id,
        analyst_id=analyst_id
    ).first()

    if analyst is None:
        return jsonify({"error": "Analyst not found"}), 404

    db.session.delete(analyst)
    db.session.commit()

    return jsonify({
        "message": "Analyst deleted successfully"
    }), 200
# ==============================
# ALGORITHM EXECUTION API
# ==============================

@main.route(
    "/api/investigations/<int:investigation_id>/run-analysis",
    methods=["POST"]
)
def run_analysis(investigation_id):

    investigation = db.session.get(
        Investigation, investigation_id
    )

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    assets = Asset.query.filter_by(
        investigation_id=investigation_id
    ).all()

    links = Link.query.filter_by(
        investigation_id=investigation_id
    ).all()

    evidence = Evidence.query.filter_by(
        investigation_id=investigation_id
    ).all()

    analysts = Analyst.query.filter_by(
        investigation_id=investigation_id
    ).all()

    if len(assets) < 2:
        return jsonify({"error": "At least two assets are required"}), 400

    if not 1 <= len(analysts) <= 3:
        return jsonify({
            "error": "Investigation must have 1 to 3 analysts"
        }), 400

    try:
        assets_df, links_df, evidence_df, analysts_df = (
            convert_to_dataframes(
                assets, links, evidence, analysts
            )
        )

        network_result = execute_kruskal_analysis(
            assets_df, links_df
        )

        reachable = network_result["reachable_assets"]

        eligible_evidence_df = evidence_df[
            evidence_df["asset_id"].isin(reachable)
        ]

        knapsack_result = execute_knapsack_analysis(
            eligible_evidence_df, analysts_df
        )

        return jsonify({
            "message": "Algorithm analysis completed successfully",
            "selected_links": network_result["selected_links"],
            "total_access_cost": network_result["total_cost"],
            "reachable_assets": reachable,
            "unreachable_assets": network_result["unreachable_assets"],
            "eligible_evidence": eligible_evidence_df.to_dict(
                orient="records"
            ),
            "maximum_evidence_value": knapsack_result["maximum_value"],
            "allocation": knapsack_result["allocation"]
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

# ==============================
# LINK FAILURE SIMULATION API
# ==============================

@main.route(
    "/api/investigations/<int:investigation_id>/simulate",
    methods=["POST"]
)
def run_simulation(investigation_id):

    investigation = db.session.get(
        Investigation, investigation_id
    )

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    data = request.get_json(silent=True) or {}
    failed_link_ids = data.get("failed_link_ids")

    if not isinstance(failed_link_ids, list):
        return jsonify({
            "error": "failed_link_ids must be a list"
        }), 400

    if len(failed_link_ids) != 3 or any(
        not isinstance(item, str) or not item.strip() for item in failed_link_ids
    ):
        return jsonify({"error": "Select exactly three nonempty link IDs"}), 400

    assets = Asset.query.filter_by(
        investigation_id=investigation_id
    ).all()

    links = Link.query.filter_by(
        investigation_id=investigation_id
    ).all()

    already_inaccessible = {
        link.link_id for link in links if not link.is_accessible
    }
    if already_inaccessible.intersection(failed_link_ids):
        return jsonify({"error": "Failed links must currently be accessible"}), 400

    try:
        assets_df, links_df, _, _ = convert_to_dataframes(
            assets, links, [], []
        )

        result = execute_simulation(
            assets_df,
            links_df,
            failed_link_ids
        )

        return jsonify({
            "message": "Link failure simulation completed successfully",
            "failed_link_ids": result["failed_link_ids"],
            "updated_forest": result["updated_forest"],
            "updated_cost": result["updated_cost"],
            "incremental_cost": result["incremental_cost"],
            "incremental_forest": result["incremental_forest"],
            "incremental_time_ms": result["incremental_time_ms"],
            "recomputation_time_ms": result["recomputation_time_ms"],
            "costs_match": result["costs_match"],
            "reachable_assets": result["reachable_assets"],
            "unreachable_assets": result["unreachable_assets"]
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


# ==============================
# SENSITIVITY ANALYSIS API
# ==============================

@main.route(
    "/api/investigations/<int:investigation_id>/sensitivity",
    methods=["POST"]
)
def run_sensitivity(investigation_id):

    investigation = db.session.get(
        Investigation, investigation_id
    )

    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    assets = Asset.query.filter_by(
        investigation_id=investigation_id
    ).all()

    links = Link.query.filter_by(
        investigation_id=investigation_id
    ).all()

    evidence = Evidence.query.filter_by(
        investigation_id=investigation_id
    ).all()

    analysts = Analyst.query.filter_by(
        investigation_id=investigation_id
    ).all()

    try:
        assets_df, links_df, evidence_df, analysts_df = (
            convert_to_dataframes(
                assets, links, evidence, analysts
            )
        )

        result = execute_sensitivity_analysis(
            assets_df,
            links_df,
            analysts_df,
            evidence_df
        )

        return jsonify({
            "message": "Sensitivity analysis completed successfully",
            "removed_assets": result["removed_assets"],
            "total_access_cost": result["total_cost"],
            "selected_links": result["selected_links"],
            "reachable_assets": result["reachable_assets"],
            "unreachable_assets": result["unreachable_assets"],
            "maximum_evidence_value": result["maximum_value"],
            "allocation": result["allocation"]
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


# ==============================
# PYVIS NETWORK VISUALIZATION API
# ==============================
@main.route(
    "/api/investigations/<int:investigation_id>/network-graph",
    methods=["GET"]
)
def get_network_graph(investigation_id):
    investigation = db.session.get(Investigation, investigation_id)
    if investigation is None:
        return jsonify({"error": "Investigation not found"}), 404

    assets = Asset.query.filter_by(investigation_id=investigation_id).all()
    links = Link.query.filter_by(investigation_id=investigation_id).all()

    if not assets:
        return (
            """<!DOCTYPE html>
            <html><body style="background:#0B1220; color:#94A3B8; font-family:Inter,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
            <div style="text-align:center;">
                <p style="font-size:1.15rem; color:#F1F5F9; font-weight:600;">No Forensic Assets in this Investigation</p>
                <p style="font-size:0.85rem;">Add assets to render the interactive PyVis topology.</p>
            </div>
            </body></html>""",
            200,
            {"Content-Type": "text/html"}
        )

    try:
        from pyvis.network import Network

        net = Network(
            height="100%",
            width="100%",
            bgcolor="#0B1220",
            font_color="#F1F5F9",
            directed=False
        )

        selected_links_ids = set()
        reachable_ids = set()
        unreachable_ids = set()

        has_root = sum(1 for a in assets if a.is_root) == 1
        if len(assets) >= 2 and has_root:
            try:
                assets_df, links_df, _, _ = convert_to_dataframes(assets, links, [], [])
                kr_res = execute_kruskal_analysis(assets_df, links_df)
                selected_links_ids = {l["link_id"] for l in kr_res["selected_links"]}
                reachable_ids = set(kr_res["reachable_assets"])
                unreachable_ids = set(kr_res["unreachable_assets"])
            except Exception as exc:
                current_app.logger.warning(
                    f"Kruskal MST analysis failed during network graph generation for investigation #{investigation_id}: {exc}"
                )

        for a in assets:
            if a.is_root:
                net.add_node(
                    a.asset_id,
                    label=f"ROOT\n{a.asset_id}",
                    title=f"Root Asset: {a.asset_name}\nType: {a.asset_type}\nImportance: {a.importance_score}/10",
                    color={"background": "#FBBF24", "border": "#F59E0B", "highlight": {"background": "#FDE047", "border": "#FBBF24"}},
                    shape="diamond",
                    size=36,
                    borderWidth=3
                )
            elif a.asset_id in reachable_ids:
                net.add_node(
                    a.asset_id,
                    label=f"{a.asset_id}\n({a.asset_type})",
                    title=f"{a.asset_name}\nID: {a.asset_id}\nType: {a.asset_type}\nImportance: {a.importance_score}/10\nReachable: YES",
                    color={"background": "#38BDF8", "border": "#0284C7", "highlight": {"background": "#7DD3FC", "border": "#38BDF8"}},
                    shape="dot",
                    size=24,
                    borderWidth=2
                )
            elif a.asset_id in unreachable_ids:
                net.add_node(
                    a.asset_id,
                    label=f"{a.asset_id}\n[UNREACHABLE]",
                    title=f"{a.asset_name}\nID: {a.asset_id}\nType: {a.asset_type}\nImportance: {a.importance_score}/10\nReachable: NO (Disconnected)",
                    color={"background": "#334155", "border": "#F87171", "highlight": {"background": "#475569", "border": "#F87171"}},
                    shape="dot",
                    size=22,
                    borderWidth=2
                )
            else:
                net.add_node(
                    a.asset_id,
                    label=a.asset_id,
                    title=f"{a.asset_name}\nType: {a.asset_type}\nImportance: {a.importance_score}",
                    color={"background": "#38BDF8", "border": "#0284C7", "highlight": {"background": "#7DD3FC", "border": "#38BDF8"}},
                    shape="dot",
                    size=22,
                    borderWidth=2
                )

        for l in links:
            if l.link_id in selected_links_ids:
                net.add_edge(
                    l.source_asset_id,
                    l.target_asset_id,
                    title=f"MST Link: {l.link_id}\nCost: {l.cost}\nStatus: Selected by Kruskal",
                    label=f"{l.cost}",
                    color={"color": "#2DD4BF", "highlight": "#5EEAD4"},
                    width=4
                )
            elif l.is_accessible:
                net.add_edge(
                    l.source_asset_id,
                    l.target_asset_id,
                    title=f"Alternate Link: {l.link_id}\nCost: {l.cost}\nStatus: Accessible (Not in MST)",
                    label=f"{l.cost}",
                    color={"color": "rgba(148, 163, 184, 0.45)", "highlight": "#CBD5E1"},
                    width=1.5
                )
            else:
                net.add_edge(
                    l.source_asset_id,
                    l.target_asset_id,
                    title=f"Inaccessible Link: {l.link_id}\nCost: {l.cost}\nStatus: Inaccessible / Severed",
                    label=f"{l.cost} (blocked)",
                    color={"color": "#F87171", "highlight": "#EF4444"},
                    width=2,
                    dashes=True
                )

        net.set_options("""
        var options = {
          "nodes": {
            "font": { "color": "#F1F5F9", "size": 18, "face": "Inter, sans-serif" }
          },
          "edges": {
            "font": { "color": "#E2E8F0", "size": 15, "align": "top",
                      "strokeWidth": 4, "strokeColor": "#0B1220" },
            "smooth": { "type": "continuous" }
          },
          "physics": {
            "barnesHut": {
              "gravitationalConstant": -9000,
              "centralGravity": 0.25,
              "springLength": 220,
              "springConstant": 0.04,
              "avoidOverlap": 0.6
            },
            "stabilization": { "enabled": true, "iterations": 250 },
            "minVelocity": 0.75
          },
          "interaction": {
            "hover": true,
            "zoomView": true,
            "dragView": true,
            "navigationButtons": true,
            "keyboard": true
          }
        }
        """)

        html = net.generate_html()

        extra_css = """
        <style>
          html, body { height: 100%; margin: 0; padding: 0; background: #0B1220 !important; overflow: hidden; }
          center, h1 { display: none !important; }
          .card { height: 100% !important; width: 100% !important; border: none !important;
                  background: #0B1220 !important; margin: 0 !important; }
          #mynetwork { width: 100% !important; height: 100vh !important;
                       border: none !important; background: #0B1220 !important; }
        </style>
        """

        fit_script = """
        <script>
          window.addEventListener("load", function () {
            if (typeof network === "undefined") return;
            network.once("stabilizationIterationsDone", function () {
              network.fit({ animation: { duration: 600 } });
              network.setOptions({ physics: false });
            });
            setTimeout(function () { network.fit(); }, 1800);
          });
        </script>
        """

        html = html.replace("</head>", extra_css + "</head>", 1)
        html = html.replace("</body>", fit_script + "</body>", 1)

        return html, 200, {"Content-Type": "text/html"}

    except Exception as exc:
        current_app.logger.error(
            f"PyVis graph generation error for investigation #{investigation_id}: {exc}",
            exc_info=True
        )
        return (
            """<!DOCTYPE html>
            <html><body style="background:#0B1220; color:#F87171; font-family:Inter,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; padding:20px; box-sizing:border-box;">
            <div style="text-align:center; max-width:480px;">
                <div style="font-size:2rem; margin-bottom:12px;">⚠️</div>
                <p style="font-size:1.15rem; color:#F1F5F9; font-weight:600; margin-bottom:8px;">Topology Graph Generation Error</p>
                <p style="font-size:0.85rem; color:#94A3B8; line-height:1.5;">Unable to render the network topology. An error occurred during graph compilation.</p>
            </div>
            </body></html>""",
            500,
            {"Content-Type": "text/html"}
        )