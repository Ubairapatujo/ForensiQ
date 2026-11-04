/**
 * ForensiQ Common Utility & UI Management Module
 * Handles active investigation state, topbar investigation switcher,
 * toast notifications, modal dialogs, date/status formatting and HTML escaping.
 */

const ForensiQ = (function () {
    const STORAGE_KEY_ID = "forensiq_active_inv_id";
    const STORAGE_KEY_NAME = "forensiq_active_inv_name";

    // ----------------------------------------------------
    // ACTIVE INVESTIGATION STATE MANAGEMENT
    // ----------------------------------------------------
    function getActiveInvestigationId() {
        const val = localStorage.getItem(STORAGE_KEY_ID);
        if (!val || val === "null" || val === "undefined") return null;
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? null : parsed;
    }

    function getActiveInvestigationName() {
        return localStorage.getItem(STORAGE_KEY_NAME) || "";
    }

    function setActiveInvestigation(id, name) {
        if (!id) {
            clearActiveInvestigation();
            return;
        }
        localStorage.setItem(STORAGE_KEY_ID, String(id));
        if (name) localStorage.setItem(STORAGE_KEY_NAME, String(name));

        // Dispatch custom event so any component/page can react instantly
        window.dispatchEvent(
            new CustomEvent("forensiq:active-inv-changed", {
                detail: { id: parseInt(id, 10), name: name || "" },
            })
        );
        updateTopbarSelectorUI();
    }

    function clearActiveInvestigation() {
        localStorage.removeItem(STORAGE_KEY_ID);
        localStorage.removeItem(STORAGE_KEY_NAME);

        window.dispatchEvent(
            new CustomEvent("forensiq:active-inv-changed", {
                detail: { id: null, name: "" },
            })
        );
        updateTopbarSelectorUI();
    }

    // ----------------------------------------------------
    // TOAST NOTIFICATIONS
    // ----------------------------------------------------
    function toast(message, type = "info", duration = 4000) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toastEl = document.createElement("div");
        toastEl.className = `toast-item toast-${type}`;

        const iconSvg = {
            success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        }[type] || "";

        toastEl.innerHTML = `
            <div class="toast-icon">${iconSvg}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
            <button class="toast-close" aria-label="Close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toastEl);

        setTimeout(() => {
            toastEl.classList.add("toast-fadeout");
            setTimeout(() => toastEl.remove(), 300);
        }, duration);
    }

    // ----------------------------------------------------
    // MODAL DIALOG MANAGEMENT
    // ----------------------------------------------------
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add("modal-open");
        document.body.classList.add("modal-backdrop-active");

        // Focus first input if any
        const firstInput = modal.querySelector("input:not([type=hidden]), select, textarea, button:not(.modal-close)");
        if (firstInput) setTimeout(() => firstInput.focus(), 80);
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove("modal-open");
        if (!document.querySelector(".modal.modal-open")) {
            document.body.classList.remove("modal-backdrop-active");
        }
    }

    // Setup global modal event listeners (ESC key & backdrop click)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const openModals = document.querySelectorAll(".modal.modal-open");
            openModals.forEach((m) => closeModal(m.id));
        }
    });

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal")) {
            closeModal(e.target.id);
        }
    });

    // ----------------------------------------------------
    // STRING SANITIZATION & FORMATTERS
    // ----------------------------------------------------
    function escapeHtml(text) {
        if (text === null || text === undefined) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(isoStr) {
        if (!isoStr) return "N/A";
        try {
            const date = new Date(isoStr);
            if (isNaN(date.getTime())) return isoStr;
            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return isoStr;
        }
    }

    function formatStatusBadge(status) {
        const s = (status || "Active").toLowerCase();
        let badgeClass = "badge-active";
        if (s === "completed") badgeClass = "badge-completed";
        if (s === "archived") badgeClass = "badge-archived";
        return `<span class="badge ${badgeClass}">${escapeHtml(status || "Active")}</span>`;
    }

    // ----------------------------------------------------
    // TOPBAR INVESTIGATION SELECTOR SYNC
    // ----------------------------------------------------
    async function loadTopbarInvestigations() {
        const selector = document.getElementById("topbar-inv-select");
        if (!selector) return;

        try {
            const list = await API.getInvestigations();
            const currentActiveId = getActiveInvestigationId();

            let optionsHtml = '<option value="">-- No Active Investigation --</option>';
            let activeStillExists = false;

            list.forEach((inv) => {
                const isSelected = inv.id === currentActiveId;
                if (isSelected) activeStillExists = true;
                optionsHtml += `<option value="${inv.id}" ${isSelected ? "selected" : ""}>
                    #${inv.id} - ${escapeHtml(inv.name)} (${escapeHtml(inv.status)})
                </option>`;
            });

            selector.innerHTML = optionsHtml;

            // If an active ID was stored but no longer exists on server, reset or clear it
            if (currentActiveId && !activeStillExists) {
                if (list.length > 0) {
                    setActiveInvestigation(list[0].id, list[0].name);
                    selector.value = String(list[0].id);
                } else {
                    clearActiveInvestigation();
                    selector.value = "";
                }
            } else if (!currentActiveId && list.length > 0) {
                // Auto-select latest investigation if none selected yet for convenience
                setActiveInvestigation(list[0].id, list[0].name);
                selector.value = String(list[0].id);
            }

            updateTopbarSelectorUI();
        } catch (err) {
            console.error("Failed to load investigations for topbar:", err);
        }
    }

    function updateTopbarSelectorUI() {
        const selector = document.getElementById("topbar-inv-select");
        const badge = document.getElementById("topbar-active-inv-badge");
        const sidebarActiveBadge = document.getElementById("sidebar-active-inv-name");
        const activeId = getActiveInvestigationId();
        const activeName = getActiveInvestigationName();

        if (selector && selector.value !== String(activeId || "")) {
            selector.value = activeId ? String(activeId) : "";
        }

        if (badge) {
            if (activeId) {
                badge.innerHTML = `<span class="indicator-dot active"></span> <span class="inv-title">Inv #${activeId}: ${escapeHtml(activeName || "Investigation " + activeId)}</span>`;
                badge.classList.remove("empty");
                badge.classList.add("active");
            } else {
                badge.innerHTML = `<span class="indicator-dot inactive"></span> <span class="inv-title">No Investigation Selected</span>`;
                badge.classList.remove("active");
                badge.classList.add("empty");
            }
        }

        if (sidebarActiveBadge) {
            sidebarActiveBadge.textContent = activeId ? `#${activeId} ${activeName || ""}` : "None Selected";
        }
    }

    function setupTopbarEvents() {
        const selector = document.getElementById("topbar-inv-select");
        if (selector) {
            selector.addEventListener("change", (e) => {
                const val = e.target.value;
                if (val) {
                    const selectedText = selector.options[selector.selectedIndex].text;
                    const cleanedName = selectedText.replace(/^#\d+\s*-\s*/, "").replace(/\s*\([^)]*\)$/, "");
                    setActiveInvestigation(val, cleanedName);
                    toast(`Switched active investigation to #${val}`, "info");
                } else {
                    clearActiveInvestigation();
                    toast("Active investigation cleared", "warning");
                }
            });
        }

        // Sidebar toggle for responsive / mobile devices
        const sidebarToggle = document.getElementById("sidebar-toggle");
        const sidebar = document.getElementById("sidebar");
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener("click", () => {
                sidebar.classList.toggle("sidebar-open");
            });
        }
    }

    // Auto-initialize when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        setupTopbarEvents();
        loadTopbarInvestigations();
    });

    return {
        getActiveInvestigationId,
        getActiveInvestigationName,
        setActiveInvestigation,
        clearActiveInvestigation,
        toast,
        openModal,
        closeModal,
        escapeHtml,
        formatDate,
        formatStatusBadge,
        loadTopbarInvestigations,
        updateTopbarSelectorUI,
    };
})();

// Attach to window for global access
window.ForensiQ = ForensiQ;
