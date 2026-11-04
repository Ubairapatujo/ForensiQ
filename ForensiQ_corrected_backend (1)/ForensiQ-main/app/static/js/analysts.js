/**
 * ForensiQ Analysts Management Controller
 * Handles CRUD operations, 1-3 analyst team limit enforcement,
 * distinct capacity validation (1–16 hours), and workload metrics.
 */

(function () {
    let analystsList = [];
    let currentInvestigationId = null;

    async function initAnalystsPage() {
        setupEventListeners();
        await evaluateActiveContext();

        window.addEventListener("forensiq:active-inv-changed", async () => {
            await evaluateActiveContext();
        });
    }

    async function evaluateActiveContext() {
        currentInvestigationId = ForensiQ.getActiveInvestigationId();
        const noInvBanner = document.getElementById("analysts-no-inv-banner");
        const mainContent = document.getElementById("analysts-main-content");

        if (!currentInvestigationId) {
            if (noInvBanner) noInvBanner.style.display = "flex";
            if (mainContent) mainContent.style.display = "none";
            return;
        }

        if (noInvBanner) noInvBanner.style.display = "none";
        if (mainContent) mainContent.style.display = "block";

        await loadAnalysts();
    }

    function setupEventListeners() {
        // Open Create Modal
        const btnOpenCreate = document.getElementById("btn-open-create-analyst");
        if (btnOpenCreate) {
            btnOpenCreate.addEventListener("click", () => {
                if (analystsList.length >= 3) {
                    ForensiQ.toast("Maximum three analysts are allowed per investigation.", "warning", 4000);
                    return;
                }

                const form = document.getElementById("form-create-analyst");
                form.reset();
                hideError("create-analyst-error");

                populateCapacityDropdown("create-analyst-capacity");
                ForensiQ.openModal("modal-create-analyst");
            });
        }

        // Form: Create Analyst
        const formCreate = document.getElementById("form-create-analyst");
        if (formCreate) {
            formCreate.addEventListener("submit", handleCreateAnalyst);
        }

        // Form: Edit Analyst
        const formEdit = document.getElementById("form-edit-analyst");
        if (formEdit) {
            formEdit.addEventListener("submit", handleEditAnalyst);
        }

        // Delete Confirm Button
        const btnConfirmDelete = document.getElementById("btn-confirm-delete-analyst");
        if (btnConfirmDelete) {
            btnConfirmDelete.addEventListener("click", handleConfirmDeleteAnalyst);
        }

        // Refresh Button
        const btnRefresh = document.getElementById("btn-refresh-analysts");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", async () => {
                btnRefresh.disabled = true;
                await loadAnalysts();
                btnRefresh.disabled = false;
            });
        }
    }

    /**
     * Fetch analysts from API
     */
    async function loadAnalysts() {
        const tableContainer = document.getElementById("analysts-table-container");

        if (!currentInvestigationId) return;

        try {
            analystsList = await API.getAnalysts(currentInvestigationId);
            updateSummaryStats();
            renderAnalystsTable();
        } catch (error) {
            console.error("Failed to load analysts:", error);
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon" style="color: var(--crimson-danger);">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="state-title">Error Loading Analysts</div>
                        <div class="state-desc">${ForensiQ.escapeHtml(error.message)}</div>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Populate 1–16 capacity dropdown, disabling already-assigned capacities
     */
    function populateCapacityDropdown(selectId, excludeAnalystId = null, currentCap = null) {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Collect taken capacities
        const takenCapacities = new Set(
            analystsList
                .filter((a) => a.analyst_id !== excludeAnalystId)
                .map((a) => a.capacity_hours)
        );

        let html = '<option value="">-- Choose Capacity (1–16h) --</option>';
        for (let h = 1; h <= 16; h++) {
            const isTaken = takenCapacities.has(h);
            const isSelected = h === currentCap;
            const disabledAttr = isTaken ? "disabled" : "";
            const labelSuffix = isTaken ? " (Taken — Unique constraint)" : "";

            html += `<option value="${h}" ${disabledAttr} ${isSelected ? "selected" : ""}>
                ${h} hour${h > 1 ? "s" : ""}${labelSuffix}
            </option>`;
        }

        select.innerHTML = html;
    }

    function updateSummaryStats() {
        const statTeam = document.getElementById("stat-team-count");
        const statTeamSub = document.getElementById("stat-team-subtext");
        const statTotalCap = document.getElementById("stat-total-capacity");
        const statStatus = document.getElementById("stat-capacity-status");
        const maxBanner = document.getElementById("analyst-max-warning");
        const btnCreate = document.getElementById("btn-open-create-analyst");

        const count = analystsList.length;
        const totalHours = analystsList.reduce((sum, a) => sum + (a.capacity_hours || 0), 0);

        if (statTeam) statTeam.textContent = `${count} / 3`;
        if (statTotalCap) statTotalCap.textContent = `${totalHours}h`;

        if (count >= 3) {
            if (maxBanner) maxBanner.style.display = "flex";
            if (btnCreate) {
                btnCreate.disabled = true;
                btnCreate.title = "Maximum 3 analysts allowed";
                btnCreate.style.opacity = "0.5";
            }
            if (statTeamSub) statTeamSub.textContent = "Quota full (3/3)";
            if (statStatus) {
                statStatus.textContent = "Fully Staffed (3/3)";
                statStatus.style.color = "var(--teal-success)";
            }
        } else {
            if (maxBanner) maxBanner.style.display = "none";
            if (btnCreate) {
                btnCreate.disabled = false;
                btnCreate.title = "";
                btnCreate.style.opacity = "1";
            }
            if (statTeamSub) statTeamSub.textContent = `${3 - count} slot${3 - count > 1 ? "s" : ""} available`;
            if (statStatus) {
                statStatus.textContent = `Unique (${count}/3)`;
                statStatus.style.color = count > 0 ? "var(--accent-cyan)" : "var(--text-muted)";
            }
        }
    }

    /**
     * Render analysts table
     */
    function renderAnalystsTable() {
        const tableContainer = document.getElementById("analysts-table-container");
        if (!tableContainer) return;

        if (analystsList.length === 0) {
            tableContainer.innerHTML = `
                <div class="state-box">
                    <div class="state-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div class="state-title">No Analysts Assigned to this Case</div>
                    <div class="state-desc">Assign 1 to 3 forensic specialists with distinct examination capacities (1–16 hours) to execute evidence allocation algorithms.</div>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-open-create-analyst').click()">
                        + Assign First Analyst
                    </button>
                </div>
            `;
            return;
        }

        const totalHours = analystsList.reduce((sum, a) => sum + (a.capacity_hours || 0), 0);

        let rowsHtml = analystsList.map((a) => {
            const pctOfMax = ((a.capacity_hours / 16) * 100).toFixed(0);
            const relativeShare = totalHours > 0 ? (((a.capacity_hours / totalHours) * 100).toFixed(1)) : "0.0";

            return `
                <tr>
                    <td>
                        <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.95rem;">
                            ${ForensiQ.escapeHtml(a.analyst_id)}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">
                            ${ForensiQ.escapeHtml(a.analyst_name)}
                        </div>
                    </td>
                    <td style="min-width: 200px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                                <span style="font-weight: 700; color: var(--teal-success);">${a.capacity_hours} hours</span>
                                <span style="color: var(--text-dim);">${pctOfMax}% of 16h max</span>
                            </div>
                            <div style="height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 9999px; overflow: hidden;">
                                <div style="width: ${pctOfMax}%; height: 100%; background: linear-gradient(90deg, var(--accent-cyan), var(--teal-success)); border-radius: 9999px;"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(45, 212, 191, 0.12); color: var(--teal-success); border: 1px solid rgba(45, 212, 191, 0.25);">
                            ${relativeShare}% team workload
                        </span>
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-secondary btn-sm btn-edit-analyst" data-id="${ForensiQ.escapeHtml(a.analyst_id)}" title="Edit analyst details">
                                Edit
                            </button>
                            <button class="btn btn-outline-danger btn-sm btn-delete-analyst" data-id="${ForensiQ.escapeHtml(a.analyst_id)}" data-name="${ForensiQ.escapeHtml(a.analyst_name)}" title="Remove analyst">
                                Remove
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
                        <th style="width: 110px;">Analyst ID</th>
                        <th>Analyst Name</th>
                        <th style="width: 240px;">Capacity Hours (1–16)</th>
                        <th style="width: 170px;">Team Share</th>
                        <th style="width: 150px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        tableContainer.querySelectorAll(".btn-edit-analyst").forEach((btn) => {
            btn.addEventListener("click", () => {
                const aid = btn.getAttribute("data-id");
                openEditAnalystModal(aid);
            });
        });

        tableContainer.querySelectorAll(".btn-delete-analyst").forEach((btn) => {
            btn.addEventListener("click", () => {
                const aid = btn.getAttribute("data-id");
                const aname = btn.getAttribute("data-name");
                openDeleteAnalystModal(aid, aname);
            });
        });
    }

    /**
     * CREATE ANALYST HANDLER
     */
    async function handleCreateAnalyst(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-create-analyst");
        const idInput = document.getElementById("create-analyst-id");
        const nameInput = document.getElementById("create-analyst-name");
        const capSelect = document.getElementById("create-analyst-capacity");

        const analyst_id = (idInput.value || "").trim();
        const analyst_name = (nameInput.value || "").trim();
        const capacity_hours = parseInt(capSelect.value, 10);

        if (!analyst_id || !analyst_name || isNaN(capacity_hours)) {
            showError("create-analyst-error", "Analyst ID, name and capacity are required.");
            return;
        }

        if (capacity_hours < 1 || capacity_hours > 16) {
            showError("create-analyst-error", "Capacity must be an integer between 1 and 16 hours.");
            return;
        }

        if (analystsList.some((a) => a.capacity_hours === capacity_hours)) {
            showError("create-analyst-error", "Each analyst must have a unique capacity. This capacity is already taken.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Assigning...";

        try {
            const result = await API.createAnalyst(currentInvestigationId, {
                analyst_id,
                analyst_name,
                capacity_hours,
            });

            ForensiQ.closeModal("modal-create-analyst");
            ForensiQ.toast(result.message || "Analyst assigned successfully", "success");
            await loadAnalysts();
        } catch (error) {
            console.error("Create analyst error:", error);
            showError("create-analyst-error", error.message || "Failed to assign analyst.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Assign Analyst</span>
            `;
        }
    }

    /**
     * OPEN EDIT MODAL
     */
    function openEditAnalystModal(analystId) {
        const analyst = analystsList.find((a) => a.analyst_id === analystId);
        if (!analyst) return;

        document.getElementById("edit-analyst-original-id").value = analyst.analyst_id;
        document.getElementById("edit-analyst-id-display").value = analyst.analyst_id;
        document.getElementById("edit-analyst-name").value = analyst.analyst_name || "";

        populateCapacityDropdown("edit-analyst-capacity", analyst.analyst_id, analyst.capacity_hours);

        hideError("edit-analyst-error");
        ForensiQ.openModal("modal-edit-analyst");
    }

    /**
     * EDIT ANALYST HANDLER
     */
    async function handleEditAnalyst(e) {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-edit-analyst");
        const analystId = document.getElementById("edit-analyst-original-id").value;
        const analyst_name = (document.getElementById("edit-analyst-name").value || "").trim();
        const capacity_hours = parseInt(document.getElementById("edit-analyst-capacity").value, 10);

        if (!analyst_name || isNaN(capacity_hours)) {
            showError("edit-analyst-error", "Analyst name and capacity are required.");
            return;
        }

        if (capacity_hours < 1 || capacity_hours > 16) {
            showError("edit-analyst-error", "Capacity must be between 1 and 16 hours.");
            return;
        }

        // Check uniqueness against other analysts
        if (analystsList.some((a) => a.analyst_id !== analystId && a.capacity_hours === capacity_hours)) {
            showError("edit-analyst-error", "Each analyst must have a unique capacity.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";

        try {
            const result = await API.updateAnalyst(currentInvestigationId, analystId, {
                analyst_name,
                capacity_hours,
            });

            ForensiQ.closeModal("modal-edit-analyst");
            ForensiQ.toast(result.message || "Analyst updated successfully", "success");
            await loadAnalysts();
        } catch (error) {
            console.error("Update analyst error:", error);
            showError("edit-analyst-error", error.message || "Failed to update analyst.");
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
    function openDeleteAnalystModal(analystId, analystName) {
        document.getElementById("delete-analyst-target-id").value = analystId;
        document.getElementById("delete-analyst-name-display").textContent = `"${analystName}" (${analystId})`;
        hideError("delete-analyst-error-box");
        ForensiQ.openModal("modal-delete-analyst");
    }

    /**
     * DELETE ANALYST HANDLER
     */
    async function handleConfirmDeleteAnalyst() {
        const btn = document.getElementById("btn-confirm-delete-analyst");
        const analystId = document.getElementById("delete-analyst-target-id").value;
        if (!analystId) return;

        btn.disabled = true;
        btn.innerHTML = "Removing...";

        try {
            const result = await API.deleteAnalyst(currentInvestigationId, analystId);
            ForensiQ.closeModal("modal-delete-analyst");
            ForensiQ.toast(result.message || "Analyst removed successfully", "success");
            await loadAnalysts();
        } catch (error) {
            console.error("Delete analyst failed:", error);
            showError("delete-analyst-error-box", error.message || "Failed to remove analyst.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Remove Analyst</span>
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

    document.addEventListener("DOMContentLoaded", initAnalystsPage);
})();
