/**
 * ForensiQ Algorithm Analysis Controller
 * Executes Kruskal's MSF, DFS Reachability, and Multiple Knapsack DP
 * Renders real backend algorithm metrics and Chart.js visualizations
 */

(function () {
    let currentInvestigationId = null;
    let assetsList = [];
    let linksList = [];
    let evidenceList = [];
    let analystsList = [];
    let analysisResult = null;

    let chartWorkload = null;
    let chartValueShare = null;

    async function initAnalysisPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    function setupEventListeners() {
        const btnRun = document.getElementById("btn-run-analysis");
        if (btnRun) {
            btnRun.addEventListener("click", () => {
                executeAnalysis();
            });
        }
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("analysis-no-inv-banner");
        const mainContent = document.getElementById("analysis-main-content");
        const promptCard = document.getElementById("analysis-prompt-card");
        const resultsContainer = document.getElementById("analysis-results-container");
        const errorBanner = document.getElementById("analysis-error-banner");

        // Reset display states
        if (errorBanner) errorBanner.style.display = "none";
        if (resultsContainer) resultsContainer.style.display = "none";
        if (promptCard) promptCard.style.display = "block";

        destroyCharts();

        if (!currentInvestigationId) {
            if (noInvBanner) noInvBanner.style.display = "flex";
            if (mainContent) mainContent.style.display = "none";
            return;
        }

        if (noInvBanner) noInvBanner.style.display = "none";
        if (mainContent) mainContent.style.display = "block";

        // Pre-fetch entity counts to validate prerequisites
        await preloadInvestigationData();
    }

    async function preloadInvestigationData() {
        if (!currentInvestigationId) return;

        try {
            const [assets, links, evidence, analysts] = await Promise.all([
                API.getAssets(currentInvestigationId),
                API.getLinks(currentInvestigationId),
                API.getEvidence(currentInvestigationId),
                API.getAnalysts(currentInvestigationId),
            ]);

            assetsList = assets;
            linksList = links;
            evidenceList = evidence;
            analystsList = analysts;

            validatePrerequisites();
        } catch (err) {
            console.error("Error preloading investigation data:", err);
            const errorBanner = document.getElementById("analysis-error-banner");
            const errorText = document.getElementById("analysis-error-text");
            if (errorBanner && errorText) {
                errorText.innerHTML = `<strong>Data Loading Error:</strong> Failed to fetch investigation records: ${ForensiQ.escapeHtml(err.message || "Server error")}`;
                errorBanner.style.display = "block";
            }
            ForensiQ.toast(err.message || "Failed to load investigation data", "error");
        }
    }

    function validatePrerequisites() {
        const errorBanner = document.getElementById("analysis-error-banner");
        const errorText = document.getElementById("analysis-error-text");
        const btnRun = document.getElementById("btn-run-analysis");

        const errors = [];
        if (assetsList.length < 2) {
            errors.push(`At least 2 assets are required to build a spanning forest (current: ${assetsList.length}).`);
        }
        const hasRoot = assetsList.some((a) => a.is_root);
        if (!hasRoot && assetsList.length > 0) {
            errors.push("A designated Root Asset is required for DFS reachability traversal.");
        }
        if (analystsList.length < 1 || analystsList.length > 3) {
            errors.push(`Investigation must have 1 to 3 forensic analysts (current: ${analystsList.length}).`);
        }

        if (errors.length > 0) {
            if (errorBanner && errorText) {
                errorText.innerHTML = `<strong>Prerequisites Not Met:</strong><ul style="margin: 4px 0 0 16px;">${errors.map((e) => `<li>${ForensiQ.escapeHtml(e)}</li>`).join("")}</ul>`;
                errorBanner.style.display = "block";
            }
            if (btnRun) btnRun.disabled = true;
            return false;
        } else {
            if (errorBanner) errorBanner.style.display = "none";
            if (btnRun) btnRun.disabled = false;
            return true;
        }
    }

    async function executeAnalysis() {
        if (!currentInvestigationId) return;

        const promptCard = document.getElementById("analysis-prompt-card");
        const loadingState = document.getElementById("analysis-loading-state");
        const resultsContainer = document.getElementById("analysis-results-container");
        const errorBanner = document.getElementById("analysis-error-banner");
        const errorText = document.getElementById("analysis-error-text");
        const btnRun = document.getElementById("btn-run-analysis");

        if (promptCard) promptCard.style.display = "none";
        if (resultsContainer) resultsContainer.style.display = "none";
        if (errorBanner) errorBanner.style.display = "none";
        if (loadingState) loadingState.style.display = "block";
        if (btnRun) btnRun.disabled = true;

        try {
            // Refresh baseline records first to ensure latest state
            const [assets, links, evidence, analysts] = await Promise.all([
                API.getAssets(currentInvestigationId),
                API.getLinks(currentInvestigationId),
                API.getEvidence(currentInvestigationId),
                API.getAnalysts(currentInvestigationId),
            ]);

            assetsList = assets;
            linksList = links;
            evidenceList = evidence;
            analystsList = analysts;

            // Execute real backend optimization algorithms
            const result = await API.runAnalysis(currentInvestigationId);
            analysisResult = result;

            if (loadingState) loadingState.style.display = "none";
            if (resultsContainer) resultsContainer.style.display = "block";

            renderSummaryStats(result);
            renderReachabilityChips(result);
            renderMstLinksTable(result);
            renderAnalystAllocations(result);
            renderUnassignedEvidence(result);
            renderCharts(result);

            ForensiQ.toast("Optimization completed successfully", "success");
        } catch (error) {
            console.error("Analysis execution failed:", error);
            if (loadingState) loadingState.style.display = "none";
            if (promptCard) promptCard.style.display = "block";

            if (errorBanner && errorText) {
                errorText.innerHTML = `<strong>Algorithm Execution Error:</strong> ${ForensiQ.escapeHtml(error.message || "Failed to execute algorithms")}`;
                errorBanner.style.display = "block";
            }
            ForensiQ.toast(error.message || "Failed to execute algorithms", "error");
        } finally {
            if (btnRun) btnRun.disabled = false;
        }
    }

    function renderSummaryStats(data) {
        const elTotalCost = document.getElementById("res-total-cost");
        const elMaxValue = document.getElementById("res-max-value");
        const elReachability = document.getElementById("res-reachability");
        const elReachSubtext = document.getElementById("res-reachability-subtext");
        const elEvidenceRatio = document.getElementById("res-evidence-ratio");
        const elEvidenceSubtext = document.getElementById("res-evidence-subtext");

        const totalCost = Number(data.total_access_cost || 0);
        const maxValue = Number(data.maximum_evidence_value || 0);
        const reachableCount = (data.reachable_assets || []).length;
        const totalAssets = assetsList.length;

        // Count assigned evidence items
        let assignedCount = 0;
        if (data.allocation) {
            Object.values(data.allocation).forEach((items) => {
                assignedCount += (items || []).length;
            });
        }
        const totalEvidence = evidenceList.length;

        if (elTotalCost) elTotalCost.textContent = totalCost.toFixed(2);
        if (elMaxValue) elMaxValue.textContent = maxValue.toFixed(2);

        if (elReachability) {
            elReachability.textContent = `${reachableCount} / ${totalAssets}`;
        }
        if (elReachSubtext) {
            const pct = totalAssets > 0 ? ((reachableCount / totalAssets) * 100).toFixed(0) : 0;
            elReachSubtext.textContent = `${pct}% assets reachable from root`;
        }

        if (elEvidenceRatio) {
            elEvidenceRatio.textContent = `${assignedCount} / ${totalEvidence}`;
        }
        if (elEvidenceSubtext) {
            const pct = totalEvidence > 0 ? ((assignedCount / totalEvidence) * 100).toFixed(0) : 0;
            elEvidenceSubtext.textContent = `${pct}% items scheduled for examination`;
        }
    }

    function renderReachabilityChips(data) {
        const reachableContainer = document.getElementById("container-reachable-chips");
        const unreachableContainer = document.getElementById("container-unreachable-chips");

        const reachableSet = new Set(data.reachable_assets || []);
        const unreachableSet = new Set(data.unreachable_assets || []);

        if (reachableContainer) {
            if (reachableSet.size === 0) {
                reachableContainer.innerHTML = '<span style="color: var(--text-dim); font-size: 0.82rem; font-style: italic;">No assets reachable</span>';
            } else {
                reachableContainer.innerHTML = Array.from(reachableSet).map((assetId) => {
                    const asset = assetsList.find((a) => a.asset_id === assetId);
                    const isRoot = asset?.is_root;
                    const name = asset ? asset.asset_name : "";
                    return `
                        <span class="badge ${isRoot ? 'badge-root' : 'badge-active'}" title="${ForensiQ.escapeHtml(name)}" style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.8rem; padding: 4px 10px;">
                            ${isRoot ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : ''}
                            <strong>${ForensiQ.escapeHtml(assetId)}</strong>
                            ${name ? `<span style="opacity: 0.75; font-weight: normal;">(${ForensiQ.escapeHtml(name)})</span>` : ''}
                        </span>
                    `;
                }).join("");
            }
        }

        if (unreachableContainer) {
            if (unreachableSet.size === 0) {
                unreachableContainer.innerHTML = '<span style="color: var(--teal-success); font-size: 0.82rem; display: flex; align-items: center; gap: 5px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Full Connectivity: All nodes reachable from root asset</span>';
            } else {
                unreachableContainer.innerHTML = Array.from(unreachableSet).map((assetId) => {
                    const asset = assetsList.find((a) => a.asset_id === assetId);
                    const name = asset ? asset.asset_name : "";
                    return `
                        <span class="badge" title="${ForensiQ.escapeHtml(name)}" style="background: var(--crimson-danger-dim); color: var(--crimson-danger); border: 1px solid rgba(248, 113, 113, 0.35); font-size: 0.8rem; padding: 4px 10px;">
                            <strong>${ForensiQ.escapeHtml(assetId)}</strong>
                            ${name ? `<span style="opacity: 0.75; font-weight: normal;">(${ForensiQ.escapeHtml(name)})</span>` : ''}
                        </span>
                    `;
                }).join("");
            }
        }
    }

    function renderMstLinksTable(data) {
        const tbody = document.getElementById("table-mst-links-body");
        if (!tbody) return;

        const links = data.selected_links || [];
        if (links.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table-cell" style="padding: 30px; text-align: center; color: var(--text-dim);">
                        No links selected in the Minimum Spanning Forest.
                    </td>
                </tr>
            `;
            return;
        }

        let cumulativeCost = 0;
        tbody.innerHTML = links.map((link) => {
            const cost = Number(link.cost || 0);
            cumulativeCost += cost;

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
                        <div>
                            <strong style="font-family: var(--font-mono); color: var(--text-primary);">${ForensiQ.escapeHtml(link.source_asset_id)}</strong>
                            ${sourceAsset ? `<span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 6px;">(${ForensiQ.escapeHtml(sourceAsset.asset_name)})</span>` : ''}
                        </div>
                    </td>
                    <td style="text-align: center; color: var(--accent-cyan);">
                        &harr;
                    </td>
                    <td>
                        <div>
                            <strong style="font-family: var(--font-mono); color: var(--text-primary);">${ForensiQ.escapeHtml(link.target_asset_id)}</strong>
                            ${targetAsset ? `<span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 6px;">(${ForensiQ.escapeHtml(targetAsset.asset_name)})</span>` : ''}
                        </div>
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-primary); font-family: var(--font-mono);">
                            ${cost.toFixed(2)}
                        </span>
                    </td>
                    <td>
                        <span class="badge" style="background: var(--teal-success-dim); color: var(--teal-success); font-family: var(--font-mono); font-weight: 700;">
                            ${cumulativeCost.toFixed(2)}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function renderAnalystAllocations(data) {
        const container = document.getElementById("analyst-allocations-container");
        if (!container) return;

        const allocation = data.allocation || {};
        const analystNames = Object.keys(allocation);

        if (analystNames.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--text-dim);">
                    No analyst allocations produced.
                </div>
            `;
            return;
        }

        container.innerHTML = analystNames.map((name) => {
            const assignedItems = allocation[name] || [];
            const analystRecord = analystsList.find((a) => a.analyst_name === name);
            const capacityHours = analystRecord ? Number(analystRecord.available_hours) : 0;

            const totalHoursUsed = assignedItems.reduce((sum, item) => sum + Number(item.examination_hours || 0), 0);
            const totalValueCaptured = assignedItems.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0);
            const utilPct = capacityHours > 0 ? ((totalHoursUsed / capacityHours) * 100).toFixed(1) : 0;

            // Bar color logic
            let barColor = "var(--teal-success)";
            if (totalHoursUsed >= capacityHours) {
                barColor = "var(--accent-cyan)";
            }

            let itemsTableHtml = "";
            if (assignedItems.length === 0) {
                itemsTableHtml = `
                    <div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 0.82rem; font-style: italic;">
                        No evidence items assigned to this analyst within capacity constraints.
                    </div>
                `;
            } else {
                itemsTableHtml = `
                    <div class="table-responsive" style="margin-top: 10px;">
                        <table class="data-table" style="font-size: 0.82rem;">
                            <thead>
                                <tr>
                                    <th style="width: 100px;">Evidence ID</th>
                                    <th style="width: 130px;">Source Asset</th>
                                    <th>Description</th>
                                    <th style="width: 90px;">Hours</th>
                                    <th style="width: 100px;">Value</th>
                                    <th style="width: 100px;">Yield / Hr</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${assignedItems.map((item) => {
                                    const hours = Number(item.examination_hours || 0);
                                    const value = Number(item.estimated_value || 0);
                                    const density = hours > 0 ? (value / hours).toFixed(2) : "0.00";
                                    return `
                                        <tr>
                                            <td>
                                                <span style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);">
                                                    ${ForensiQ.escapeHtml(item.evidence_id)}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="font-family: var(--font-mono); color: var(--text-primary);">
                                                    ${ForensiQ.escapeHtml(item.asset_id)}
                                                </span>
                                            </td>
                                            <td style="color: var(--text-muted);">
                                                ${ForensiQ.escapeHtml(item.description || "")}
                                            </td>
                                            <td>
                                                <span class="badge" style="background: rgba(255, 255, 255, 0.05); font-family: var(--font-mono);">
                                                    ${hours}h
                                                </span>
                                            </td>
                                            <td>
                                                <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 600;">
                                                    ${value.toFixed(1)}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="font-family: var(--font-mono); color: var(--teal-success); font-weight: 600;">
                                                    ${density}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            return `
                <div class="card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 18px 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px; margin-bottom: 12px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                    ${ForensiQ.escapeHtml(name)}
                                </h4>
                                <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); font-size: 0.74rem;">
                                    ${assignedItems.length} items
                                </span>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                                Total Assigned Workload: <strong style="color: var(--text-primary);">${totalHoursUsed}h</strong> / ${capacityHours}h capacity (${utilPct}%)
                            </div>
                        </div>

                        <div style="text-align: right;">
                            <div style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600;">
                                Value Harvested
                            </div>
                            <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-cyan); font-family: var(--font-mono);">
                                ${totalValueCaptured.toFixed(1)}
                            </div>
                        </div>
                    </div>

                    <!-- Utilization Progress Bar -->
                    <div style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.06); border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                        <div style="width: ${Math.min(100, Number(utilPct))}%; height: 100%; background: ${barColor}; border-radius: 3px; transition: width 0.4s ease;"></div>
                    </div>

                    <!-- Collapsible / Expanded Assigned Items Table -->
                    ${itemsTableHtml}
                </div>
            `;
        }).join("");
    }

    function renderUnassignedEvidence(data) {
        const tbody = document.getElementById("table-unassigned-evidence-body");
        if (!tbody) return;

        // Build set of all assigned evidence IDs
        const assignedIds = new Set();
        if (data.allocation) {
            Object.values(data.allocation).forEach((items) => {
                (items || []).forEach((item) => {
                    assignedIds.add(item.evidence_id);
                });
            });
        }

        const reachableSet = new Set(data.reachable_assets || []);

        // Filter unassigned items from full investigation evidence
        const unassignedList = evidenceList.filter((e) => !assignedIds.has(e.evidence_id));

        if (unassignedList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table-cell" style="padding: 24px; text-align: center; color: var(--teal-success);">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            <span>100% of eligible evidence items were assigned to analysts.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = unassignedList.map((item) => {
            const isReachable = reachableSet.has(item.asset_id);
            let reasonBadge = "";

            if (!isReachable) {
                reasonBadge = `
                    <span class="badge" style="background: var(--crimson-danger-dim); color: var(--crimson-danger); border: 1px solid rgba(248, 113, 113, 0.35);">
                        Asset Disconnected / Unreachable
                    </span>
                `;
            } else {
                reasonBadge = `
                    <span class="badge" style="background: var(--amber-warning-dim); color: var(--amber-warning); border: 1px solid rgba(251, 191, 36, 0.35);">
                        Analyst Capacity Exceeded / Suboptimal
                    </span>
                `;
            }

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
                    <td style="color: var(--text-muted);">
                        ${ForensiQ.escapeHtml(item.description || "")}
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.05); font-family: var(--font-mono);">
                            ${item.examination_hours}h
                        </span>
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); font-family: var(--font-mono);">
                            ${Number(item.estimated_value || 0).toFixed(1)}
                        </span>
                    </td>
                    <td>
                        ${reasonBadge}
                    </td>
                </tr>
            `;
        }).join("");
    }

    function destroyCharts() {
        if (chartWorkload) {
            chartWorkload.destroy();
            chartWorkload = null;
        }
        if (chartValueShare) {
            chartValueShare.destroy();
            chartValueShare = null;
        }
    }

    function renderCharts(data) {
        destroyCharts();

        if (typeof Chart === "undefined") {
            console.warn("Chart.js is not loaded.");
            return;
        }

        const allocation = data.allocation || {};
        const analystNames = Object.keys(allocation);

        if (analystNames.length === 0) return;

        // Data prep for Chart 1: Workload (Capacity vs Assigned)
        const capacities = [];
        const assignedHours = [];
        const valuesHarvested = [];

        analystNames.forEach((name) => {
            const analystRecord = analystsList.find((a) => a.analyst_name === name);
            const cap = analystRecord ? Number(analystRecord.available_hours) : 0;
            const items = allocation[name] || [];
            const hours = items.reduce((s, it) => s + Number(it.examination_hours || 0), 0);
            const val = items.reduce((s, it) => s + Number(it.estimated_value || 0), 0);

            capacities.push(cap);
            assignedHours.push(hours);
            valuesHarvested.push(val);
        });

        // 1. ANALYST WORKLOAD CHART (Grouped Bar)
        const ctxWorkload = document.getElementById("chart-analyst-workload");
        if (ctxWorkload) {
            chartWorkload = new Chart(ctxWorkload, {
                type: "bar",
                data: {
                    labels: analystNames,
                    datasets: [
                        {
                            label: "Available Capacity (Hours)",
                            data: capacities,
                            backgroundColor: "rgba(56, 189, 248, 0.25)",
                            borderColor: "#38BDF8",
                            borderWidth: 1.5,
                            borderRadius: 4,
                        },
                        {
                            label: "Assigned Workload (Hours)",
                            data: assignedHours,
                            backgroundColor: "rgba(45, 212, 191, 0.65)",
                            borderColor: "#2DD4BF",
                            borderWidth: 1.5,
                            borderRadius: 4,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "top",
                            labels: {
                                color: "#94A3B8",
                                font: { family: "Inter", size: 12 },
                                boxWidth: 12,
                                padding: 14,
                            },
                        },
                        tooltip: {
                            backgroundColor: "#17263B",
                            titleColor: "#F1F5F9",
                            bodyColor: "#94A3B8",
                            borderColor: "#38BDF8",
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                afterBody: function (context) {
                                    const index = context[0].dataIndex;
                                    const cap = capacities[index];
                                    const used = assignedHours[index];
                                    const pct = cap > 0 ? ((used / cap) * 100).toFixed(1) : 0;
                                    return `Capacity Utilized: ${pct}%`;
                                },
                            },
                        },
                    },
                    scales: {
                        x: {
                            grid: { color: "rgba(255, 255, 255, 0.05)" },
                            ticks: { color: "#94A3B8", font: { family: "Inter", size: 11 } },
                        },
                        y: {
                            grid: { color: "rgba(255, 255, 255, 0.05)" },
                            ticks: {
                                color: "#94A3B8",
                                font: { family: "Inter", size: 11 },
                                stepSize: 2,
                            },
                            title: {
                                display: true,
                                text: "Hours",
                                color: "#64748B",
                                font: { size: 11 },
                            },
                            beginAtZero: true,
                        },
                    },
                },
            });
        }

        // 2. VALUE SHARE CHART (Doughnut)
        const ctxValue = document.getElementById("chart-value-share");
        if (ctxValue) {
            const paletteColors = [
                "rgba(56, 189, 248, 0.8)",   // Cyan
                "rgba(45, 212, 191, 0.8)",   // Teal
                "rgba(251, 191, 36, 0.8)",   // Amber
            ];
            const borderColors = ["#38BDF8", "#2DD4BF", "#FBBF24"];

            const totalHarvested = valuesHarvested.reduce((a, b) => a + b, 0);

            chartValueShare = new Chart(ctxValue, {
                type: "doughnut",
                data: {
                    labels: analystNames,
                    datasets: [
                        {
                            data: valuesHarvested,
                            backgroundColor: paletteColors.slice(0, analystNames.length),
                            borderColor: borderColors.slice(0, analystNames.length),
                            borderWidth: 1.5,
                            hoverOffset: 6,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                color: "#94A3B8",
                                font: { family: "Inter", size: 11 },
                                boxWidth: 12,
                                padding: 12,
                            },
                        },
                        tooltip: {
                            backgroundColor: "#17263B",
                            titleColor: "#F1F5F9",
                            bodyColor: "#94A3B8",
                            borderColor: "#38BDF8",
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: function (context) {
                                    const val = context.raw || 0;
                                    const pct = totalHarvested > 0 ? ((val / totalHarvested) * 100).toFixed(1) : 0;
                                    return ` ${context.label}: ${val.toFixed(1)} pts (${pct}%)`;
                                },
                            },
                        },
                    },
                    cutout: "62%",
                },
            });
        }
    }

    document.addEventListener("DOMContentLoaded", initAnalysisPage);
})();
