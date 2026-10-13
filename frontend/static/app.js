// Helper de cabeceras seguras con token JWT para administración
function getAdminAuthHeaders(customHeaders = {}) {
    const headers = { ...customHeaders };
    try {
        const auth = JSON.parse(localStorage.getItem("wilotech_auth") || "{}");
        if (auth && auth.token) {
            headers["Authorization"] = `Bearer ${auth.token}`;
        }
    } catch (e) {}
    return headers;
}

// Estado global de la aplicación
const state = {
    distributors: [],
    distributorHealth: {},
    searchResults: null,
    currentQuery: "",
    isLoading: false,
    selectedDistributorIds: new Set(),
    dolarBlueRate: null,
    refineFilter: "",
    qualityFilter: "all",
    stockOnlyFilter: false,
    sortBy: "price_asc",
};

// Formato de moneda ARS
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(amount);
};

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    await loadDolarBlue();
    await loadDistributors();
    await loadHistory();
    setupEventListeners();

    // Auto-búsqueda inmediata si viene con parámetro ?q=... (ej: desde control de stock en panel de taller)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const queryParam = urlParams.get("q");
        if (queryParam && queryParam.trim()) {
            const cleanQ = queryParam.trim();
            const input = document.getElementById("search-input");
            const clearBtn = document.getElementById("clear-btn");
            if (input) input.value = cleanQ;
            if (clearBtn) clearBtn.classList.remove("hidden");
            executeSearch(cleanQ);
        }
    } catch (e) {
        console.warn("Error al procesar query de URL:", e);
    }
}

// Configuración de listeners
function setupEventListeners() {
    const searchForm = document.getElementById("search-form");
    const searchInput = document.getElementById("search-input");
    const clearBtn = document.getElementById("clear-btn");

    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) executeSearch(query);
    });

    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        clearBtn.classList.add("hidden");
    });

    searchInput.addEventListener("input", () => {
        if (searchInput.value.trim().length > 0) {
            clearBtn.classList.remove("hidden");
        } else {
            clearBtn.classList.add("hidden");
        }
    });

    // Chips de sugerencias rápidas
    document.querySelectorAll(".suggestion-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const query = chip.getAttribute("data-query");
            searchInput.value = query;
            clearBtn.classList.remove("hidden");
            executeSearch(query);
        });
    });

    // Botones de exportación
    document.getElementById("export-excel-btn").addEventListener("click", () => exportData("excel"));
    document.getElementById("export-csv-btn").addEventListener("click", () => exportData("csv"));

    // Modal de distribuidores
    document.getElementById("open-distributors-btn").addEventListener("click", openDistributorsModal);
    document.getElementById("close-distributors-modal").addEventListener("click", closeDistributorsModal);
    document.getElementById("distributor-form").addEventListener("submit", handleSaveDistributor);
    document.getElementById("new-distributor-btn").addEventListener("click", resetDistributorForm);

    // Modal de Listas Excel
    const openExcelBtn = document.getElementById("open-excel-modal-btn");
    if (openExcelBtn) openExcelBtn.addEventListener("click", openExcelModal);
    const closeExcelBtn = document.getElementById("close-excel-modal");
    if (closeExcelBtn) closeExcelBtn.addEventListener("click", closeExcelModal);

    // Modal Dólar Blue
    const openDolarBtn = document.getElementById("dolar-blue-btn");
    if (openDolarBtn) openDolarBtn.addEventListener("click", openDolarModal);
    const closeDolarBtn = document.getElementById("close-dolar-modal");
    if (closeDolarBtn) closeDolarBtn.addEventListener("click", closeDolarModal);
    const customDolarForm = document.getElementById("dolar-custom-form");
    if (customDolarForm) customDolarForm.addEventListener("submit", handleSetCustomDolar);
    const resetDolarBtn = document.getElementById("reset-dolar-btn");
    if (resetDolarBtn) resetDolarBtn.addEventListener("click", handleResetDolar);
    
    // Controles de filtrado y orden interactivo sobre resultados
    const refineInput = document.getElementById("filter-refine-input");
    if (refineInput) {
        refineInput.addEventListener("input", (e) => {
            state.refineFilter = e.target.value.trim();
            applyClientFiltersAndRender();
        });
    }

    const stockOnlyCb = document.getElementById("filter-stock-only");
    if (stockOnlyCb) {
        stockOnlyCb.addEventListener("change", (e) => {
            state.stockOnlyFilter = e.target.checked;
            applyClientFiltersAndRender();
        });
    }

    const sortSelect = document.getElementById("sort-results-select");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            state.sortBy = e.target.value;
            applyClientFiltersAndRender();
        });
    }

    // Chips de filtrado interactivo por Calidad de repuesto
    document.querySelectorAll(".quality-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".quality-chip").forEach(c => {
                c.classList.remove("active", "bg-cyan-500/20", "border-cyan-500/50", "text-cyan-300");
                c.classList.add("bg-[#0b101c]", "border-slate-800");
            });
            chip.classList.add("active", "bg-cyan-500/20", "border-cyan-500/50", "text-cyan-300");
            chip.classList.remove("bg-[#0b101c]", "border-slate-800");
            state.qualityFilter = chip.getAttribute("data-quality") || "all";
            applyClientFiltersAndRender();
        });
    });

    // Botón para refrescar/vaciar caché en memoria
    const clearCacheBtn = document.getElementById("btn-clear-cache");
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener("click", async () => {
            try {
                clearCacheBtn.disabled = true;
                clearCacheBtn.classList.add("opacity-50");
                const res = await fetch("/api/search/clear-cache", { method: "POST" });
                if (res.ok) {
                    showToast("Caché de búsquedas vaciada exitosamente", "success");
                    if (state.currentQuery) {
                        executeSearch(state.currentQuery);
                    }
                }
            } catch (err) {
                showToast("Error al vaciar caché", "error");
            } finally {
                clearCacheBtn.disabled = false;
                clearCacheBtn.classList.remove("opacity-50");
            }
        });
    }

    setupWhatsAppQuoteModal();
    setupExcelDropzone();
}

