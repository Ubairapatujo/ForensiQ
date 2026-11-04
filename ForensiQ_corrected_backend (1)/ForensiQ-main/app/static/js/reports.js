/**
 * ForensiQ Reports & Dossier Controller
 * Synthesizes comprehensive investigation dossiers, Kruskal MSF pathways,
 * and Knapsack evidence allocation schedules.
 * Provides native Print / Save to PDF and transparent disclosure of pending export APIs.
 */

(function () {
    let currentInvestigationId = null;
    let investigationData = null;
    let assetsList = [];
    let linksList = [];
    let evidenceList = [];
    let analystsList = [];
    let analysisResult = null;

    async function initReportsPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    function setupEventListeners() {
        // Native Print / Save to PDF
        const btnPrint = document.getElementById("btn-print-report");
        if (btnPrint) {
            btnPrint.addEventListener("click", () => {
                window.print();
            });
        }

        // CSV Export button (Transparent disclosure: pending backend API)
        const btnCsv = document.getElementById("btn-export-csv");
        if (btnCsv) {
            btnCsv.addEventListener("click", () => {
                ForensiQ.toast(
                    "CSV Export Pending Backend Implementation: Export APIs have not been implemented by Member 1/2. Use Print / Save as PDF.",
                    "warning"
                );
            });
        }

        // PDF Server Export button (Transparent disclosure: pending backend API)
        const btnPdf = document.getElementById("btn-export-pdf");
        if (btnPdf) {
            btnPdf.addEventListener("click", () => {
                ForensiQ.toast(
                    "Server PDF Export Pending Backend Implementation: Server-side PDF generation is pending backend implementation. Use Print / Save as PDF.",
                    "warning"
                );
            });
        }
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("rep-no-inv-banner");
        const mainContent = document.getElementById("rep-main-content");
        const dossierBody = document.getElementById("rep-dossier-body");

        if (dossierBody) dossierBody.style.display = "none";

        if (!currentInvestigationId) {
            if (noInvBanner) noInvBanner.style.display = "flex";
            if (mainContent) mainContent.style.display = "none";
            return;
        }

        if (noInvBanner) noInvBanner.style.display = "none";
        if (mainContent) mainContent.style.display = "block";

        await loadReportData();
    }

    async function loadReportData() {
        if (!currentInvestigationId) return;

        const loadingState = document.getElementById("rep-loading-state");
        const dossierBody = document.getElementById("rep-dossier-body");

        if (loadingState) loadingState.style.display = "block";
        if (dossierBody) dossierBody.style.display = "none";

        try {
            const [inv, assets, links, evidence, analysts] = await Promise.all([
                API.getInvestigation(currentInvestigationId),
                API.getAssets(currentInvestigationId),
                API.getLinks(currentInvestigationId),
                API.getEvidence(currentInvestigationId),
                API.getAnalysts(currentInvestigationId),
            ]);

            investigationData = inv;
            assetsList = assets;
            linksList = links;
            evidenceList = evidence;
            analystsList = analysts;

            // Attempt algorithm execution
            analysisResult = null;
            if (assets.length >= 2 && assets.some((a) => a.is_root) && analysts.length >= 1 && analysts.length <= 3) {
                try {
                    analysisResult = await API.runAnalysis(currentInvestigationId);
                } catch (err) {
                    console.warn("Could not execute algorithms for report:", err.message);
                }
            }

            if (loadingState) loadingState.style.display = "none";
            if (dossierBody) dossierBody.style.display = "block";

            renderReportHeader();
            renderKpiGrid();
            renderNarrative();
            renderMstLinksTable();
            renderAnalystAllocations();
            renderUnassignedEvidence();
        } catch (error) {
            console.error("Failed to compile report:", error);
            if (loadingState) loadingState.style.display = "none";
            ForensiQ.toast("Failed to load investigation data for report", "error");
        }
    }

    function renderReportHeader() {
        if (!investigationData) return;

        const elId = document.getElementById("rep-meta-id");
        const elStatus = document.getElementById("rep-meta-status");
        const elName = document.getElementById("rep-meta-name");
        const elDesc = document.getElementById("rep-meta-description");
        const elDate = document.getElementById("rep-meta-date");

        if (elId) elId.textContent = `CASE #${investigationData.id}`;
        if (elStatus) {
            elStatus.textContent = investigationData.status || "Active";
            elStatus.className = `badge ${investigationData.status === 'Completed' ? 'badge-completed' : (investigationData.status === 'Archived' ? 'badge-archived' : 'badge-active')}`;
        }
        if (elName) elName.textContent = investigationData.name;
        if (elDesc) elDesc.textContent = investigationData.description || "No formal case description recorded.";
        if (elDate) {
            const now = new Date();
            elDate.textContent = now.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        }
    }

    function renderKpiGrid() {
        const elValue = document.getElementById("rep-kpi-value");
        const elCost = document.getElementById("rep-kpi-cost");
        const elReach = document.getElementById("rep-kpi-reachability");
        const elEv = document.getElementById("rep-kpi-evidence");

        if (analysisResult) {
            const totalCost = Number(analysisResult.total_access_cost || 0);
            const totalVal = Number(analysisResult.maximum_evidence_value || 0);
            const reachableCount = (analysisResult.reachable_assets || []).length;

            let assignedCount = 0;
            if (analysisResult.allocation) {
                Object.values(analysisResult.allocation).forEach((arr) => {
                    assignedCount += (arr || []).length;
                });
            }

            if (elValue) elValue.textContent = `${totalVal.toFixed(1)} pts`;
            if (elCost) elCost.textContent = totalCost.toFixed(2);
            if (elReach) elReach.textContent = `${reachableCount} / ${assetsList.length}`;
            if (elEv) elEv.textContent = `${assignedCount} / ${evidenceList.length}`;
        } else {
            if (elValue) elValue.textContent = "--";
            if (elCost) elCost.textContent = "--";
            if (elReach) elReach.textContent = `0 / ${assetsList.length}`;
            if (elEv) elEv.textContent = `0 / ${evidenceList.length}`;
        }
    }

    function renderNarrative() {
        const container = document.getElementById("rep-narrative-content");
        if (!container) return;

        const rootAsset = assetsList.find((a) => a.is_root);
        const reachableCount = analysisResult ? (analysisResult.reachable_assets || []).length : 0;
        const totalCost = analysisResult ? Number(analysisResult.total_access_cost || 0).toFixed(2) : "0.00";
        const totalVal = analysisResult ? Number(analysisResult.maximum_evidence_value || 0).toFixed(1) : "0.0";

        let assignedCount = 0;
        if (analysisResult?.allocation) {
            Object.values(analysisResult.allocation).forEach((arr) => {
                assignedCount += (arr || []).length;
            });
        }

        container.innerHTML = `
            <p style="margin-bottom: 12px;">
                Investigation <strong>"${ForensiQ.escapeHtml(investigationData.name)}"</strong> encompasses a total of <strong>${assetsList.length} infrastructure assets</strong> and <strong>${linksList.length} network pathways</strong>.
                ${
                    rootAsset
                        ? `Forensic analysis initiates from designated Root Asset <strong>${ForensiQ.escapeHtml(rootAsset.asset_id)} (${ForensiQ.escapeHtml(rootAsset.asset_name)})</strong>.`
                        : "No designated root asset has been assigned."
                }
            </p>
            <p style="margin-bottom: 12px;">
                Execution of Kruskal's algorithm established an optimal Minimum Spanning Forest totaling <strong>${totalCost} traversal cost units</strong>, rendering <strong>${reachableCount} of ${assetsList.length} assets accessible</strong> via DFS exploration.
            </p>
            <p style="margin: 0;">
                Multiple Knapsack dynamic programming allocated <strong>${assignedCount} of ${evidenceList.length} evidence artifacts</strong> across <strong>${analystsList.length} assigned specialists</strong>, achieving a maximum evidentiary yield of <strong>${totalVal} points</strong> within individual capacity limits.
            </p>
        `;
    }

    function renderMstLinksTable() {
        const tbody = document.getElementById("rep-mst-links-body");
        if (!tbody) return;

        const links = analysisResult?.selected_links || [];
        if (links.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table-cell" style="padding: 24px; text-align: center; color: var(--text-dim);">
                        No spanning forest pathways computed.
                    </td>
                </tr>
            `;
            return;
        }

        let cumCost = 0;
        tbody.innerHTML = links.map((link) => {
            const cost = Number(link.cost || 0);
            cumCost += cost;

            const sourceAsset = assetsList.find((a) => a.asset_id === link.source_asset_id);
            const targetAsset = assetsList.find((a) => a.asset_id === link.target_asset_id);

            return `
                <tr>
                    <td>
                        <span style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);">
                            ${ForensiQ.escapeHtml(link.link_id)}
                        </span>
                    </td>
                    <td>
                        <strong style="font-family: var(--font-mono); color: var(--text-primary);">${ForensiQ.escapeHtml(link.source_asset_id)}</strong>
                        ${sourceAsset ? `<span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 6px;">(${ForensiQ.escapeHtml(sourceAsset.asset_name)})</span>` : ''}
                    </td>
                    <td style="text-align: center; color: var(--accent-cyan);">&harr;</td>
                    <td>
                        <strong style="font-family: var(--font-mono); color: var(--text-primary);">${ForensiQ.escapeHtml(link.target_asset_id)}</strong>
                        ${targetAsset ? `<span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 6px;">(${ForensiQ.escapeHtml(targetAsset.asset_name)})</span>` : ''}
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.05); font-family: var(--font-mono);">
                            ${cost.toFixed(2)}
                        </span>
                    </td>
                    <td>
                        <span class="badge" style="background: var(--teal-success-dim); color: var(--teal-success); font-family: var(--font-mono); font-weight: 700;">
                            ${cumCost.toFixed(2)}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function renderAnalystAllocations() {
        const container = document.getElementById("rep-analyst-allocations-container");
        if (!container) return;

        const allocation = analysisResult?.allocation || {};
        const analystNames = Object.keys(allocation);

        if (analystNames.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px;">No analyst allocation schedule produced.</div>';
            return;
        }

        container.innerHTML = analystNames.map((name) => {
            const items = allocation[name] || [];
            const analystRecord = analystsList.find((a) => a.analyst_name === name);
            const cap = analystRecord ? Number(analystRecord.available_hours) : 0;
            const hours = items.reduce((s, it) => s + Number(it.examination_hours || 0), 0);
            const val = items.reduce((s, it) => s + Number(it.estimated_value || 0), 0);

            return `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px 18px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <strong style="font-size: 0.95rem; color: var(--text-primary);">${ForensiQ.escapeHtml(name)}</strong>
                            <span style="color: var(--text-dim); font-size: 0.82rem; margin-left: 10px;">
                                Workload: <strong>${hours}h</strong> / ${cap}h (${cap > 0 ? ((hours / cap) * 100).toFixed(0) : 0}%)
                            </span>
                        </div>
                        <div>
                            <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 700;">
                                Total Yield: ${val.toFixed(1)} pts
                            </span>
                        </div>
                    </div>

                    ${
                        items.length === 0
                            ? '<div style="color: var(--text-dim); font-size: 0.8rem; font-style: italic;">No evidence items scheduled for this specialist.</div>'
                            : `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                                ${items.map((it) => `
                                    <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-primary); font-size: 0.76rem;">
                                        ${ForensiQ.escapeHtml(it.evidence_id)}: ${ForensiQ.escapeHtml(it.description || "Evidence")} (${it.examination_hours}h, ${Number(it.estimated_value).toFixed(0)} pts)
                                    </span>
                                `).join("")}
                               </div>`
                    }
                </div>
            `;
        }).join("");
    }

    function renderUnassignedEvidence() {
        const tbody = document.getElementById("rep-unassigned-evidence-body");
        if (!tbody) return;

        const assignedIds = new Set();
        if (analysisResult?.allocation) {
            Object.values(analysisResult.allocation).forEach((arr) => {
                (arr || []).forEach((it) => assignedIds.add(it.evidence_id));
            });
        }

        const reachableSet = new Set(analysisResult?.reachable_assets || []);
        const unassignedList = evidenceList.filter((e) => !assignedIds.has(e.evidence_id));

        if (unassignedList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table-cell" style="padding: 20px; text-align: center; color: var(--teal-success);">
                        All ${evidenceList.length} evidence artifacts successfully assigned to analysts.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = unassignedList.map((item) => {
            const isReachable = reachableSet.has(item.asset_id);
            const reasonBadge = !isReachable
                ? '<span class="badge" style="background: var(--crimson-danger-dim); color: var(--crimson-danger);">Asset Disconnected</span>'
                : '<span class="badge" style="background: var(--amber-warning-dim); color: var(--amber-warning);">Capacity Limit Exceeded</span>';

            return `
                <tr>
                    <td>
                        <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-muted);">
                            ${ForensiQ.escapeHtml(item.evidence_id)}
                        </span>
                    </td>
                    <td>
                        <span style="font-family: var(--font-mono); color: var(--text-primary);">
                            ${ForensiQ.escapeHtml(item.asset_id)}
                        </span>
                    </td>
                    <td style="color: var(--text-muted); font-size: 0.82rem;">
                        ${ForensiQ.escapeHtml(item.description || "")}
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.05); font-family: var(--font-mono);">
                            ${item.examination_hours}h
                        </span>
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.05); font-family: var(--font-mono);">
                            ${Number(item.estimated_value).toFixed(1)}
                        </span>
                    </td>
                    <td>
                        ${reasonBadge}
                    </td>
                </tr>
            `;
        }).join("");
    }

    document.addEventListener("DOMContentLoaded", initReportsPage);
})();
