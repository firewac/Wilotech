/**
 * LOGICA DEL SECTOR DE GREMIOS - WILOTECH LABORATOIO
 */

let currentGremioUser = null;
let allGremioPriceItems = [];

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  checkGremioSession();
});

// Toast notification helper
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `p-4 rounded-xl shadow-xl border font-tech text-sm flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0 ${
    type === "success"
      ? "bg-emerald-950/90 border-emerald-500 text-emerald-200"
      : type === "error"
      ? "bg-rose-950/90 border-rose-500 text-rose-200"
      : "bg-slate-900/90 border-cyan-500 text-cyan-200"
  }`;

  toast.innerHTML = `
    <i data-lucide="${type === "success" ? "check-circle" : type === "error" ? "alert-triangle" : "info"}" class="w-5 h-5 shrink-0"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 1. SESIÓN, CREDENCIALES Y VISTAS
function getLocalGremioAccounts() {
  try {
    const raw = localStorage.getItem("local_gremio_accounts");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalGremioAccount(user, password) {
  try {
    const accounts = getLocalGremioAccounts();
    const existingIndex = accounts.findIndex(a => a.user.email.toLowerCase() === user.email.toLowerCase());
    const accountData = { user, password, updated_at: new Date().isoformat ? new Date().isoformat() : new Date().toISOString() };
    if (existingIndex >= 0) {
      accounts[existingIndex] = accountData;
    } else {
      accounts.push(accountData);
    }
    localStorage.setItem("local_gremio_accounts", JSON.stringify(accounts));
  } catch (e) {
    console.warn("Could not save local account backup", e);
  }
}

function findLocalGremioAccount(email, password) {
  const accounts = getLocalGremioAccounts();
  return accounts.find(a => a.user.email.toLowerCase() === email.toLowerCase() && a.password === password);
}

function checkGremioSession() {
  // Auto-completar credenciales recordadas si existen
  try {
    const remembered = localStorage.getItem("gremio_remembered_creds");
    if (remembered) {
      const creds = JSON.parse(remembered);
      const emailEl = document.getElementById("login-email");
      const passEl = document.getElementById("login-password");
      const remEl = document.getElementById("login-remember");
      if (emailEl && creds.email) emailEl.value = creds.email;
      if (passEl && creds.password) passEl.value = creds.password;
      if (remEl) remEl.checked = true;
    }
  } catch (e) {}

  const saved = localStorage.getItem("gremio_user");
  if (saved) {
    try {
      currentGremioUser = JSON.parse(saved);
      renderPortalView();
      return;
    } catch (e) {
      localStorage.removeItem("gremio_user");
    }
  }
  renderAuthView();
}

function toggleAuthView(mode) {
  const loginCard = document.getElementById("login-card");
  const registerCard = document.getElementById("register-card");
  if (mode === "register") {
    loginCard.classList.add("hidden");
    registerCard.classList.remove("hidden");
  } else {
    registerCard.classList.add("hidden");
    loginCard.classList.remove("hidden");
  }
}

function renderAuthView() {
  document.getElementById("auth-section").classList.remove("hidden");
  document.getElementById("portal-section").classList.add("hidden");
  document.getElementById("user-header-badge").classList.add("hidden");
}

function renderPortalView() {
  document.getElementById("auth-section").classList.add("hidden");
  document.getElementById("portal-section").classList.remove("hidden");
  
  const headerBadge = document.getElementById("user-header-badge");
  headerBadge.classList.remove("hidden");
  document.getElementById("user-name-span").textContent = currentGremioUser.name;
  
  document.getElementById("portal-user-name").textContent = currentGremioUser.name;
  document.getElementById("portal-user-email").textContent = currentGremioUser.email;

  // Cargar lista de precios inicial
  loadGremioPriceList();
}

function logoutGremio() {
  localStorage.removeItem("gremio_user");
  currentGremioUser = null;
  showToast("Has cerrado la sesión del Sector Gremios", "info");
  renderAuthView();
}

// 2. AUTENTICACIÓN Y REGISTRO PERMANENTE
async function handleGremioLogin(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const remember = document.getElementById("login-remember")?.checked;
  const btn = document.getElementById("btn-login-submit");

  try {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin">⏳</span> Iniciando sesión...`;

    if (remember) {
      localStorage.setItem("gremio_remembered_creds", JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem("gremio_remembered_creds");
    }

    let userLoggedIn = null;

    try {
      const resp = await fetch("/api/gremios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();
      if (resp.ok && data.user) {
        userLoggedIn = data.user;
      }
    } catch (networkErr) {
      console.warn("Backend login failed or offline, checking local backup...", networkErr);
    }

    // Fallback a respaldo local de cuentas si la API falló o el servidor se reinició
    if (!userLoggedIn) {
      const localAccount = findLocalGremioAccount(email, password);
      if (localAccount) {
        userLoggedIn = localAccount.user;
        // Re-sincronizar cuenta silenciosamente con el servidor backend
        fetch("/api/gremios/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: userLoggedIn.name,
            phone: userLoggedIn.phone || "",
            email: userLoggedIn.email,
            password: password
          })
        }).catch(() => {});
      }
    }

    if (!userLoggedIn) {
      throw new Error("Correo electrónico o contraseña incorrectos. Si no tenés cuenta, registrate haciendo clic abajo.");
    }

    currentGremioUser = userLoggedIn;
    saveLocalGremioAccount(userLoggedIn, password);
    localStorage.setItem("gremio_user", JSON.stringify(userLoggedIn));
    showToast(`Bienvenido/a ${userLoggedIn.name}`, "success");
    renderPortalView();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>INGRESAR AL SECTOR GREMIOS</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

