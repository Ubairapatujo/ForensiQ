/**
 * ForensiQ Asset Management Controller
 * Handles CRUD operations, root asset enforcement, dependency validation,
 * importance score visualization, and client filtering.
 */

(function () {
    let assetsList = [];
    let currentInvestigationId = null;

    async function initAssetsPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async (e) => {
            await evaluateActiveContext();
        });
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("assets-no-inv-banner");
        const mainContent = document.getElementById("assets-main-content");

        if (!currentInvestigationId) {
            if (noInvBanner) noInvBanner.style.display = "flex";
            if (mainContent) mainContent.style.display = "none";
            return;
        }

        if (noInvBanner) noInvBanner.style.display = "none";
        if (mainContent) mainContent.style.display = "block";

        await loadAssets();
    }

    function setupEventListeners() {
        // Open Create Modal
        const btnOpenCreate = document.getElementById("btn-open-create-asset");
        if (btnOpenCreate) {
            btnOpenCreate.addEventListener("click", () => {
                const form = document.getElementById("form-create-asset");
                form.reset();
                document.getElementById("create-asset-importance").value = "8";
                document.getElementById("create-importance-display").textContent = "8";
                hideError("create-asset-error");

                // If this investigation has 0 assets, the first asset MUST be root
                const rootCheckbox = document.getElementById("create-asset-is-root");
                const rootHelper = document.getElementById("create-root-helper");
                if (assetsList.length === 0) {
                    rootCheckbox.checked = true;
                    rootCheckbox.disabled = true;
                    rootHelper.textContent = "First asset in an investigation must be designated as root.";
                } else {
                    rootCheckbox.checked = false;
                    rootCheckbox.disabled = false;
                    rootHelper.textContent = "If selected, any previously designated root asset will be demoted automatically.";
                }

                ForensiQ.openModal("modal-create-asset");
            });
        }

        // Sliders live display
        const createSlider = document.getElementById("create-asset-importance");
        const createDisplay = document.getElementById("create-importance-display");
        if (createSlider && createDisplay) {
            createSlider.addEventListener("input", (e) => {
                createDisplay.textContent = e.target.value;
            });
        }

        const editSlider = document.getElementById("edit-asset-importance");
        const editDisplay = document.getElementById("edit-importance-display");
        if (editSlider && editDisplay) {
            editSlider.addEventListener("input", (e) => {
                editDisplay.textContent = e.target.value;
            });
        }

        // Form: Create Asset
        const formCreate = document.getElementById("form-create-asset");
        if (formCreate) {
            formCreate.addEventListener("submit", handleCreateAsset);
        }

        // Form: Edit Asset
        const formEdit = document.getElementById("form-edit-asset");
        if (formEdit) {
            formEdit.addEventListener("submit", handleEditAsset);
        }

        // Delete Confirm Button
        const btnConfirmDelete = document.getElementById("btn-confirm-delete-asset");
        if (btnConfirmDelete) {
            btnConfirmDelete.addEventListener("click", handleConfirmDeleteAsset);
        }

        // Search and Filters
        const searchInput = document.getElementById("asset-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", renderAssetsTable);
        }

        const typeFilter = document.getElementById("asset-type-filter");
        if (typeFilter) {
            typeFilter.addEventListener("change", renderAssetsTable);
        }

        const rootFilter = document.getElementById("asset-root-filter");
        if (rootFilter) {
            rootFilter.addEventListener("change", renderAssetsTable);
        }

        // Refresh Button
        const btnRefresh = document.getElementById("btn-refresh-assets");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", async () => {
                btnRefresh.disabled = true;
                await loadAssets();
                btnRefresh.disabled = false;
            });
        }
    }

    /**
     * Load assets from API
     */
    async function loadAssets() {
        const tableContainer = document.getElementById("assets-table-container");
        const countEl = document.getElementById("asset-results-count");

        if (!currentInvestigationId) return;

        try {
            assetsList = await API.getAssets(currentInvestigationId);
            updateSummaryStats();
            populateTypeFilterOptions();
            renderAssetsTable();
        } catch (error) {
            console.error("Failed to load assets:", error);
            if (countEl) countEl.textContent = "Error loading";
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon" style="color: var(--crimson-danger);">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="state-title">Error Loading Assets</div>
                        <div class="state-desc">${ForensiQ.escapeHtml(error.message)}</div>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    function updateSummaryStats() {
        const statCount = document.getElementById("stat-assets-count");
        const statRoot = document.getElementById("stat-root-asset");
        const statTypes = document.getElementById("stat-asset-types");

        if (statCount) statCount.textContent = assetsList.length;

        const root = assetsList.find((a) => a.is_root);
        if (statRoot) {
            statRoot.textContent = root ? root.asset_id : "None";
            statRoot.style.color = root ? "var(--amber-warning)" : "var(--crimson-danger)";
        }

        const distinctTypes = new Set(assetsList.map((a) => a.asset_type));
        if (statTypes) statTypes.textContent = distinctTypes.size;
    }

    function populateTypeFilterOptions() {
        const typeSelect = document.getElementById("asset-type-filter");
        if (!typeSelect) return;

        const currentVal = typeSelect.value;
        const types = Array.from(new Set(assetsList.map((a) => a.asset_type))).sort();

        let html = '<option value="ALL">All Types</option>';
        types.forEach((t) => {
            html += `<option value="${ForensiQ.escapeHtml(t)}">${ForensiQ.escapeHtml(t)}</option>`;
        });

        typeSelect.innerHTML = html;
        if (types.includes(currentVal)) {
            typeSelect.value = currentVal;
        }
    }

    /**
     * Render filtered assets table
     */
    function renderAssetsTable() {
        const tableContainer = document.getElementById("assets-table-container");
        const countEl = document.getElementById("asset-results-count");
        const searchQuery = (document.getElementById("asset-search-input")?.value || "").trim().toLowerCase();
        const typeFilter = document.getElementById("asset-type-filter")?.value || "ALL";
        const rootFilter = document.getElementById("asset-root-filter")?.value || "ALL";

        const filtered = assetsList.filter((a) => {
            const matchesType = typeFilter === "ALL" || (a.asset_type || "") === typeFilter;
            const matchesRoot =
                rootFilter === "ALL" ||
                (rootFilter === "ROOT" && a.is_root) ||
                (rootFilter === "NON_ROOT" && !a.is_root);
            const id = (a.asset_id || "").toLowerCase();
            const name = (a.asset_name || "").toLowerCase();
            const type = (a.asset_type || "").toLowerCase();
            const matchesSearch = !searchQuery || id.includes(searchQuery) || name.includes(searchQuery) || type.includes(searchQuery);

            return matchesType && matchesRoot && matchesSearch;
        });

        if (countEl) {
            countEl.textContent = `Showing ${filtered.length} of ${assetsList.length} assets`;
        }

        if (filtered.length === 0) {
            if (assetsList.length === 0) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        </div>
                        <div class="state-title">No Assets Recorded in this Case</div>
                        <div class="state-desc">Add laptops, phones, servers or accounts. The first asset added will serve as the Root Asset.</div>
                        <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-open-create-asset').click()">
                            + Add First Asset
                        </button>
                    </div>
                `;
            } else {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <div class="state-title">No Matching Assets</div>
                        <div class="state-desc">Try clearing your search query or dropdown filters.</div>
                        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('asset-search-input').value=''; document.getElementById('asset-type-filter').value='ALL'; document.getElementById('asset-root-filter').value='ALL'; renderAssetsTable();">
                            Clear Filters
                        </button>
                    </div>
                `;
            }
            return;
        }

        let rowsHtml = filtered.map((a) => {
            const importancePct = (a.importance_score / 10) * 100;
            let importanceColor = "var(--accent-cyan)";
            if (a.importance_score >= 8) importanceColor = "var(--crimson-danger)";
            else if (a.importance_score >= 5) importanceColor = "var(--amber-warning)";

            return `
                <tr class="${a.is_root ? 'row-active' : ''}">
                    <td>
                        <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.95rem;">
                            ${ForensiQ.escapeHtml(a.asset_id)}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary);">
                            ${ForensiQ.escapeHtml(a.asset_name)}
                        </div>
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border-subtle); color: var(--text-primary);">
                            ${ForensiQ.escapeHtml(a.asset_type)}
                        </span>
                    </td>
                    <td style="min-width: 140px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 700; color: ${importanceColor}; min-width: 18px;">
                                ${a.importance_score}
                            </span>
                            <div style="flex: 1; height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 9999px; overflow: hidden;">
                                <div style="width: ${importancePct}%; height: 100%; background: ${importanceColor}; border-radius: 9999px;"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${
                            a.is_root
                                ? `<span class="badge badge-root">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                    ROOT ASSET
                                   </span>`
                                : `<span class="badge badge-archived">Standard</span>`
                        }
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-secondary btn-sm btn-edit-asset" data-id="${ForensiQ.escapeHtml(a.asset_id)}" title="Edit asset">
                                Edit
                            </button>
                            <button class="btn btn-outline-danger btn-sm btn-delete-asset" data-id="${ForensiQ.escapeHtml(a.asset_id)}" data-name="${ForensiQ.escapeHtml(a.asset_name)}" title="Delete asset">
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
                        <th style="width: 100px;">Asset ID</th>
                        <th>Asset Name</th>
                        <th style="width: 150px;">Type</th>
                        <th style="width: 160px;">Importance Score</th>
                        <th style="width: 140px;">Root Status</th>
                        <th style="width: 160px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        tableContainer.querySelectorAll(".btn-edit-asset").forEach((btn) => {
            btn.addEventListener("click", () => {
                const assetId = btn.getAttribute("data-id");
                openEditAssetModal(assetId);
            });
        });

        tableContainer.querySelectorAll(".btn-delete-asset").forEach((btn) => {
            btn.addEventListener("click", () => {
                const assetId = btn.getAttribute("data-id");
                const assetName = btn.getAttribute("data-name");
                openDeleteAssetModal(assetId, assetName);
            });
        });
    }

    /**
     * CREATE ASSET HANDLER
     */
    async function handleCreateAsset(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-create-asset");
        const assetIdInput = document.getElementById("create-asset-id");
        const nameInput = document.getElementById("create-asset-name");
        const typeInput = document.getElementById("create-asset-type");
        const importanceInput = document.getElementById("create-asset-importance");
        const isRootInput = document.getElementById("create-asset-is-root");

        const asset_id = (assetIdInput.value || "").trim();
        const asset_name = (nameInput.value || "").trim();
        const asset_type = (typeInput.value || "").trim();
        const importance_score = parseInt(importanceInput.value, 10);
        const is_root = isRootInput.checked;

        if (!asset_id || !asset_name || !asset_type) {
            showError("create-asset-error", "Asset ID, Name and Type are required.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";

        try {
            const result = await API.createAsset(currentInvestigationId, {
                asset_id,
                asset_name,
                asset_type,
                importance_score,
                is_root,
            });

            ForensiQ.closeModal("modal-create-asset");
            ForensiQ.toast(result.message || "Asset created successfully", "success");
            await loadAssets();
        } catch (error) {
            console.error("Create asset error:", error);
            showError("create-asset-error", error.message || "Failed to create asset.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Save Asset</span>
            `;
        }
    }

    /**
     * OPEN EDIT MODAL
     */
    function openEditAssetModal(assetId) {
        const asset = assetsList.find((a) => a.asset_id === assetId);
        if (!asset) return;

        document.getElementById("edit-asset-original-id").value = asset.asset_id;
        document.getElementById("edit-asset-id-display").value = asset.asset_id;
        document.getElementById("edit-asset-name").value = asset.asset_name || "";
        document.getElementById("edit-asset-type").value = asset.asset_type || "";
        document.getElementById("edit-asset-importance").value = asset.importance_score;
        document.getElementById("edit-importance-display").textContent = asset.importance_score;
        document.getElementById("edit-asset-is-root").checked = Boolean(asset.is_root);

        hideError("edit-asset-error");
        ForensiQ.openModal("modal-edit-asset");
    }

    /**
     * EDIT ASSET HANDLER
     */
    async function handleEditAsset(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-edit-asset");
        const assetId = document.getElementById("edit-asset-original-id").value;
        const asset_name = (document.getElementById("edit-asset-name").value || "").trim();
        const asset_type = (document.getElementById("edit-asset-type").value || "").trim();
        const importance_score = parseInt(document.getElementById("edit-asset-importance").value, 10);
        const is_root = document.getElementById("edit-asset-is-root").checked;

        if (!asset_name || !asset_type) {
            showError("edit-asset-error", "Asset Name and Type are required.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";

        try {
            const result = await API.updateAsset(currentInvestigationId, assetId, {
                asset_name,
                asset_type,
                importance_score,
                is_root,
            });

            ForensiQ.closeModal("modal-edit-asset");
            ForensiQ.toast(result.message || "Asset updated successfully", "success");
            await loadAssets();
        } catch (error) {
            console.error("Update asset error:", error);
            showError("edit-asset-error", error.message || "Failed to update asset.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Save Changes</span>
            `;
        }
    }

    /**
     * OPEN DELETE CONFIRMATION MODAL
     */
    function openDeleteAssetModal(assetId, assetName) {
        document.getElementById("delete-asset-target-id").value = assetId;
        document.getElementById("delete-asset-name-display").textContent = `"${assetName}" (${assetId})`;
        hideError("delete-asset-error-box");
        ForensiQ.openModal("modal-delete-asset");
    }

    /**
     * DELETE ASSET HANDLER
     */
    async function handleConfirmDeleteAsset() {
        const btn = document.getElementById("btn-confirm-delete-asset");
        const assetId = document.getElementById("delete-asset-target-id").value;
        if (!assetId) return;

        btn.disabled = true;
        btn.innerHTML = "Deleting...";

        try {
            const result = await API.deleteAsset(currentInvestigationId, assetId);
            ForensiQ.closeModal("modal-delete-asset");
            ForensiQ.toast(result.message || "Asset deleted successfully", "success");
            await loadAssets();
        } catch (error) {
            console.error("Delete asset failed:", error);
            showError("delete-asset-error-box", error.message || "Failed to delete asset.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete Asset</span>
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

    document.addEventListener("DOMContentLoaded", initAssetsPage);
})();
