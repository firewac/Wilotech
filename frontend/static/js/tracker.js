/**
 * TechFix Pro - Sistema de Rastreo de Órdenes y Tickets en Tiempo Real
 */

const TechTracker = (function () {
  const elements = {
    searchInput: null,
    searchBtn: null,
    demoBadges: null,
    resultContainer: null,
    emptyState: null,
    ticketNotFound: null
  };

  const STATUS_CONFIG = {
    received: { step: 1, label: "Ingresado en Recepción", color: "text-slate-400", bg: "bg-slate-800" },
    diagnosing: { step: 2, label: "En Diagnóstico Técnico", color: "text-amber-400", bg: "bg-amber-950/40 border-amber-500/30" },
    waiting_parts: { step: 3, label: "Aguardando Repuestos / Autorización", color: "text-purple-400", bg: "bg-purple-950/40 border-purple-500/30" },
    repairing: { step: 4, label: "En Reparación / Pruebas de Laboratorio", color: "text-[#00d2ff]", bg: "bg-[#00d2ff]/10 border-[#00d2ff]/30" },
    ready: { step: 5, label: "¡Reparado y Listo para Retiro!", color: "text-[#00f5a0]", bg: "bg-[#00f5a0]/15 border-[#00f5a0]/40" },
    delivered: { step: 5, label: "Entregado al Cliente", color: "text-blue-400", bg: "bg-blue-950/40 border-blue-500/30" }
  };

  function init() {
    elements.searchInput = document.getElementById("tracker-search-input");
    elements.searchBtn = document.getElementById("tracker-search-btn");
    elements.demoBadges = document.getElementById("tracker-demo-badges");
    elements.resultContainer = document.getElementById("tracker-result-container");
    elements.emptyState = document.getElementById("tracker-empty-state");
    elements.ticketNotFound = document.getElementById("tracker-not-found");

    if (!elements.searchInput) return;

    setupEventListeners();
    renderDemoBadges();
  }

  function setupEventListeners() {
    elements.searchBtn.addEventListener("click", () => {
      performSearch(elements.searchInput.value.trim());
    });

    elements.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        performSearch(elements.searchInput.value.trim());
      }
    });

    if (elements.demoBadges) {
      elements.demoBadges.addEventListener("click", (e) => {
        const badge = e.target.closest("[data-ticket-id]");
        if (badge) {
          const id = badge.dataset.ticketId;
          elements.searchInput.value = id;
          performSearch(id);
        }
      });
    }
  }

  function renderDemoBadges() {
    if (!elements.demoBadges) return;
    const tickets = TechAdmin.getAllTickets();
    elements.demoBadges.innerHTML = tickets.map(t => `
      <button 
        type="button" 
        data-ticket-id="${t.id}"
        class="text-xs font-brand px-2.5 py-1 rounded-md bg-[#0a101c] border border-slate-700 text-[#00f5a0] hover:border-[#00f5a0] hover:bg-[#05070d] transition-colors"
      >
        ${t.id} (${t.deviceType})
      </button>
    `).join("");
  }

  function performSearch(query) {
    if (!query) {
      showToast("Por favor ingresa un número de ticket, teléfono o serial.", "warning");
      return;
    }

    const tickets = TechAdmin.getAllTickets();
    const cleanQuery = query.toLowerCase().replace(/[^a-z0-9]/g, "");

    const found = tickets.find(t => {
      const matchId = t.id.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanQuery);
      const matchPhone = t.clientPhone && t.clientPhone.replace(/[^0-9]/g, "").includes(cleanQuery);
      const matchDni = t.clientDni && t.clientDni.replace(/[^0-9]/g, "").includes(cleanQuery);
      const matchSerial = t.serialOrImei && t.serialOrImei.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanQuery);
      return matchId || matchPhone || matchDni || matchSerial;
    });

    if (found) {
      renderTicketDetails(found);
      if (elements.emptyState) elements.emptyState.classList.add("hidden");
      if (elements.ticketNotFound) elements.ticketNotFound.classList.add("hidden");
      elements.resultContainer.classList.remove("hidden");
      elements.resultContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      if (elements.emptyState) elements.emptyState.classList.add("hidden");
      elements.resultContainer.classList.add("hidden");
      if (elements.ticketNotFound) elements.ticketNotFound.classList.remove("hidden");
    }
  }

  function renderTicketDetails(ticket) {
    const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.received;
    const currentStep = ticket.statusStep || statusInfo.step;

    const steps = [
      { num: 1, title: "Recepción", desc: "Ingresado al taller" },
      { num: 2, title: "Diagnóstico", desc: "En banco de pruebas" },
      { num: 3, title: "Repuestos", desc: "Componentes listos" },
      { num: 4, title: "Reparación", desc: "Microelectrónica" },
      { num: 5, title: "Finalizado", desc: "Listo para retiro" }
    ];

    const stepperHtml = steps.map(s => {
      const isCompleted = s.num < currentStep;
      const isCurrent = s.num === currentStep;

      let nodeClass = "border-slate-700 bg-slate-900 text-slate-500";
      let stepClass = "";

      if (isCompleted) {
        nodeClass = "border-[#00f5a0] bg-[#00f5a0]/20 text-[#00f5a0]";
        stepClass = "completed";
      } else if (isCurrent) {
        nodeClass = "border-[#00d2ff] bg-gradient-to-r from-[#00d2ff] to-[#00f5a0] text-slate-950 font-bold shadow-lg shadow-[#00f5a0]/40 ring-4 ring-[#00f5a0]/20";
        stepClass = "active";
      }

      return `
        <div class="tracker-step flex-1 text-center ${stepClass}">
          <div class="step-node w-11 h-11 mx-auto rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all ${nodeClass}">
            ${isCompleted ? '<i data-lucide="check" class="w-5 h-5 text-[#00f5a0]"></i>' : s.num}
          </div>
          <div class="mt-3">
            <p class="text-xs font-brand font-bold ${isCurrent ? 'text-[#00f5a0]' : isCompleted ? 'text-slate-200' : 'text-slate-500'}">
              ${s.title}
            </p>
            <p class="text-[11px] text-slate-500 hidden sm:block font-tech">${s.desc}</p>
          </div>
        </div>
      `;
    }).join("");

    elements.resultContainer.innerHTML = `
      <div class="glass-panel-glow rounded-2xl p-6 sm:p-8 relative overflow-hidden border border-[#00f5a0]/30">
        <!-- Badge de Estado Superior -->
        <div class="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-brand font-bold uppercase tracking-widest text-[#00f5a0] bg-[#00f5a0]/10 border border-[#00f5a0]/40 px-3 py-1 rounded-full">
                Ticket #${ticket.id}
              </span>
              <span class="text-xs text-slate-400 font-tech">Ingreso: ${ticket.dateReceived}</span>
            </div>
            <h3 class="text-xl sm:text-2xl font-brand font-bold text-white mt-2">${ticket.deviceModel}</h3>
            <p class="text-xs font-mono text-slate-400 mt-0.5">S/N - IMEI: ${ticket.serialOrImei}</p>
            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-tech mt-2">
              <span>Cliente: <strong class="text-white">${ticket.clientName}</strong></span>
              ${ticket.clientType ? `<span class="px-2 py-0.5 rounded text-[10px] font-brand font-bold uppercase ${
                ticket.clientType === 'Gremio Mayorista' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                ticket.clientType === 'Gremio' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }">${ticket.clientType}</span>` : ''}
              ${ticket.clientDni ? `<span class="text-cyan-400 font-mono">DNI: ${ticket.clientDni}</span>` : ''}
              ${ticket.clientAddress ? `<span class="text-slate-400">📍 ${ticket.clientAddress}</span>` : ''}
            </div>
          </div>

          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${statusInfo.bg}">
            <span class="w-2.5 h-2.5 rounded-full ${ticket.status === 'ready' ? 'bg-[#00f5a0] animate-ping' : 'bg-[#00d2ff] animate-pulse'}"></span>
            <span class="text-sm font-brand font-bold ${statusInfo.color}">${statusInfo.label}</span>
          </div>
        </div>

        <!-- Stepper de Progreso -->
        <div class="my-8 py-4 px-2 overflow-x-auto">
          <div class="flex items-center justify-between min-w-[500px]">
            ${stepperHtml}
          </div>
        </div>

        <!-- Ficha Técnica de la Reparación -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800">
          <!-- Columna Izquierda: Diagnóstico y Técnico -->
          <div class="space-y-4">
            <div class="bg-[#0a101c]/80 rounded-xl p-4 border border-slate-800/80">
              <h4 class="text-xs font-brand font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <i data-lucide="alert-circle" class="w-4 h-4 text-amber-400"></i> Falla Reportada por Cliente
              </h4>
              <p class="text-sm text-slate-200">${ticket.issueDescription}</p>
            </div>

            <div class="bg-[#0a101c]/80 rounded-xl p-4 border border-slate-800/80">
              <h4 class="text-xs font-brand font-bold text-[#00d2ff] uppercase tracking-wider mb-2 flex items-center gap-2">
                <i data-lucide="cpu" class="w-4 h-4 text-[#00d2ff]"></i> Informe de Banco de Trabajo
              </h4>
              <p class="text-sm text-slate-300 leading-relaxed">${ticket.technicianNotes}</p>
              <div class="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-tech">
                <span>Responsable de Laboratorio:</span>
                <span class="font-medium text-slate-200">${ticket.technician}</span>
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Repuestos, Presupuesto y Contacto -->
          <div class="space-y-4">
            <div class="bg-[#0a101c]/80 rounded-xl p-4 border border-slate-800/80">
              <h4 class="text-xs font-brand font-bold text-[#00f5a0] uppercase tracking-wider mb-2 flex items-center gap-2">
                <i data-lucide="package-check" class="w-4 h-4 text-[#00f5a0]"></i> Insumos & Repuestos OEM
              </h4>
              <ul class="space-y-1.5 text-xs text-slate-300 font-tech">
                ${ticket.partsUsed.map(p => `
                  <li class="flex items-center gap-2">
                    <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-[#00f5a0] shrink-0"></i>
                    <span>${p}</span>
                  </li>
                `).join("")}
              </ul>
            </div>

            <div class="bg-gradient-to-br from-[#0a101c] to-[#00f5a0]/10 rounded-xl p-4 border border-[#00f5a0]/30">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs text-slate-400 font-tech">Costo Total de Reparación:</span>
                  <div class="text-3xl font-brand font-black text-[#00f5a0]">$${ticket.finalCost} USD</div>
                </div>
                <div class="text-right">
                  <span class="text-xs text-slate-400 font-tech">Garantía Certificada:</span>
                  <div class="text-xs font-semibold text-[#00f5a0] mt-1 font-mono">${ticket.warranty}</div>
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
                <a 
                  href="https://wa.me/542235914163?text=${encodeURIComponent(`Hola WILOTECH, consulto por el estado actualizado de mi Ticket #${ticket.id} (${ticket.deviceModel})`)}"
                  target="_blank"
                  class="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00d2ff] to-[#00f5a0] text-slate-950 font-brand font-bold text-xs uppercase tracking-wider transition-all hover:opacity-90 shadow-md shadow-[#00f5a0]/20"
                >
                  <i data-lucide="message-circle" class="w-4 h-4 text-slate-950"></i> Consultar Técnico por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  return {
    init: init,
    refreshDemoBadges: renderDemoBadges,
    searchById: performSearch
  };
})();

if (typeof window !== "undefined") {
  window.TechTracker = TechTracker;
}
