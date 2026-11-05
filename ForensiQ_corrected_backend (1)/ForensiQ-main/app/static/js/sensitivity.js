/**
 * ForensiQ Sensitivity Analysis Controller
 * Executes POST /sensitivity to evaluate structural resilience under loss of
 * the two highest-importance non-root assets. Renders real comparisons and Chart.js metrics.
 */

(function () {
    let currentInvestigationId = null;
    let assetsList = [];
    let linksList = [];
    let evidenceList = [];
    let analystsList = [];
    let baselineAnalysis = null;
    let sensitivityResult = null;

    let chartComparison = null;
    let chartWorkloadShift = null;

    async function initSensitivityPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    function setupEventListeners() {
        const btnRun = document.getElementById("btn-run-sensitivity");
        if (btnRun) {
            btnRun.addEventListener("click", () => {
                executeSensitivityAnalysis();
            });
        }
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("sens-no-inv-banner");
        const mainContent = document.getElementById("sens-main-content");
        const promptCard = document.getElementById("sens-prompt-card");
        const resultsContainer = document.getElementById("sens-results-container");
        const errorBanner = document.getElementById("sens-error-banner");

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

        await loadSensitivityPrerequisites();
    }

    async function loadSensitivityPrerequisites() {
        if (!currentInvestigationId) return;

        const errorBanner = document.getElementById("sens-error-banner");
        const errorText = document.getElementById("sens-error-text");
        const btnRun = document.getElementById("btn-run-sensitivity");

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

            const nonRootAssets = assets.filter((a) => !a.is_root);
            const errors = [];

            if (nonRootAssets.length < 2) {
                errors.push(`Sensitivity analysis requires at least 2 non-root assets to eliminate (currently: ${nonRootAssets.length}).`);
            }
            if (analysts.length < 1 || analysts.length > 3) {
                errors.push(`Investigation must have 1 to 3 analysts (currently: ${analysts.length}).`);
            }

            if (errors.length > 0) {
                if (errorBanner && errorText) {
                    errorText.innerHTML = `<strong>Prerequisites Not Met:</strong><ul style="margin: 4px 0 0 16px;">${errors.map((e) => `<li>${ForensiQ.escapeHtml(e)}</li>`).join("")}</ul>`;
                    errorBanner.style.display = "block";
                }
                if (btnRun) btnRun.disabled = true;
                return;
            }

            if (errorBanner) errorBanner.style.display = "none";
            if (btnRun) btnRun.disabled = false;

            // Pre-fetch baseline analysis for comparison
            try {
                baselineAnalysis = await API.runAnalysis(currentInvestigationId);
            } catch (err) {
                console.warn("Could not precompute baseline analysis:", err.message);
            }
        } catch (error) {
            console.error("Failed to load sensitivity prerequisites:", error);
            if (errorBanner && errorText) {
                errorText.innerHTML = `<strong>Data Loading Error:</strong> Failed to fetch investigation records: ${ForensiQ.escapeHtml(error.message || "Server error")}`;
                errorBanner.style.display = "block";
            }
            ForensiQ.toast(error.message || "Failed to load sensitivity prerequisites", "error");
        }
    }

    async function executeSensitivityAnalysis() {
        if (!currentInvestigationId) return;

        const promptCard = document.getElementById("sens-prompt-card");
        const loadingState = document.getElementById("sens-loading-state");
        const resultsContainer = document.getElementById("sens-results-container");
        const errorBanner = document.getElementById("sens-error-banner");
        const errorText = document.getElementById("sens-error-text");
        const btnRun = document.getElementById("btn-run-sensitivity");

        if (promptCard) promptCard.style.display = "none";
        if (resultsContainer) resultsContainer.style.display = "none";
        if (errorBanner) errorBanner.style.display = "none";
        if (loadingState) loadingState.style.display = "block";
        if (btnRun) btnRun.disabled = true;

        try {
            // Re-fetch baseline if needed
            if (!baselineAnalysis) {
                baselineAnalysis = await API.runAnalysis(currentInvestigationId);
            }

            const data = await API.runSensitivity(currentInvestigationId);
            sensitivityResult = data;

            if (loadingState) loadingState.style.display = "none";
            if (resultsContainer) resultsContainer.style.display = "block";

            renderSensitivityStats(data);
            renderRemovedAssetsAndImpact(data);
            renderComparisonCharts(data);
            renderDegradedAllocations(data);

            ForensiQ.toast("Sensitivity analysis completed successfully", "success");
        } catch (error) {
            console.error("Sensitivity analysis failed:", error);
            if (loadingState) loadingState.style.display = "none";
            if (promptCard) promptCard.style.display = "block";
            if (errorBanner && errorText) {
                errorText.innerHTML = `<strong>Sensitivity Analysis Error:</strong> ${ForensiQ.escapeHtml(error.message || "Execution failed")}`;
                errorBanner.style.display = "block";
            }
            ForensiQ.toast(error.message || "Sensitivity analysis failed", "error");
        } finally {
            if (btnRun) btnRun.disabled = false;
        }
    }

    function renderSensitivityStats(data) {
        // 1. Evidentiary Yield
        const elValue = document.getElementById("sens-res-value");
        const elValueDelta = document.getElementById("sens-res-value-delta");
        const elValueBaseline = document.getElementById("sens-res-value-baseline-label");

        const degradedValue = Number(data.maximum_evidence_value || 0);
        const baselineValue = baselineAnalysis ? Number(baselineAnalysis.maximum_evidence_value || 0) : degradedValue;
        const valDiff = degradedValue - baselineValue;
        const valPct = baselineValue > 0 ? ((valDiff / baselineValue) * 100).toFixed(1) : "0.0";

        if (elValue) elValue.textContent = degradedValue.toFixed(1);
        if (elValueBaseline) elValueBaseline.textContent = `Baseline: ${baselineValue.toFixed(1)} pts`;
        if (elValueDelta) {
            if (valDiff < 0) {
                elValueDelta.textContent = `${valDiff.toFixed(1)} (${valPct}%)`;
                elValueDelta.className = "badge";
                elValueDelta.style.background = "var(--crimson-danger-dim)";
                elValueDelta.style.color = "var(--crimson-danger)";
            } else {
                elValueDelta.textContent = "±0.0 (0.0%)";
                elValueDelta.className = "badge badge-active";
            }
        }

        // 2. Network Access Cost
        const elCost = document.getElementById("sens-res-cost");
        const elCostDelta = document.getElementById("sens-res-cost-delta");
        const elCostBaseline = document.getElementById("sens-res-cost-baseline-label");

        const degradedCost = Number(data.total_access_cost || 0);
        const baselineCost = baselineAnalysis ? Number(baselineAnalysis.total_access_cost || 0) : degradedCost;
        const costDiff = degradedCost - baselineCost;

        if (elCost) elCost.textContent = degradedCost.toFixed(2);
        if (elCostBaseline) elCostBaseline.textContent = `Baseline: ${baselineCost.toFixed(2)}`;
        if (elCostDelta) {
            if (costDiff > 0) {
                elCostDelta.textContent = `+${costDiff.toFixed(2)}`;
                elCostDelta.className = "badge";
                elCostDelta.style.background = "var(--crimson-danger-dim)";
                elCostDelta.style.color = "var(--crimson-danger)";
            } else if (costDiff < 0) {
                elCostDelta.textContent = `${costDiff.toFixed(2)}`;
                elCostDelta.className = "badge badge-active";
            } else {
                elCostDelta.textContent = "±0.00";
                elCostDelta.className = "badge";
                elCostDelta.style.background = "rgba(255, 255, 255, 0.05)";
                elCostDelta.style.color = "var(--text-muted)";
            }
        }

        // 3. Reachable Assets
        const elReach = document.getElementById("sens-res-reachability");
        const elReachDelta = document.getElementById("sens-res-reach-delta");
        const reachableCount = (data.reachable_assets || []).length;
        const remainingTotal = assetsList.length - (data.removed_assets || []).length;
        const baselineReachable = baselineAnalysis ? (baselineAnalysis.reachable_assets || []).length : reachableCount;

        if (elReach) elReach.textContent = `${reachableCount} / ${remainingTotal}`;
        if (elReachDelta) {
            const lost = baselineReachable - reachableCount;
            elReachDelta.textContent = `${lost} fewer reachable`;
            elReachDelta.className = lost > 0 ? "badge" : "badge badge-active";
            if (lost > 0) {
                elReachDelta.style.background = "var(--amber-warning-dim)";
                elReachDelta.style.color = "var(--amber-warning)";
            }
        }

        // 4. Assigned Evidence Items
        const elEv = document.getElementById("sens-res-evidence");
        const elEvDelta = document.getElementById("sens-res-evidence-delta");

        let degradedItemsCount = 0;
        if (data.allocation) {
            Object.values(data.allocation).forEach((arr) => {
                degradedItemsCount += (arr || []).length;
            });
        }

        let baselineItemsCount = 0;
        if (baselineAnalysis?.allocation) {
            Object.values(baselineAnalysis.allocation).forEach((arr) => {
                baselineItemsCount += (arr || []).length;
            });
        }

        if (elEv) elEv.textContent = `${degradedItemsCount} items`;
        if (elEvDelta) {
            const evLost = baselineItemsCount - degradedItemsCount;
            if (evLost > 0) {
                elEvDelta.textContent = `-${evLost} items`;
                elEvDelta.className = "badge";
                elEvDelta.style.background = "var(--crimson-danger-dim)";
                elEvDelta.style.color = "var(--crimson-danger)";
            } else {
                elEvDelta.textContent = "No item drop";
                elEvDelta.className = "badge badge-active";
            }
        }
    }

    function renderRemovedAssetsAndImpact(data) {
        const removedContainer = document.getElementById("sens-removed-assets-container");
        const linksCountSpan = document.getElementById("sens-affected-links-count");
        const linksListContainer = document.getElementById("sens-affected-links-list");
        const evCountSpan = document.getElementById("sens-affected-evidence-count");
        const evListContainer = document.getElementById("sens-affected-evidence-list");

        const removedIds = data.removed_assets || [];
        const removedSet = new Set(removedIds);

        // 1. Render Removed Asset Cards
        if (removedContainer) {
            removedContainer.innerHTML = removedIds.map((assetId) => {
                const asset = assetsList.find((a) => a.asset_id === assetId);
                return `
                    <div style="background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.35); border-radius: var(--radius-sm); padding: 14px 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 700; color: var(--crimson-danger);">
                                ${ForensiQ.escapeHtml(assetId)}
                            </span>
                            <span class="badge" style="background: var(--crimson-danger-dim); color: var(--crimson-danger); font-size: 0.72rem;">
                                ELIMINATED
                            </span>
                        </div>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem;">
                            ${asset ? ForensiQ.escapeHtml(asset.asset_name) : "Target Node"}
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 2px;">
                            Type: ${asset ? ForensiQ.escapeHtml(asset.asset_type) : "--"}
                        </div>
                        <div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                            <span>Importance Score:</span>
                            <strong style="color: var(--crimson-danger); font-weight: 700;">${asset ? asset.importance_score : "--"} / 10</strong>
                        </div>
                    </div>
                `;
            }).join("");
        }

        // 2. Affected Links (Severed incident links)
        const affectedLinks = linksList.filter(
            (l) => removedSet.has(l.source_asset_id) || removedSet.has(l.target_asset_id)
        );

        if (linksCountSpan) linksCountSpan.textContent = affectedLinks.length;
        if (linksListContainer) {
            if (affectedLinks.length === 0) {
                linksListContainer.innerHTML = '<span style="color: var(--text-dim); font-style: italic;">No incident links affected.</span>';
            } else {
                linksListContainer.innerHTML = affectedLinks.map((l) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                        <span>
                            <strong style="font-family: var(--font-mono); color: var(--crimson-danger);">${ForensiQ.escapeHtml(l.link_id)}</strong>:
                            ${ForensiQ.escapeHtml(l.source_asset_id)} &harr; ${ForensiQ.escapeHtml(l.target_asset_id)}
                        </span>
                        <span style="font-family: var(--font-mono); color: var(--text-dim);">Cost: ${Number(l.cost).toFixed(1)}</span>
                    </div>
                `).join("");
            }
        }

        // 3. Affected Evidence (Hosted evidence lost)
        const affectedEvidence = evidenceList.filter((e) => removedSet.has(e.asset_id));

        if (evCountSpan) evCountSpan.textContent = affectedEvidence.length;
        if (evListContainer) {
            if (affectedEvidence.length === 0) {
                evListContainer.innerHTML = '<span style="color: var(--text-dim); font-style: italic;">No hosted evidence lost.</span>';
            } else {
                evListContainer.innerHTML = affectedEvidence.map((e) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                        <span>
                            <strong style="font-family: var(--font-mono); color: var(--amber-warning);">${ForensiQ.escapeHtml(e.evidence_id)}</strong>
                            (${ForensiQ.escapeHtml(e.asset_id)})
                        </span>
                        <span style="font-family: var(--font-mono); color: var(--text-dim);">${Number(e.estimated_value).toFixed(1)} pts (${e.examination_hours}h)</span>
                    </div>
                `).join("");
            }
        }
    }

    function destroyCharts() {
        if (chartComparison) {
            chartComparison.destroy();
            chartComparison = null;
        }
        if (chartWorkloadShift) {
            chartWorkloadShift.destroy();
            chartWorkloadShift = null;
        }
    }

    function renderComparisonCharts(data) {
        destroyCharts();

        if (typeof Chart === "undefined") {
            console.warn("Chart.js not loaded.");
            return;
        }

        const baselineVal = baselineAnalysis ? Number(baselineAnalysis.maximum_evidence_value || 0) : 0;
        const degradedVal = Number(data.maximum_evidence_value || 0);

        const baselineCost = baselineAnalysis ? Number(baselineAnalysis.total_access_cost || 0) : 0;
        const degradedCost = Number(data.total_access_cost || 0);

        // CHART 1: KPI COMPARISON (Evidentiary Yield & Access Cost)
        const ctxKpi = document.getElementById("chart-sens-comparison");
        if (ctxKpi) {
            chartComparison = new Chart(ctxKpi, {
                type: "bar",
                data: {
                    labels: ["Evidentiary Yield (pts)", "Network Access Cost"],
                    datasets: [
                        {
                            label: "Baseline Network",
                            data: [baselineVal, baselineCost],
                            backgroundColor: "rgba(56, 189, 248, 0.65)",
                            borderColor: "#38BDF8",
                            borderWidth: 1.5,
                            borderRadius: 4,
                        },
                        {
                            label: "Degraded Stress Test",
                            data: [degradedVal, degradedCost],
                            backgroundColor: "rgba(248, 113, 113, 0.65)",
                            borderColor: "#F87171",
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
                            labels: { color: "#94A3B8", font: { family: "Inter", size: 11 }, boxWidth: 12 },
                        },
                        tooltip: {
                            backgroundColor: "#17263B",
                            titleColor: "#F1F5F9",
                            bodyColor: "#94A3B8",
                            borderColor: "#38BDF8",
                            borderWidth: 1,
                        },
                    },
                    scales: {
                        x: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94A3B8" } },
                        y: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94A3B8" }, beginAtZero: true },
                    },
                },
            });
        }

        // CHART 2: ANALYST WORKLOAD SHIFT
        const ctxWorkload = document.getElementById("chart-sens-workload-shift");
        if (ctxWorkload) {
            const analysts = Object.keys(data.allocation || {});
            const baselineHours = [];
            const degradedHours = [];

            analysts.forEach((name) => {
                const bItems = baselineAnalysis?.allocation ? (baselineAnalysis.allocation[name] || []) : [];
                const dItems = data.allocation ? (data.allocation[name] || []) : [];

                const bH = bItems.reduce((s, it) => s + Number(it.examination_hours || 0), 0);
                const dH = dItems.reduce((s, it) => s + Number(it.examination_hours || 0), 0);

                baselineHours.push(bH);
                degradedHours.push(dH);
            });

            chartWorkloadShift = new Chart(ctxWorkload, {
                type: "bar",
                data: {
                    labels: analysts,
                    datasets: [
                        {
                            label: "Baseline Hours",
                            data: baselineHours,
                            backgroundColor: "rgba(45, 212, 191, 0.6)",
                            borderColor: "#2DD4BF",
                            borderWidth: 1.5,
                            borderRadius: 4,
                        },
                        {
                            label: "Post-Sensitivity Hours",
                            data: degradedHours,
                            backgroundColor: "rgba(251, 191, 36, 0.6)",
                            borderColor: "#FBBF24",
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
                            labels: { color: "#94A3B8", font: { family: "Inter", size: 11 }, boxWidth: 12 },
                        },
                    },
                    scales: {
                        x: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94A3B8" } },
                        y: {
                            grid: { color: "rgba(255, 255, 255, 0.05)" },
                            ticks: { color: "#94A3B8", stepSize: 2 },
                            title: { display: true, text: "Assigned Hours", color: "#64748B", font: { size: 11 } },
                            beginAtZero: true,
                        },
                    },
                },
            });
        }
    }

    function renderDegradedAllocations(data) {
        const container = document.getElementById("sens-analysts-container");
        if (!container) return;

        const allocation = data.allocation || {};
        const analystNames = Object.keys(allocation);

        if (analystNames.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px;">No analyst allocations available.</div>';
            return;
        }

        container.innerHTML = analystNames.map((name) => {
            const items = allocation[name] || [];
            const analystRecord = analystsList.find((a) => a.analyst_name === name);
            const cap = analystRecord
    ? Number(
        analystRecord.capacity_hours ??
        analystRecord.available_hours ??
        analystRecord.capacity ??
        0
      )
    : 0;
            const hours = items.reduce((s, it) => s + Number(it.examination_hours || 0), 0);
            const val = items.reduce((s, it) => s + Number(it.estimated_value || 0), 0);

            return `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px 18px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <strong style="color: var(--text-primary); font-size: 0.95rem;">${ForensiQ.escapeHtml(name)}</strong>
                            <span style="color: var(--text-dim); font-size: 0.8rem; margin-left: 8px;">Workload: <strong>${hours}h</strong> / ${cap}h</span>
                        </div>
                        <div>
                            <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 700;">
                                Value: ${val.toFixed(1)} pts
                            </span>
                        </div>
                    </div>

                    ${
                        items.length === 0
                            ? '<div style="color: var(--text-dim); font-size: 0.8rem; font-style: italic;">No items assigned under degraded constraints.</div>'
                            : `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                                ${items.map((it) => `
                                    <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-primary); font-size: 0.76rem;">
                                        ${ForensiQ.escapeHtml(it.evidence_id)} (${it.examination_hours}h, ${Number(it.estimated_value).toFixed(0)} pts)
                                    </span>
                                `).join("")}
                               </div>`
                    }
                </div>
            `;
        }).join("");
    }

    document.addEventListener("DOMContentLoaded", initSensitivityPage);
})();
