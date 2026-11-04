/**
 * ForensiQ Connections (Links) Controller
 * Handles CRUD operations, dropdown population from real assets,
 * validation (rejecting self-links), accessibility toggles, and search.
 */

(function () {
    let linksList = [];
    let assetsMap = new Map();
    let currentInvestigationId = null;

    async function initConnectionsPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("links-no-inv-banner");
        const mainContent = document.getElementById("links-main-content");

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
        const btnOpenCreate = document.getElementById("btn-open-create-link");
        if (btnOpenCreate) {
            btnOpenCreate.addEventListener("click", () => {
                const form = document.getElementById("form-create-link");
                form.reset();
                document.getElementById("create-link-cost").value = "1.0";
                document.getElementById("create-link-accessible").checked = true;
                hideError("create-link-error");

                if (assetsMap.size < 2) {
                    ForensiQ.toast("At least two forensic assets are required before creating connections.", "warning", 5000);
                }

                populateAssetDropdown("create-link-source");
                populateAssetDropdown("create-link-target");
                ForensiQ.openModal("modal-create-link");
            });
        }

        // Form: Create Link
        const formCreate = document.getElementById("form-create-link");
        if (formCreate) {
            formCreate.addEventListener("submit", handleCreateLink);
        }

        // Form: Edit Link
        const formEdit = document.getElementById("form-edit-link");
        if (formEdit) {
            formEdit.addEventListener("submit", handleEditLink);
        }

        // Delete Confirm Button
        const btnConfirmDelete = document.getElementById("btn-confirm-delete-link");
        if (btnConfirmDelete) {
            btnConfirmDelete.addEventListener("click", handleConfirmDeleteLink);
        }

        // Search & Filter
        const searchInput = document.getElementById("link-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", renderLinksTable);
        }

        const accessFilter = document.getElementById("link-access-filter");
        if (accessFilter) {
            accessFilter.addEventListener("change", renderLinksTable);
        }

        // Refresh
        const btnRefresh = document.getElementById("btn-refresh-links");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", async () => {
                btnRefresh.disabled = true;
                await loadData();
                btnRefresh.disabled = false;
            });
        }
    }

    /**
     * Load assets and links in parallel
     */
    async function loadData() {
        const tableContainer = document.getElementById("links-table-container");
        const countEl = document.getElementById("link-results-count");

        if (!currentInvestigationId) return;

        try {
            const [assets, links] = await Promise.all([
                API.getAssets(currentInvestigationId),
                API.getLinks(currentInvestigationId),
            ]);

            assetsMap.clear();
            assets.forEach((a) => assetsMap.set(a.asset_id, a));
            linksList = links;

            updateSummaryStats();
            renderLinksTable();
        } catch (error) {
            console.error("Failed to load connections:", error);
            if (countEl) countEl.textContent = "Error loading";
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon" style="color: var(--crimson-danger);">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="state-title">Error Loading Connections</div>
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
                ${ForensiQ.escapeHtml(id)}: ${ForensiQ.escapeHtml(asset.asset_name)} (${ForensiQ.escapeHtml(asset.asset_type)})
            </option>`;
        });

        select.innerHTML = html;
    }

    function updateSummaryStats() {
        const statTotal = document.getElementById("stat-total-links");
        const statAcc = document.getElementById("stat-accessible-links");
        const statInacc = document.getElementById("stat-inaccessible-links");
        const statAvg = document.getElementById("stat-avg-cost");

        const total = linksList.length;
        const accessible = linksList.filter((l) => l.is_accessible).length;
        const inaccessible = total - accessible;
        const totalCost = linksList.reduce((sum, l) => sum + (l.cost || 0), 0);
        const avgCost = total > 0 ? (totalCost / total).toFixed(1) : "0.0";

        if (statTotal) statTotal.textContent = total;
        if (statAcc) statAcc.textContent = accessible;
        if (statInacc) statInacc.textContent = inaccessible;
        if (statAvg) statAvg.textContent = avgCost;
    }

    /**
     * Render filtered links table
     */
    function renderLinksTable() {
        const tableContainer = document.getElementById("links-table-container");
        const countEl = document.getElementById("link-results-count");
        const searchQuery = (document.getElementById("link-search-input")?.value || "").trim().toLowerCase();
        const accessFilter = document.getElementById("link-access-filter")?.value || "ALL";

        const filtered = linksList.filter((l) => {
            const matchesAccess =
                accessFilter === "ALL" ||
                (accessFilter === "ACCESSIBLE" && l.is_accessible) ||
                (accessFilter === "INACCESSIBLE" && !l.is_accessible);

            const lid = (l.link_id || "").toLowerCase();
            const sid = (l.source_asset_id || "").toLowerCase();
            const tid = (l.target_asset_id || "").toLowerCase();
            const sName = (assetsMap.get(l.source_asset_id)?.asset_name || "").toLowerCase();
            const tName = (assetsMap.get(l.target_asset_id)?.asset_name || "").toLowerCase();

            const matchesSearch =
                !searchQuery ||
                lid.includes(searchQuery) ||
                sid.includes(searchQuery) ||
                tid.includes(searchQuery) ||
                sName.includes(searchQuery) ||
                tName.includes(searchQuery);

            return matchesAccess && matchesSearch;
        });

        if (countEl) {
            countEl.textContent = `Showing ${filtered.length} of ${linksList.length} links`;
        }

        if (filtered.length === 0) {
            if (linksList.length === 0) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </div>
                        <div class="state-title">No Network Links Mapped</div>
                        <div class="state-desc">Map connections between digital assets to enable Kruskal's algorithm and link failure simulations.</div>
                        <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-open-create-link').click()">
                            + Add First Connection
                        </button>
                    </div>
                `;
            } else {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <div class="state-title">No Matching Links</div>
                        <div class="state-desc">Adjust your search keyword or accessibility filter.</div>
                        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('link-search-input').value=''; document.getElementById('link-access-filter').value='ALL'; renderLinksTable();">
                            Clear Filters
                        </button>
                    </div>
                `;
            }
            return;
        }

        let rowsHtml = filtered.map((l) => {
            const sAsset = assetsMap.get(l.source_asset_id);
            const tAsset = assetsMap.get(l.target_asset_id);

            const sourceDisplay = sAsset
                ? `<span style="font-weight: 600; color: var(--text-primary);">${ForensiQ.escapeHtml(l.source_asset_id)}</span> <span style="font-size: 0.78rem; color: var(--text-muted);">(${ForensiQ.escapeHtml(sAsset.asset_name)})</span>`
                : `<span style="color: var(--crimson-danger);">${ForensiQ.escapeHtml(l.source_asset_id)} (Unknown)</span>`;

            const targetDisplay = tAsset
                ? `<span style="font-weight: 600; color: var(--text-primary);">${ForensiQ.escapeHtml(l.target_asset_id)}</span> <span style="font-size: 0.78rem; color: var(--text-muted);">(${ForensiQ.escapeHtml(tAsset.asset_name)})</span>`
                : `<span style="color: var(--crimson-danger);">${ForensiQ.escapeHtml(l.target_asset_id)} (Unknown)</span>`;

            return `
                <tr>
                    <td>
                        <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.95rem;">
                            ${ForensiQ.escapeHtml(l.link_id)}
                        </span>
                    </td>
                    <td>${sourceDisplay}</td>
                    <td style="text-align: center; color: var(--text-dim); width: 40px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </td>
                    <td>${targetDisplay}</td>
                    <td>
                        <span style="font-weight: 700; color: var(--text-primary); font-feature-settings: 'tnum';">
                            ${l.cost}
                        </span>
                    </td>
                    <td>
                        ${
                            l.is_accessible
                                ? `<span class="badge badge-active">Accessible</span>`
                                : `<span class="badge" style="background: var(--crimson-danger-dim); color: var(--crimson-danger); border: 1px solid rgba(248, 113, 113, 0.35);">Inaccessible</span>`
                        }
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-secondary btn-sm btn-edit-link" data-id="${ForensiQ.escapeHtml(l.link_id)}" title="Edit connection">
                                Edit
                            </button>
                            <button class="btn btn-outline-danger btn-sm btn-delete-link" data-id="${ForensiQ.escapeHtml(l.link_id)}" title="Delete connection">
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
                        <th style="width: 100px;">Link ID</th>
                        <th>Source Asset</th>
                        <th style="width: 40px; text-align: center;"></th>
                        <th>Target Asset</th>
                        <th style="width: 120px;">Cost</th>
                        <th style="width: 130px;">Accessibility</th>
                        <th style="width: 150px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        tableContainer.querySelectorAll(".btn-edit-link").forEach((btn) => {
            btn.addEventListener("click", () => {
                const linkId = btn.getAttribute("data-id");
                openEditLinkModal(linkId);
            });
        });

        tableContainer.querySelectorAll(".btn-delete-link").forEach((btn) => {
            btn.addEventListener("click", () => {
                const linkId = btn.getAttribute("data-id");
                openDeleteLinkModal(linkId);
            });
        });
    }

    /**
     * CREATE LINK HANDLER
     */
    async function handleCreateLink(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-create-link");
        const linkIdInput = document.getElementById("create-link-id");
        const sourceSelect = document.getElementById("create-link-source");
        const targetSelect = document.getElementById("create-link-target");
        const costInput = document.getElementById("create-link-cost");
        const accessInput = document.getElementById("create-link-accessible");

        const link_id = (linkIdInput.value || "").trim();
        const source_asset_id = sourceSelect.value;
        const target_asset_id = targetSelect.value;
        const cost = parseFloat(costInput.value);
        const is_accessible = accessInput.checked;

        if (!link_id || !source_asset_id || !target_asset_id) {
            showError("create-link-error", "Link ID, source asset and target asset are all required.");
            return;
        }

        if (source_asset_id === target_asset_id) {
            showError("create-link-error", "Self-connections rejected: Source and target assets must be different.");
            return;
        }

        if (isNaN(cost) || cost < 0) {
            showError("create-link-error", "Cost must be a non-negative number.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Creating...";

        try {
            const result = await API.createLink(currentInvestigationId, {
                link_id,
                source_asset_id,
                target_asset_id,
                cost,
                is_accessible,
            });

            ForensiQ.closeModal("modal-create-link");
            ForensiQ.toast(result.message || "Connection created successfully", "success");
            await loadData();
        } catch (error) {
            console.error("Create link error:", error);
            showError("create-link-error", error.message || "Failed to create connection.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Create Link</span>
            `;
        }
    }

    /**
     * OPEN EDIT LINK MODAL
     */
    function openEditLinkModal(linkId) {
        const link = linksList.find((l) => l.link_id === linkId);
        if (!link) return;

        document.getElementById("edit-link-original-id").value = link.link_id;
        document.getElementById("edit-link-id-display").value = link.link_id;
        document.getElementById("edit-link-cost").value = link.cost;
        document.getElementById("edit-link-accessible").checked = Boolean(link.is_accessible);

        populateAssetDropdown("edit-link-source", link.source_asset_id);
        populateAssetDropdown("edit-link-target", link.target_asset_id);

        hideError("edit-link-error");
        ForensiQ.openModal("modal-edit-link");
    }

    /**
     * EDIT LINK HANDLER
     */
    async function handleEditLink(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-edit-link");
        const linkId = document.getElementById("edit-link-original-id").value;
        const source_asset_id = document.getElementById("edit-link-source").value;
        const target_asset_id = document.getElementById("edit-link-target").value;
        const cost = parseFloat(document.getElementById("edit-link-cost").value);
        const is_accessible = document.getElementById("edit-link-accessible").checked;

        if (!source_asset_id || !target_asset_id) {
            showError("edit-link-error", "Both source and target assets must be selected.");
            return;
        }

        if (source_asset_id === target_asset_id) {
            showError("edit-link-error", "Source and target assets must be different.");
            return;
        }

        if (isNaN(cost) || cost < 0) {
            showError("edit-link-error", "Cost must be a non-negative number.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";

        try {
            const result = await API.updateLink(currentInvestigationId, linkId, {
                source_asset_id,
                target_asset_id,
                cost,
                is_accessible,
            });

            ForensiQ.closeModal("modal-edit-link");
            ForensiQ.toast(result.message || "Connection updated successfully", "success");
            await loadData();
        } catch (error) {
            console.error("Update link error:", error);
            showError("edit-link-error", error.message || "Failed to update connection.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Save Changes</span>
            `;
        }
    }

    /**
     * OPEN DELETE LINK MODAL
     */
    function openDeleteLinkModal(linkId) {
        document.getElementById("delete-link-target-id").value = linkId;
        document.getElementById("delete-link-name-display").textContent = linkId;
        hideError("delete-link-error-box");
        ForensiQ.openModal("modal-delete-link");
    }

    /**
     * DELETE LINK HANDLER
     */
    async function handleConfirmDeleteLink() {
        const btn = document.getElementById("btn-confirm-delete-link");
        const linkId = document.getElementById("delete-link-target-id").value;
        if (!linkId) return;

        btn.disabled = true;
        btn.innerHTML = "Deleting...";

        try {
            const result = await API.deleteLink(currentInvestigationId, linkId);
            ForensiQ.closeModal("modal-delete-link");
            ForensiQ.toast(result.message || "Connection deleted successfully", "success");
            await loadData();
        } catch (error) {
            console.error("Delete link failed:", error);
            showError("delete-link-error-box", error.message || "Failed to delete connection.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete Connection</span>
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

    document.addEventListener("DOMContentLoaded", initConnectionsPage);
})();
