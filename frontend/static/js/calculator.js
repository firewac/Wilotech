/**
 * TechFix Pro - Cotizador Interactivo de Reparaciones
 */

const TechCalculator = (function () {
  let selectedCategory = null;
  let selectedBrand = null;
  let selectedModel = null;
  let selectedFault = null;
  let isExpress = false;

  const elements = {
    categoryTabs: null,
    brandSelect: null,
    modelSelect: null,
    faultsContainer: null,
    expressToggle: null,
    estimatedPrice: null,
    estimatedTime: null,
    whatsappBtn: null,
    quoteSummaryCard: null
  };

  function init() {
    elements.categoryTabs = document.getElementById("calc-category-tabs");
    elements.brandSelect = document.getElementById("calc-brand-select");
    elements.modelSelect = document.getElementById("calc-model-select");
    elements.faultsContainer = document.getElementById("calc-faults-container");
    elements.expressToggle = document.getElementById("calc-express-toggle");
    elements.estimatedPrice = document.getElementById("calc-estimated-price");
    elements.estimatedTime = document.getElementById("calc-estimated-time");
    elements.whatsappBtn = document.getElementById("calc-whatsapp-btn");
    elements.quoteSummaryCard = document.getElementById("calc-summary-card");

    if (!elements.categoryTabs) return;

    renderCategoryTabs();
    setupEventListeners();

    function getActiveCatalog() {
      return (window.TechAdmin && TechAdmin.getCatalog) ? TechAdmin.getCatalog() : TECH_CATALOG;
    }

    // Seleccionar por defecto la primera categoría
    const activeCat = getActiveCatalog().categories[0];
    if (activeCat) selectCategory(activeCat.id);
  }

  function getActiveCatalog() {
    return (window.TechAdmin && TechAdmin.getCatalog) ? TechAdmin.getCatalog() : TECH_CATALOG;
  }

  function renderCategoryTabs() {
    elements.categoryTabs.innerHTML = getActiveCatalog().categories.map(cat => `
      <button 
        type="button" 
        data-category="${cat.id}"
        class="calc-cat-btn flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all duration-200 border-slate-700 bg-[#0a101c] text-slate-300 hover:border-[#00f5a0]/50 hover:text-white"
      >
        <i data-lucide="${cat.icon}" class="w-4 h-4 text-[#00d2ff]"></i>
        <span>${cat.name}</span>
      </button>
    `).join("");

    if (window.lucide) lucide.createIcons();
  }

  function setupEventListeners() {
    // Click en tabs de categorías
    elements.categoryTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".calc-cat-btn");
      if (btn) {
        selectCategory(btn.dataset.category);
      }
    });

    // Cambio de marca
    elements.brandSelect.addEventListener("change", (e) => {
      selectBrand(e.target.value);
    });

    // Cambio de modelo
    elements.modelSelect.addEventListener("change", (e) => {
      selectModel(e.target.value);
    });

    // Toggle de servicio express
    if (elements.expressToggle) {
      elements.expressToggle.addEventListener("change", (e) => {
        isExpress = e.target.checked;
        updateCalculation();
      });
    }

    // Botón de WhatsApp
    elements.whatsappBtn.addEventListener("click", () => {
      sendQuoteViaWhatsApp();
    });
  }

  function selectCategory(categoryId) {
    selectedCategory = getActiveCatalog().categories.find(c => c.id === categoryId);
    selectedBrand = null;
    selectedModel = null;
    selectedFault = null;

    // Actualizar estilos activos de tabs
    document.querySelectorAll(".calc-cat-btn").forEach(btn => {
      if (btn.dataset.category === categoryId) {
        btn.classList.add("border-[#00f5a0]", "bg-[#00f5a0]/15", "text-[#00f5a0]", "shadow-sm", "shadow-[#00f5a0]/25");
        btn.classList.remove("border-slate-700", "bg-[#0a101c]", "text-slate-300");
      } else {
        btn.classList.remove("border-[#00f5a0]", "bg-[#00f5a0]/15", "text-[#00f5a0]", "shadow-sm", "shadow-[#00f5a0]/25");
        btn.classList.add("border-slate-700", "bg-[#0a101c]", "text-slate-300");
      }
    });

    // Cargar selector de marcas
    elements.brandSelect.innerHTML = `<option value="">-- Selecciona una marca o línea --</option>` +
      selectedCategory.brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");

    elements.modelSelect.innerHTML = `<option value="">-- Primero selecciona una marca --</option>`;
    elements.modelSelect.disabled = true;

    elements.faultsContainer.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 text-sm">
        <i data-lucide="wrench" class="w-8 h-8 mx-auto mb-2 text-[#00f5a0]/40"></i>
        Selecciona la marca y modelo para desplegar el catálogo de fallas y soluciones.
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    updateCalculation();
  }

  function selectBrand(brandId) {
    if (!brandId) {
      selectedBrand = null;
      selectedModel = null;
      elements.modelSelect.innerHTML = `<option value="">-- Primero selecciona una marca --</option>`;
      elements.modelSelect.disabled = true;
      elements.faultsContainer.innerHTML = "";
      updateCalculation();
      return;
    }

    selectedBrand = selectedCategory.brands.find(b => b.id === brandId);
    selectedModel = null;
    selectedFault = null;

    elements.modelSelect.disabled = false;
    elements.modelSelect.innerHTML = `<option value="">-- Selecciona el modelo exacto --</option>` +
      selectedBrand.models.map(m => `<option value="${m}">${m}</option>`).join("");

    elements.faultsContainer.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 text-sm font-tech">
        <i data-lucide="smartphone" class="w-8 h-8 mx-auto mb-2 text-[#00f5a0]/40"></i>
        Selecciona el modelo exacto arriba para ver los precios y tiempos correspondientes.
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    updateCalculation();
  }

  function selectModel(modelName) {
    selectedModel = modelName;
    selectedFault = null;

    if (!modelName) {
      elements.faultsContainer.innerHTML = `
        <div class="col-span-full py-8 text-center text-slate-400 text-sm font-tech">
          <i data-lucide="smartphone" class="w-8 h-8 mx-auto mb-2 text-[#00f5a0]/40"></i>
          Selecciona el modelo exacto arriba para ver los precios correspondientes.
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      updateCalculation();
      return;
    }

    const faults = (window.TechAdmin && TechAdmin.getModelFaults)
      ? TechAdmin.getModelFaults(selectedCategory.id, selectedBrand.id, selectedModel)
      : selectedBrand.commonFaults;

    renderFaults(faults);
    updateCalculation();
  }

  function renderFaults(faults) {
    elements.faultsContainer.innerHTML = faults.map(f => `
      <label class="fault-option flex items-start gap-3 p-3.5 rounded-xl border border-slate-700/80 bg-[#0a101c]/80 hover:bg-[#0a101c] hover:border-[#00f5a0]/50 cursor-pointer transition-all">
        <input 
          type="radio" 
          name="calc-fault" 
          value="${f.id}" 
          class="mt-1 w-4 h-4 text-[#00f5a0] border-slate-600 focus:ring-[#00f5a0]/30 bg-slate-900"
        />
        <div class="flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-slate-200 text-sm">${f.name}</span>
            <span class="text-xs font-brand font-bold text-[#00f5a0] bg-slate-950 border border-[#00f5a0]/40 px-2 py-0.5 rounded shadow-sm">
              $${f.basePrice} USD
            </span>
          </div>
          <div class="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <i data-lucide="clock" class="w-3.5 h-3.5 text-[#00d2ff]"></i>
            <span>Demora típica: ${f.time}</span>
          </div>
        </div>
      </label>
    `).join("");

    if (window.lucide) lucide.createIcons();

    // Event listeners para los radios de fallas
    elements.faultsContainer.querySelectorAll("input[name='calc-fault']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        selectedFault = faults.find(f => f.id === e.target.value);
        
        // Highlight border
        elements.faultsContainer.querySelectorAll(".fault-option").forEach(lbl => {
          lbl.classList.remove("border-[#00f5a0]", "bg-[#00f5a0]/10");
        });
        e.target.closest(".fault-option").classList.add("border-[#00f5a0]", "bg-[#00f5a0]/10");

        updateCalculation();
      });
    });
  }

  function updateCalculation() {
    if (!selectedFault) {
      elements.estimatedPrice.textContent = "$0 USD";
      elements.estimatedTime.textContent = "--";
      elements.whatsappBtn.disabled = true;
      elements.whatsappBtn.classList.add("opacity-50", "cursor-not-allowed");
      return;
    }

    let finalPrice = selectedFault.basePrice;
    let timeText = selectedFault.time;

    if (isExpress) {
      finalPrice = Math.round(finalPrice * 1.25);
      timeText = "Servicio Express Prioritario (~" + (timeText.includes("horas") ? "1-2 horas" : "24 horas") + ")";
    }

    elements.estimatedPrice.textContent = `$${finalPrice} USD`;
    elements.estimatedTime.textContent = timeText;

    elements.whatsappBtn.disabled = false;
    elements.whatsappBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }

  function sendQuoteViaWhatsApp() {
    if (!selectedFault) return;

    const catName = selectedCategory ? selectedCategory.name : "Equipo";
    const brandName = selectedBrand ? selectedBrand.name : "";
    const modelName = selectedModel || "Modelo no especificado";
    const faultName = selectedFault.name;
    const priceText = elements.estimatedPrice.textContent;
    const timeText = elements.estimatedTime.textContent;
    const expressNote = isExpress ? "⚡ Requiere Servicio Express Prioritario" : "Servicio de Taller Estándar";

    const message = `Hola WILOTECH! Estuve cotizando en su web y deseo coordinar la reparación de mi equipo:\n\n` +
      `📌 *Categoría:* ${catName}\n` +
      `🏷️ *Dispositivo:* ${brandName} - ${modelName}\n` +
      `🔧 *Falla / Servicio:* ${faultName}\n` +
      `⏱️ *Tiempo estimado:* ${timeText}\n` +
      `💵 *Presupuesto aprox.:* ${priceText} (${expressNote})\n\n` +
      `¿Tienen disponibilidad en el laboratorio para recibir el equipo? ¡Muchas gracias!`;

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = "542235914163"; // Número comercial del laboratorio (Mar del Plata)
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, "_blank");
  }

  return {
    init: init
  };
})();
