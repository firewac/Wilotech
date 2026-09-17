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
let ilabBlueRate = 1300;
let ilabBlueRateTime = null;

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
    ilabBlueRate = data.venta || 1300;
    ilabBlueRateTime = new Date();
    updateIlabCotizInfo();
  } catch (e) {
    ilabBlueRate = 1300;
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
    btnUsd.className = "py-1.5 px-4 rounded-xl text-xs font-brand font-bold transition-all bg-[#00f5a0] text-slate-950 shadow-md";
    btnArs.className = "py-1.5 px-4 rounded-xl text-xs font-brand font-bold transition-all border border-slate-700 text-slate-300 hover:text-white";
  } else {
    btnArs.className = "py-1.5 px-4 rounded-xl text-xs font-brand font-bold transition-all bg-[#00f5a0] text-slate-950 shadow-md";
    btnUsd.className = "py-1.5 px-4 rounded-xl text-xs font-brand font-bold transition-all border border-slate-700 text-slate-300 hover:text-white";
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

  container.innerHTML = filtered.map(item => {
    const rawPriceArs = item.price_gremio || 0;
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

    if (currentIlabCat === "pantalla" || item.category.includes("Módulos")) {
      return `
        <div class="flex items-center justify-between p-3.5 bg-[#0a101c] border border-slate-800 rounded-2xl hover:border-[#00f5a0]/50 transition-all">
          <div class="flex flex-col gap-0.5">
            <span class="font-brand font-bold text-sm text-white">${modelName}</span>
            <span class="text-xs text-slate-300 font-medium">${detailTag}</span>
            ${isIcChange ? `<span class="text-[10px] font-mono text-amber-400 italic">✓ Con cambio de IC</span>` : ''}
          </div>
          <span class="font-brand font-black text-base text-[#00f5a0] tabular-nums flex-shrink-0">${priceText}</span>
        </div>
      `;
    }

    return `
      <div class="flex items-center justify-between p-3.5 bg-[#0a101c] border border-slate-800 rounded-2xl hover:border-[#00f5a0]/50 transition-all">
        <div class="flex items-center gap-2.5">
          <div class="w-2 h-2 rounded-full bg-[#00f5a0]"></div>
          <span class="font-brand font-bold text-sm text-white">${modelName}</span>
        </div>
        <span class="font-brand font-black text-base text-[#00f5a0] tabular-nums flex-shrink-0">${priceText}</span>
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tarifario iLab Gremios");

    XLSX.writeFile(workbook, `Tarifario_iLab_Gremios_WILOTECH.xlsx`);
    showToast("Planilla Excel exportada con éxito", "success");
  } catch (err) {
    showToast(`Error al exportar: ${err.message}`, "error");
  }
}
