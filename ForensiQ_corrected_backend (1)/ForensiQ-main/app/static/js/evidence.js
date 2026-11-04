/**
 * ForensiQ Evidence Management Controller
 * Handles CRUD operations, asset relationship dropdowns,
 * value-per-hour density metrics, and client search/filtering.
 */

(function () {
    let evidenceList = [];
    let assetsMap = new Map();
    let currentInvestigationId = null;

    async function initEvidencePage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("evidence-no-inv-banner");
        const mainContent = document.getElementById("evidence-main-content");

        if (!currentInvestigationId) {
            if (noInvBanner) noInvBanner.style.display = "flex";
            if (mainContent) mainContent.style.display = "none";
            return;
        }

        if (noInvBanner) noInvBanner.style.display = "none";
        if (mainContent) mainContent.style.display = "block";

        await loadData();
    }

    function setupEventListeners() {
        // Open Create Modal
        const btnOpenCreate = document.getElementById("btn-open-create-evidence");
        if (btnOpenCreate) {
            btnOpenCreate.addEventListener("click", () => {
                const form = document.getElementById("form-create-evidence");
                form.reset();
                document.getElementById("create-evidence-hours").value = "4";
                document.getElementById("create-evidence-value").value = "50";
                hideError("create-evidence-error");

                if (assetsMap.size === 0) {
                    ForensiQ.toast("Please add at least one forensic asset before adding evidence items.", "warning", 5000);
                }

                populateAssetDropdown("create-evidence-asset");
                ForensiQ.openModal("modal-create-evidence");
            });
        }

        // Form: Create Evidence
        const formCreate = document.getElementById("form-create-evidence");
        if (formCreate) {
            formCreate.addEventListener("submit", handleCreateEvidence);
        }

        // Form: Edit Evidence
        const formEdit = document.getElementById("form-edit-evidence");
        if (formEdit) {
            formEdit.addEventListener("submit", handleEditEvidence);
        }

        // Delete Confirm Button
        const btnConfirmDelete = document.getElementById("btn-confirm-delete-evidence");
        if (btnConfirmDelete) {
            btnConfirmDelete.addEventListener("click", handleConfirmDeleteEvidence);
        }

        // Search & Filter
        const searchInput = document.getElementById("evidence-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", renderEvidenceTable);
        }

        const assetFilter = document.getElementById("evidence-asset-filter");
        if (assetFilter) {
            assetFilter.addEventListener("change", renderEvidenceTable);
        }

        // Refresh Button
        const btnRefresh = document.getElementById("btn-refresh-evidence");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", async () => {
                btnRefresh.disabled = true;
                await loadData();
                btnRefresh.disabled = false;
            });
        }
    }

    /**
     * Fetch assets and evidence in parallel
     */
    async function loadData() {
        const tableContainer = document.getElementById("evidence-table-container");
        const countEl = document.getElementById("evidence-results-count");

        if (!currentInvestigationId) return;

        try {
            const [assets, evidence] = await Promise.all([
                API.getAssets(currentInvestigationId),
                API.getEvidence(currentInvestigationId),
            ]);

            assetsMap.clear();
            assets.forEach((a) => assetsMap.set(a.asset_id, a));
            evidenceList = evidence;

            updateSummaryStats();
            populateAssetFilterOptions();
            renderEvidenceTable();
        } catch (error) {
            console.error("Failed to load evidence:", error);
            if (countEl) countEl.textContent = "Error loading";
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon" style="color: var(--crimson-danger);">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="state-title">Error Loading Evidence</div>
                        <div class="state-desc">${ForensiQ.escapeHtml(error.message)}</div>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    function populateAssetDropdown(selectId, selectedId = "") {
        const select = document.getElementById(selectId);
        if (!select) return;

        let html = '<option value="">-- Choose Asset --</option>';
        assetsMap.forEach((asset, id) => {
            const isSelected = id === selectedId ? "selected" : "";
            html += `<option value="${ForensiQ.escapeHtml(id)}" ${isSelected}>
                ${ForensiQ.escapeHtml(id)}: ${ForensiQ.escapeHtml(asset.asset_name)}
            </option>`;
        });

        select.innerHTML = html;
    }

    function populateAssetFilterOptions() {
        const filterSelect = document.getElementById("evidence-asset-filter");
        if (!filterSelect) return;

        const currentVal = filterSelect.value;
        const usedAssetIds = Array.from(new Set(evidenceList.map((e) => e.asset_id))).sort();

        let html = '<option value="ALL">All Source Assets</option>';
        usedAssetIds.forEach((id) => {
            const asset = assetsMap.get(id);
            const name = asset ? asset.asset_name : id;
            html += `<option value="${ForensiQ.escapeHtml(id)}">${ForensiQ.escapeHtml(id)}: ${ForensiQ.escapeHtml(name)}</option>`;
        });

        filterSelect.innerHTML = html;
        if (usedAssetIds.includes(currentVal)) {
            filterSelect.value = currentVal;
        }
    }

    function updateSummaryStats() {
        const statTotal = document.getElementById("stat-total-evidence");
        const statHours = document.getElementById("stat-total-hours");
        const statValue = document.getElementById("stat-total-value");
        const statDensity = document.getElementById("stat-avg-density");

        const totalItems = evidenceList.length;
        const totalHours = evidenceList.reduce((sum, e) => sum + (e.examination_hours || 0), 0);
        const totalValue = evidenceList.reduce((sum, e) => sum + (e.estimated_value || 0), 0);
        const avgDensity = totalHours > 0 ? (totalValue / totalHours).toFixed(1) : "0.0";

        if (statTotal) statTotal.textContent = totalItems;
        if (statHours) statHours.textContent = `${totalHours}h`;
        if (statValue) statValue.textContent = totalValue.toFixed(1);
        if (statDensity) statDensity.textContent = avgDensity;
    }

    /**
     * Render filtered evidence table
     */
    function renderEvidenceTable() {
        const tableContainer = document.getElementById("evidence-table-container");
        const countEl = document.getElementById("evidence-results-count");
        const searchQuery = (document.getElementById("evidence-search-input")?.value || "").trim().toLowerCase();
        const assetFilter = document.getElementById("evidence-asset-filter")?.value || "ALL";

        const filtered = evidenceList.filter((e) => {
            const matchesAsset = assetFilter === "ALL" || (e.asset_id || "") === assetFilter;
            const eid = (e.evidence_id || "").toLowerCase();
            const aid = (e.asset_id || "").toLowerCase();
            const desc = (e.description || "").toLowerCase();
            const assetName = (assetsMap.get(e.asset_id)?.asset_name || "").toLowerCase();

            const matchesSearch =
                !searchQuery ||
                eid.includes(searchQuery) ||
                aid.includes(searchQuery) ||
                desc.includes(searchQuery) ||
                assetName.includes(searchQuery);

            return matchesAsset && matchesSearch;
        });

        if (countEl) {
            countEl.textContent = `Showing ${filtered.length} of ${evidenceList.length} items`;
        }

        if (filtered.length === 0) {
            if (evidenceList.length === 0) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <div class="state-title">No Evidence Items Recorded</div>
                        <div class="state-desc">Attach forensic artifacts to assets to enable Multiple Knapsack DP optimization and workload assignment.</div>
                        <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-open-create-evidence').click()">
                            + Add First Evidence Item
                        </button>
                    </div>
                `;
            } else {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <div class="state-title">No Matching Evidence</div>
                        <div class="state-desc">Try clearing your search keyword or asset filter.</div>
                        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('evidence-search-input').value=''; document.getElementById('evidence-asset-filter').value='ALL'; renderEvidenceTable();">
                            Clear Filters
                        </button>
                    </div>
                `;
            }
            return;
        }

        let rowsHtml = filtered.map((e) => {
            const asset = assetsMap.get(e.asset_id);
            const assetDisplay = asset
                ? `<span style="font-weight: 600; color: var(--text-primary);">${ForensiQ.escapeHtml(e.asset_id)}</span> <span style="font-size: 0.78rem; color: var(--text-muted);">(${ForensiQ.escapeHtml(asset.asset_name)})</span>`
                : `<span style="color: var(--crimson-danger);">${ForensiQ.escapeHtml(e.asset_id)} (Unknown)</span>`;

            const density = e.examination_hours > 0 ? (e.estimated_value / e.examination_hours).toFixed(1) : "0.0";

            return `
                <tr>
                    <td>
                        <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.95rem;">
                            ${ForensiQ.escapeHtml(e.evidence_id)}
                        </span>
                    </td>
                    <td>${assetDisplay}</td>
                    <td style="color: var(--text-primary); max-width: 320px; line-height: 1.4;">
                        ${ForensiQ.escapeHtml(e.description)}
                    </td>
                    <td>
                        <span style="font-weight: 600; color: var(--text-primary); font-feature-settings: 'tnum';">
                            ${e.examination_hours}h
                        </span>
                    </td>
                    <td>
                        <span style="font-weight: 700; color: var(--teal-success); font-feature-settings: 'tnum';">
                            ${e.estimated_value}
                        </span>
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: var(--accent-cyan); border: 1px solid rgba(56, 189, 248, 0.25);">
                            ${density} val/h
                        </span>
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-secondary btn-sm btn-edit-evidence" data-id="${ForensiQ.escapeHtml(e.evidence_id)}" title="Edit evidence item">
                                Edit
                            </button>
                            <button class="btn btn-outline-danger btn-sm btn-delete-evidence" data-id="${ForensiQ.escapeHtml(e.evidence_id)}" title="Delete evidence item">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        tableContainer.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 100px;">Evidence ID</th>
                        <th style="width: 220px;">Associated Asset</th>
                        <th>Description</th>
                        <th style="width: 110px;">Hours</th>
                        <th style="width: 110px;">Value</th>
                        <th style="width: 120px;">Density</th>
                        <th style="width: 150px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        tableContainer.querySelectorAll(".btn-edit-evidence").forEach((btn) => {
            btn.addEventListener("click", () => {
                const eid = btn.getAttribute("data-id");
                openEditEvidenceModal(eid);
            });
        });

        tableContainer.querySelectorAll(".btn-delete-evidence").forEach((btn) => {
            btn.addEventListener("click", () => {
                const eid = btn.getAttribute("data-id");
                openDeleteEvidenceModal(eid);
            });
        });
    }

    /**
     * CREATE EVIDENCE HANDLER
     */
    async function handleCreateEvidence(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-create-evidence");
        const idInput = document.getElementById("create-evidence-id");
        const assetSelect = document.getElementById("create-evidence-asset");
        const descInput = document.getElementById("create-evidence-desc");
        const hoursInput = document.getElementById("create-evidence-hours");
        const valueInput = document.getElementById("create-evidence-value");

        const evidence_id = (idInput.value || "").trim();
        const asset_id = assetSelect.value;
        const description = (descInput.value || "").trim();
        const examination_hours = parseInt(hoursInput.value, 10);
        const estimated_value = parseFloat(valueInput.value);

        if (!evidence_id || !asset_id || !description) {
            showError("create-evidence-error", "Evidence ID, associated asset and description are required.");
            return;
        }

        if (isNaN(examination_hours) || examination_hours <= 0) {
            showError("create-evidence-error", "Examination hours must be a positive integer (> 0).");
            return;
        }

        if (isNaN(estimated_value) || estimated_value < 0) {
            showError("create-evidence-error", "Estimated value must be a non-negative number (>= 0).");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Creating...";

        try {
            const result = await API.createEvidence(currentInvestigationId, {
                evidence_id,
                asset_id,
                description,
                examination_hours,
                estimated_value,
            });

            ForensiQ.closeModal("modal-create-evidence");
            ForensiQ.toast(result.message || "Evidence created successfully", "success");
            await loadData();
        } catch (error) {
            console.error("Create evidence error:", error);
            showError("create-evidence-error", error.message || "Failed to create evidence.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Save Evidence</span>
            `;
        }
    }

    /**
     * OPEN EDIT MODAL
     */
    function openEditEvidenceModal(evidenceId) {
        const item = evidenceList.find((e) => e.evidence_id === evidenceId);
        if (!item) return;

        document.getElementById("edit-evidence-original-id").value = item.evidence_id;
        document.getElementById("edit-evidence-id-display").value = item.evidence_id;
        document.getElementById("edit-evidence-desc").value = item.description || "";
        document.getElementById("edit-evidence-hours").value = item.examination_hours;
        document.getElementById("edit-evidence-value").value = item.estimated_value;

        populateAssetDropdown("edit-evidence-asset", item.asset_id);

        hideError("edit-evidence-error");
        ForensiQ.openModal("modal-edit-evidence");
    }

    /**
     * EDIT EVIDENCE HANDLER
     */
    async function handleEditEvidence(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-edit-evidence");
        const evidenceId = document.getElementById("edit-evidence-original-id").value;
        const asset_id = document.getElementById("edit-evidence-asset").value;
        const description = (document.getElementById("edit-evidence-desc").value || "").trim();
        const examination_hours = parseInt(document.getElementById("edit-evidence-hours").value, 10);
        const estimated_value = parseFloat(document.getElementById("edit-evidence-value").value);

        if (!asset_id || !description) {
            showError("edit-evidence-error", "Associated asset and description are required.");
            return;
        }

        if (isNaN(examination_hours) || examination_hours <= 0) {
            showError("edit-evidence-error", "Examination hours must be a positive integer (> 0).");
            return;
        }

        if (isNaN(estimated_value) || estimated_value < 0) {
            showError("edit-evidence-error", "Estimated value must be a non-negative number.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";

        try {
            const result = await API.updateEvidence(currentInvestigationId, evidenceId, {
                asset_id,
                description,
                examination_hours,
                estimated_value,
            });

            ForensiQ.closeModal("modal-edit-evidence");
            ForensiQ.toast(result.message || "Evidence updated successfully", "success");
            await loadData();
        } catch (error) {
            console.error("Update evidence error:", error);
            showError("edit-evidence-error", error.message || "Failed to update evidence.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Save Changes</span>
            `;
        }
    }

    /**
     * OPEN DELETE MODAL
     */
    function openDeleteEvidenceModal(evidenceId) {
        document.getElementById("delete-evidence-target-id").value = evidenceId;
        document.getElementById("delete-evidence-name-display").textContent = evidenceId;
        hideError("delete-evidence-error-box");
        ForensiQ.openModal("modal-delete-evidence");
    }

    /**
     * DELETE EVIDENCE HANDLER
     */
    async function handleConfirmDeleteEvidence() {
        const btn = document.getElementById("btn-confirm-delete-evidence");
        const evidenceId = document.getElementById("delete-evidence-target-id").value;
        if (!evidenceId) return;

        btn.disabled = true;
        btn.innerHTML = "Deleting...";

        try {
            const result = await API.deleteEvidence(currentInvestigationId, evidenceId);
            ForensiQ.closeModal("modal-delete-evidence");
            ForensiQ.toast(result.message || "Evidence deleted successfully", "success");
            await loadData();
        } catch (error) {
            console.error("Delete evidence failed:", error);
            showError("delete-evidence-error-box", error.message || "Failed to delete evidence.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete Evidence</span>
            `;
        }
    }

    function showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.style.display = "block";
        }
    }

    function hideError(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = "";
            el.style.display = "none";
        }
    }

    document.addEventListener("DOMContentLoaded", initEvidencePage);
})();