async function handleGremioRegister(event) {
  event.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value.trim();
  const btn = document.getElementById("btn-reg-submit");

  try {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin">⏳</span> Creando cuenta...`;

    let newUser = null;

    try {
      const resp = await fetch("/api/gremios/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password })
      });

      const data = await resp.json();
      if (resp.ok && data.user) {
        newUser = data.user;
      } else if (data.detail && data.detail.includes("ya se encuentra registrado")) {
        throw new Error(data.detail);
      }
    } catch (err) {
      if (err.message && err.message.includes("ya se encuentra registrado")) {
        throw err;
      }
      console.warn("Backend registration offline, creating local profile...", err);
    }

    if (!newUser) {
      newUser = {
        id: Date.now(),
        name: name,
        email: email,
        phone: phone,
        status: "active",
        created_at: new Date().toISOString()
      };
    }

    currentGremioUser = newUser;
    saveLocalGremioAccount(newUser, password);
    localStorage.setItem("gremio_user", JSON.stringify(newUser));
    localStorage.setItem("gremio_remembered_creds", JSON.stringify({ email, password }));

    showToast("Cuenta de gremio registrada e iniciada con éxito", "success");
    renderPortalView();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>CREAR MI CUENTA DE GREMIO</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

// 3. CAMBIO DE PESTAÑAS EN PORTAL
function switchGremioTab(tabName) {
  document.querySelectorAll(".gremio-tab-btn").forEach(btn => {
    btn.classList.remove("border-[#00f5a0]", "text-[#00f5a0]");
    btn.classList.add("border-transparent", "text-slate-400");
  });

  document.querySelectorAll(".gremio-pane").forEach(pane => {
    pane.classList.add("hidden");
  });

  const activeBtn = document.getElementById(`gremio-tab-btn-${tabName}`);
  const activePane = document.getElementById(`gremio-pane-${tabName}`);
  
  if (activeBtn) {
    activeBtn.classList.remove("border-transparent", "text-slate-400");
    activeBtn.classList.add("border-[#00f5a0]", "text-[#00f5a0]");
  }
  if (activePane) {
    activePane.classList.remove("hidden");
  }

  if (tabName === "pricelist" && allGremioPriceItems.length === 0) {
    loadGremioPriceList();
  }
}

// 4. TAB 1: BUSCADOR DE ÓRDENES
async function searchGremioOrder(event) {
  if (event) event.preventDefault();
  const query = document.getElementById("gremio-order-query").value.trim();
  const container = document.getElementById("gremio-orders-results");

  if (!query) return;

  container.innerHTML = `
    <div class="text-center py-8">
      <div class="inline-block animate-spin text-[#00f5a0] text-3xl mb-2">⏳</div>
      <p class="text-xs text-slate-400 font-brand">BUSCANDO ÓRDENES DE SERVICIO...</p>
    </div>
  `;

  try {
    const resp = await fetch(`/api/tickets?q=${encodeURIComponent(query)}`);
    const tickets = await resp.json();

    if (!Array.isArray(tickets) || tickets.length === 0) {
      container.innerHTML = `
        <div class="glass-panel p-6 text-center rounded-2xl border border-rose-500/30 bg-rose-950/10">
          <i data-lucide="alert-circle" class="w-8 h-8 text-rose-400 mx-auto mb-2"></i>
          <p class="font-brand font-bold text-sm text-rose-300">No se encontraron órdenes coincidentes.</p>
          <p class="text-xs text-slate-400 mt-1">Verificá que el número de orden, DNI o teléfono ingresado sea el correcto.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = tickets.map(t => renderOrderCard(t)).join("");
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `
      <div class="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs text-center">
        Error al consultar las órdenes: ${err.message}
      </div>
    `;
  }
}

function renderOrderCard(t) {
  const statusColor = t.status === "Entregado" ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/40"
    : t.status === "Listo" ? "text-[#00f5a0] border-[#00f5a0]/40 bg-[#00f5a0]/10"
    : t.status === "En Proceso" ? "text-amber-400 border-amber-500/40 bg-amber-950/40"
    : "text-cyan-400 border-cyan-500/40 bg-cyan-950/40";

  return `
    <div class="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#05070d]/90 space-y-4 shadow-xl hover:border-[#00f5a0]/40 transition-all">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <span class="font-brand text-base font-black text-white bg-[#0a101c] px-3 py-1 rounded-xl border border-slate-700">
            #${t.id}
          </span>
          <div>
            <h4 class="font-brand font-bold text-sm text-white">${t.device_brand || ''} ${t.device_model || 'Equipo Técnico'}</h4>
            <p class="text-xs text-slate-400">Cliente: ${t.client_name || 'Gremio'} ${t.client_phone ? `(${t.client_phone})` : ''}</p>
          </div>
        </div>

        <span class="py-1 px-3 rounded-full border text-xs font-brand font-bold ${statusColor}">
          ${t.status || 'Ingresado'}
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div class="bg-[#0a101c] p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block text-[10px] uppercase font-brand">Problema Declarado</span>
          <span class="text-slate-200 font-semibold">${t.issue_description || 'Sin especificar'}</span>
        </div>
        <div class="bg-[#0a101c] p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block text-[10px] uppercase font-brand">Informe / Nota Técnica</span>
          <span class="text-slate-200 font-semibold">${t.technician_notes || 'En diagnóstico preliminar'}</span>
        </div>
        <div class="bg-[#0a101c] p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block text-[10px] uppercase font-brand">Presupuesto Final</span>
          <span class="text-[#00f5a0] font-brand font-bold text-sm">$${(t.final_cost || 0).toLocaleString("es-AR")}</span>
        </div>
      </div>
    </div>
  `;
}

// 5. TAB 2: COMPARADOR DE PRECIOS
async function searchGremioParts(event) {
  if (event) event.preventDefault();
  const query = document.getElementById("gremio-part-query").value.trim();
  const container = document.getElementById("gremio-comparator-results");

  if (!query) return;

  container.innerHTML = `
    <div class="text-center py-8">
      <div class="inline-block animate-spin text-[#00d2ff] text-3xl mb-2">⏳</div>
      <p class="text-xs text-slate-400 font-brand">BUSCANDO EN DISTRIBUIDORAS Y CATÁLOGOS...</p>
    </div>
  `;

  try {
    const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await resp.json();

    if (!data.results || data.results.length === 0) {
      container.innerHTML = `
        <div class="glass-panel p-6 text-center rounded-2xl border border-amber-500/30 bg-amber-950/10">
          <i data-lucide="alert-triangle" class="w-8 h-8 text-amber-400 mx-auto mb-2"></i>
          <p class="font-brand font-bold text-sm text-amber-300">No se encontraron resultados para "${query}".</p>
          <p class="text-xs text-slate-400 mt-1">Intentá buscar con otros términos como SKU, modelo o marca.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="flex items-center justify-between text-xs font-brand text-slate-400 mb-2">
        <span>${data.results.length} resultados encontrados</span>
        ${data.dolar_blue_rate ? `<span class="text-[#00f5a0]">Cotización Dólar Blue: $${data.dolar_blue_rate}</span>` : ''}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${data.results.map(p => renderPartCard(p)).join("")}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `
      <div class="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs text-center">
        Error al buscar repuestos: ${err.message}
      </div>
    `;
  }
}

function renderPartCard(p) {
  return `
    <div class="glass-panel p-4 rounded-xl border ${p.is_best_price ? 'border-[#00f5a0] bg-[#00f5a0]/5 shadow-lg shadow-[#00f5a0]/10' : 'border-slate-800 bg-[#05070d]/90'} space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div>
          <span class="text-[10px] font-brand font-bold uppercase tracking-wider text-[#00d2ff] bg-[#00d2ff]/10 px-2 py-0.5 rounded border border-[#00d2ff]/30">
            ${p.distributor_name}
          </span>
          <h4 class="font-brand text-sm font-bold text-white mt-1.5">${p.description}</h4>
          <p class="text-xs text-slate-400">SKU: ${p.sku || 'N/D'} • Marca: ${p.brand || 'Genérico'}</p>
        </div>
        ${p.is_best_price ? `
          <span class="shrink-0 py-0.5 px-2 bg-[#00f5a0] text-slate-950 text-[10px] font-brand font-black uppercase rounded shadow">
            MEJOR PRECIO
          </span>
        ` : ''}
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-800">
        <div>
          <span class="text-xs text-slate-400 block">Stock: <strong class="${p.has_stock ? 'text-emerald-400' : 'text-rose-400'}">${p.stock}</strong></span>
        </div>
        <div class="text-right">
          <span class="font-brand text-lg font-black text-[#00f5a0]">$${p.price.toLocaleString("es-AR")}</span>
          <span class="text-[10px] text-slate-400 block">${p.currency}</span>
        </div>
      </div>
    </div>
  `;
}

// 6. TAB 3: LISTA DE PRECIOS & BUSCADOR TIPO iLAB GREMIO
let currentIlabCat = "placa";
let currentIlabCurrency = "usd";
let currentIlabViewType = "gremio"; // "gremio" vs "retail"
let isIlabEditMode = false;
let selectedBulkItemIds = new Set();
let ilabBlueRate = 1555;
let ilabBlueRateTime = null;

function setIlabViewType(type) {
  currentIlabViewType = type;
  const btnGremio = document.getElementById("btnViewGremio");
  const btnRetail = document.getElementById("btnViewRetail");
  if (btnGremio && btnRetail) {
    if (type === "gremio") {
      btnGremio.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/40 shadow-sm";
      btnRetail.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all border border-slate-700 text-slate-400 hover:text-white";
    } else {
      btnRetail.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40 shadow-sm";
      btnGremio.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all border border-slate-700 text-slate-400 hover:text-white";
    }
  }
  renderIlabPriceList();
}

function toggleIlabEditMode(forceState) {
  isIlabEditMode = typeof forceState === "boolean" ? forceState : !isIlabEditMode;
  
  const banner = document.getElementById("edit-mode-banner");
  const txtBtn = document.getElementById("txt-edit-mode");
  const btnToggle = document.getElementById("btn-toggle-edit-mode");

  if (banner) {
    if (isIlabEditMode) {
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  if (txtBtn) {
    txtBtn.textContent = isIlabEditMode ? "✓ MODO CONSULTA" : "✎ EDITAR PRECIOS";
  }

  if (btnToggle) {
    if (isIlabEditMode) {
      btnToggle.className = "py-2 px-3.5 rounded-xl border border-[#00f5a0] bg-[#00f5a0] text-slate-950 font-brand font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-[#00f5a0]/20";
    } else {
      btnToggle.className = "py-2 px-3.5 rounded-xl border border-[#00f5a0]/40 bg-[#00f5a0]/10 hover:bg-[#00f5a0] text-[#00f5a0] hover:text-slate-950 font-brand font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md";
    }
  }

  renderIlabPriceList();
}

async function loadGremioPriceList() {
  const container = document.getElementById("ilab-results-container");
  if (container) {
    container.innerHTML = `<div class="py-12 text-center text-slate-400 text-xs">Cargando tarifario oficial de gremios...</div>`;
  }

  try {
    const resp = await fetch("/api/gremios/price-list");
    const items = await resp.json();
    allGremioPriceItems = Array.isArray(items) ? items : [];

    await loadIlabBlueRate();
    renderIlabPriceList();
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="py-12 text-center text-rose-400 text-xs">Error al cargar la lista: ${err.message}</div>`;
    }
  }
}

async function loadIlabBlueRate() {
  try {
    const res = await fetch("https://dolarapi.com/v1/ambito/dolares/blue");
    if (!res.ok) throw new Error("error dapi");
    const data = await res.json();
    ilabBlueRate = data.venta || 1555;
    ilabBlueRateTime = new Date();
    updateIlabCotizInfo();
  } catch (e) {
    ilabBlueRate = 1555;
    updateIlabCotizInfo(true);
  }
}

function updateIlabCotizInfo(isCached = false) {
  const cotizEl = document.getElementById("cotizInfo");
  if (!cotizEl) return;
  const hora = ilabBlueRateTime ? ilabBlueRateTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "guardada";
  const tag = isCached ? " (ref. offline)" : "";
  cotizEl.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
    <span>Dólar blue (Ámbito): $${ilabBlueRate.toLocaleString("es-AR")}${tag} · ${hora}</span>
  `;
}

function setIlabCurrency(currency) {
  currentIlabCurrency = currency;
  const btnUsd = document.getElementById("btnUsd");
  const btnArs = document.getElementById("btnArs");

  if (currency === "usd") {
    btnUsd.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all bg-[#00f5a0] text-slate-950 shadow-md";
    btnArs.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all border border-slate-700 text-slate-300 hover:text-white";
  } else {
    btnArs.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all bg-[#00f5a0] text-slate-950 shadow-md";
    btnUsd.className = "py-1.5 px-3.5 rounded-xl text-xs font-brand font-bold transition-all border border-slate-700 text-slate-300 hover:text-white";
  }

  renderIlabPriceList();
}

function setIlabCategory(catKey) {
  currentIlabCat = catKey;
  const buttons = document.querySelectorAll("#ilabCategoryTabs .ilab-tab");
  buttons.forEach(btn => {
    if (btn.dataset.cat === catKey) {
      btn.className = "ilab-tab py-2 px-4 rounded-xl text-xs font-brand font-bold border transition-all flex items-center gap-2 bg-[#00f5a0] text-slate-950 border-[#00f5a0] shadow-md shadow-[#00f5a0]/10";
    } else {
      btn.className = "ilab-tab py-2 px-4 rounded-xl text-xs font-brand font-bold border transition-all flex items-center gap-2 bg-[#0a101c] text-slate-300 border-slate-800 hover:border-slate-700";
    }
  });

  const subText = document.getElementById("subTextIlab");
  const statCat = document.getElementById("statCat");
  const descriptions = {
    placa: "reparación de placa y microelectrónica",
    bateria: "reemplazo de batería",
    tapa: "reemplazo de tapa trasera / cristal",
    pantalla: "reemplazo de pantalla / módulos",
    todas: "tarifario general de mano de obra y servicios"
  };
  const labels = {
    placa: "Placa",
    bateria: "Batería",
    tapa: "Tapa trasera",
    pantalla: "Pantalla",
    todas: "Ver Todo"
  };

  if (subText) subText.textContent = `Buscá por modelo y encontrá rápidamente el valor de ${descriptions[catKey] || 'servicio'}.`;
  if (statCat) statCat.textContent = labels[catKey] || 'General';

  renderIlabPriceList();
}

function renderIlabPriceList() {
  const container = document.getElementById("ilab-results-container");
  const searchInput = document.getElementById("gremio-pricelist-search");
  const statCount = document.getElementById("statCount");
  if (!container) return;

  const query = (searchInput ? searchInput.value : "").trim().toLowerCase();

  const filtered = allGremioPriceItems.filter(item => {
    const title = (item.title || "").toLowerCase();
    const code = (item.code || "").toLowerCase();
    const cat = (item.category || "").toLowerCase();

    let matchCat = true;
    if (currentIlabCat === "placa") {
      matchCat = cat.includes("laboratorio") || title.includes("placa") || title.includes("reballing") || code.includes("plc");
    } else if (currentIlabCat === "bateria") {
      matchCat = cat.includes("batería") || cat.includes("bateria") || title.includes("batería") || title.includes("bateria") || code.includes("bat");
    } else if (currentIlabCat === "tapa") {
      matchCat = cat.includes("glass") || title.includes("tapa") || title.includes("cristal") || code.includes("tap");
    } else if (currentIlabCat === "pantalla") {
      matchCat = cat.includes("módu") || cat.includes("pantalla") || title.includes("módulo") || title.includes("pantalla") || code.includes("mod") || code.includes("scr");
    }

    let matchQ = !query || title.includes(query) || code.includes(query);
    return matchCat && matchQ;
  });

  if (statCount) statCount.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-500 text-xs bg-[#0a101c]/50 rounded-2xl border border-dashed border-slate-800">
        Sin resultados con los criterios seleccionados.
      </div>
    `;
    return;
  }

  // SI ESTAMOS EN MODO EDICIÓN -> RENDERIZAR TABLA DE EDICIÓN INLINE COMPLETA
  if (isIlabEditMode) {
    let rowsHtml = filtered.map(item => {
      const isChecked = selectedBulkItemIds.has(item.id);
      const gremioUsdVal = item.price_gremio_usd || (ilabBlueRate > 0 ? (item.price_gremio / ilabBlueRate) : 0);
      const retailUsdVal = item.price_retail_usd || (ilabBlueRate > 0 ? (item.price_retail / ilabBlueRate) : (gremioUsdVal * 1.5));

      return `
        <div class="p-3 bg-[#0a101c] border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:border-[#00f5a0]/40 transition-all" id="edit-row-${item.id}">
          <div class="flex items-center gap-3 flex-1 w-full">
            <input type="checkbox" onchange="toggleSelectItem(${item.id}, this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 accent-[#00f5a0] rounded border-slate-700">
            <div class="flex-1 space-y-1">
              <input type="text" id="inline-title-${item.id}" value="${item.title.replace(/"/g, '&quot;')}" class="w-full bg-[#05070d] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-brand font-bold focus:border-[#00f5a0]">
              <div class="flex items-center gap-2">
                <select id="inline-cat-${item.id}" class="bg-[#05070d] border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300">
                  <option value="Placa / Laboratorio" ${item.category.includes("Placa") || item.category.includes("Laboratorio") ? "selected" : ""}>Placa / Lab</option>
                  <option value="Baterías" ${item.category.includes("Baterí") ? "selected" : ""}>Baterías</option>
                  <option value="Glass & Refurbish" ${item.category.includes("Glass") || item.category.includes("Tapa") ? "selected" : ""}>Glass & Refurbish</option>
                  <option value="Módulos & Pantallas" ${item.category.includes("Módulos") || item.category.includes("Pantalla") ? "selected" : ""}>Módulos</option>
                  <option value="General" ${!item.category || item.category === "General" ? "selected" : ""}>General</option>
                </select>
                <span class="text-[10px] text-slate-400 font-mono">${item.code || ''}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <!-- INPUT PRECIO PÚBLICO USD -->
            <div class="flex flex-col items-end">
              <span class="text-[9px] font-brand font-bold text-[#00d2ff] uppercase">Público (USD)</span>
              <div class="relative w-24">
                <span class="absolute left-2 top-1 text-[10px] text-slate-400 font-bold">$</span>
                <input type="number" step="0.5" id="inline-retail-usd-${item.id}" value="${retailUsdVal.toFixed(2)}" class="w-full pl-5 pr-1 py-1 bg-[#05070d] border border-slate-700 rounded-lg text-xs text-white font-brand font-bold text-right focus:border-[#00d2ff]">
              </div>
            </div>

            <!-- INPUT PRECIO GREMIO USD -->
            <div class="flex flex-col items-end">
              <span class="text-[9px] font-brand font-bold text-[#00f5a0] uppercase">Gremio (USD)</span>
              <div class="relative w-24">
                <span class="absolute left-2 top-1 text-[10px] text-slate-400 font-bold">$</span>
                <input type="number" step="0.5" id="inline-gremio-usd-${item.id}" value="${gremioUsdVal.toFixed(2)}" class="w-full pl-5 pr-1 py-1 bg-[#05070d] border border-slate-700 rounded-lg text-white font-brand font-bold text-right focus:border-[#00f5a0]">
              </div>
            </div>

            <!-- BOTÓN GUARDAR FILA -->
            <button onclick="saveInlinePriceRow(${item.id})" title="Guardar cambios de esta fila" class="py-1.5 px-2.5 rounded-xl bg-[#00f5a0]/10 hover:bg-[#00f5a0] text-[#00f5a0] hover:text-slate-950 border border-[#00f5a0]/40 font-brand font-bold text-xs transition-all flex items-center gap-1">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between px-2 text-[11px] font-brand font-bold text-slate-400 border-b border-slate-800 pb-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" onchange="toggleSelectAllItems(this.checked)" class="w-3.5 h-3.5 accent-[#00f5a0]">
            <span>Seleccionar Todos (${filtered.length})</span>
          </label>
          <span>Edición Directa por Fila</span>
        </div>
        ${rowsHtml}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // MODO CONSULTA NORMAL (CLEAN SEARCH VIEW)
  container.innerHTML = filtered.map(item => {
    const isRetail = currentIlabViewType === "retail";
    const rawPriceArs = isRetail ? (item.price_retail || (item.price_gremio * 1.6)) : (item.price_gremio || 0);
    const isUsd = currentIlabCurrency === "usd";
    const priceRounded = isUsd
      ? Math.ceil(rawPriceArs / ilabBlueRate)
      : Math.ceil(rawPriceArs);

    const priceText = isUsd
      ? `USD ${priceRounded}`
      : `$ ${priceRounded.toLocaleString("es-AR")}`;

    const titleLower = item.title.toLowerCase();
    const isIcChange = titleLower.includes("ic") || titleLower.includes("chip") || titleLower.includes("trasplante");

    let modelName = item.title.replace(/^Mano de Obra:\s*/i, "").replace(/\(iLab\)/i, "").trim();
    let detailTag = item.category || "General";
    let typeTag = isRetail ? `<span class="text-[10px] px-1.5 py-0.2 rounded bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/30 font-bold">Público</span>` : `<span class="text-[10px] px-1.5 py-0.2 rounded bg-[#00f5a0]/10 text-[#00f5a0] border border-[#00f5a0]/30 font-bold">Gremio</span>`;

    return `
      <div class="flex items-center justify-between p-3.5 bg-[#0a101c] border border-slate-800 rounded-2xl hover:border-[#00f5a0]/50 transition-all group">
        <div class="flex items-center gap-2.5">
          <div class="w-2 h-2 rounded-full ${isRetail ? 'bg-[#00d2ff]' : 'bg-[#00f5a0]'}"></div>
          <div class="flex flex-col">
            <span class="font-brand font-bold text-sm text-white">${modelName}</span>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-[11px] text-slate-400 font-medium">${detailTag}</span>
              ${typeTag}
              ${isIcChange ? `<span class="text-[10px] font-mono text-amber-400 italic">✓ Con cambio de IC</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="font-brand font-black text-base ${isRetail ? 'text-[#00d2ff]' : 'text-[#00f5a0]'} tabular-nums cursor-pointer" onclick="openGremioPriceModalEdit(${item.id})" title="Click para editar">${priceText}</span>
          <button onclick="openGremioPriceModalEdit(${item.id})" title="Editar Servicio" class="p-1.5 rounded-xl bg-slate-800/80 hover:bg-[#00f5a0] hover:text-slate-950 border border-slate-700 hover:border-[#00f5a0] text-slate-400 hover:text-white transition-all flex items-center justify-center">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

function exportGremioPriceListExcel() {
  if (!allGremioPriceItems || allGremioPriceItems.length === 0) {
    showToast("No hay ítems para exportar", "error");
    return;
  }

  try {
    const exportData = allGremioPriceItems.map(item => ({
      "Código": item.code || "",
      "Servicio / Mano de Obra": item.title || "",
      "Categoría": item.category || "General",
      "Marca": item.brand || "",
      "Precio Mano de Obra Gremio ($)": item.price_gremio || 0,
      "Precio Público Sugerido ($)": item.price_retail || 0,
      "Estado / Disponibilidad": item.stock || "Disponible"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tarifario Oficial WILOTECH");

    XLSX.writeFile(workbook, `Tarifario_Oficial_WILOTECH.xlsx`);
    showToast("Planilla Excel exportada con éxito", "success");
  } catch (err) {
    showToast(`Error al exportar: ${err.message}`, "error");
  }
}

// ==========================================
// FUNCIONES DE EDICIÓN Y GESTIÓN DE PRECIOS
// ==========================================

let currentEditingGremioItemId = null;

function openGremioPriceModalNew() {
  currentEditingGremioItemId = null;
  document.getElementById("modalGremioPriceTitle").innerHTML = `
    <i data-lucide="plus-circle" class="w-5 h-5 text-[#00f5a0]"></i>
    <span>Agregar Nuevo Servicio / Reparación</span>
  `;
  document.getElementById("edit-item-id").value = "";
  document.getElementById("edit-item-title").value = "";
  document.getElementById("edit-item-category").value = "Placa / Laboratorio";
  document.getElementById("edit-item-pricetype").value = "usd_to_ars";
  document.getElementById("edit-item-code").value = "";
  document.getElementById("edit-item-usd").value = "";
  document.getElementById("edit-item-ars").value = "";
  document.getElementById("edit-retail-usd").value = "";
  document.getElementById("edit-retail-ars").value = "";

  const btnDelete = document.getElementById("btn-delete-gremio-item");
  if (btnDelete) btnDelete.classList.add("hidden");

  const rateLabel = document.getElementById("modalUsdRateLabel");
  if (rateLabel) rateLabel.textContent = `$${ilabBlueRate.toLocaleString("es-AR")}`;

  const modal = document.getElementById("modalGremioPriceEdit");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function openGremioPriceModalEdit(itemId) {
  const item = allGremioPriceItems.find(it => String(it.id) === String(itemId));
  if (!item) {
    showToast("No se encontró el ítem seleccionado", "error");
    return;
  }

  currentEditingGremioItemId = item.id;
  document.getElementById("modalGremioPriceTitle").innerHTML = `
    <i data-lucide="edit-3" class="w-5 h-5 text-[#00f5a0]"></i>
    <span>Editar Precio de Servicio</span>
  `;
  document.getElementById("edit-item-id").value = item.id;
  document.getElementById("edit-item-title").value = item.title || "";
  document.getElementById("edit-item-category").value = item.category || "General";
  document.getElementById("edit-item-pricetype").value = item.price_type || "usd_to_ars";
  document.getElementById("edit-item-code").value = item.code || "";

  const priceArs = item.price_gremio || 0;
  const priceUsd = item.price_gremio_usd || (ilabBlueRate > 0 ? (priceArs / ilabBlueRate) : 0);

  const retailArs = item.price_retail || (priceArs * 1.6);
  const retailUsd = item.price_retail_usd || (ilabBlueRate > 0 ? (retailArs / ilabBlueRate) : (priceUsd * 1.5));

  document.getElementById("edit-item-ars").value = Math.round(priceArs);
  document.getElementById("edit-item-usd").value = priceUsd > 0 ? priceUsd.toFixed(2) : "";

  document.getElementById("edit-retail-ars").value = Math.round(retailArs);
  document.getElementById("edit-retail-usd").value = retailUsd > 0 ? retailUsd.toFixed(2) : "";

  const btnDelete = document.getElementById("btn-delete-gremio-item");
  if (btnDelete) btnDelete.classList.remove("hidden");

  const rateLabel = document.getElementById("modalUsdRateLabel");
  if (rateLabel) rateLabel.textContent = `$${ilabBlueRate.toLocaleString("es-AR")}`;

  const modal = document.getElementById("modalGremioPriceEdit");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeGremioPriceModal() {
  const modal = document.getElementById("modalGremioPriceEdit");
  if (modal) modal.classList.add("hidden");
}

function syncGremioPriceFromUsd() {
  const usdVal = parseFloat(document.getElementById("edit-item-usd").value) || 0;
  const arsVal = Math.round(usdVal * ilabBlueRate);
  document.getElementById("edit-item-ars").value = arsVal > 0 ? arsVal : "";
}

function syncGremioPriceFromArs() {
  const arsVal = parseFloat(document.getElementById("edit-item-ars").value) || 0;
  const usdVal = ilabBlueRate > 0 ? (arsVal / ilabBlueRate).toFixed(2) : 0;
  document.getElementById("edit-item-usd").value = usdVal > 0 ? usdVal : "";
}

function syncRetailFromUsd() {
  const usdVal = parseFloat(document.getElementById("edit-retail-usd").value) || 0;
  const arsVal = Math.round(usdVal * ilabBlueRate);
  document.getElementById("edit-retail-ars").value = arsVal > 0 ? arsVal : "";
}

function syncRetailFromArs() {
  const arsVal = parseFloat(document.getElementById("edit-retail-ars").value) || 0;
  const usdVal = ilabBlueRate > 0 ? (arsVal / ilabBlueRate).toFixed(2) : 0;
  document.getElementById("edit-retail-usd").value = usdVal > 0 ? usdVal : "";
}

async function saveGremioPriceForm(event) {
  event.preventDefault();
  const idVal = document.getElementById("edit-item-id").value;
  const title = document.getElementById("edit-item-title").value.trim();
  const category = document.getElementById("edit-item-category").value;
  const priceType = document.getElementById("edit-item-pricetype").value;
  const code = document.getElementById("edit-item-code").value.trim();

  const gremioUsd = parseFloat(document.getElementById("edit-item-usd").value) || 0;
  const gremioArs = parseFloat(document.getElementById("edit-item-ars").value) || Math.round(gremioUsd * ilabBlueRate);

  const retailUsd = parseFloat(document.getElementById("edit-retail-usd").value) || (gremioUsd * 1.5);
  const retailArs = parseFloat(document.getElementById("edit-retail-ars").value) || Math.round(retailUsd * ilabBlueRate);

  if (!title) {
    showToast("Ingresá un título para el servicio", "error");
    return;
  }

  if (gremioArs <= 0 && gremioUsd <= 0) {
    showToast("Ingresá un precio válido mayor a 0", "error");
    return;
  }

  const payload = {
    title: title,
    category: category,
    price_type: priceType,
    code: code,
    price_gremio: gremioArs,
    price_retail: retailArs,
    price_gremio_usd: gremioUsd,
    price_retail_usd: retailUsd,
    usd_rate: ilabBlueRate,
    brand: "Apple",
    stock: "Disponible"
  };

  if (idVal) {
    payload.id = parseInt(idVal);
  }

  try {
    const endpoint = idVal ? `/api/gremios/price-list/${idVal}` : "/api/gremios/price-list";
    const method = idVal ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al guardar el precio");
    }

    const data = await res.json();
    const savedItem = data.item || payload;

    if (idVal) {
      const idx = allGremioPriceItems.findIndex(it => String(it.id) === String(idVal));
      if (idx >= 0) {
        allGremioPriceItems[idx] = savedItem;
      }
    } else {
      allGremioPriceItems.unshift(savedItem);
    }

    closeGremioPriceModal();
    renderIlabPriceList();
    showToast(`Servicio '${title}' guardado correctamente`, "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

async function deleteGremioPriceItemCurrent() {
  if (!currentEditingGremioItemId) return;
  if (!confirm("¿Estás seguro de que deseas eliminar este precio de la lista de gremios?")) return;

  try {
    const res = await fetch(`/api/gremios/price-list/${currentEditingGremioItemId}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      throw new Error("No se pudo eliminar el ítem");
    }

    allGremioPriceItems = allGremioPriceItems.filter(it => String(it.id) !== String(currentEditingGremioItemId));
    closeGremioPriceModal();
    renderIlabPriceList();
    showToast("Precio eliminado con éxito", "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

async function saveInlinePriceRow(itemId) {
  const titleEl = document.getElementById(`inline-title-${itemId}`);
  const catEl = document.getElementById(`inline-cat-${itemId}`);
  const retailUsdEl = document.getElementById(`inline-retail-usd-${itemId}`);
  const gremioUsdEl = document.getElementById(`inline-gremio-usd-${itemId}`);

  if (!titleEl || !gremioUsdEl) return;

  const title = titleEl.value.trim();
  const category = catEl ? catEl.value : "General";
  const retailUsd = parseFloat(retailUsdEl ? retailUsdEl.value : 0) || 0;
  const gremioUsd = parseFloat(gremioUsdEl.value) || 0;

  if (!title || gremioUsd <= 0) {
    showToast("Título y precio en USD deben ser válidos", "error");
    return;
  }

  const priceGremioArs = Math.round(gremioUsd * ilabBlueRate);
  const priceRetailArs = Math.round(retailUsd * ilabBlueRate);

  const payload = {
    id: parseInt(itemId),
    title: title,
    category: category,
    price_gremio: priceGremioArs,
    price_retail: priceRetailArs,
    price_gremio_usd: gremioUsd,
    price_retail_usd: retailUsd,
    price_type: "usd_to_ars",
    usd_rate: ilabBlueRate,
    brand: "Apple",
    stock: "Disponible"
  };

  try {
    const res = await fetch(`/api/gremios/price-list/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Error al guardar fila");

    const data = await res.json();
    const savedItem = data.item || payload;

    const idx = allGremioPriceItems.findIndex(it => String(it.id) === String(itemId));
    if (idx >= 0) allGremioPriceItems[idx] = savedItem;

    showToast(`Precio '${title}' actualizado ($${gremioUsd} USD)`, "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

async function saveAllInlinePrices() {
  const rows = document.querySelectorAll("[id^='inline-title-']");
  if (rows.length === 0) {
    showToast("No hay filas visibles para guardar", "info");
    return;
  }

  let count = 0;
  for (const titleEl of rows) {
    const itemId = titleEl.id.replace("inline-title-", "");
    await saveInlinePriceRow(itemId);
    count++;
  }

  showToast(`Se guardaron ${count} precios modificados`, "success");
  toggleIlabEditMode(false);
}

function toggleSelectItem(itemId, isChecked) {
  if (isChecked) {
    selectedBulkItemIds.add(itemId);
  } else {
    selectedBulkItemIds.delete(itemId);
  }
}

function toggleSelectAllItems(isChecked) {
  selectedBulkItemIds.clear();
  if (isChecked) {
    allGremioPriceItems.forEach(it => selectedBulkItemIds.add(it.id));
  }
  renderIlabPriceList();
}

function openBulkUpdateModal() {
  const countLabel = document.getElementById("bulkCountLabel");
  const numSelected = selectedBulkItemIds.size > 0 ? selectedBulkItemIds.size : allGremioPriceItems.length;
  const isAll = selectedBulkItemIds.size === 0;

  if (countLabel) {
    countLabel.textContent = `${numSelected} ítems ${isAll ? '(Todos)' : '(Seleccionados)'}`;
  }

  const modal = document.getElementById("modalGremioBulkUpdate");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeBulkModal() {
  const modal = document.getElementById("modalGremioBulkUpdate");
  if (modal) modal.classList.add("hidden");
}

async function applyBulkPreset(actionType, amount) {
  const targetIds = selectedBulkItemIds.size > 0 ? Array.from(selectedBulkItemIds) : allGremioPriceItems.map(it => it.id);
  
  if (targetIds.length === 0) {
    showToast("No hay ítems para modificar", "error");
    return;
  }

  const labels = {
    percent_add: `+${amount}%`,
    percent_sub: `-${amount}%`,
    amount_add: `+$${amount} USD`,
    amount_sub: `-$${amount} USD`
  };

  if (!confirm(`¿Confirmar ajuste de ${labels[actionType]} a ${targetIds.length} precios de servicios?`)) {
    return;
  }

  try {
    const res = await fetch("/api/gremios/price-list/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_ids: targetIds,
        action_type: actionType,
        amount: amount,
        usd_rate: ilabBlueRate,
        changed_by: currentGremioUser ? currentGremioUser.name : "Administrador"
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al aplicar edición masiva");
    }

    const data = await res.json();
    showToast(`✓ Modificados ${data.updated_count} precios exitosamente`, "success");
    closeBulkModal();
    selectedBulkItemIds.clear();
    await loadGremioPriceList();
  } catch (e) {
    showToast(`Error: ${e.message}`, "error");
  }
}

async function openPriceHistoryModal() {
  const container = document.getElementById("history-list-container");
  const modal = document.getElementById("modalGremioHistory");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();

  if (!container) return;
  container.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs font-mono">Cargando historial comercial...</div>`;

  try {
    const res = await fetch("/api/gremios/price-list/history");
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `<div class="py-8 text-center text-slate-500 text-xs">Sin registros recientes de cambio de precio.</div>`;
      return;
    }

    container.innerHTML = items.map(h => {
      const fecha = h.created_at ? new Date(h.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
      return `
        <div class="p-3 bg-[#0a101c] border border-slate-800 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span class="font-brand font-bold text-white block">${h.item_title || 'Servicio'}</span>
            <span class="text-[10px] text-slate-400">${fecha} · por: <b class="text-[#00d2ff]">${h.changed_by || 'Admin'}</b></span>
          </div>
          <div class="text-right font-brand font-bold">
            <div class="text-[#00f5a0]">Gremio: USD ${h.old_price_gremio_usd || 0} → USD ${h.new_price_gremio_usd || 0}</div>
            <div class="text-[#00d2ff] text-[11px]">Público: USD ${h.old_price_retail_usd || 0} → USD ${h.new_price_retail_usd || 0}</div>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    container.innerHTML = `<div class="py-8 text-center text-rose-400 text-xs">Error al obtener historial: ${e.message}</div>`;
  }
}

function closeHistoryModal() {
  const modal = document.getElementById("modalGremioHistory");
  if (modal) modal.classList.add("hidden");
}
