/**
 * ForensiQ Investigations Management Controller
 * Handles full CRUD operations, live client search/filter,
 * active context selection, and modal dialogs.
 */

(function () {
    let investigationsList = [];

    async function initInvestigationsPage() {
        setupEventListeners();
        await loadInvestigations();

        window.addEventListener("forensiq:active-inv-changed", () => {
            renderTable();
        });
    }

    /**
     * Setup DOM event listeners
     */
    function setupEventListeners() {
        // Open Create Modal
        const btnOpenCreate = document.getElementById("btn-open-create-modal");
        if (btnOpenCreate) {
            btnOpenCreate.addEventListener("click", () => {
                document.getElementById("form-create-investigation").reset();
                document.getElementById("create-inv-status").value = "Active";
                hideError("create-inv-error");
                ForensiQ.openModal("modal-create-investigation");
            });
        }

        // Form: Create Investigation
        const formCreate = document.getElementById("form-create-investigation");
        if (formCreate) {
            formCreate.addEventListener("submit", handleCreateSubmit);
        }

        // Form: Edit Investigation
        const formEdit = document.getElementById("form-edit-investigation");
        if (formEdit) {
            formEdit.addEventListener("submit", handleEditSubmit);
        }

        // Delete Confirm Button
        const btnConfirmDelete = document.getElementById("btn-confirm-delete-inv");
        if (btnConfirmDelete) {
            btnConfirmDelete.addEventListener("click", handleConfirmDelete);
        }

        // Search and Filter inputs
        const searchInput = document.getElementById("inv-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", renderTable);
        }

        const statusFilter = document.getElementById("inv-status-filter");
        if (statusFilter) {
            statusFilter.addEventListener("change", renderTable);
        }

        // Refresh button
        const refreshBtn = document.getElementById("btn-refresh-inv");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", async () => {
                refreshBtn.disabled = true;
                await loadInvestigations();
                refreshBtn.disabled = false;
            });
        }
    }

    /**
     * Fetch all investigations from API
     */
    async function loadInvestigations() {
        const tableContainer = document.getElementById("investigations-table-container");
        const countEl = document.getElementById("inv-results-count");

        try {
            investigationsList = await API.getInvestigations();
            renderTable();
            // Also refresh the topbar dropdown
            ForensiQ.loadTopbarInvestigations();
        } catch (error) {
            console.error("Failed to load investigations:", error);
            if (countEl) countEl.textContent = "Error loading";
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon" style="color: var(--crimson-danger);">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="state-title">Error Loading Investigations</div>
                        <div class="state-desc">${ForensiQ.escapeHtml(error.message)}</div>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Filter and render investigations table
     */
    function renderTable() {
        const tableContainer = document.getElementById("investigations-table-container");
        const countEl = document.getElementById("inv-results-count");
        const searchQuery = (document.getElementById("inv-search-input")?.value || "").trim().toLowerCase();
        const statusFilter = document.getElementById("inv-status-filter")?.value || "ALL";
        const activeId = ForensiQ.getActiveInvestigationId();

        // Apply filters
        const filtered = investigationsList.filter((inv) => {
            const matchesStatus = statusFilter === "ALL" || (inv.status || "").toLowerCase() === statusFilter.toLowerCase();
            const name = (inv.name || "").toLowerCase();
            const desc = (inv.description || "").toLowerCase();
            const matchesSearch = !searchQuery || name.includes(searchQuery) || desc.includes(searchQuery);
            return matchesStatus && matchesSearch;
        });

        if (countEl) {
            countEl.textContent = `Showing ${filtered.length} of ${investigationsList.length} cases`;
        }

        if (filtered.length === 0) {
            if (investigationsList.length === 0) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div class="state-title">No Investigations in Database</div>
                        <div class="state-desc">Create your first digital forensic case to begin cataloguing assets and executing network algorithms.</div>
                        <button class="btn btn-primary btn-sm" onclick="ForensiQ.openModal('modal-create-investigation')">
                            + New Investigation
                        </button>
                    </div>
                `;
            } else {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <div class="state-title">No Matching Investigations Found</div>
                        <div class="state-desc">Try adjusting your search criteria or status filter.</div>
                        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('inv-search-input').value=''; document.getElementById('inv-status-filter').value='ALL'; renderTable();">
                            Clear Filters
                        </button>
                    </div>
                `;
            }
            return;
        }

        let rowsHtml = filtered.map((inv) => {
            const isActive = inv.id === activeId;
            return `
                <tr class="${isActive ? 'row-active' : ''}">
                    <td><strong>#${inv.id}</strong></td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">
                            ${ForensiQ.escapeHtml(inv.name)}
                        </div>
                        ${isActive ? '<span class="badge badge-active" style="margin-top: 4px;">Active Context</span>' : ''}
                    </td>
                    <td>${ForensiQ.formatStatusBadge(inv.status)}</td>
                    <td style="color: var(--text-muted); max-width: 320px; line-height: 1.4;">
                        ${inv.description ? ForensiQ.escapeHtml(inv.description) : '<span style="color: var(--text-dim); font-style: italic;">No description</span>'}
                    </td>
                    <td style="color: var(--text-dim); font-size: 0.8rem; white-space: nowrap;">
                        ${ForensiQ.formatDate(inv.created_at)}
                    </td>
                    <td>
                        <div class="table-actions">
                            ${
                                isActive
                                    ? `<button class="btn btn-secondary btn-sm" disabled title="Currently active investigation">Selected</button>`
                                    : `<button class="btn btn-outline-cyan btn-sm btn-select-action" data-id="${inv.id}" data-name="${ForensiQ.escapeHtml(inv.name)}">Select</button>`
                            }
                            <button class="btn btn-secondary btn-sm btn-edit-action" data-id="${inv.id}" title="Edit investigation">
                                Edit
                            </button>
                            <button class="btn btn-outline-danger btn-sm btn-delete-action" data-id="${inv.id}" data-name="${ForensiQ.escapeHtml(inv.name)}" title="Delete investigation">
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
                        <th style="width: 70px;">ID</th>
                        <th>Investigation Name</th>
                        <th style="width: 120px;">Status</th>
                        <th>Description</th>
                        <th style="width: 160px;">Created Date</th>
                        <th style="width: 200px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        // Attach action handlers
        tableContainer.querySelectorAll(".btn-select-action").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const name = btn.getAttribute("data-name");
                ForensiQ.setActiveInvestigation(id, name);
                ForensiQ.toast(`Set investigation #${id} as active`, "success");
            });
        });

        tableContainer.querySelectorAll(".btn-edit-action").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = parseInt(btn.getAttribute("data-id"), 10);
                openEditModal(id);
            });
        });

        tableContainer.querySelectorAll(".btn-delete-action").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = parseInt(btn.getAttribute("data-id"), 10);
                const name = btn.getAttribute("data-name");
                openDeleteModal(id, name);
            });
        });
    }

    /**
     * CREATE SUBMIT HANDLER
     */
    async function handleCreateSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-create-inv");
        const nameInput = document.getElementById("create-inv-name");
        const statusSelect = document.getElementById("create-inv-status");
        const descInput = document.getElementById("create-inv-desc");

        const name = (nameInput.value || "").trim();
        const status = statusSelect.value;
        const description = (descInput.value || "").trim() || null;

        if (!name) {
            showError("create-inv-error", "Investigation name is required.");
            nameInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Creating...";

        try {
            const result = await API.createInvestigation({ name, status, description });
            ForensiQ.closeModal("modal-create-investigation");
            ForensiQ.toast(result.message || "Investigation created successfully", "success");

            // Auto-select the newly created investigation as active
            if (result.investigation && result.investigation.id) {
                ForensiQ.setActiveInvestigation(result.investigation.id, result.investigation.name);
            }

            await loadInvestigations();
        } catch (error) {
            console.error("Create investigation failed:", error);
            showError("create-inv-error", error.message || "Failed to create investigation.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Create Investigation</span>
            `;
        }
    }

    /**
     * OPEN EDIT MODAL
     */
    function openEditModal(id) {
        const inv = investigationsList.find((i) => i.id === id);
        if (!inv) return;

        document.getElementById("edit-inv-id").value = inv.id;
        document.getElementById("edit-inv-name").value = inv.name || "";
        document.getElementById("edit-inv-status").value = inv.status || "Active";
        document.getElementById("edit-inv-desc").value = inv.description || "";

        hideError("edit-inv-error");
        ForensiQ.openModal("modal-edit-investigation");
    }

    /**
     * EDIT SUBMIT HANDLER
     */
    async function handleEditSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-edit-inv");
        const id = document.getElementById("edit-inv-id").value;
        const name = (document.getElementById("edit-inv-name").value || "").trim();
        const status = document.getElementById("edit-inv-status").value;
        const description = (document.getElementById("edit-inv-desc").value || "").trim() || null;

        if (!name) {
            showError("edit-inv-error", "Investigation name cannot be empty.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";

        try {
            const result = await API.updateInvestigation(id, { name, status, description });
            ForensiQ.closeModal("modal-edit-investigation");
            ForensiQ.toast(result.message || "Investigation updated successfully", "success");

            // Update active state metadata if the updated investigation is active
            if (ForensiQ.getActiveInvestigationId() === parseInt(id, 10)) {
                ForensiQ.setActiveInvestigation(id, name);
            }

            await loadInvestigations();
        } catch (error) {
            console.error("Update investigation failed:", error);
            showError("edit-inv-error", error.message || "Failed to update investigation.");
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
    function openDeleteModal(id, name) {
        document.getElementById("delete-inv-id").value = id;
        document.getElementById("delete-inv-name").textContent = `"${name}" (#${id})`;
        ForensiQ.openModal("modal-delete-investigation");
    }

    /**
     * DELETE CONFIRMATION HANDLER
     */
    async function handleConfirmDelete() {
        const btn = document.getElementById("btn-confirm-delete-inv");
        const id = document.getElementById("delete-inv-id").value;
        if (!id) return;

        btn.disabled = true;
        btn.innerHTML = "Deleting...";

        try {
            const result = await API.deleteInvestigation(id);
            ForensiQ.closeModal("modal-delete-investigation");
            ForensiQ.toast(result.message || "Investigation deleted successfully", "success");

            // If the deleted investigation was active, clear active state
            if (ForensiQ.getActiveInvestigationId() === parseInt(id, 10)) {
                ForensiQ.clearActiveInvestigation();
            }

            await loadInvestigations();
        } catch (error) {
            console.error("Delete investigation failed:", error);
            ForensiQ.toast(error.message || "Failed to delete investigation", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete Investigation</span>
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

    document.addEventListener("DOMContentLoaded", initInvestigationsPage);
})();
