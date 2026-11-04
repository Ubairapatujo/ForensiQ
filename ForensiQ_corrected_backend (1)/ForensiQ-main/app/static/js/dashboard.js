/**
 * ForensiQ Dashboard Controller
 * Fetches real metrics from the Flask backend, renders recent investigations,
 * tracks active investigation context, and updates real counts without fake data.
 */

(function () {
    let allInvestigations = [];

    async function initDashboard() {
        await loadOverviewData();
        await loadActiveInvestigationStats();

        // Listen for active investigation change from topbar or other components
        window.addEventListener("forensiq:active-inv-changed", () => {
            loadActiveInvestigationStats();
            renderRecentInvestigations(allInvestigations);
        });

        // Setup manual refresh button
        const refreshBtn = document.getElementById("btn-refresh-dashboard");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", async () => {
                refreshBtn.disabled = true;
                ForensiQ.toast("Refreshing dashboard data...", "info", 1500);
                await loadOverviewData();
                await loadActiveInvestigationStats();
                refreshBtn.disabled = false;
            });
        }
    }

    /**
     * Load global investigations and render recent cases table
     */
    async function loadOverviewData() {
        const tableContainer = document.getElementById("recent-investigations-container");
        const totalStatEl = document.getElementById("stat-total-investigations");

        try {
            allInvestigations = await API.getInvestigations();
            if (totalStatEl) {
                totalStatEl.textContent = allInvestigations.length;
            }
            renderRecentInvestigations(allInvestigations);
        } catch (error) {
            console.error("Dashboard error:", error);
            if (totalStatEl) totalStatEl.textContent = "Error";
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="state-box">
                        <div class="state-icon" style="color: var(--crimson-danger);">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="state-title">Failed to load investigations</div>
                        <div class="state-desc">${ForensiQ.escapeHtml(error.message)}</div>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Render recent investigations table
     */
    function renderRecentInvestigations(investigations) {
        const container = document.getElementById("recent-investigations-container");
        if (!container) return;

        if (!investigations || investigations.length === 0) {
            container.innerHTML = `
                <div class="state-box">
                    <div class="state-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div class="state-title">No Investigations Recorded</div>
                    <div class="state-desc">Get started by creating your first digital forensics case.</div>
                    <a href="/investigations" class="btn btn-primary btn-sm">Create Investigation</a>
                </div>
            `;
            return;
        }

        const activeId = ForensiQ.getActiveInvestigationId();

        // Show up to 5 most recent investigations
        const recent = investigations.slice(0, 5);

        let rowsHtml = recent.map((inv) => {
            const isActive = inv.id === activeId;
            return `
                <tr class="${isActive ? 'row-active' : ''}">
                    <td><strong>#${inv.id}</strong></td>
                    <td>
                        <span style="font-weight: 600; color: var(--text-primary);">${ForensiQ.escapeHtml(inv.name)}</span>
                        ${isActive ? '<span class="badge badge-active" style="margin-left: 6px;">Active Context</span>' : ''}
                    </td>
                    <td>${ForensiQ.formatStatusBadge(inv.status)}</td>
                    <td style="color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${inv.description ? ForensiQ.escapeHtml(inv.description) : '<span style="color: var(--text-dim);">No description</span>'}
                    </td>
                    <td style="color: var(--text-dim); font-size: 0.8rem;">
                        ${ForensiQ.formatDate(inv.created_at)}
                    </td>
                    <td>
                        <div class="table-actions">
                            ${
                                isActive
                                    ? `<button class="btn btn-secondary btn-sm" disabled title="Currently Selected">Active</button>`
                                    : `<button class="btn btn-outline-cyan btn-sm btn-select-inv" data-id="${inv.id}" data-name="${ForensiQ.escapeHtml(inv.name)}">Select</button>`
                            }
                            <a href="/analysis" class="btn btn-secondary btn-sm btn-analyze-inv" data-id="${inv.id}" data-name="${ForensiQ.escapeHtml(inv.name)}" title="Run Analysis">
                                Analyze
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 70px;">ID</th>
                        <th>Investigation Name</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th>Created At</th>
                        <th style="width: 170px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        // Attach event listeners to Select buttons
        container.querySelectorAll(".btn-select-inv").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const name = btn.getAttribute("data-name");
                ForensiQ.setActiveInvestigation(id, name);
                ForensiQ.toast(`Set investigation #${id} as active`, "success");
            });
        });

        // Attach event listeners to Analyze buttons
        container.querySelectorAll(".btn-analyze-inv").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const id = btn.getAttribute("data-id");
                const name = btn.getAttribute("data-name");
                ForensiQ.setActiveInvestigation(id, name);
            });
        });
    }

    /**
     * Load specific active investigation statistics (assets, links, evidence, analysts)
     */
    async function loadActiveInvestigationStats() {
        const bannerContainer = document.getElementById("active-inv-banner-container");
        const assetsStatEl = document.getElementById("stat-active-assets");
        const linksStatEl = document.getElementById("stat-active-links");
        const evidenceStatEl = document.getElementById("stat-active-evidence");
        const analystsStatEl = document.getElementById("stat-active-analysts");

        const assetsSubtext = document.getElementById("stat-assets-subtext");
        const linksSubtext = document.getElementById("stat-links-subtext");
        const evidenceSubtext = document.getElementById("stat-evidence-subtext");
        const analystsSubtext = document.getElementById("stat-analysts-subtext");

        const activeId = ForensiQ.getActiveInvestigationId();

        if (!activeId) {
            // No active investigation
            if (bannerContainer) {
                bannerContainer.innerHTML = `
                    <div class="active-inv-banner" style="border-style: dashed;">
                        <div class="active-inv-meta">
                            <div class="active-inv-badge-large" style="background: rgba(248, 113, 113, 0.15); color: var(--crimson-danger); border-color: rgba(248, 113, 113, 0.3);">
                                !
                            </div>
                            <div class="active-inv-title-group">
                                <h3>No Active Investigation Selected</h3>
                                <p>Select an existing case from the topbar switcher or create a new investigation to view real forensic assets and run algorithms.</p>
                            </div>
                        </div>
                        <div>
                            <a href="/investigations" class="btn btn-primary btn-sm">Manage Investigations</a>
                        </div>
                    </div>
                `;
            }

            if (assetsStatEl) assetsStatEl.textContent = "--";
            if (linksStatEl) linksStatEl.textContent = "--";
            if (evidenceStatEl) evidenceStatEl.textContent = "--";
            if (analystsStatEl) analystsStatEl.textContent = "--";

            const defaultSub = "Select an investigation";
            if (assetsSubtext) assetsSubtext.textContent = defaultSub;
            if (linksSubtext) linksSubtext.textContent = defaultSub;
            if (evidenceSubtext) evidenceSubtext.textContent = defaultSub;
            if (analystsSubtext) analystsSubtext.textContent = defaultSub;
            return;
        }

        // Active investigation exists: fetch real data
        try {
            // Find current investigation metadata
            let currentInv = allInvestigations.find((i) => i.id === activeId);
            if (!currentInv) {
                try {
                    currentInv = await API.getInvestigation(activeId);
                } catch {
                    currentInv = { id: activeId, name: `Investigation #${activeId}`, status: "Active" };
                }
            }

            if (bannerContainer) {
                bannerContainer.innerHTML = `
                    <div class="active-inv-banner">
                        <div class="active-inv-meta">
                            <div class="active-inv-badge-large">
                                #${currentInv.id}
                            </div>
                            <div class="active-inv-title-group">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h3>${ForensiQ.escapeHtml(currentInv.name)}</h3>
                                    ${ForensiQ.formatStatusBadge(currentInv.status)}
                                </div>
                                <p>${currentInv.description ? ForensiQ.escapeHtml(currentInv.description) : 'Active investigation context enabled. Data counters reflect this case.'}</p>
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <a href="/assets" class="btn btn-secondary btn-sm">Assets</a>
                            <a href="/connections" class="btn btn-secondary btn-sm">Links</a>
                            <a href="/evidence" class="btn btn-secondary btn-sm">Evidence</a>
                            <a href="/analysis" class="btn btn-primary btn-sm">Run Analysis</a>
                        </div>
                    </div>
                `;
            }

            // Concurrently query real assets, links, evidence and analysts
            const [assets, links, evidence, analysts] = await Promise.all([
                API.getAssets(activeId),
                API.getLinks(activeId),
                API.getEvidence(activeId),
                API.getAnalysts(activeId),
            ]);

            if (assetsStatEl) assetsStatEl.textContent = assets.length;
            if (linksStatEl) linksStatEl.textContent = links.length;
            if (evidenceStatEl) evidenceStatEl.textContent = evidence.length;
            if (analystsStatEl) analystsStatEl.textContent = `${analysts.length} / 3`;

            const sub = `Case #${activeId}`;
            if (assetsSubtext) assetsSubtext.textContent = sub;
            if (linksSubtext) linksSubtext.textContent = sub;
            if (evidenceSubtext) evidenceSubtext.textContent = sub;
            if (analystsSubtext) analystsSubtext.textContent = `${analysts.length} active (max 3)`;
        } catch (error) {
            console.error("Failed to load active investigation metrics:", error);
            if (assetsStatEl) assetsStatEl.textContent = "!";
            if (linksStatEl) linksStatEl.textContent = "!";
            if (evidenceStatEl) evidenceStatEl.textContent = "!";
            if (analystsStatEl) analystsStatEl.textContent = "!";
            ForensiQ.toast(error.message || "Failed to load active investigation metrics", "error");
        }
    }

    document.addEventListener("DOMContentLoaded", initDashboard);
})();
