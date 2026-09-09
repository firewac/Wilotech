/**
 * TechFix Pro - Aplicación Principal y Utilidades Globales
 */

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const bgColors = {
    info: "bg-slate-900 border-cyan-500/40 text-cyan-300",
    success: "bg-slate-900 border-emerald-500/40 text-emerald-300",
    warning: "bg-slate-900 border-amber-500/40 text-amber-300",
    error: "bg-slate-900 border-rose-500/40 text-rose-300"
  };

  const icons = {
    info: "info",
    success: "check-circle",
    warning: "alert-triangle",
    error: "x-circle"
  };

  toast.className = `toast flex items-center gap-3 p-4 rounded-xl border shadow-2xl ${bgColors[type] || bgColors.info} max-w-sm text-sm z-50`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 shrink-0"></i>
    <span class="flex-1 font-medium">${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Inicializar iconos de Lucide
  if (window.lucide) {
    lucide.createIcons();
  }

  // 2. Inicializar Módulos Principales
  if (window.TechAdmin) TechAdmin.init();
  if (window.TechCalculator) TechCalculator.init();
  if (window.TechTracker) TechTracker.init();

  // 3. Menú móvil
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
    // Cerrar menú móvil al hacer click en un enlace
    mobileMenu.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        mobileMenu.classList.add("hidden");
      });
    });
  }

  // 4. Smooth scrolling para anclas
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId && targetId !== "#") {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }
    });
  });

  // 5. Botón de acceso rápido al rastreador desde el Hero
  const heroTrackBtn = document.getElementById("hero-track-btn");
  if (heroTrackBtn) {
    heroTrackBtn.addEventListener("click", () => {
      const trackerSection = document.getElementById("tracker-section");
      if (trackerSection) {
        trackerSection.scrollIntoView({ behavior: "smooth" });
        const input = document.getElementById("tracker-search-input");
        if (input) setTimeout(() => input.focus(), 600);
      }
    });
  }

  console.log("WILOTECH Platform initialized successfully.");
});