// Local Storage Persistence Helpers for Distributor Credentials across Serverless Sessions
function getSavedLocalDistributors() {
    try {
        const raw = localStorage.getItem("cellprice_saved_distributors");
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveLocalDistributor(payload) {
    try {
        const localDists = getSavedLocalDistributors();
        const existing = localDists[payload.id] || {};
        localDists[payload.id] = {
            id: payload.id,
            name: payload.name,
            base_url: payload.base_url,
            login_url: payload.login_url || "",
            username: payload.username || "",
            password: payload.password !== undefined ? payload.password : (existing.password || ""),
            scraper_type: payload.scraper_type,
            is_active: payload.is_active
        };
        localStorage.setItem("cellprice_saved_distributors", JSON.stringify(localDists));
    } catch (e) {
        console.warn("No se pudo guardar distribuidora en localStorage:", e);
    }
}

function removeLocalDistributor(distId) {
    try {
        const localDists = getSavedLocalDistributors();
        delete localDists[distId];
        localStorage.setItem("cellprice_saved_distributors", JSON.stringify(localDists));
    } catch (e) {
        console.error(e);
    }
}

// Cargar estado de salud y latencia en vivo de distribuidoras
async function loadDistributorHealth() {
    try {
        const res = await fetch("/api/distributors/health");
        if (!res.ok) return;
        const list = await res.json();
        state.distributorHealth = {};
        if (Array.isArray(list)) {
            list.forEach(h => {
                state.distributorHealth[h.id] = h;
            });
        }
    } catch (err) {
        console.warn("No se pudo obtener salud de distribuidoras:", err);
    }
}

// Cargar lista de distribuidores desde el backend
async function loadDistributors() {
    try {
        const res = await fetch("/api/distributors");
        if (!res.ok) throw new Error("Error al cargar distribuidoras");
        state.distributors = await res.json();

        // Auto-sincronizar credenciales guardadas localmente si la BD serverless en Vercel se reinició
        const localDists = getSavedLocalDistributors();
        let needsReRes = false;

        for (const [dId, dObj] of Object.entries(localDists)) {
            const serverDist = state.distributors.find(d => d.id === dId);
            if (!serverDist || (!serverDist.username && dObj.username)) {
                try {
                    await fetch("/api/distributors", {
                        method: "POST",
                        headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
                        body: JSON.stringify(dObj)
                    });
                    needsReRes = true;
                } catch (errSync) {
                    console.error("Error al re-sincronizar distribuidora:", errSync);
                }
            }
        }

        if (needsReRes) {
            const reRes = await fetch("/api/distributors");
            if (reRes.ok) state.distributors = await reRes.json();
        }

        await loadDistributorHealth();
        renderDistributorPills();
        renderDistributorModalList();
    } catch (err) {
        console.error("Error al obtener distribuidoras:", err);
    }
}

// Renderizar filtros de distribuidores en la pantalla principal
function renderDistributorPills() {
    const container = document.getElementById("distributor-filters");
    const countBadge = document.getElementById("active-distributors-count");
    
    const activeCount = state.distributors.filter(d => d.is_active).length;
    const healthValues = Object.values(state.distributorHealth || {});
    const healthyCount = healthValues.filter(h => h.status === 'healthy').length;

    if (countBadge) {
        if (healthyCount > 0) {
            countBadge.innerHTML = `<span class="text-[#00ff87] font-semibold">${activeCount} activas</span> &bull; <span class="text-cyan-300 font-mono text-[10px]">${healthyCount} online</span>`;
        } else {
            countBadge.textContent = `${activeCount} de ${state.distributors.length} activas`;
        }
    }

    container.innerHTML = "";
    state.distributors.forEach(d => {
        const isChecked = d.is_active;
        if (isChecked) state.selectedDistributorIds.add(d.id);

        const isExcel = d.scraper_type === "excel_catalog" || d.id.startsWith("excel_");
        const health = state.distributorHealth ? state.distributorHealth[d.id] : null;

        const pill = document.createElement("label");
        const activeClass = isExcel 
            ? "distributor-pill-active-excel"
            : "distributor-pill-active-web";
        const inactiveClass = isExcel
            ? "bg-[#0b101c]/70 border-emerald-900/30 text-slate-400 hover:border-emerald-700/50"
            : "bg-[#0b101c]/70 border-slate-800 text-slate-400 hover:border-cyan-700/50";

        pill.className = `flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
            isChecked ? activeClass : inactiveClass
        }`;
        
        let badgeDot = "";
        if (isExcel) {
            badgeDot = `<span class="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-[#00ff87] text-[10px] font-bold border border-emerald-500/30 font-mono">Excel</span>`;
        } else {
            let dotClass = "bg-amber-400";
            let dotTitle = `Estado: ${d.last_login_status || 'Sin probar'}`;
            if (health) {
                if (health.status === 'healthy') {
                    dotClass = "bg-[#00ff87] neon-glow-green";
                    dotTitle = `En línea (${health.latency_ms}ms) - ${health.message}`;
                } else if (health.status === 'error') {
                    dotClass = "bg-rose-500";
                    dotTitle = `Error: ${health.message}`;
                } else if (health.status === 'warning') {
                    dotClass = "bg-amber-400";
                    dotTitle = `Aviso: ${health.message}`;
                } else {
                    dotClass = "bg-cyan-400";
                    dotTitle = health.message || "Listo";
                }
            } else if (d.last_login_status === 'OK') {
                dotClass = "bg-[#00ff87] neon-glow-green";
            }
            badgeDot = `<span class="w-2 h-2 rounded-full ${dotClass}" title="${dotTitle}"></span>`;
        }

        pill.innerHTML = `
            <input type="checkbox" value="${d.id}" ${isChecked ? "checked" : ""} class="rounded border-slate-700 text-cyan-400 focus:ring-0 focus:ring-offset-0 bg-[#070b14]">
            <span class="font-medium">${d.name}</span>
            ${badgeDot}
        `;

        const checkbox = pill.querySelector("input");
        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                state.selectedDistributorIds.add(d.id);
                pill.className = `flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${activeClass}`;
            } else {
                state.selectedDistributorIds.delete(d.id);
                pill.className = `flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${inactiveClass}`;
            }
        });

        container.appendChild(pill);
    });
}

