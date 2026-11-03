from flask import Blueprint, request, jsonify
from app import db
from app.models import Investigation, Asset, Link, Evidence, Analyst
main = Blueprint("main", __name__)


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

    if type(importance) is not int or importance < 0:
        return jsonify({
            "error": "importance_score must be a non-negative integer"
        }), 400

    if type(is_root) is not bool:
        return jsonify({"error": "is_root must be true or false"}), 400

    existing = Asset.query.filter_by(
        investigation_id=investigation_id,
        asset_id=asset_id.strip()
    ).first()

    if existing:
        return jsonify({"error": "Asset ID already exists"}), 409

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
        if type(value) is not int or value < 0:
            return jsonify({"error": "Invalid importance score"}), 400
        asset.importance_score = value

    if "is_root" in data:
        if type(data["is_root"]) is not bool:
            return jsonify({"error": "is_root must be true or false"}), 400
        asset.is_root = data["is_root"]

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

    if type(cost) not in [int, float] or cost < 0:
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

        if type(cost) not in [int, float] or cost < 0:
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

    if type(hours) is not int or hours < 0:
        return jsonify({
            "error": "examination_hours must be a non-negative integer"
        }), 400

    if type(value) not in [int, float] or value < 0:
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

        if type(hours) is not int or hours < 0:
            return jsonify({
                "error": "examination_hours must be a non-negative integer"
            }), 400

        evidence.examination_hours = hours

    if "estimated_value" in data:
        value = data["estimated_value"]

        if type(value) not in [int, float] or value < 0:
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

    if type(capacity) is not int or capacity < 0:
        return jsonify({
            "error": "capacity_hours must be a non-negative integer"
        }), 400

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

        if type(capacity) is not int or capacity < 0:
            return jsonify({
                "error": "capacity_hours must be a non-negative integer"
            }), 400

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