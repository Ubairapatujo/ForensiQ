/**
 * ForensiQ API Client
 * Centralized Fetch API abstraction for all backend endpoints.
 * Handles headers, JSON parsing, HTTP error statuses and error formatting.
 */

const API = (function () {
    const BASE = "/api";

    /**
     * Generic fetch wrapper with proper error handling and JSON headers.
     */
    async function request(endpoint, options = {}) {
        const url = `${BASE}${endpoint}`;
        const config = {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...options.headers,
            },
            ...options,
        };

        if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            let data = null;
            const contentType = response.headers.get("content-type");

            if (contentType && contentType.includes("application/json")) {
                try {
                    data = await response.json();
                } catch (parseErr) {
                    throw new Error("Invalid JSON response received from server.");
                }
            } else {
                const text = await response.text();
                data = { message: text };
            }

            if (!response.ok) {
                const errorMessage = (data && (data.error || data.message)) || `HTTP ${response.status}: ${response.statusText}`;
                const err = new Error(errorMessage);
                err.status = response.status;
                err.data = data;
                throw err;
            }

            return data;
        } catch (error) {
            // Re-throw with consistent structure
            if (error.status) throw error;
            const networkErr = new Error(error.message || "Network request failed. Is the backend server running?");
            networkErr.status = 0;
            throw networkErr;
        }
    }

    return {
        // ==========================================
        // INVESTIGATIONS
        // ==========================================
        async getInvestigations() {
            return request("/investigations", { method: "GET" });
        },

        async getInvestigation(id) {
            return request(`/investigations/${encodeURIComponent(id)}`, { method: "GET" });
        },

        async createInvestigation(payload) {
            return request("/investigations", {
                method: "POST",
                body: payload,
            });
        },

        async updateInvestigation(id, payload) {
            return request(`/investigations/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: payload,
            });
        },

        async deleteInvestigation(id) {
            return request(`/investigations/${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
        },

        // ==========================================
        // ASSETS
        // ==========================================
        async getAssets(investigationId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/assets`, { method: "GET" });
        },

        async getAsset(investigationId, assetId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/assets/${encodeURIComponent(assetId)}`, { method: "GET" });
        },

        async createAsset(investigationId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/assets`, {
                method: "POST",
                body: payload,
            });
        },

        async updateAsset(investigationId, assetId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/assets/${encodeURIComponent(assetId)}`, {
                method: "PUT",
                body: payload,
            });
        },

        async deleteAsset(investigationId, assetId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/assets/${encodeURIComponent(assetId)}`, {
                method: "DELETE",
            });
        },

        // ==========================================
        // LINKS (CONNECTIONS)
        // ==========================================
        async getLinks(investigationId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/links`, { method: "GET" });
        },

        async getLink(investigationId, linkId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/links/${encodeURIComponent(linkId)}`, { method: "GET" });
        },

        async createLink(investigationId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/links`, {
                method: "POST",
                body: payload,
            });
        },

        async updateLink(investigationId, linkId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/links/${encodeURIComponent(linkId)}`, {
                method: "PUT",
                body: payload,
            });
        },

        async deleteLink(investigationId, linkId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/links/${encodeURIComponent(linkId)}`, {
                method: "DELETE",
            });
        },

        // ==========================================
        // EVIDENCE
        // ==========================================
        async getEvidence(investigationId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/evidence`, { method: "GET" });
        },

        async getEvidenceItem(investigationId, evidenceId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/evidence/${encodeURIComponent(evidenceId)}`, { method: "GET" });
        },

        async createEvidence(investigationId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/evidence`, {
                method: "POST",
                body: payload,
            });
        },

        async updateEvidence(investigationId, evidenceId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/evidence/${encodeURIComponent(evidenceId)}`, {
                method: "PUT",
                body: payload,
            });
        },

        async deleteEvidence(investigationId, evidenceId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/evidence/${encodeURIComponent(evidenceId)}`, {
                method: "DELETE",
            });
        },

        // ==========================================
        // ANALYSTS
        // ==========================================
        async getAnalysts(investigationId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/analysts`, { method: "GET" });
        },

        async getAnalyst(investigationId, analystId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/analysts/${encodeURIComponent(analystId)}`, { method: "GET" });
        },

        async createAnalyst(investigationId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/analysts`, {
                method: "POST",
                body: payload,
            });
        },

        async updateAnalyst(investigationId, analystId, payload) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/analysts/${encodeURIComponent(analystId)}`, {
                method: "PUT",
                body: payload,
            });
        },

        async deleteAnalyst(investigationId, analystId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/analysts/${encodeURIComponent(analystId)}`, {
                method: "DELETE",
            });
        },

        // ==========================================
        // ALGORITHMS & ANALYSIS
        // ==========================================
        async runAnalysis(investigationId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/run-analysis`, {
                method: "POST",
            });
        },

        async runSimulation(investigationId, failedLinkIds) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/simulate`, {
                method: "POST",
                body: { failed_link_ids: failedLinkIds },
            });
        },

        async runSensitivity(investigationId) {
            return request(`/investigations/${encodeURIComponent(investigationId)}/sensitivity`, {
                method: "POST",
            });
        },
    };
})();

// Export globally for browser use
window.API = API;
