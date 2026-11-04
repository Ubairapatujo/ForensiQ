/**
 * ForensiQ Link Failure Simulation Controller
 * Manages link failure selection (strictly 3 links), calls POST /simulate,
 * and renders baseline vs. simulated costs, reachability, real timing, and bridge links.
 */

(function () {
    let currentInvestigationId = null;
    let assetsList = [];
    let accessibleLinksList = [];
    let baselineAnalysis = null;
    let selectedLinkIds = new Set();

    async function initSimulationPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    function setupEventListeners() {
        const btnRun = document.getElementById("btn-run-simulation");
        if (btnRun) {
            btnRun.addEventListener("click", () => {
                executeSimulation();
            });
        }

        const btnQuickSelect = document.getElementById("btn-quick-select-3");
        if (btnQuickSelect) {
            btnQuickSelect.addEventListener("click", () => {
                quickSelectThreeLinks();
            });
        }

        const btnClear = document.getElementById("btn-clear-selection");
        if (btnClear) {
            btnClear.addEventListener("click", () => {
                clearSelection();
            });
        }
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("sim-no-inv-banner");
        const mainContent = document.getElementById("sim-main-content");
        const resultsContainer = document.getElementById("sim-results-container");
        const errorBanner = document.getElementById("sim-error-banner");

        if (errorBanner) errorBanner.style.display = "none";
        if (resultsContainer) resultsContainer.style.display = "none";
        clearSelection();

        if (!currentInvestigationId) {
            if (noInvBanner) noInvBanner.style.display = "flex";
            if (mainContent) mainContent.style.display = "none";
            return;
        }

        if (noInvBanner) noInvBanner.style.display = "none";
        if (mainContent) mainContent.style.display = "block";

        await loadSimulationPrerequisites();
    }

    async function loadSimulationPrerequisites() {
        if (!currentInvestigationId) return;

        const errorBanner = document.getElementById("sim-error-banner");
        const errorText = document.getElementById("sim-error-text");

        try {
            const [assets, links] = await Promise.all([
                API.getAssets(currentInvestigationId),
                API.getLinks(currentInvestigationId),
            ]);

            assetsList = assets;
            accessibleLinksList = links.filter((l) => l.is_accessible);

            // Fetch baseline analysis to compare against
            baselineAnalysis = null;
            if (assets.length >= 2 && assets.some((a) => a.is_root)) {
                try {
                    baselineAnalysis = await API.runAnalysis(currentInvestigationId);
                } catch (err) {
                    console.warn("Could not precompute baseline analysis:", err.message);
                }
            }

            if (accessibleLinksList.length < 3) {
                if (errorBanner && errorText) {
                    errorText.innerHTML = `<strong>Insufficient Accessible Links:</strong> Investigation requires at least 3 accessible links to simulate link failure (currently ${accessibleLinksList.length} accessible).`;
                    errorBanner.style.display = "block";
                }
            } else {
                if (errorBanner) errorBanner.style.display = "none";
            }

            renderAccessibleLinksTable();
            updateSelectionCounter();
        } catch (error) {
            console.error("Failed to load simulation prerequisites:", error);
            if (errorBanner && errorText) {
                errorText.innerHTML = `<strong>Data Loading Error:</strong> Failed to load links and assets: ${ForensiQ.escapeHtml(error.message || "Server error")}`;
                errorBanner.style.display = "block";
            }
            ForensiQ.toast("Failed to load investigation links", "error");
        }
    }

    function renderAccessibleLinksTable() {
        const tbody = document.getElementById("sim-accessible-links-body");
        if (!tbody) return;

        if (accessibleLinksList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-table-cell" style="padding: 24px; text-align: center; color: var(--text-dim);">
                        No accessible links available in this investigation.
                    </td>
                </tr>
            `;
            return;
        }

        const baselineMstSet = new Set((baselineAnalysis?.selected_links || []).map((l) => l.link_id));

        tbody.innerHTML = accessibleLinksList.map((link) => {
            const isChecked = selectedLinkIds.has(link.link_id);
            const inBaseline = baselineMstSet.has(link.link_id);

            const sourceAsset = assetsList.find((a) => a.asset_id === link.source_asset_id);
            const targetAsset = assetsList.find((a) => a.asset_id === link.target_asset_id);

            return `
                <tr style="${isChecked ? 'background: rgba(248, 113, 113, 0.08);' : ''}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="sim-link-checkbox form-check-input" data-link-id="${ForensiQ.escapeHtml(link.link_id)}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
                    </td>
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
                            ${Number(link.cost).toFixed(2)}
                        </span>
                    </td>
                    <td>
                        ${
                            inBaseline
                                ? '<span class="badge" style="background: var(--teal-success-dim); color: var(--teal-success);">In Baseline MST</span>'
                                : '<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-dim);">Alternate Path</span>'
                        }
                    </td>
                </tr>
            `;
        }).join("");

        // Attach checkbox change handlers
        tbody.querySelectorAll(".sim-link-checkbox").forEach((cb) => {
            cb.addEventListener("change", (e) => {
                const linkId = e.target.getAttribute("data-link-id");
                if (e.target.checked) {
                    if (selectedLinkIds.size >= 3) {
                        e.target.checked = false;
                        ForensiQ.toast("Simulation requires exactly 3 links. Deselect one first.", "warning");
                        return;
                    }
                    selectedLinkIds.add(linkId);
                } else {
                    selectedLinkIds.delete(linkId);
                }
                updateSelectionCounter();
                renderAccessibleLinksTable();
            });
        });
    }

    function updateSelectionCounter() {
        const count = selectedLinkIds.size;
        const countSpan = document.getElementById("sim-selected-count");
        const badge = document.getElementById("sim-selection-counter-badge");
        const btnRun = document.getElementById("btn-run-simulation");

        if (countSpan) countSpan.textContent = count;

        if (badge) {
            if (count === 3) {
                badge.style.background = "var(--teal-success-dim)";
                badge.style.color = "var(--teal-success)";
                badge.style.borderColor = "rgba(45, 212, 191, 0.4)";
            } else {
                badge.style.background = "rgba(251, 191, 36, 0.15)";
                badge.style.color = "var(--amber-warning)";
                badge.style.borderColor = "rgba(251, 191, 36, 0.35)";
            }
        }

        if (btnRun) {
            btnRun.disabled = count !== 3;
        }
    }

    function quickSelectThreeLinks() {
        if (accessibleLinksList.length < 3) {
            ForensiQ.toast("At least 3 accessible links are required", "warning");
            return;
        }

        selectedLinkIds.clear();
        for (let i = 0; i < 3; i++) {
            selectedLinkIds.add(accessibleLinksList[i].link_id);
        }

        renderAccessibleLinksTable();
        updateSelectionCounter();
        ForensiQ.toast("Selected first 3 accessible links", "info");
    }

    function clearSelection() {
        selectedLinkIds.clear();
        renderAccessibleLinksTable();
        updateSelectionCounter();
    }

    async function executeSimulation() {
        if (!currentInvestigationId) return;
        if (selectedLinkIds.size !== 3) {
            ForensiQ.toast("Please select exactly three accessible links", "warning");
            return;
        }

        const failedArray = Array.from(selectedLinkIds);
        const loadingState = document.getElementById("sim-loading-state");
        const resultsContainer = document.getElementById("sim-results-container");
        const errorBanner = document.getElementById("sim-error-banner");
        const errorText = document.getElementById("sim-error-text");
        const btnRun = document.getElementById("btn-run-simulation");

        if (resultsContainer) resultsContainer.style.display = "none";
        if (errorBanner) errorBanner.style.display = "none";
        if (loadingState) loadingState.style.display = "block";
        if (btnRun) btnRun.disabled = true;

        try {
            const data = await API.runSimulation(currentInvestigationId, failedArray);

            if (loadingState) loadingState.style.display = "none";
            if (resultsContainer) resultsContainer.style.display = "block";

            renderSimulationResults(data, failedArray);
            ForensiQ.toast("Link failure simulation executed successfully", "success");
        } catch (error) {
            console.error("Simulation failed:", error);
            if (loadingState) loadingState.style.display = "none";
            if (errorBanner && errorText) {
                errorText.innerHTML = `<strong>Simulation Execution Error:</strong> ${ForensiQ.escapeHtml(error.message || "Failed to execute simulation")}`;
                errorBanner.style.display = "block";
            }
            ForensiQ.toast(error.message || "Simulation failed", "error");
        } finally {
            if (btnRun) btnRun.disabled = selectedLinkIds.size !== 3;
        }
    }

    function renderSimulationResults(data, failedArray) {
        // 1. Cost Comparison
        const elUpdatedCost = document.getElementById("sim-res-updated-cost");
        const elCostDelta = document.getElementById("sim-res-cost-delta");
        const elBaselineLabel = document.getElementById("sim-res-cost-baseline-label");

        const updatedCost = Number(data.updated_cost || 0);
        const baselineCost = baselineAnalysis ? Number(baselineAnalysis.total_access_cost || 0) : updatedCost;
        const costDelta = updatedCost - baselineCost;

        if (elUpdatedCost) elUpdatedCost.textContent = updatedCost.toFixed(2);
        if (elBaselineLabel) elBaselineLabel.textContent = `Baseline MSF Cost: ${baselineCost.toFixed(2)}`;

        if (elCostDelta) {
            if (costDelta > 0) {
                elCostDelta.textContent = `+${costDelta.toFixed(2)}`;
                elCostDelta.className = "badge";
                elCostDelta.style.background = "var(--crimson-danger-dim)";
                elCostDelta.style.color = "var(--crimson-danger)";
            } else if (costDelta === 0) {
                elCostDelta.textContent = "±0.00";
                elCostDelta.className = "badge";
                elCostDelta.style.background = "rgba(255, 255, 255, 0.05)";
                elCostDelta.style.color = "var(--text-muted)";
            } else {
                elCostDelta.textContent = `${costDelta.toFixed(2)}`;
                elCostDelta.className = "badge badge-active";
            }
        }

        // 2. DFS Reachability
        const elReachability = document.getElementById("sim-res-reachability");
        const elReachDelta = document.getElementById("sim-res-reach-delta");
        const reachableCount = (data.reachable_assets || []).length;
        const totalAssets = assetsList.length;
        const baselineReachableCount = baselineAnalysis ? (baselineAnalysis.reachable_assets || []).length : reachableCount;
        const reachDelta = reachableCount - baselineReachableCount;

        if (elReachability) elReachability.textContent = `${reachableCount} / ${totalAssets}`;
        if (elReachDelta) {
            if (reachDelta < 0) {
                elReachDelta.textContent = `${reachDelta} assets lost`;
                elReachDelta.className = "badge";
                elReachDelta.style.background = "var(--crimson-danger-dim)";
                elReachDelta.style.color = "var(--crimson-danger)";
            } else {
                elReachDelta.textContent = "0 assets lost";
                elReachDelta.className = "badge badge-active";
            }
        }

        // 3. Real Timing Data (Only rendered because returned by backend)
        const elRecompTime = document.getElementById("sim-res-recomp-time");
        const elIncrTime = document.getElementById("sim-res-incr-time");
        const elSpeedup = document.getElementById("sim-res-speedup-badge");

        const recompMs = Number(data.recomputation_time_ms || 0);
        const incrMs = Number(data.incremental_time_ms || 0);

        if (elRecompTime) elRecompTime.textContent = `${recompMs.toFixed(3)} ms`;
        if (elIncrTime) elIncrTime.textContent = `${incrMs.toFixed(3)} ms`;

        if (elSpeedup) {
            if (incrMs > 0) {
                const ratio = recompMs / incrMs;
                elSpeedup.textContent = `${ratio.toFixed(1)}x faster`;
            } else {
                elSpeedup.textContent = "Instantaneous";
            }
        }

        // 4. Verification Check
        const badgeMatch = document.getElementById("sim-costs-match-badge");
        const textMatch = document.getElementById("sim-verification-text");
        if (badgeMatch) {
            badgeMatch.textContent = `costs_match: ${data.costs_match}`;
            badgeMatch.className = data.costs_match ? "badge badge-active" : "badge";
            if (!data.costs_match) {
                badgeMatch.style.background = "var(--crimson-danger-dim)";
                badgeMatch.style.color = "var(--crimson-danger)";
            }
        }
        if (textMatch) {
            textMatch.textContent = data.costs_match
                ? "Algorithm Verification: Incremental tree update cost strictly matches full Kruskal recomputation."
                : "Algorithm Warning: Incremental cost discrepancy detected against full recomputation.";
        }

        // 5. Reachability Chips
        renderReachabilityChips(data);

        // 6. Updated Links Table
        renderUpdatedLinksTable(data, failedArray);
    }

    function renderReachabilityChips(data) {
        const containerReachable = document.getElementById("sim-reachable-chips");
        const containerUnreachable = document.getElementById("sim-unreachable-chips");

        const reachableSet = new Set(data.reachable_assets || []);
        const unreachableSet = new Set(data.unreachable_assets || []);

        if (containerReachable) {
            if (reachableSet.size === 0) {
                containerReachable.innerHTML = '<span style="color: var(--text-dim); font-size: 0.82rem; font-style: italic;">No reachable assets</span>';
            } else {
                containerReachable.innerHTML = Array.from(reachableSet).map((assetId) => {
                    const asset = assetsList.find((a) => a.asset_id === assetId);
                    const isRoot = asset?.is_root;
                    return `
                        <span class="badge ${isRoot ? 'badge-root' : 'badge-active'}" style="font-size: 0.8rem; padding: 4px 10px;">
                            <strong>${ForensiQ.escapeHtml(assetId)}</strong>
                            ${asset ? `<span style="opacity: 0.75; font-weight: normal;">(${ForensiQ.escapeHtml(asset.asset_name)})</span>` : ''}
                        </span>
                    `;
                }).join("");
            }
        }

        if (containerUnreachable) {
            if (unreachableSet.size === 0) {
                containerUnreachable.innerHTML = '<span style="color: var(--teal-success); font-size: 0.82rem;">Network Intact: No nodes disconnected by link severance.</span>';
            } else {
                containerUnreachable.innerHTML = Array.from(unreachableSet).map((assetId) => {
                    const asset = assetsList.find((a) => a.asset_id === assetId);
                    return `
                        <span class="badge" style="background: var(--crimson-danger-dim); color: var(--crimson-danger); border: 1px solid rgba(248, 113, 113, 0.35); font-size: 0.8rem; padding: 4px 10px;">
                            <strong>${ForensiQ.escapeHtml(assetId)}</strong>
                            ${asset ? `<span style="opacity: 0.75; font-weight: normal;">(${ForensiQ.escapeHtml(asset.asset_name)})</span>` : ''}
                        </span>
                    `;
                }).join("");
            }
        }
    }

    function renderUpdatedLinksTable(data, failedArray) {
        const tbody = document.getElementById("sim-updated-links-body");
        if (!tbody) return;

        const updatedForest = data.updated_forest || [];
        const baselineMstSet = new Set((baselineAnalysis?.selected_links || []).map((l) => l.link_id));
        const failedSet = new Set(failedArray);

        let html = "";

        // First render severed links with distinct warning row
        failedArray.forEach((linkId) => {
            const link = accessibleLinksList.find((l) => l.link_id === linkId);
            if (link) {
                html += `
                    <tr style="background: rgba(248, 113, 113, 0.08); text-decoration: line-through; opacity: 0.7;">
                        <td>
                            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--crimson-danger);">
                                ${ForensiQ.escapeHtml(link.link_id)}
                            </span>
                        </td>
                        <td>${ForensiQ.escapeHtml(link.source_asset_id)}</td>
                        <td style="text-align: center; color: var(--crimson-danger);">&times;</td>
                        <td>${ForensiQ.escapeHtml(link.target_asset_id)}</td>
                        <td>${Number(link.cost).toFixed(2)}</td>
                        <td>
                            <span class="badge" style="background: var(--crimson-danger-dim); color: var(--crimson-danger); border: 1px solid rgba(248, 113, 113, 0.35);">
                                [SEVERED / FAILED]
                            </span>
                        </td>
                    </tr>
                `;
            }
        });

        // Next render reconstructed forest links
        updatedForest.forEach((link) => {
            const isRecruitedBridge = !baselineMstSet.has(link.link_id);
            const sourceAsset = assetsList.find((a) => a.asset_id === link.source_asset_id);
            const targetAsset = assetsList.find((a) => a.asset_id === link.target_asset_id);

            let statusBadge = "";
            if (isRecruitedBridge) {
                statusBadge = '<span class="badge" style="background: var(--accent-cyan-dim); color: var(--accent-cyan); border: 1px solid rgba(56, 189, 248, 0.35); font-weight: 700;">[RECRUITED BRIDGE]</span>';
            } else {
                statusBadge = '<span class="badge badge-active">[RETAINED MST LINK]</span>';
            }

            html += `
                <tr style="${isRecruitedBridge ? 'background: rgba(56, 189, 248, 0.05);' : ''}">
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
                            ${Number(link.cost).toFixed(2)}
                        </span>
                    </td>
                    <td>
                        ${statusBadge}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    document.addEventListener("DOMContentLoaded", initSimulationPage);
})();