// Ejecutar búsqueda y comparativa de repuestos
async function executeSearch(query) {
    if (state.isLoading) return;
    
    state.isLoading = true;
    state.currentQuery = query;
    showLoadingSkeleton();

    try {
        // Sincronizar credenciales y distribuidores guardados localmente antes de consultar
        await loadDistributors();

        const targetIds = Array.from(state.selectedDistributorIds).join(",");
        const url = `/api/search?q=${encodeURIComponent(query)}${targetIds ? `&distributors=${targetIds}` : ""}`;
        
        const startTime = performance.now();
        const res = await fetch(url);
        const duration = Math.round(performance.now() - startTime);
        
        if (!res.ok) throw new Error("Error en la búsqueda del servidor");
        
        const data = await res.json();
        state.searchResults = data;
        renderSearchResults(data, duration);
        await loadHistory();
    } catch (err) {
        console.error("Error en búsqueda:", err);
        showErrorBanner(`No se pudo completar la búsqueda: ${err.message}`);
    } finally {
        state.isLoading = false;
    }
}

// Mostrar esqueletos de carga
function showLoadingSkeleton() {
    const resultsContainer = document.getElementById("results-container");
    const summaryBanner = document.getElementById("summary-banner");
    const emptyState = document.getElementById("empty-state");
    const errorBanner = document.getElementById("error-banner");

    emptyState.classList.add("hidden");
    errorBanner.classList.add("hidden");
    summaryBanner.classList.remove("hidden");

    document.getElementById("stat-best-price").innerHTML = `<div class="h-8 w-24 skeleton-shimmer"></div>`;
    document.getElementById("stat-avg-price").innerHTML = `<div class="h-8 w-24 skeleton-shimmer"></div>`;
    document.getElementById("stat-range-price").innerHTML = `<div class="h-8 w-28 skeleton-shimmer"></div>`;
    document.getElementById("stat-total-results").innerHTML = `<div class="h-8 w-12 skeleton-shimmer"></div>`;

    const skeletonCards = [1, 2, 3, 4].map(() => `
        <div class="p-5 rounded-2xl border border-slate-800/80 bg-[#0c1220]/75 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex-1 space-y-3 w-full">
                <div class="flex items-center gap-2">
                    <div class="h-6 w-28 skeleton-shimmer"></div>
                    <div class="h-5 w-24 skeleton-shimmer"></div>
                    <div class="h-5 w-20 skeleton-shimmer"></div>
                </div>
                <div class="h-6 w-3/4 skeleton-shimmer"></div>
                <div class="flex items-center gap-4">
                    <div class="h-4 w-32 skeleton-shimmer"></div>
                    <div class="h-4 w-28 skeleton-shimmer"></div>
                </div>
            </div>
            <div class="flex md:flex-col items-end justify-between w-full md:w-48 gap-3 border-t md:border-t-0 border-slate-800/80 pt-3 md:pt-0">
                <div class="h-8 w-28 skeleton-shimmer"></div>
                <div class="flex items-center gap-2 w-full justify-end">
                    <div class="h-9 w-24 skeleton-shimmer"></div>
                    <div class="h-9 w-28 skeleton-shimmer"></div>
                </div>
            </div>
        </div>
    `).join("");

    resultsContainer.innerHTML = `
        <div class="col-span-full space-y-3">
            <div class="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex items-center justify-center gap-3 text-cyan-300">
                <svg class="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-xs font-bold font-tech uppercase tracking-wider">Consultando en paralelo distribuidoras conectadas...</span>
            </div>
            ${skeletonCards}
        </div>
    `;
}

// Renderizar resultados de la comparativa
function renderSearchResults(data, durationMs) {
    const summaryBanner = document.getElementById("summary-banner");
    const emptyState = document.getElementById("empty-state");
    const searchMeta = document.getElementById("search-meta");
    const resultsContainer = document.getElementById("results-container");

    if (!data.results || data.results.length === 0) {
        summaryBanner.classList.add("hidden");
        resultsContainer.innerHTML = "";
        emptyState.classList.remove("hidden");
        document.getElementById("empty-state-title").textContent = `No se encontraron repuestos para "${data.query}"`;
        document.getElementById("empty-state-desc").textContent = "Intenta buscar por código de pieza alternativo o una descripción más general.";
        return;
    }

    // Actualizar banner de estadísticas
    summaryBanner.classList.remove("hidden");
    emptyState.classList.add("hidden");

    const bestPrice = data.best_option ? data.best_option.price : (data.min_price || 0);
    document.getElementById("stat-best-price").textContent = formatCurrency(bestPrice);
    document.getElementById("stat-best-distributor").textContent = data.best_option ? `En ${data.best_option.distributor_name}` : "Mejor opción disponible";

    document.getElementById("stat-avg-price").textContent = formatCurrency(data.average_price || 0);
    document.getElementById("stat-range-price").textContent = `${formatCurrency(data.min_price || 0)} - ${formatCurrency(data.max_price || 0)}`;
    document.getElementById("stat-total-results").textContent = `${data.total_results} opciones`;

    const blueInfoText = data.dolar_blue_rate ? ` &bull; Dólar Blue: $${data.dolar_blue_rate.toLocaleString('es-AR')}` : "";
    searchMeta.innerHTML = `Se compararon ${data.distributors_queried.length} distribuidoras en ${durationMs} ms${blueInfoText}.`;

    // Restablecer filtros de refinamiento
    state.refineFilter = "";
    state.stockOnlyFilter = false;
    const refineInput = document.getElementById("filter-refine-input");
    if (refineInput) refineInput.value = "";
    const stockOnlyCb = document.getElementById("filter-stock-only");
    if (stockOnlyCb) stockOnlyCb.checked = false;

    applyClientFiltersAndRender();
}

