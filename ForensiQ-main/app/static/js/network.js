/**
 * ForensiQ Network Explorer Controller
 * Manages PyVis iframe lifecycle, node inspection,
 * real MSF metrics synchronization, and context switching.
 */

(function () {
    let assetsList = [];
    let linksList = [];
    let evidenceList = [];
    let analysisResult = null;
    let currentInvestigationId = null;

    async function initNetworkPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("network-no-inv-banner");
        const mainContent = document.getElementById("network-main-content");

        if (!currentInvestigationId) {
            if (noInvBanner) noInvBanner.style.display = "flex";
            if (mainContent) mainContent.style.display = "none";
            return;
        }

        if (noInvBanner) noInvBanner.style.display = "none";
        if (mainContent) mainContent.style.display = "block";

        await loadNetworkData();
    }

    function setupEventListeners() {
        // Reload Graph Button
        const btnReload = document.getElementById("btn-reload-graph");
        if (btnReload) {
            btnReload.addEventListener("click", () => {
                reloadGraphIframe();
                ForensiQ.toast("Network graph canvas reloaded", "info");
            });
        }

        // Inspector dropdown
        const selectInspector = document.getElementById("inspector-asset-select");
        if (selectInspector) {
            selectInspector.addEventListener("change", (e) => {
                const assetId = e.target.value;
                renderNodeInspection(assetId);
            });
        }
    }

    /**
     * Load assets, links, evidence, and Kruskal results
     */
    async function loadNetworkData() {
        if (!currentInvestigationId) return;

        reloadGraphIframe();

        try {
            const [assets, links, evidence] = await Promise.all([
                API.getAssets(currentInvestigationId),
                API.getLinks(currentInvestigationId),
                API.getEvidence(currentInvestigationId),
            ]);

            assetsList = assets;
            linksList = links;
            evidenceList = evidence;

            // Attempt to fetch real analysis for MST and DFS reachability
            analysisResult = null;
            if (assets.length >= 2 && assets.some((a) => a.is_root)) {
                try {
                    analysisResult = await API.runAnalysis(currentInvestigationId);
                } catch (analysisErr) {
                    console.warn("Algorithm analysis could not execute for topology:", analysisErr.message);
                }
            }

            updateSummaryStats();
            populateInspectorDropdown();
        } catch (error) {
            console.error("Failed to load network explorer data:", error);
            ForensiQ.toast(error.message || "Failed to load network explorer data", "error");
            const statNodes = document.getElementById("net-stat-nodes");
            const statEdges = document.getElementById("net-stat-edges");
            if (statNodes) statNodes.textContent = "!";
            if (statEdges) statEdges.textContent = "!";
        }
    }

    function reloadGraphIframe() {
        const iframe = document.getElementById("pyvis-iframe");
        const btnPopout = document.getElementById("btn-open-graph-newtab");
        if (!iframe || !currentInvestigationId) return;

        const graphUrl = `/api/investigations/${currentInvestigationId}/network-graph?t=${Date.now()}`;
        iframe.src = graphUrl;

        if (btnPopout) {
            btnPopout.href = `/api/investigations/${currentInvestigationId}/network-graph`;
        }
    }

    function updateSummaryStats() {
        const statNodes = document.getElementById("net-stat-nodes");
        const statEdges = document.getElementById("net-stat-edges");
        const statMst = document.getElementById("net-stat-mst-links");
        const statReach = document.getElementById("net-stat-reachability");

        if (statNodes) statNodes.textContent = assetsList.length;
        if (statEdges) statEdges.textContent = linksList.length;

        if (analysisResult) {
            if (statMst) statMst.textContent = analysisResult.selected_links?.length || 0;
            if (statReach) {
                const reachableCount = analysisResult.reachable_assets?.length || 0;
                statReach.textContent = `${reachableCount} / ${assetsList.length}`;
            }
        } else {
            if (statMst) statMst.textContent = "--";
            if (statReach) statReach.textContent = "--";
        }
    }

    function populateInspectorDropdown() {
        const select = document.getElementById("inspector-asset-select");
        if (!select) return;

        let html = '<option value="">-- Choose Asset Node --</option>';
        assetsList.forEach((a) => {
            const isRootText = a.is_root ? " [ROOT]" : "";
            html += `<option value="${ForensiQ.escapeHtml(a.asset_id)}">
                ${ForensiQ.escapeHtml(a.asset_id)}: ${ForensiQ.escapeHtml(a.asset_name)}${isRootText}
            </option>`;
        });

        select.innerHTML = html;

        // Auto inspect root asset by default if present
        const rootAsset = assetsList.find((a) => a.is_root);
        if (rootAsset) {
            select.value = rootAsset.asset_id;
            renderNodeInspection(rootAsset.asset_id);
        } else if (assetsList.length > 0) {
            select.value = assetsList[0].asset_id;
            renderNodeInspection(assetsList[0].asset_id);
        }
    }

    /**
     * Render node inspection panel
     */
    function renderNodeInspection(assetId) {
        const pane = document.getElementById("inspector-details-pane");
        if (!pane) return;

        if (!assetId) {
            pane.innerHTML = `
                <p style="color: var(--text-dim); font-size: 0.8rem; text-align: center; margin: 10px 0;">
                    Select an asset from the dropdown above to inspect details.
                </p>
            `;
            return;
        }

        const asset = assetsList.find((a) => a.asset_id === assetId);
        if (!asset) return;

        // Find connected links
        const incidentLinks = linksList.filter(
            (l) => l.source_asset_id === assetId || l.target_asset_id === assetId
        );

        // Find associated evidence
        const attachedEvidence = evidenceList.filter((e) => e.asset_id === assetId);

        // Determine DFS reachability
        let isReachable = null;
        if (analysisResult) {
            isReachable = analysisResult.reachable_assets?.includes(assetId);
        }

        let reachabilityBadge = '<span class="badge badge-archived">Pending Analysis</span>';
        if (isReachable === true) {
            reachabilityBadge = '<span class="badge badge-active">DFS Reachable</span>';
        } else if (isReachable === false) {
            reachabilityBadge = '<span class="badge" style="background: var(--crimson-danger-dim); color: var(--crimson-danger); border: 1px solid rgba(248, 113, 113, 0.35);">Unreachable</span>';
        }

        let linksHtml = incidentLinks.map((l) => {
            const partner = l.source_asset_id === assetId ? l.target_asset_id : l.source_asset_id;
            const inMst = analysisResult?.selected_links?.some((mstL) => mstL.link_id === l.link_id);

            return `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.76rem;">
                    <span>
                        <span style="font-family: var(--font-mono); color: var(--accent-cyan);">${ForensiQ.escapeHtml(l.link_id)}</span>:
                        &rarr; ${ForensiQ.escapeHtml(partner)}
                    </span>
                    <span>
                        Cost: <strong>${l.cost}</strong>
                        ${inMst ? '<span style="color: var(--teal-success); margin-left: 4px;">[MST]</span>' : ''}
                    </span>
                </li>
            `;
        }).join("");

        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: var(--accent-cyan);">
                        ${ForensiQ.escapeHtml(asset.asset_id)}
                    </span>
                    ${
                        asset.is_root
                            ? '<span class="badge badge-root">Root Asset</span>'
                            : '<span class="badge badge-archived">Standard Node</span>'
                    }
                </div>

                <div>
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
                        ${ForensiQ.escapeHtml(asset.asset_name)}
                    </div>
                    <div style="color: var(--text-dim); font-size: 0.78rem;">
                        Type: ${ForensiQ.escapeHtml(asset.asset_type)}
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); padding: 6px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 0.78rem; color: var(--text-muted);">Importance:</span>
                    <span style="font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem;">${asset.importance_score} / 10</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); padding: 6px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 0.78rem; color: var(--text-muted);">Network Reachability:</span>
                    ${reachabilityBadge}
                </div>

                <div style="margin-top: 4px;">
                    <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                        Connected Links (${incidentLinks.length})
                    </div>
                    ${
                        incidentLinks.length > 0
                            ? `<ul style="list-style: none; max-height: 110px; overflow-y: auto;">${linksHtml}</ul>`
                            : '<p style="color: var(--text-dim); font-size: 0.76rem; font-style: italic;">No links connected to this asset.</p>'
                    }
                </div>

                <div style="margin-top: 4px;">
                    <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                        Attached Evidence (${attachedEvidence.length})
                    </div>
                    ${
                        attachedEvidence.length > 0
                            ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${attachedEvidence.map((e) => `<span class="badge" style="background: rgba(45, 212, 191, 0.12); color: var(--teal-success);">${ForensiQ.escapeHtml(e.evidence_id)} (${e.examination_hours}h)</span>`).join("")}
                               </div>`
                            : '<p style="color: var(--text-dim); font-size: 0.76rem; font-style: italic;">No evidence items attached.</p>'
                    }
                </div>
            </div>
        `;
    }

    document.addEventListener("DOMContentLoaded", initNetworkPage);
})();
