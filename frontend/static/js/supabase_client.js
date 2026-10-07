/**
 * WILOTECH — Cliente de Conexión a Supabase (Frontend JS)
 * Permite la lectura y sincronización en tiempo real de clientes, órdenes y lista de precios.
 */

const SUPABASE_CONFIG = {
  url: window.WILOTECH_SUPABASE_URL || "",
  key: window.WILOTECH_SUPABASE_KEY || ""
};

let supabaseClient = null;

function initSupabaseClient() {
  if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.key) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
      console.log("⚡ Cliente Supabase inicializado correctamente.");
    } catch (err) {
      console.warn("⚠️ No se pudo inicializar cliente Supabase JS:", err);
    }
  }
}

// Cargar SDK oficial de Supabase si no está en window
if (!window.supabase && (SUPABASE_CONFIG.url || SUPABASE_CONFIG.key)) {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  script.onload = initSupabaseClient;
  document.head.appendChild(script);
} else {
  initSupabaseClient();
}