// Aplicar filtros interactivos de cliente y renderizar tarjetas
function applyClientFiltersAndRender() {
    const resultsContainer = document.getElementById("results-container");
    if (!state.searchResults || !state.searchResults.results) return;

    let items = [...state.searchResults.results];
    const bestPrice = state.searchResults.best_option ? state.searchResults.best_option.price : (state.searchResults.min_price || 0);

    // 1. Filtro de solo stock
    if (state.stockOnlyFilter) {
        items = items.filter(i => i.has_stock);
    }

    // 2. Filtro de calidad de repuesto
    if (state.qualityFilter && state.qualityFilter !== "all") {
        const targetQ = state.qualityFilter.toLowerCase();
        items = items.filter(i => {
            const q = (i.quality || "").toLowerCase();
            const desc = (i.description || "").toLowerCase();
            return q.includes(targetQ) || desc.includes(targetQ);
        });
    }

    // 3. Filtro de refinamiento por texto
    if (state.refineFilter) {
        const tokens = state.refineFilter.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        items = items.filter(i => {
            const fullText = `${i.description} ${i.brand} ${i.distributor_name} ${i.sku} ${i.quality || ''}`.toLowerCase();
            return tokens.every(token => fullText.includes(token));
        });
    }

    // 4. Ordenamiento
    if (state.sortBy === "price_asc") {
        items.sort((a, b) => a.price - b.price);
    } else if (state.sortBy === "price_desc") {
        items.sort((a, b) => b.price - a.price);
    } else if (state.sortBy === "distributor") {
        items.sort((a, b) => a.distributor_name.localeCompare(b.distributor_name));
    }

    // Actualizar badge de conteo
    const countBadge = document.getElementById("filtered-count-badge");
    if (countBadge) {
        countBadge.textContent = `(${items.length} de ${state.searchResults.results.length} visibles)`;
    }

    resultsContainer.innerHTML = "";

    if (items.length === 0) {
        resultsContainer.innerHTML = `
            <div class="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                <p class="text-sm font-semibold text-slate-300">Ningún repuesto coincide con los filtros aplicados.</p>
                <p class="text-xs text-slate-500 mt-1">Intenta borrar o relajar el filtro para ver los demás repuestos.</p>
            </div>
        `;
        return;
    }

    items.forEach((item) => {
        const isBest = item.is_best_price;
        const priceDiff = item.price - bestPrice;
        const diffPercent = bestPrice > 0 ? Math.round((priceDiff / bestPrice) * 100) : 0;

        const card = document.createElement("div");
        card.className = `p-5 rounded-2xl border transition-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            isBest 
            ? "best-deal-glow bg-[#0a101d]/90" 
            : "border-slate-800/80 bg-[#0c1220]/75 hover:border-cyan-500/30"
        }`;

        let diffBadgeHtml = "";
        if (isBest) {
            diffBadgeHtml = `
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-[#00ff87] border border-emerald-400/50 best-deal-badge font-tech tracking-wider">
                    <svg class="w-3.5 h-3.5 text-[#00ff87]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    MEJOR PRECIO LAB
                </span>
            `;
        } else if (priceDiff > 0) {
            diffBadgeHtml = `
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                    +${formatCurrency(priceDiff)} (+${diffPercent}%)
                </span>
            `;
        }

        const stockBadge = item.has_stock
            ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <span class="w-1.5 h-1.5 rounded-full bg-[#00ff87] neon-glow-green"></span> ${item.stock}
               </span>`
            : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ${item.stock}
               </span>`;

        let qualityBadgeHtml = "";
        if (item.quality && item.quality !== "Estándar") {
            let qClass = "quality-standard";
            if (item.quality.includes("Original")) qClass = "quality-original";
            else if (item.quality.includes("OLED")) qClass = "quality-oled";
            else if (item.quality.includes("Incell")) qClass = "quality-incell";
            else if (item.quality.includes("Batería")) qClass = "quality-battery";
            else if (item.quality.includes("Pin")) qClass = "quality-pin";
            qualityBadgeHtml = `<span class="quality-badge ${qClass}">💎 ${item.quality}</span>`;
        }

        card.innerHTML = `
            <div class="flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#070b14] text-cyan-300 border border-cyan-500/30 font-tech">
                        ${item.distributor_name}
                    </span>
                    ${diffBadgeHtml}
                    ${stockBadge}
                    ${qualityBadgeHtml}
                    <span class="text-xs text-slate-400 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        ${item.delivery_time || "Consultar plazo"}
                    </span>
                </div>

                <div class="flex items-baseline gap-2">
                    <h3 class="text-base sm:text-lg font-bold text-white tracking-tight">${item.description}</h3>
                </div>

                <div class="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <div><span class="text-slate-500">Código / SKU:</span> <strong class="text-cyan-200 font-mono">${item.sku}</strong></div>
                    <div><span class="text-slate-500">Marca:</span> <strong class="text-slate-200 font-medium">${item.brand || "Estándar"}</strong></div>
                    <div><span class="text-slate-500">Actualizado:</span> ${item.scraped_at}</div>
                </div>
            </div>

            <div class="flex md:flex-col items-end justify-between w-full md:w-auto gap-3 border-t md:border-t-0 border-slate-800/80 pt-3 md:pt-0">
                <div class="text-right">
                    <div class="text-2xl font-black font-mono ${isBest ? 'text-[#00ff87]' : 'text-white'}">
                        ${formatCurrency(item.price)}
                    </div>
                    ${item.original_price ? `
                        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-semibold mt-0.5 font-mono" title="Precio original en dólares convertido a pesos con Dólar Blue">
                            <span>💵 U$D ${item.original_price.toFixed(2)}</span>
                            <span class="text-[10px] text-slate-400 font-normal">(@ $${item.exchange_rate_used.toLocaleString('es-AR')})</span>
                        </div>
                    ` : `<div class="text-[11px] text-slate-400">IVA e impuestos incluidos</div>`}
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" class="btn-open-wa-quote inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/50 text-[#00ff87] transition-all cursor-pointer shadow-sm hover:scale-105" data-desc="${encodeURIComponent(item.description)}" data-price="${item.price}">
                        <span>📲 Presupuesto</span>
                    </button>

                    <a href="${item.product_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold ${
                        isBest 
                        ? "wilo-btn-primary shadow-lg shadow-cyan-950/40" 
                        : "bg-[#0e1626] hover:bg-[#142036] text-cyan-200 border border-cyan-500/30 hover:border-cyan-400"
                    } transition-all cursor-pointer">
                        <span>Ver en web</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            </div>
        `;

        resultsContainer.appendChild(card);
    });

    // Listeners para los botones de Presupuesto WhatsApp
    resultsContainer.querySelectorAll(".btn-open-wa-quote").forEach(btn => {
        btn.addEventListener("click", () => {
            const desc = decodeURIComponent(btn.getAttribute("data-desc") || "");
            const price = parseFloat(btn.getAttribute("data-price") || 0);
            openWhatsAppQuoteModal(desc, price);
        });
    });
}

