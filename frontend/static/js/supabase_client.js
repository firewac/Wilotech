/**
 * WILOTECH — Cliente de Conexión a Supabase (Frontend JS)
 * Permite la lectura y sincronización en tiempo real de clientes, órdenes y lista de precios.
 */

const SUPABASE_CONFIG = {
  url: window.WILOTECH_SUPABASE_URL || "https://gndhgcgehtkxqpvdkpwc.supabase.co",
  key: window.WILOTECH_SUPABASE_KEY || "sb_publishable_xtKtTWKIQ1DUXaOJn_mI4g_KXLkaZxs"
};

let supabaseClient = null;

function initSupabaseClient() {
  if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.key) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
      console.log("⚡ Cliente Supabase en Tiempo Real (Realtime WebSockets) inicializado correctamente.");
      subscribeToRealtimeDatabase();
    } catch (err) {
      console.warn("⚠️ No se pudo inicializar cliente Supabase JS:", err);
    }
  }
}

/**
 * Suscripción en Tiempo Real (Realtime WebSockets) a los cambios de Supabase
 */
function subscribeToRealtimeDatabase() {
  if (!supabaseClient) return;

  // Escuchar cambios en vivo en la lista de precios / tarifario
  supabaseClient
    .channel('realtime-price-list')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gremio_price_list' }, payload => {
      console.log("🔔 [Realtime Supabase] Cambio detectado en Lista de Precios:", payload);
      if (typeof window.onSupabasePriceChange === 'function') {
        window.onSupabasePriceChange(payload);
      }
    })
    .subscribe();

  // Escuchar cambios en vivo en tickets / órdenes de clientes
  supabaseClient
    .channel('realtime-repair-tickets')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_tickets' }, payload => {
      console.log("🔔 [Realtime Supabase] Cambio detectado en Ordenes de Trabajo:", payload);
      if (typeof window.onSupabaseTicketChange === 'function') {
        window.onSupabaseTicketChange(payload);
      }
    })
    .subscribe();
}

// Cargar SDK oficial de Supabase
if (!window.supabase) {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  script.onload = initSupabaseClient;
  document.head.appendChild(script);
} else {
  initSupabaseClient();
}
