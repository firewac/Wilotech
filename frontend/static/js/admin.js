/**
 * WILOTECH - Sistema Administrativo Integral del Laboratorio
 * Gestiona: Catálogo de Precios, Modelos, Fallas, Órdenes de Reparación e Inventario
 * Persistencia total en LocalStorage
 */

const TechAdmin = (function () {
  const STORAGE_KEYS = {
    TICKETS: "wilotech_tickets_v3",
    CATALOG: "wilotech_catalog_v6",
    INVENTORY: "wilotech_inventory_v3",
    CUSTOMERS: "wilotech_customers_v1"
  };

  let tickets = [];
  let catalog = null;
  let inventory = [];
  let customers = [];

  function init() {
    loadCatalog();
    loadTickets();
    loadInventory();
    loadCustomers();
  }

  // -------------------------------------------------------------
  // 1. GESTIÓN DEL CATÁLOGO DE PRECIOS Y MODELOS INDIVIDUALES
  // -------------------------------------------------------------
  function loadCatalog() {
    ["wilotech_catalog_v1", "wilotech_catalog_v2", "wilotech_catalog_v3", "wilotech_catalog_v4", "wilotech_catalog_v5"].forEach(k => {
      localStorage.removeItem(k);
    });

    const saved = localStorage.getItem(STORAGE_KEYS.CATALOG);
    if (saved) {
      try {
        catalog = JSON.parse(saved);
        const techCatBrandsCount = TECH_CATALOG.categories.reduce((acc, c) => acc + (c.brands ? c.brands.length : 0), 0);
        const loadedBrandsCount = (catalog && catalog.categories) ? catalog.categories.reduce((acc, c) => acc + (c.brands ? c.brands.length : 0), 0) : 0;

        if (loadedBrandsCount < techCatBrandsCount) {
          catalog = JSON.parse(JSON.stringify(TECH_CATALOG));
          saveCatalog();
        }
      } catch (e) {
        catalog = JSON.parse(JSON.stringify(TECH_CATALOG));
        saveCatalog();
      }
    } else {
      catalog = JSON.parse(JSON.stringify(TECH_CATALOG));
      saveCatalog();
    }
    return catalog;
  }

  function saveCatalog() {
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
  }

  function getCatalog() {
    if (!catalog) loadCatalog();
    return catalog;
  }

  function getModelFaults(categoryId, brandId, modelName) {
    if (!catalog) loadCatalog();
    const cat = catalog.categories.find(c => c.id === categoryId);
    if (!cat) return [];
    const brand = cat.brands.find(b => b.id === brandId);
    if (!brand) return [];

    if (!brand.modelPricing) brand.modelPricing = {};

    if (!modelName) {
      return brand.commonFaults;
    }

    if (!brand.modelPricing[modelName]) {
      // Cálculo escalonado por generación para precios base realistas
      let mult = 1.0;
      const m = modelName.toLowerCase();
      if (m.includes("16 pro max") || m.includes("15 pro max") || m.includes("s24 ultra")) mult = 1.95;
      else if (m.includes("16 pro") || m.includes("15 pro") || m.includes("14 pro max") || m.includes("s23 ultra")) mult = 1.65;
      else if (m.includes("16 plus") || m.includes("15 plus") || m.includes("14 pro") || m.includes("13 pro max")) mult = 1.40;
      else if (m.includes("16") || m.includes("15") || m.includes("14 plus") || m.includes("13 pro") || m.includes("12 pro max")) mult = 1.20;
      else if (m.includes("14") || m.includes("13") || m.includes("12 pro")) mult = 1.0;
      else if (m.includes("13 mini") || m.includes("12") || m.includes("11 pro max") || m.includes("11 pro")) mult = 0.85;
      else if (m.includes("12 mini") || m.includes("11") || m.includes("xs max")) mult = 0.70;
      else if (m.includes("xs") || m.includes("xr") || m.includes("x") || m.includes("se")) mult = 0.55;
      else if (m.includes("8") || m.includes("7")) mult = 0.40;

      brand.modelPricing[modelName] = brand.commonFaults.map(f => ({
        id: f.id,
        name: f.name,
        basePrice: Math.round(f.basePrice * mult),
        time: f.time
      }));
      saveCatalog();
    }

    return brand.modelPricing[modelName];
  }

  function updateModelFaultPrice(categoryId, brandId, modelName, faultId, newPrice, newTime) {
    const faults = getModelFaults(categoryId, brandId, modelName);
    const target = faults.find(f => f.id === faultId);
    if (target) {
      target.basePrice = parseFloat(newPrice) || 0;
      if (newTime) target.time = newTime;
      saveCatalog();
      return true;
    }
    return false;
  }

  function addNewModelFault(categoryId, brandId, modelName, faultName, basePrice, time) {
    const faults = getModelFaults(categoryId, brandId, modelName);
    const newId = "f_" + Date.now().toString().slice(-6);
    faults.push({
      id: newId,
      name: faultName,
      basePrice: parseFloat(basePrice) || 0,
      time: time || "24 horas"
    });
    saveCatalog();
    return true;
  }

  function updateFaultPrice(categoryId, brandId, faultId, newPrice, newTime) {
    const cat = catalog.categories.find(c => c.id === categoryId);
    if (!cat) return false;
    const brand = cat.brands.find(b => b.id === brandId);
    if (!brand) return false;
    const fault = brand.commonFaults.find(f => f.id === faultId);
    if (!fault) return false;

    fault.basePrice = parseFloat(newPrice) || 0;
    if (newTime) fault.time = newTime;

    saveCatalog();
    return true;
  }

  function addNewFault(categoryId, brandId, faultName, basePrice, time) {
    const cat = catalog.categories.find(c => c.id === categoryId);
    if (!cat) return false;
    const brand = cat.brands.find(b => b.id === brandId);
    if (!brand) return false;

    const newId = "f_" + Date.now().toString().slice(-6);
    brand.commonFaults.push({
      id: newId,
      name: faultName,
      basePrice: parseFloat(basePrice) || 0,
      time: time || "24 horas"
    });

    saveCatalog();
    return true;
  }

  function addNewModel(categoryId, brandId, modelName) {
    const cat = catalog.categories.find(c => c.id === categoryId);
    if (!cat) return false;
    const brand = cat.brands.find(b => b.id === brandId);
    if (!brand) return false;

    if (!brand.models.includes(modelName)) {
      brand.models.unshift(modelName);
      saveCatalog();
      return true;
    }
    return false;
  }

  function resetCatalogToDefault() {
    catalog = JSON.parse(JSON.stringify(TECH_CATALOG));
    saveCatalog();
  }

  // -------------------------------------------------------------
  // 2. GESTIÓN DE ÓRDENES Y TICKETS DE REPARACIÓN
  // -------------------------------------------------------------
  function loadTickets() {
    const saved = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (saved) {
      try {
        tickets = JSON.parse(saved);
      } catch (e) {
        tickets = [...TECH_CATALOG.sampleTickets];
      }
    } else {
      tickets = [...TECH_CATALOG.sampleTickets];
      saveTickets();
    }
    return tickets;
  }

  function saveTickets() {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  }

  function getAllTickets() {
    if (!tickets || tickets.length === 0) loadTickets();
    return tickets;
  }

  function createNewTicket(data) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `WT-${randomNum}`;

    const newTicket = {
      id: newId,
      clientName: data.clientName || "Cliente Mostrador",
      clientType: data.clientType || "Público",
      clientDni: data.clientDni || "",
      clientPhone: data.clientPhone || "+54 9 11 0000-0000",
      clientAddress: data.clientAddress || "",
      deviceType: data.deviceType || "Dispositivo",
      deviceBrand: data.deviceBrand || "",
      deviceModel: data.deviceModel || "Modelo no especificado",
      deviceColor: data.deviceColor || "",
      deviceStorage: data.deviceStorage || "",
      serialOrImei: data.serialOrImei || "SN-" + Date.now().toString().slice(-6),
      deviceLockType: data.deviceLockType || "Sin Bloqueo",
      deviceLockCode: data.deviceLockCode || "",
      issueDescription: data.issueDescription || "Ingreso general para diagnóstico",
      status: data.status || "received",
      statusStep: getStepNumber(data.status || "received"),
      dateReceived: new Date().toISOString().replace("T", " ").slice(0, 16),
      technician: data.technician || "Laboratorio WILOTECH",
      technicianNotes: data.technicianNotes || "Equipo recepcionado. Pendiente de apertura e inspección en microscopio.",
      partsUsed: data.partsUsed ? (Array.isArray(data.partsUsed) ? data.partsUsed : data.partsUsed.split(",").map(s => s.trim())) : ["Diagnóstico inicial de laboratorio"],
      finalCost: parseFloat(data.finalCost) || 0,
      warranty: data.warranty || "90 días de garantía por escrito"
    };

    tickets.unshift(newTicket);
    saveTickets();

    // Auto-guardar o actualizar cliente en la Base de Datos de Clientes
    upsertCustomer({
      name: newTicket.clientName,
      type: newTicket.clientType,
      dni: newTicket.clientDni,
      phone: newTicket.clientPhone,
      address: newTicket.clientAddress
    });

    return newTicket;
  }

  function getStepNumber(status) {
    switch (status) {
      case "received": return 1;
      case "diagnosing": return 2;
      case "waiting_parts": return 3;
      case "repairing": return 4;
      case "ready":
      case "delivered": return 5;
      default: return 1;
    }
  }

  function updateTicketStatus(ticketId, newStatus, newNotes = null) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.status = newStatus;
      ticket.statusStep = getStepNumber(newStatus);
      if (newNotes) ticket.technicianNotes = newNotes;
      saveTickets();
      return true;
    }
    return false;
  }

  function deleteTicket(ticketId) {
    tickets = tickets.filter(t => t.id !== ticketId);
    saveTickets();
  }

  // -------------------------------------------------------------
  // 3. MENSAJES AUTOMÁTICOS DE WHATSAPP AL CLIENTE
  // -------------------------------------------------------------
  function notifyClientWhatsApp(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    let statusText = "";
    let callToAction = "";

    switch (ticket.status) {
      case "received":
        statusText = "fue ingresado con éxito en nuestro laboratorio técnico.";
        callToAction = "Nuestro equipo comenzará las mediciones en banco de trabajo a la brevedad.";
        break;
      case "diagnosing":
        statusText = "se encuentra actualmente en etapa de DIAGNÓSTICO con instrumental de precisión.";
        callToAction = `Informe preliminar: "${ticket.technicianNotes}".`;
        break;
      case "waiting_parts":
        statusText = "se encuentra en espera de arribo de repuestos originales OEM.";
        callToAction = "Apenas contemos con los componentes procederemos a la micro-soldadura.";
        break;
      case "repairing":
        statusText = "se encuentra EN REPARACIÓN / pruebas de estrés térmico.";
        callToAction = "Estamos realizando los protocolos finales de calidad.";
        break;
      case "ready":
        statusText = "¡YA ESTÁ REPARADO Y LISTO PARA RETIRAR! 🎉";
        callToAction = `Pasa por nuestro local en los horarios habituales. Presupuesto final: $${ticket.finalCost} USD (Garantía: ${ticket.warranty}).`;
        break;
      case "delivered":
        statusText = "ha sido entregado.";
        callToAction = "¡Gracias por confiar en WILOTECH! Tienes soporte posventa y garantía vigente.";
        break;
    }

    const message = `Hola *${ticket.clientName}*! Te informamos desde *WILOTECH - Laboratorio Técnico*:\n\n` +
      `📦 *Ticket N°:* #${ticket.id}\n` +
      `📱 *Equipo:* ${ticket.deviceModel}\n` +
      `⚡ *Estado actual:* ${statusText}\n\n` +
      `📝 *Detalle:* ${callToAction}\n\n` +
      `Puedes seguir el estado en tiempo real en nuestra web cuando gustes. ¡Saludos!`;

    const cleanPhone = (ticket.clientPhone || "").replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
  }

  // -------------------------------------------------------------
  // 4. IMPRESIÓN DE COMPROBANTE TÉCNICO DE INGRESO / EGRESO
  // -------------------------------------------------------------
  function printTicketReceipt(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const printWindow = window.open("", "_blank", "width=800,height=900");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Servicio #${ticket.id} - WILOTECH</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; color: #111; padding: 25px; max-width: 650px; margin: auto; }
          .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 15px; }
          .title { font-size: 22px; font-weight: bold; margin: 0; }
          .sub { font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }
          .ticket-id { font-size: 18px; font-weight: bold; margin-top: 10px; background: #eee; padding: 4px; display: inline-block; }
          .section { margin-bottom: 14px; }
          .section-title { font-size: 12px; font-weight: bold; border-bottom: 1px solid #ddd; margin-bottom: 5px; text-transform: uppercase; }
          .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
          .terms { font-size: 9px; line-height: 1.3; color: #555; border-top: 1px dashed #333; padding-top: 8px; margin-top: 20px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; font-size: 11px; text-align: center; }
          .sig-line { border-top: 1px solid #333; width: 45%; padding-top: 4px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">WILOTECH</h1>
          <div class="sub">Laboratorio de Microelectrónica & Reparaciones</div>
          <div>Colón 1475, Mar del Plata, Bs. As., Argentina</div>
          <div>Tel / WhatsApp: +54 223 591-4163 • Email: wil_18_22@hotmail.com</div>
          <div class="ticket-id">ORDEN TÉCNICA #${ticket.id}</div>
        </div>

        <div class="section">
          <div class="section-title">Datos del Cliente & Recepción</div>
          <div class="row"><span>Cliente:</span><strong>${ticket.clientName}</strong></div>
          <div class="row"><span>Categoría / Tipo:</span><strong>${ticket.clientType || 'Público'}</strong></div>
          ${ticket.clientDni ? `<div class="row"><span>DNI / CUIT:</span><strong>${ticket.clientDni}</strong></div>` : ''}
          <div class="row"><span>Teléfono:</span><strong>${ticket.clientPhone}</strong></div>
          ${ticket.clientAddress ? `<div class="row"><span>Dirección:</span><span>${ticket.clientAddress}</span></div>` : ''}
          <div class="row"><span>Fecha Ingreso:</span><span>${ticket.dateReceived}</span></div>
          <div class="row"><span>Técnico Asignado:</span><span>${ticket.technician}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Detalle del Dispositivo</div>
          ${ticket.deviceBrand ? `<div class="row"><span>Marca / Fabricante:</span><strong>${ticket.deviceBrand}</strong></div>` : ''}
          <div class="row"><span>Equipo / Modelo:</span><strong>${ticket.deviceModel}</strong></div>
          ${ticket.deviceColor ? `<div class="row"><span>Color / Terminación:</span><span>${ticket.deviceColor}</span></div>` : ''}
          ${ticket.deviceStorage ? `<div class="row"><span>Capacidad / Almacenamiento:</span><span>${ticket.deviceStorage}</span></div>` : ''}
          <div class="row"><span>Categoría:</span><span>${ticket.deviceType}</span></div>
          <div class="row"><span>Serial / IMEI:</span><span>${ticket.serialOrImei}</span></div>
          <div class="row"><span>Seguridad / Bloqueo:</span><strong>${ticket.deviceLockType || 'Sin Bloqueo'} ${ticket.deviceLockCode ? `[ ${ticket.deviceLockCode} ]` : ''}</strong></div>
          <div class="row"><span>Falla Declarada:</span><span>${ticket.issueDescription}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Diagnóstico & Presupuesto</div>
          <div class="row"><span>Informe Taller:</span><span>${ticket.technicianNotes}</span></div>
          <div class="row"><span>Costo Total:</span><strong>$${ticket.finalCost} USD</strong></div>
          <div class="row"><span>Garantía:</span><span>${ticket.warranty}</span></div>
        </div>

        <div class="terms">
          CONDICIONES GENERALES: El cliente declara conocer y aceptar que equipos con sulfato, daño por líquidos o golpes pueden presentar fallas ocultas preexistentes. Transcurridos 60 días desde la notificación de finalización, los equipos no retirados devengarán costos de guarda o pasarán a desarme de acuerdo a la legislación vigente. Garantía válida únicamente sobre componentes reparados.
        </div>

        <div class="signatures">
          <div class="sig-line">Firma del Cliente</div>
          <div class="sig-line">Firma y Sello WILOTECH</div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // -------------------------------------------------------------
  // 5. INVENTARIO
  // -------------------------------------------------------------
  function loadInventory() {
    const saved = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    if (saved) {
      try {
        inventory = JSON.parse(saved);
      } catch (e) {
        inventory = [...TECH_CATALOG.stockInventory];
      }
    } else {
      inventory = [...TECH_CATALOG.stockInventory];
      saveInventory();
    }
    return inventory;
  }

  function saveInventory() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  }

  function getInventory() {
    if (!inventory || inventory.length === 0) loadInventory();
    return inventory;
  }

  function adjustStock(index, delta) {
    if (inventory[index]) {
      inventory[index].qty = Math.max(0, inventory[index].qty + delta);
      saveInventory();
    }
  }

  // -------------------------------------------------------------
  // 5. BASE DE DATOS DE CLIENTES & AUTO-COMPLETADO INTELIGENTE
  // -------------------------------------------------------------
  function loadCustomers() {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (saved) {
      try {
        customers = JSON.parse(saved);
      } catch (e) {
        customers = TECH_CATALOG.sampleCustomers ? [...TECH_CATALOG.sampleCustomers] : [];
      }
    } else {
      customers = TECH_CATALOG.sampleCustomers ? [...TECH_CATALOG.sampleCustomers] : [];
      saveCustomers();
    }
    return customers;
  }

  function saveCustomers() {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }

  function getAllCustomers() {
    if (!customers || customers.length === 0) loadCustomers();
    return customers;
  }

  function findCustomerByDniOrPhone(query) {
    if (!query) return null;
    const clean = query.toString().replace(/\D/g, "");
    if (clean.length < 5) return null;

    getAllCustomers();
    return customers.find(c => {
      const cDni = (c.dni || "").replace(/\D/g, "");
      const cPhone = (c.phone || "").replace(/\D/g, "");
      return (cDni && cDni === clean) || (cPhone && cPhone === clean) || (cDni && clean.endsWith(cDni)) || (cPhone && clean.endsWith(cPhone));
    }) || null;
  }

  function upsertCustomer(data) {
    if (!data.name) return null;
    getAllCustomers();
    const cleanDni = (data.dni || "").replace(/\D/g, "");
    const cleanPhone = (data.phone || "").replace(/\D/g, "");

    let existingIndex = customers.findIndex(c => {
      const cDni = (c.dni || "").replace(/\D/g, "");
      const cPhone = (c.phone || "").replace(/\D/g, "");
      return (cleanDni && cDni === cleanDni) || (cleanPhone && cPhone === cleanPhone);
    });

    if (existingIndex >= 0) {
      customers[existingIndex] = {
        ...customers[existingIndex],
        name: data.name || customers[existingIndex].name,
        type: data.type || customers[existingIndex].type,
        dni: data.dni || customers[existingIndex].dni,
        phone: data.phone || customers[existingIndex].phone,
        address: data.address || customers[existingIndex].address
      };
    } else {
      const newCustomer = {
        id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: data.name,
        type: data.type || "Público",
        dni: data.dni || "",
        phone: data.phone || "",
        address: data.address || ""
      };
      customers.unshift(newCustomer);
    }
    saveCustomers();
  }

  function deleteCustomer(customerId) {
    getAllCustomers();
    customers = customers.filter(c => c.id !== customerId);
    saveCustomers();
  }

  return {
    init: init,
    getCatalog: getCatalog,
    getModelFaults: getModelFaults,
    updateModelFaultPrice: updateModelFaultPrice,
    addNewModelFault: addNewModelFault,
    updateFaultPrice: updateFaultPrice,
    addNewFault: addNewFault,
    addNewModel: addNewModel,
    resetCatalog: resetCatalogToDefault,
    getAllTickets: getAllTickets,
    createNewTicket: createNewTicket,
    updateTicketStatus: updateTicketStatus,
    deleteTicket: deleteTicket,
    notifyClientWhatsApp: notifyClientWhatsApp,
    printTicketReceipt: printTicketReceipt,
    getInventory: getInventory,
    adjustStock: adjustStock,
    getAllCustomers: getAllCustomers,
    findCustomerByDniOrPhone: findCustomerByDniOrPhone,
    upsertCustomer: upsertCustomer,
    deleteCustomer: deleteCustomer
  };
})();

if (typeof window !== "undefined") {
  window.TechAdmin = TechAdmin;
}