// Cargar historial de búsquedas recientes
async function loadHistory() {
    try {
        const res = await fetch("/api/history");
        if (!res.ok) return;
        const history = await res.json();
        const container = document.getElementById("search-history-container");
        
        if (!history || history.length === 0) {
            container.parentElement.classList.add("hidden");
            return;
        }

        container.parentElement.classList.remove("hidden");
        container.innerHTML = "";

        history.forEach(item => {
            const btn = document.createElement("button");
            btn.className = "text-xs px-2.5 py-1 rounded-lg bg-[#0e1626] hover:bg-[#15223a] text-slate-300 border border-slate-700/80 hover:border-cyan-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm";
            btn.innerHTML = `
                <span>${item.query}</span>
                <span class="text-[10px] text-slate-500">(${item.total_results})</span>
            `;
            btn.addEventListener("click", () => {
                document.getElementById("search-input").value = item.query;
                document.getElementById("clear-btn").classList.remove("hidden");
                executeSearch(item.query);
            });
            container.appendChild(btn);
        });
    } catch (err) {
        console.error("Error al cargar historial:", err);
    }
}

// Exportar datos a Excel o CSV
function exportData(format) {
    if (!state.currentQuery) {
        alert("Por favor realiza una búsqueda primero antes de exportar.");
        return;
    }
    const endpoint = `/api/export/${format}?q=${encodeURIComponent(state.currentQuery)}`;
    window.location.href = endpoint;
}

// Mostrar banner de error
function showErrorBanner(message) {
    const errorBanner = document.getElementById("error-banner");
    errorBanner.textContent = message;
    errorBanner.classList.remove("hidden");
}

// --- MODAL DE DISTRIBUIDORAS ---

function openDistributorsModal() {
    document.getElementById("distributors-modal").classList.remove("hidden");
    renderDistributorModalList();
}

function closeDistributorsModal() {
    document.getElementById("distributors-modal").classList.add("hidden");
    resetDistributorForm();
    loadDistributors(); // Refrescar filtros en pantalla principal
}

