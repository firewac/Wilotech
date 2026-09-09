/**
 * WILOTECH — Control de Tema (Modo Claro / Modo Oscuro)
 */

(function () {
  'use strict';

  function getStoredTheme() {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return 'dark';
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
    localStorage.setItem('theme', theme);
    updateToggleButtons(theme);
  }

  function updateToggleButtons(theme) {
    var buttons = document.querySelectorAll('.theme-toggle-btn, #theme-toggle-btn');
    buttons.forEach(function (btn) {
      var isDark = theme === 'dark';
      var iconContainer = btn.querySelector('.theme-toggle-icon') || btn;
      
      btn.setAttribute('aria-label', isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro');
      btn.setAttribute('title', isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro');

      if (iconContainer) {
        if (isDark) {
          iconContainer.innerHTML = '<i data-lucide="sun" class="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform duration-300"></i>';
        } else {
          iconContainer.innerHTML = '<i data-lucide="moon" class="w-5 h-5 text-cyan-600 hover:-rotate-12 transition-transform duration-300"></i>';
        }
      }
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons();
      } catch (e) {}
    }
  }

  window.toggleTheme = function () {
    var current = getStoredTheme();
    var nextTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  };

  // Inicialización inmediata (anti-FOUT)
  var initialTheme = getStoredTheme();
  applyTheme(initialTheme);

  document.addEventListener('DOMContentLoaded', function () {
    updateToggleButtons(getStoredTheme());

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.theme-toggle-btn, #theme-toggle-btn');
      if (btn) {
        e.preventDefault();
        window.toggleTheme();
      }
    });
  });
})();