function renderDistributorModalList() {
    const listContainer = document.getElementById("modal-distributors-list");
    listContainer.innerHTML = "";

    state.distributors.forEach(d => {
        const item = document.createElement("div");
        item.className = "p-4 rounded-xl border border-slate-800 bg-slate-900/80 space-y-3";
        
        const health = state.distributorHealth ? state.distributorHealth[d.id] : null;
        let statusBadge = "";
        if (health && health.status === "healthy") {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">En línea (${health.latency_ms}ms)</span>`;
        } else if (health && health.status === "error") {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Error (${health.message})</span>`;
        } else if (health && health.status === "warning") {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">${health.message}</span>`;
        } else if (d.last_login_status === "OK") {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Conectado (OK)</span>`;
        } else if (d.last_login_status === "ERROR") {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Error de Acceso</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-700/50 text-slate-400">Sin probar</span>`;
        }

        item.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-white text-sm">${d.name}</h4>
                    <p class="text-xs text-slate-400 truncate max-w-xs">${d.base_url}</p>
                </div>
                <div>${statusBadge}</div>
            </div>

            <div class="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Usuario: <strong class="text-slate-300 font-mono">${d.username || 'No asignado'}</strong></span>
                <span class="text-[11px] text-slate-500 uppercase">${d.scraper_type}</span>
            </div>

            ${d.last_login_msg ? `<p class="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded">${d.last_login_msg}</p>` : ""}

            <div class="flex items-center justify-end gap-2 pt-1">
                <button type="button" class="test-login-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-700/50 transition-colors flex items-center gap-1.5" data-id="${d.id}">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    Probar Conexión
                </button>
                <button type="button" class="edit-dist-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors" data-id="${d.id}">
                    Editar
                </button>
                <button type="button" class="del-dist-btn px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/30 transition-colors" data-id="${d.id}">
                    Eliminar
                </button>
            </div>
        `;

        item.querySelector(".test-login-btn").addEventListener("click", () => handleTestLogin(d.id, item));
        item.querySelector(".edit-dist-btn").addEventListener("click", () => populateDistributorForm(d));
        item.querySelector(".del-dist-btn").addEventListener("click", () => handleDeleteDistributor(d.id));

        listContainer.appendChild(item);
    });
}

// Probar login individual
async function handleTestLogin(distId, containerElement) {
    const btn = containerElement.querySelector(".test-login-btn");
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span> Probando...`;

    try {
        // Asegurar que las credenciales locales estén sincronizadas en el servidor antes de probar
        const localDists = getSavedLocalDistributors();
        if (localDists[distId] && localDists[distId].username) {
            await fetch("/api/distributors", {
                method: "POST",
                headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(localDists[distId])
            });
        }

        const res = await fetch(`/api/distributors/${distId}/test-login`, {
            method: "POST",
            headers: getAdminAuthHeaders()
        });
        const result = await res.json();
        
        await loadDistributors();
        renderDistributorModalList();
        
        if (result.success) {
            alert(`Conexión exitosa con "${result.distributor_name}":\n${result.message}`);
        } else {
            alert(`Falla de acceso en "${result.distributor_name}":\n${result.message}`);
        }
    } catch (err) {
        alert("Error al intentar probar conexión: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// Guardar distribuidora (crear o editar)
async function handleSaveDistributor(e) {
    e.preventDefault();
    const form = e.target;
    
    const id = form["dist-id"].value.trim() || form["dist-name"].value.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const name = form["dist-name"].value.trim();
    const base_url = form["dist-base-url"].value.trim();
    const login_url = form["dist-login-url"].value.trim();
    const username = form["dist-username"].value.trim();
    const password = form["dist-password"].value;
    const scraper_type = form["dist-type"].value;
    const is_active = form["dist-active"].checked;

    const payload = {
        id,
        name,
        base_url,
        login_url,
        username,
        password: password || undefined,
        scraper_type,
        is_active
    };

    try {
        const res = await fetch("/api/distributors", {
            method: "POST",
            headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "No se pudo guardar la distribuidora. Se requiere sesión de administrador.");
        }

        // Guardar copia persistente localmente
        saveLocalDistributor(payload);

        await loadDistributors();
        resetDistributorForm();
        alert(`Distribuidora "${name}" guardada y credenciales sincronizadas con éxito.`);
    } catch (err) {
        alert("Error al guardar: " + err.message);
    }
}

function populateDistributorForm(d) {
    const form = document.getElementById("distributor-form");
    const localDists = getSavedLocalDistributors();
    const localObj = localDists[d.id] || {};

    form["dist-id"].value = d.id;
    form["dist-name"].value = d.name;
    form["dist-base-url"].value = d.base_url;
    form["dist-login-url"].value = d.login_url || "";
    form["dist-username"].value = d.username || localObj.username || "";
    form["dist-password"].value = localObj.password || "";
    form["dist-password"].placeholder = "Dejar en blanco para conservar la actual";
    form["dist-type"].value = d.scraper_type;
    form["dist-active"].checked = d.is_active;

    document.getElementById("form-title").textContent = `Editar: ${d.name}`;
    document.getElementById("cancel-edit-btn").classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth" });
}

function resetDistributorForm() {
    const form = document.getElementById("distributor-form");
    form.reset();
    form["dist-id"].value = "";
    form["dist-password"].placeholder = "Contraseña segura de acceso al portal";
    document.getElementById("form-title").textContent = "Agregar Nueva Distribuidora";
    document.getElementById("cancel-edit-btn").classList.add("hidden");
}

async function handleDeleteDistributor(distId) {
    if (!confirm("¿Seguro que deseas eliminar esta distribuidora de tu lista?")) return;
    try {
        const res = await fetch(`/api/distributors/${distId}`, {
            method: "DELETE",
            headers: getAdminAuthHeaders()
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "No se pudo eliminar. Se requiere sesión de administrador.");
        }

        removeLocalDistributor(distId);
        await loadDistributors();
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}

// ==========================================
// CONTROLADOR DE LISTAS EXCEL / CSV
// ==========================================

let selectedExcelFile = null;

function openExcelModal() {
    document.getElementById("excel-modal").classList.remove("hidden");
    loadExcelCatalogs();
}

function closeExcelModal() {
    document.getElementById("excel-modal").classList.add("hidden");
}

function setupExcelDropzone() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("excel-file-input");
    const dropzoneText = document.getElementById("dropzone-text");
    const form = document.getElementById("excel-upload-form");

    if (!dropzone || !fileInput || !form) return;

    dropzone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("border-emerald-400", "bg-emerald-950/20");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("border-emerald-400", "bg-emerald-950/20");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-emerald-400", "bg-emerald-950/20");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    form.addEventListener("submit", handleUploadExcel);

    // Cerrar modales con clic en el fondo o tecla Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeDistributorsModal();
            closeExcelModal();
        }
    });

    const excelModal = document.getElementById("excel-modal");
    if (excelModal) {
        excelModal.addEventListener("click", (e) => {
            if (e.target === excelModal) closeExcelModal();
        });
    }

    const distModal = document.getElementById("distributors-modal");
    if (distModal) {
        distModal.addEventListener("click", (e) => {
            if (e.target === distModal) closeDistributorsModal();
        });
    }
}

function handleSelectedFile(file) {
    selectedExcelFile = file;
    const dropzoneText = document.getElementById("dropzone-text");
    const nameInput = document.getElementById("excel-supplier-name");
    
    dropzoneText.innerHTML = `<strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
    
    // Si el nombre del proveedor está vacío, sugerir el nombre del archivo sin extensión
    if (!nameInput.value.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        nameInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
}

// Persistent Local Storage Helpers for Excel Catalogs across Serverless Sessions
function getSavedLocalExcelCatalogs() {
    try {
        const raw = localStorage.getItem("cellprice_excel_catalogs");
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveLocalExcelCatalog(catalogId, catalogData, items) {
    try {
        const localCatalogs = getSavedLocalExcelCatalogs();
        localCatalogs[catalogId] = {
            catalog_id: catalogId,
            name: catalogData.name,
            filename: catalogData.filename,
            currency: catalogData.currency,
            uploaded_at: catalogData.uploaded_at,
            total_items: items ? items.length : catalogData.total_items,
            items: items || []
        };
        localStorage.setItem("cellprice_excel_catalogs", JSON.stringify(localCatalogs));
    } catch (e) {
        console.warn("No se pudo guardar copia en localStorage:", e);
    }
}

function removeLocalExcelCatalog(catalogId) {
    try {
        const localCatalogs = getSavedLocalExcelCatalogs();
        delete localCatalogs[catalogId];
        localStorage.setItem("cellprice_excel_catalogs", JSON.stringify(localCatalogs));
    } catch (e) {
        console.error(e);
    }
}

async function loadExcelCatalogs() {
    const container = document.getElementById("modal-excel-list");
    if (!container) return;

    try {
        const res = await fetch("/api/catalogs/excel");
        if (!res.ok) throw new Error("Error al obtener catálogos");
        let catalogs = await res.json();

        // Auto-restaurar catálogos guardados localmente si se perdió la memoria del servidor (ej: Serverless cold-start)
        const localCatalogs = getSavedLocalExcelCatalogs();
        const serverIds = new Set(catalogs.map(c => c.id));
        let reSynced = false;

        for (const [catId, catObj] of Object.entries(localCatalogs)) {
            if (!serverIds.has(catId) && catObj.items && catObj.items.length > 0) {
                try {
                    await fetch("/api/catalogs/excel/restore", {
                        method: "POST",
                        headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
                        body: JSON.stringify({
                            catalog_id: catObj.catalog_id,
                            name: catObj.name,
                            filename: catObj.filename,
                            currency: catObj.currency,
                            items: catObj.items
                        })
                    });
                    reSynced = true;
                } catch (errSync) {
                    console.error("Error al auto-restaurar catálogo:", errSync);
                }
            }
        }

        if (reSynced) {
            const reRes = await fetch("/api/catalogs/excel");
            if (reRes.ok) catalogs = await reRes.json();
            await loadDistributors();
        }

        if (catalogs.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center border border-dashed border-slate-800 rounded-xl">
                    <p class="text-xs text-slate-400">Aún no has importado ninguna lista de precios en Excel.</p>
                    <p class="text-[11px] text-slate-500 mt-1">Sube la planilla de tu mayorista para comparar precios automáticamente.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = catalogs.map(c => `
            <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-white truncate">${c.name}</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ${c.total_items} items
                        </span>
                    </div>
                    <div class="text-[11px] text-slate-400 truncate mt-0.5">
                        📄 ${c.filename} &bull; ${c.currency}
                    </div>
                    <div class="text-[10px] text-slate-500 mt-0.5">
                        Actualizado: ${new Date(c.uploaded_at).toLocaleString('es-AR')}
                    </div>
                </div>
                <button onclick="handleDeleteExcelCatalog('${c.id}')" class="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Eliminar lista">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `).join("");

    } catch (err) {
        console.error("Error al cargar catálogos Excel:", err);
        container.innerHTML = `<div class="text-xs text-rose-400">Error al cargar listas: ${err.message}</div>`;
    }
}

async function handleUploadExcel(e) {
    e.preventDefault();
    const fileInput = document.getElementById("excel-file-input");
    const fileToUpload = selectedExcelFile || (fileInput.files && fileInput.files[0]);

    if (!fileToUpload) {
        alert("Por favor selecciona o arrastra un archivo Excel (.xlsx, .xls) o CSV primero.");
        return;
    }

    const nameInput = document.getElementById("excel-supplier-name");
    const currencySelect = document.getElementById("excel-currency");
    const statusBox = document.getElementById("upload-status");
    const uploadBtn = document.getElementById("upload-excel-btn");

    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("name", nameInput.value.trim());
    formData.append("currency", currencySelect.value);

    statusBox.className = "p-3 rounded-lg text-xs bg-blue-950/40 border border-blue-800 text-blue-300 flex items-center gap-2";
    statusBox.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
        <span>Procesando planilla e indexando repuestos...</span>
    `;
    statusBox.classList.remove("hidden");
    uploadBtn.disabled = true;

    try {
        const res = await fetch("/api/catalogs/excel/upload", {
            method: "POST",
            headers: getAdminAuthHeaders(),
            body: formData
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Error al procesar el archivo. Requiere sesión de administrador.");
        }

        // Guardar copia persistente en localStorage del cliente
        if (data.items && data.items.length > 0) {
            saveLocalExcelCatalog(data.catalog.catalog_id, data.catalog, data.items);
        }

        statusBox.className = "p-3 rounded-lg text-xs bg-emerald-950/40 border border-emerald-800 text-emerald-300";
        statusBox.innerHTML = `
            <strong>¡Lista importada con éxito!</strong><br>
            Se indexaron <strong>${data.catalog.total_items}</strong> repuestos listos para comparar.
        `;

        // Limpiar formulario
        selectedExcelFile = null;
        document.getElementById("excel-file-input").value = "";
        document.getElementById("dropzone-text").innerHTML = "Haz clic o arrastra tu archivo aquí";
        nameInput.value = "";

        // Refrescar vistas
        await loadExcelCatalogs();
        await loadDistributors();

    } catch (err) {
        statusBox.className = "p-3 rounded-lg text-xs bg-rose-950/40 border border-rose-800 text-rose-300";
        statusBox.innerHTML = `<strong>Error:</strong> ${err.message}`;
    } finally {
        uploadBtn.disabled = false;
    }
}

async function handleDeleteExcelCatalog(catalogId) {
    if (!confirm("¿Deseas eliminar este catálogo Excel y todos sus repuestos?")) return;

    try {
        const res = await fetch(`/api/catalogs/excel/${catalogId}`, {
            method: "DELETE",
            headers: getAdminAuthHeaders()
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "No se pudo eliminar el catálogo. Se requiere sesión de administrador.");
        }

        removeLocalExcelCatalog(catalogId);
        await loadExcelCatalogs();
        await loadDistributors();
    } catch (err) {
        alert("Error al eliminar catálogo: " + err.message);
    }
}

// ==========================================
// CONTROLADOR DÓLAR BLUE
// ==========================================

async function loadDolarBlue() {
    try {
        const res = await fetch("/api/currency/dolar-blue");
        if (!res.ok) return;
        const data = await res.json();
        state.dolarBlueRate = data.tarifa_usada;

        const valSpan = document.getElementById("dolar-blue-val");
        if (valSpan) {
            valSpan.textContent = `$${data.tarifa_usada.toLocaleString('es-AR')}${data.is_custom ? '*' : ''}`;
        }

        const ventaEl = document.getElementById("modal-dolar-venta");
        if (ventaEl) ventaEl.textContent = `$ ${data.tarifa_usada.toLocaleString('es-AR')}`;

        const compraEl = document.getElementById("modal-dolar-compra");
        if (compraEl) compraEl.textContent = `$ ${data.compra.toLocaleString('es-AR')}`;

        const fuenteEl = document.getElementById("modal-dolar-fuente");
        if (fuenteEl) {
            fuenteEl.innerHTML = `<strong>Fuente:</strong> ${data.fuente} &bull; <strong>Fecha:</strong> ${data.actualizado ? new Date(data.actualizado).toLocaleString('es-AR') : 'Hoy'}`;
        }
    } catch (err) {
        console.error("Error al cargar Dólar Blue:", err);
    }
}

function openDolarModal() {
    document.getElementById("dolar-modal").classList.remove("hidden");
    loadDolarBlue();
}

function closeDolarModal() {
    document.getElementById("dolar-modal").classList.add("hidden");
}

async function handleSetCustomDolar(e) {
    e.preventDefault();
    const input = document.getElementById("dolar-custom-input");
    const val = parseFloat(input.value);
    if (!val || val <= 0) {
        alert("Ingresa un valor numérico válido en pesos (ej: 1540).");
        return;
    }

    try {
        const res = await fetch("/api/currency/dolar-blue", {
            method: "POST",
            headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ rate: val })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Error al fijar cotización. Se requiere inicio de sesión de taller.");
        }
        await loadDolarBlue();
        input.value = "";
        alert(`Cotización manual fijada en $${val.toLocaleString('es-AR')}. Los repuestos en dólares ahora se calcularán con este valor.`);
        closeDolarModal();
        if (state.currentQuery) executeSearch(state.currentQuery);
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function handleResetDolar() {
    try {
        const res = await fetch("/api/currency/dolar-blue", {
            method: "POST",
            headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ rate: null })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Error al restablecer. Se requiere inicio de sesión de taller.");
        }
        await loadDolarBlue();
        showToast("Cotización restablecida a la cotización oficial/blue automática en vivo.", "success");
        closeDolarModal();
        if (state.currentQuery) executeSearch(state.currentQuery);
    } catch (err) {
        alert("Error: " + err.message);
    }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgClass = type === "success" 
        ? "border-[#00ff87]/50 bg-[#0a1814] text-[#00ff87]" 
        : type === "error" 
        ? "border-rose-500/50 bg-[#1e0e13] text-rose-300" 
        : "border-cyan-500/50 bg-[#0c1626] text-cyan-300";

    toast.className = `p-3.5 rounded-xl border text-xs font-semibold shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2 ${bgClass}`;
    toast.innerHTML = `
        <span>${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
    });

    setTimeout(() => {
        toast.classList.add("translate-y-2", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// MODAL DE PRESUPUESTADOR RÁPIDO WHATSAPP
// ==========================================
let currentQuoteData = {
    desc: "",
    cost: 0,
    margin: 25,
    labor: 18000,
    device: ""
};

function setupWhatsAppQuoteModal() {
    const modal = document.getElementById("whatsapp-quote-modal");
    if (!modal) return;

    const closeBtn = document.getElementById("close-wa-modal-btn");
    if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

    const costInput = document.getElementById("wa-modal-cost");
    const marginInput = document.getElementById("wa-modal-margin");
    const laborInput = document.getElementById("wa-modal-labor");
    const deviceInput = document.getElementById("wa-modal-device");

    const updateCalculations = () => {
        const cost = parseFloat(costInput.value) || 0;
        const margin = parseFloat(marginInput.value) || 0;
        const labor = parseFloat(laborInput.value) || 0;
        const device = deviceInput.value.trim() || "Dispositivo";

        const subtotal = (cost * (1.0 + (margin / 100.0))) + labor;
        const total = Math.round(subtotal);

        const totalDisp = document.getElementById("wa-modal-total-display");
        if (totalDisp) totalDisp.textContent = formatCurrency(total);

        const previewText = 
            `🛠️ *WILOTECH - Presupuesto Técnico Oficial*\n` +
            `📱 *Equipo:* ${device}\n` +
            `🔧 *Repuesto / Trabajo:* ${currentQuoteData.desc}\n` +
            `💵 *Total Estimado:* ${formatCurrency(total)}\n` +
            `⏱️ *Garantía:* 30 días sobre repuesto y mano de obra.\n` +
            `🔬 *Laboratorio:* Nivel 3 y 4 con instrumental de precisión.`;

        const previewEl = document.getElementById("wa-modal-preview");
        if (previewEl) previewEl.value = previewText;
    };

    [costInput, marginInput, laborInput, deviceInput].forEach(inp => {
        if (inp) inp.addEventListener("input", updateCalculations);
    });

    const copyBtn = document.getElementById("wa-modal-copy-btn");
    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            const previewEl = document.getElementById("wa-modal-preview");
            if (previewEl && previewEl.value) {
                navigator.clipboard.writeText(previewEl.value).then(() => {
                    showToast("Presupuesto copiado al portapapeles", "success");
                }).catch(() => {
                    showToast("No se pudo copiar el texto", "error");
                });
            }
        });
    }

    const sendBtn = document.getElementById("wa-modal-send-btn");
    if (sendBtn) {
        sendBtn.addEventListener("click", () => {
            const previewEl = document.getElementById("wa-modal-preview");
            if (previewEl && previewEl.value) {
                const encoded = encodeURIComponent(previewEl.value);
                window.open(`https://wa.me/?text=${encoded}`, "_blank");
            }
        });
    }
}

function openWhatsAppQuoteModal(desc, price) {
    const modal = document.getElementById("whatsapp-quote-modal");
    if (!modal) return;

    currentQuoteData.desc = desc;
    currentQuoteData.cost = price;

    const descInput = document.getElementById("wa-modal-item-name");
    if (descInput) descInput.value = desc;

    const costInput = document.getElementById("wa-modal-cost");
    if (costInput) costInput.value = Math.round(price);

    const deviceInput = document.getElementById("wa-modal-device");
    if (deviceInput) {
        if (state.currentQuery) {
            deviceInput.value = state.currentQuery;
        } else {
            deviceInput.value = "";
        }
    }

    modal.classList.remove("hidden");

    // Disparar recálculo inicial
    const costEvent = new Event("input");
    if (costInput) costInput.dispatchEvent(costEvent);
}


