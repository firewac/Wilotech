/**
 * WILOTECH - Sistema Administrativo Integral del Laboratorio
 * Gestiona: Catálogo de Precios, Modelos, Fallas, Órdenes de Reparación e Inventario
 * Persistencia total en LocalStorage
 */

const TechAdmin = (function () {
  const STORAGE_KEYS = {
    TICKETS: "wilotech_tickets_v3",
    DELETED_TICKETS: "wilotech_deleted_tickets_v1",
    CATALOG: "wilotech_catalog_v6",
    INVENTORY: "wilotech_inventory_v3",
    CUSTOMERS: "wilotech_customers_v1"
  };

  let tickets = [];
  let deletedTicketIds = [];
  let catalog = null;
  let inventory = [];
  let customers = [];

  function init() {
    loadCatalog();
    loadTickets();
    loadInventory();
    loadCustomers();
    if (typeof renderAdminGremiosUsers === 'function') renderAdminGremiosUsers();
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
  function loadDeletedTickets() {
    const saved = localStorage.getItem(STORAGE_KEYS.DELETED_TICKETS);
    if (saved) {
      try {
        deletedTicketIds = JSON.parse(saved);
        if (!Array.isArray(deletedTicketIds)) deletedTicketIds = [];
      } catch (e) {
        deletedTicketIds = [];
      }
    } else {
      deletedTicketIds = [];
    }
    return deletedTicketIds;
  }

  function saveDeletedTickets() {
    localStorage.setItem(STORAGE_KEYS.DELETED_TICKETS, JSON.stringify(deletedTicketIds));
  }

  function loadTickets() {
    loadDeletedTickets();
    const saved = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        tickets = Array.isArray(parsed) ? parsed.filter(t => t && t.id && !deletedTicketIds.includes(t.id)) : [];
      } catch (e) {
        tickets = [];
      }
    } else {
      if (deletedTicketIds.length === 0) {
        tickets = [...TECH_CATALOG.sampleTickets];
        saveTickets();
      } else {
        tickets = [];
        saveTickets();
      }
    }
    fetchTicketsFromBackend();
    return tickets;
  }

  function saveTickets() {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  }

  async function syncTicketWithBackend(ticket) {
    if (!ticket || !ticket.id) return;
    try {
      await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket)
      });
    } catch (e) {
      console.warn('[TechAdmin] No se pudo sincronizar ticket con el servidor:', e);
    }
  }

  async function syncDeleteTicketWithBackend(ticketId) {
    if (!ticketId) return;
    try {
      await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('[TechAdmin] No se pudo eliminar ticket en el servidor:', e);
    }
  }

  async function fetchTicketsFromBackend() {
    try {
      const resp = await fetch('/api/tickets');
      if (resp.ok) {
        const serverTickets = await resp.json();
        const existingMap = new Map();

        // 1. Cargar tickets locales válidos que no hayan sido eliminados por el usuario
        if (Array.isArray(tickets)) {
          tickets.forEach(t => {
            if (t && t.id && !deletedTicketIds.includes(t.id)) {
              existingMap.set(t.id, t);
            }
          });
        }

        // 2. Fusionar tickets del servidor ignorando los eliminados expresamente por el usuario
        if (Array.isArray(serverTickets)) {
          serverTickets.forEach(st => {
            if (st && st.id) {
              if (!deletedTicketIds.includes(st.id) && !existingMap.has(st.id)) {
                existingMap.set(st.id, st);
              }
            }
          });
        }

        tickets = Array.from(existingMap.values());
        saveTickets();

        // 3. Sincronizar en lote al servidor
        if (tickets.length > 0) {
          await fetch('/api/tickets/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tickets)
          });
        }

        if (typeof renderRepairsTable === "function") renderRepairsTable();
        if (typeof renderStats === "function") renderStats();
        return tickets;
      }
    } catch (e) {
      // Backend offline o sin conexión
    }
    return tickets;
  }

  function getAllTickets() {
    if (!tickets || tickets.length === 0) loadTickets();
    return tickets;
  }

  function getTicketById(id) {
    if (!tickets || tickets.length === 0) loadTickets();
    return tickets.find(t => t.id === id) || null;
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
      deviceLockPattern: data.deviceLockPattern || "",
      deviceChecklist: data.deviceChecklist || {
        display: "ok",
        backCover: "ok",
        battery: "ok",
        cameras: "ok",
        audio: "ok",
        housing: "ok",
        signal: "ok",
        liquid: "ok"
      },
      deviceConditionNotes: data.deviceConditionNotes || "",
      issueDescription: data.issueDescription || "Ingreso general para diagnóstico",
      status: data.status || "received",
      statusStep: getStepNumber(data.status || "received"),
      dateReceived: new Date().toISOString().replace("T", " ").slice(0, 16),
      technician: data.technician || "Laboratorio WILOTECH",
      technicianNotes: data.technicianNotes || "Equipo recepcionado. Pendiente de apertura e inspección en microscopio.",
      partsUsed: data.partsUsed ? (Array.isArray(data.partsUsed) ? data.partsUsed : data.partsUsed.split(",").map(s => s.trim())) : ["Diagnóstico inicial de laboratorio"],
      warrantyStickers: data.warrantyStickers || [],
      devicePhotos: data.devicePhotos || [],
      finalCost: parseFloat(data.finalCost) || 0,
      partCost: parseFloat(data.partCost) || 0,
      warranty: data.warranty || "90 días de garantía por escrito"
    };

    tickets.unshift(newTicket);
    saveTickets();
    syncTicketWithBackend(newTicket);

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

  function getTicketById(ticketId) {
    if (!tickets || tickets.length === 0) loadTickets();
    return tickets.find(t => t.id === ticketId) || null;
  }

  function updateTicket(ticketId, data) {
    if (!tickets || tickets.length === 0) loadTickets();
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return null;

    if (data.clientName !== undefined) ticket.clientName = data.clientName;
    if (data.clientType !== undefined) ticket.clientType = data.clientType;
    if (data.clientDni !== undefined) ticket.clientDni = data.clientDni;
    if (data.clientPhone !== undefined) ticket.clientPhone = data.clientPhone;
    if (data.clientAddress !== undefined) ticket.clientAddress = data.clientAddress;
    if (data.deviceType !== undefined) ticket.deviceType = data.deviceType;
    if (data.deviceBrand !== undefined) ticket.deviceBrand = data.deviceBrand;
    if (data.deviceModel !== undefined) ticket.deviceModel = data.deviceModel;
    if (data.deviceColor !== undefined) ticket.deviceColor = data.deviceColor;
    if (data.deviceStorage !== undefined) ticket.deviceStorage = data.deviceStorage;
    if (data.serialOrImei !== undefined) ticket.serialOrImei = data.serialOrImei;
    if (data.deviceLockType !== undefined) ticket.deviceLockType = data.deviceLockType;
    if (data.deviceLockCode !== undefined) ticket.deviceLockCode = data.deviceLockCode;
    if (data.deviceLockPattern !== undefined) ticket.deviceLockPattern = data.deviceLockPattern;
    if (data.deviceChecklist !== undefined) ticket.deviceChecklist = data.deviceChecklist;
    if (data.deviceConditionNotes !== undefined) ticket.deviceConditionNotes = data.deviceConditionNotes;
    if (data.issueDescription !== undefined) ticket.issueDescription = data.issueDescription;
    if (data.status !== undefined) {
      ticket.status = data.status;
      ticket.statusStep = getStepNumber(data.status);
    }
    if (data.technician !== undefined) ticket.technician = data.technician;
    if (data.technicianNotes !== undefined) ticket.technicianNotes = data.technicianNotes;
    if (data.partsUsed !== undefined) {
      ticket.partsUsed = Array.isArray(data.partsUsed) ? data.partsUsed : data.partsUsed.split(",").map(s => s.trim());
    }
    if (data.warrantyStickers !== undefined) ticket.warrantyStickers = data.warrantyStickers;
    if (data.devicePhotos !== undefined) ticket.devicePhotos = data.devicePhotos;
    if (data.finalCost !== undefined) ticket.finalCost = parseFloat(data.finalCost) || 0;
    if (data.partCost !== undefined) ticket.partCost = parseFloat(data.partCost) || 0;
    if (data.warranty !== undefined) ticket.warranty = data.warranty;

    saveTickets();
    syncTicketWithBackend(ticket);

    upsertCustomer({
      name: ticket.clientName,
      type: ticket.clientType,
      dni: ticket.clientDni,
      phone: ticket.clientPhone,
      address: ticket.clientAddress
    });

    return ticket;
  }

  function addTicketPhoto(ticketId, photoData) {
    const ticket = getTicketById(ticketId);
    if (!ticket) return false;
    if (!ticket.devicePhotos) ticket.devicePhotos = [];

    const newPhoto = {
      id: "photo_" + Date.now(),
      url: photoData.url,
      caption: photoData.caption || "Fotografía de diagnóstico de laboratorio",
      date: new Date().toISOString().replace("T", " ").slice(0, 16)
    };

    ticket.devicePhotos.push(newPhoto);
    saveTickets();
    syncTicketWithBackend(ticket);
    return newPhoto;
  }

  function deleteTicketPhoto(ticketId, photoId) {
    const ticket = getTicketById(ticketId);
    if (!ticket || !ticket.devicePhotos) return false;
    ticket.devicePhotos = ticket.devicePhotos.filter(p => p.id !== photoId);
    saveTickets();
    syncTicketWithBackend(ticket);
    return true;
  }

  function saveWarrantyStickers(ticketId, stickersList) {
    const ticket = getTicketById(ticketId);
    if (!ticket) return false;
    ticket.warrantyStickers = stickersList || [];
    saveTickets();
    syncTicketWithBackend(ticket);
    return true;
  }

  function updateTicketStatus(ticketId, newStatus, newNotes = null) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.status = newStatus;
      ticket.statusStep = getStepNumber(newStatus);
      if (newNotes) ticket.technicianNotes = newNotes;
      saveTickets();
      syncTicketWithBackend(ticket);
      return true;
    }
    return false;
  }

  function deleteTicket(ticketId) {
    if (!ticketId) return;
    if (!deletedTicketIds.includes(ticketId)) {
      deletedTicketIds.push(ticketId);
      saveDeletedTickets();
    }
    tickets = tickets.filter(t => t.id !== ticketId);
    saveTickets();
    syncDeleteTicketWithBackend(ticketId);
  }

  function deleteAllTickets() {
    tickets.forEach(t => {
      if (t && t.id && !deletedTicketIds.includes(t.id)) {
        deletedTicketIds.push(t.id);
      }
    });
    saveDeletedTickets();
    tickets = [];
    saveTickets();
    fetch('/api/tickets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([])
    }).catch(() => {});
  }

  function restoreDefaultTickets() {
    deletedTicketIds = [];
    saveDeletedTickets();
    tickets = [...TECH_CATALOG.sampleTickets];
    saveTickets();
    fetchTicketsFromBackend();
    return tickets;
  }

  // -------------------------------------------------------------
  // 3. MENSAJES AUTOMÁTICOS DE WHATSAPP AL CLIENTE (PLANTILLAS RÁPIDAS)
  // -------------------------------------------------------------
  function notifyClientWhatsApp(ticketId, templateType = null) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    let statusText = "";
    let callToAction = "";
    const effectiveTemplate = templateType || ticket.status;

    switch (effectiveTemplate) {
      case "received":
        statusText = "fue ingresado con éxito en nuestro laboratorio técnico.";
        callToAction = "Nuestro equipo comenzará las mediciones en banco de trabajo a la brevedad.";
        break;
      case "diagnosing":
      case "budget":
        statusText = "tiene su DIAGNÓSTICO Y PRESUPUESTO LISTO.";
        callToAction = `Presupuesto: $${ticket.finalCost} USD. Informe del laboratorio: "${ticket.technicianNotes || ticket.issueDescription}".`;
        break;
      case "waiting_parts":
        statusText = "se encuentra en espera de arribo de repuestos originales OEM.";
        callToAction = "Apenas contemos con los componentes procederemos a la micro-soldadura.";
        break;
      case "repairing":
        statusText = "se encuentra EN REPARACIÓN / pruebas de estrés térmico.";
        callToAction = "Estamos realizando los protocolos finales de control de calidad.";
        break;
      case "ready":
        statusText = "¡YA ESTÁ REPARADO Y LISTO PARA RETIRAR! 🎉";
        callToAction = `Puedes pasar por nuestro laboratorio en Colón 1475. Presupuesto final: $${ticket.finalCost} USD (Garantía: ${ticket.warranty || '90 días'}).`;
        break;
      case "delivered":
        statusText = "ha sido entregado.";
        callToAction = "¡Gracias por confiar en WILOTECH! Tienes soporte posventa y garantía vigente.";
        break;
      default:
        statusText = "presenta novedades en el laboratorio.";
        callToAction = `Estado: ${ticket.status}. Presupuesto: $${ticket.finalCost} USD.`;
        break;
    }

    const message = `Hola *${ticket.clientName}*! Te informamos desde *WILOTECH - Laboratorio Técnico*:\n\n` +
      `📦 *Ticket N°:* #${ticket.id}\n` +
      `📱 *Equipo:* ${ticket.deviceModel}\n` +
      `⚡ *Estado:* ${statusText}\n\n` +
      `📝 *Detalle:* ${callToAction}\n\n` +
      `Seguí tu reparación en tiempo real en nuestra web. ¡Saludos!`;

    const cleanPhone = (ticket.clientPhone || "").replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
  }

  // -------------------------------------------------------------
  // 4. IMPRESIÓN DE COMPROBANTE TÉCNICO & ROTULADORA TÉRMICA (58mm/80mm)
  // -------------------------------------------------------------
  function printTicketReceipt(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    function formatCheckStateLabel(st) {
      if (st === 'damaged') return '<span style="color:#b91c1c; font-weight:bold;">⚠️ ROTO / DAÑADO</span>';
      if (st === 'untested') return '<span style="color:#64748b;">❓ SIN PROBAR</span>';
      return '<span style="color:#15803d; font-weight:bold;">✓ OK</span>';
    }

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
          <div>Tel / WhatsApp: +54 223 591-4163</div>
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
          <div class="row"><span>Seguridad / Bloqueo:</span><strong>${ticket.deviceLockType || 'Sin Bloqueo'} ${ticket.deviceLockCode ? `[ ${ticket.deviceLockCode} ]` : ''} ${ticket.deviceLockPattern ? `[ Patrón 3x3: ${ticket.deviceLockPattern} ]` : ''}</strong></div>
          <div class="row"><span>Falla Declarada:</span><span>${ticket.issueDescription}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Inspección de Recepción & Estado Físico Preexistente</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; font-size: 11px; margin-bottom: 6px;">
            <div>📱 Pantalla / Touch: ${formatCheckStateLabel(ticket.deviceChecklist?.display)}</div>
            <div>🖼️ Tapa / Vidrio Trasero: ${formatCheckStateLabel(ticket.deviceChecklist?.backCover)}</div>
            <div>🔋 Batería / Carga: ${formatCheckStateLabel(ticket.deviceChecklist?.battery)}</div>
            <div>📷 Cámaras (Frontal/Trasera): ${formatCheckStateLabel(ticket.deviceChecklist?.cameras)}</div>
            <div>🔊 Audio / Parlante / Mic: ${formatCheckStateLabel(ticket.deviceChecklist?.audio)}</div>
            <div>🔲 Marco / Chasis / Botones: ${formatCheckStateLabel(ticket.deviceChecklist?.housing)}</div>
            <div>📶 Wi-Fi / Bluetooth / Señal: ${formatCheckStateLabel(ticket.deviceChecklist?.signal)}</div>
            <div>💧 Daño por Agua / Sulfato: ${formatCheckStateLabel(ticket.deviceChecklist?.liquid)}</div>
          </div>
          ${ticket.deviceConditionNotes ? `<div class="row" style="margin-top:4px;"><span>Observaciones / Daños Preexistentes:</span><strong style="color: #dc2626;">${ticket.deviceConditionNotes}</strong></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">Diagnóstico & Presupuesto</div>
          <div class="row"><span>Informe Taller:</span><span>${ticket.technicianNotes}</span></div>
          <div class="row"><span>Costo Total:</span><strong>$${ticket.finalCost} USD</strong></div>
          <div class="row"><span>Garantía:</span><span>${ticket.warranty}</span></div>
        </div>

        ${ticket.warrantyStickers && ticket.warrantyStickers.length > 0 ? `
        <div class="section" style="border: 1px solid #333; padding: 8px; border-radius: 4px; background: #fafafa;">
          <div class="section-title" style="border-bottom: 1px solid #333;">🏷️ Control de Garantía & Pegatinas de Seguridad</div>
          ${ticket.warrantyStickers.map(st => `
            <div class="row" style="margin-top: 4px;">
              <span>🔧 ${st.partName}:</span>
              <strong style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-family: monospace;">PEGATINA: ${st.stickerCode}</strong>
            </div>
          `).join('')}
          <div style="font-size: 8.5px; color: #555; margin-top: 6px; font-style: italic;">
            * Los componentes instalados cuentan con sellos / pegatinas de seguridad inviolables. Su remoción o daño anula la garantía.
          </div>
        </div>
        ` : ''}

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

  function printThermalTicket(ticketId, width = "80mm") {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const trackingUrl = encodeURIComponent(`${window.location.origin}/index.html?ticket=${ticket.id}`);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${trackingUrl}`;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta Térmica #${ticket.id}</title>
        <style>
          @page { size: ${width} auto; margin: 0; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            width: ${width === "58mm" ? "54mm" : "76mm"}; 
            margin: 0 auto; 
            padding: 6px 4px; 
            color: #000; 
            background: #fff;
            font-size: 11px;
            line-height: 1.2;
          }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
          .logo { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
          .ticket-id { font-size: 18px; font-weight: 900; background: #000; color: #fff; padding: 2px 6px; display: inline-block; margin: 4px 0; }
          .line { border-bottom: 1px dashed #000; margin: 5px 0; }
          .bold { font-weight: bold; }
          .qr-container { text-align: center; margin: 8px 0; }
          .qr-container img { width: 110px; height: 110px; }
          .pattern-box { border: 1px solid #000; padding: 4px; font-size: 10px; margin-top: 4px; text-align: center; background: #f0f0f0; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">WILOTECH</div>
          <div style="font-size: 9px;">LABORATORIO DE REPARACIONES</div>
          <div class="ticket-id">#${ticket.id}</div>
          <div style="font-size: 9px;">${ticket.dateReceived}</div>
        </div>

        <div><span class="bold">CLIENTE:</span> ${ticket.clientName}</div>
        <div><span class="bold">TEL:</span> ${ticket.clientPhone}</div>
        <div class="line"></div>
        <div><span class="bold">EQUIPO:</span> ${ticket.deviceModel}</div>
        ${ticket.serialOrImei ? `<div><span class="bold">IMEI/SN:</span> ${ticket.serialOrImei}</div>` : ''}
        <div><span class="bold">FALLA:</span> ${ticket.issueDescription}</div>
        <div class="line"></div>
        <div><span class="bold">BLOQUEO:</span> ${ticket.deviceLockType || 'Sin Bloqueo'}</div>
        ${ticket.deviceLockCode ? `<div><span class="bold">CLAVE:</span> ${ticket.deviceLockCode}</div>` : ''}
        ${ticket.deviceLockPattern ? `
          <div class="pattern-box">
            <span class="bold">PATRÓN 3x3:</span> ${ticket.deviceLockPattern}
          </div>
        ` : ''}
        <div class="line"></div>

        <div class="qr-container">
          <img src="${qrApiUrl}" alt="QR Tracking">
          <div style="font-size: 9px; margin-top: 2px;">Escanear para Rastreo de Ticket</div>
        </div>

        <div style="text-align: center; font-size: 8px; margin-top: 6px;">
          WILOTECH • Colón 1475 • Tel: 223 591-4163
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
    getTicketById: getTicketById,
    createNewTicket: createNewTicket,
    updateTicket: updateTicket,
    updateTicketStatus: updateTicketStatus,
    deleteTicket: deleteTicket,
    deleteAllTickets: deleteAllTickets,
    restoreDefaultTickets: restoreDefaultTickets,
    addTicketPhoto: addTicketPhoto,
    deleteTicketPhoto: deleteTicketPhoto,
    saveWarrantyStickers: saveWarrantyStickers,
    notifyClientWhatsApp: notifyClientWhatsApp,
    printTicketReceipt: printTicketReceipt,
    printThermalTicket: printThermalTicket,
    getInventory: getInventory,
    adjustStock: adjustStock,
    getAllCustomers: getAllCustomers,
    findCustomerByDniOrPhone: findCustomerByDniOrPhone,
    upsertCustomer: upsertCustomer,
    deleteCustomer: deleteCustomer
  };
})();

// ============================================================================
// WILOTECH OS — ARCHITECTURE & SCREEN CONTROLLERS ("Una pantalla = una tarea")
// ============================================================================

let currentActiveScreen = 'dashboard';
let currentDetailTicketId = null;
let currentRepairsFilter = 'all';
let isPinVisible = false;

function navigateTo(screenId) {
  currentActiveScreen = screenId;

  // Hide all screens
  document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));

  // Update navigation buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('text-cyan-400', 'bg-slate-900', 'border', 'border-cyan-500/30', 'shadow-[0_0_15px_rgba(0,210,255,0.1)]');
    btn.classList.add('text-slate-400');
  });

  const targetScreen = document.getElementById(`screen-${screenId}`);
  if (targetScreen) targetScreen.classList.remove('hidden');

  const targetNav = document.getElementById(`nav-${screenId}`);
  if (targetNav) {
    targetNav.classList.remove('text-slate-400');
    targetNav.classList.add('text-cyan-400', 'bg-slate-900', 'border', 'border-cyan-500/30');
  }

  // Execute Screen-Specific Renderer
  if (screenId === 'dashboard') renderDashboardScreen();
  else if (screenId === 'repairs') renderRepairsScreen();
  else if (screenId === 'customers') renderCustomersScreen();
  else if (screenId === 'inventory') renderInventoryScreen();
  else if (screenId === 'tariff') renderTariffScreen();
  else if (screenId === 'finances') renderFinancesScreen();
  else if (screenId === 'gremios') renderAdminGremiosUsers();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ----------------------------------------------------------------------------
// PANTALLA 1: 🏠 DASHBOARD (Responder en 5s: ¿Qué está pasando hoy en WILOTECH?)
// ----------------------------------------------------------------------------
function renderDashboardScreen() {
  const tickets = TechAdmin.getAllTickets();

  // Fecha del día en español
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const todayStr = new Date().toLocaleDateString('es-ES', options);
  const dateEl = document.getElementById('dashTodayDate');
  if (dateEl) dateEl.innerText = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  // 1. Métricas Principales (4 tarjetas)
  const activeTickets = tickets.filter(t => t.status !== 'delivered');
  const diagnosingTickets = tickets.filter(t => t.status === 'diagnosing');
  const readyTickets = tickets.filter(t => t.status === 'ready');

  let monthIncome = 0;
  tickets.forEach(t => {
    monthIncome += parseFloat(t.finalCost) || 0;
  });

  document.getElementById('dashMetricActive').innerText = activeTickets.length;
  document.getElementById('dashMetricDiagnosing').innerText = diagnosingTickets.length;
  document.getElementById('dashMetricReady').innerText = readyTickets.length;
  document.getElementById('dashMetricIncome').innerText = `$${monthIncome.toLocaleString('en-US')} USD`;

  // Badge en el menú
  const badgeRepairs = document.getElementById('navRepairsBadge');
  if (badgeRepairs) badgeRepairs.innerText = activeTickets.length;

  // 2. 🚨 Atención Requerida
  renderAttentionRequiredList(tickets);

  // 3. 📊 Flujo de Reparaciones en Banco
  renderFlowCounters(tickets);

  // 4. Actividad Reciente
  renderRecentActivityLog(tickets);
}

function renderAttentionRequiredList(tickets) {
  const container = document.getElementById('dashAttentionList');
  if (!container) return;

  const alerts = [];

  tickets.forEach(t => {
    const daysElapsed = calculateDaysElapsed(t.dateReceived);
    if (t.status === 'budget_pending') {
      alerts.push({
        id: t.id,
        model: t.deviceModel || 'Dispositivo',
        issue: 'Esperando aprobación de presupuesto',
        timeStr: `${daysElapsed} días ⚠️`,
        type: 'amber'
      });
    } else if (t.status === 'waiting_parts') {
      alerts.push({
        id: t.id,
        model: t.deviceModel || 'Dispositivo',
        issue: 'Esperando repuesto de proveedor',
        timeStr: `${daysElapsed} días ⚠️`,
        type: 'amber'
      });
    } else if (t.status === 'ready') {
      alerts.push({
        id: t.id,
        model: t.deviceModel || 'Dispositivo',
        issue: 'Listo para retirar — cliente no avisado / pendiente',
        timeStr: `${daysElapsed} días`,
        type: 'emerald'
      });
    }
  });

  if (alerts.length === 0) {
    container.innerHTML = `<p class="text-xs font-mono text-slate-500 py-2">🎉 No hay alertas críticas de atención requerida hoy.</p>`;
    return;
  }

  container.innerHTML = alerts.slice(0, 5).map(a => `
    <div onclick="openRepairDetail('${a.id}')" class="cursor-pointer p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between gap-4 transition-all text-xs font-mono">
      <div class="flex items-center gap-3">
        <span class="text-amber-400 font-bold">⚠️ ${a.id}</span>
        <div>
          <h4 class="font-bold text-white font-tech text-sm">${a.model}</h4>
          <p class="text-slate-400">${a.issue}</p>
        </div>
      </div>
      <span class="px-2.5 py-1 rounded-xl bg-slate-950 text-amber-300 font-bold border border-slate-800 shrink-0">${a.timeStr}</span>
    </div>
  `).join('');
}

function renderFlowCounters(tickets) {
  const counts = { received: 0, diagnosing: 0, budget_pending: 0, repairing: 0, ready: 0 };
  tickets.forEach(t => {
    const st = t.status || 'received';
    if (counts[st] !== undefined) counts[st]++;
  });

  for (const [key, val] of Object.entries(counts)) {
    const el = document.getElementById(`cntFlow-${key}`);
    if (el) el.innerText = val;
  }
}

function renderRecentActivityLog(tickets) {
  const container = document.getElementById('dashRecentActivityList');
  if (!container) return;

  const logs = [
    { time: '14:32', text: `WT-1056 pasó a reparación (${tickets[0] ? tickets[0].deviceModel : 'iPhone 13'})` },
    { time: '13:55', text: 'Cliente aprobó presupuesto WT-1054' },
    { time: '13:21', text: 'Nuevo equipo ingresado WT-1057 (PS5)' },
    { time: '12:48', text: 'WT-1052 marcado como listo para retiro' }
  ];

  container.innerHTML = logs.map(l => `
    <div class="py-2.5 flex items-center gap-3">
      <span class="text-slate-500 font-bold w-12">${l.time}</span>
      <span class="text-slate-300">${l.text}</span>
    </div>
  `).join('');
}

// ----------------------------------------------------------------------------
// PANTALLA 2: 🔧 REPARACIONES (TABLA + KANBAN + TIEMPO EN TALLER)
// ----------------------------------------------------------------------------
function renderRepairsScreen() {
  renderRepairsTable();
  renderRepairsKanban();
}

function renderRepairsTable() {
  const tbody = document.getElementById('repairsTableBody');
  if (!tbody) return;

  const tickets = TechAdmin.getAllTickets();
  const search = (document.getElementById('repairSearchInput')?.value || '').toLowerCase().trim();

  let filtered = tickets;
  if (currentRepairsFilter !== 'all') {
    filtered = filtered.filter(t => (t.status || 'received') === currentRepairsFilter);
  }

  if (search) {
    filtered = filtered.filter(t =>
      t.id.toLowerCase().includes(search) ||
      (t.serialOrImei && t.serialOrImei.toLowerCase().includes(search)) ||
      (t.clientName && t.clientName.toLowerCase().includes(search)) ||
      (t.clientPhone && t.clientPhone.includes(search)) ||
      (t.deviceModel && t.deviceModel.toLowerCase().includes(search))
    );
  }

  tbody.innerHTML = filtered.map(t => {
    const timeInWorkshop = formatTimeInWorkshop(t.dateReceived);
    return `
      <tr onclick="openRepairDetail('${t.id}')" class="cursor-pointer hover:bg-slate-900/80 transition-colors">
        <td class="p-4 font-mono font-bold text-cyan-400">#${t.id}</td>
        <td class="p-4 font-semibold text-white">${t.deviceBrand || ''} ${t.deviceModel || 'Dispositivo'}<br><span class="text-slate-500 font-mono text-[10px]">SN/IMEI: ${t.serialOrImei || 'N/A'}</span></td>
        <td class="p-4">${t.clientName || 'Cliente'}<br><span class="text-slate-500 font-mono text-[10px]">${t.clientPhone || ''}</span></td>
        <td class="p-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${getStatusBadgeClass(t.status)}">${formatStatusLabel(t.status)}</span></td>
        <td class="p-4 font-mono text-slate-300">${t.technician || 'Wilson'}</td>
        <td class="p-4 font-mono text-xs font-bold ${timeInWorkshop.includes('⚠️') ? 'text-amber-400' : 'text-emerald-400'}">${timeInWorkshop}</td>
        <td class="p-4 text-right">
          <button onclick="event.stopPropagation(); openRepairDetail('${t.id}');" class="px-3 py-1 rounded-xl bg-slate-900 hover:bg-cyan-950 text-cyan-300 font-mono text-[11px] border border-slate-800">
            👁️ Ficha
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRepairsKanban() {
  const tickets = TechAdmin.getAllTickets();
  const statuses = ['received', 'diagnosing', 'budget_pending', 'approved', 'repairing', 'testing', 'ready', 'delivered'];

  statuses.forEach(st => {
    const col = document.getElementById(`kanbanCol-${st}`);
    const cnt = document.getElementById(`kanbanCnt-${st}`);
    if (col) col.innerHTML = '';

    const colTickets = tickets.filter(t => (t.status || 'received') === st);
    if (cnt) cnt.innerText = colTickets.length;

    if (col) {
      colTickets.forEach(t => {
        const card = document.createElement('div');
        card.className = 'kanban-card p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 cursor-grab space-y-2 text-xs font-mono shadow-md';
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('ticket_id', t.id);
          card.classList.add('opacity-40');
        });
        card.addEventListener('dragend', () => card.classList.remove('opacity-40'));

        card.innerHTML = `
          <div class="flex justify-between items-center text-[10px]">
            <span class="font-bold text-cyan-400">#${t.id}</span>
            <span class="text-slate-500">${formatTimeInWorkshop(t.dateReceived)}</span>
          </div>
          <h4 class="font-bold text-white truncate font-tech text-sm">${t.deviceModel || 'Equipo'}</h4>
          <p class="text-slate-400 truncate">${t.clientName || 'Cliente'}</p>
          <div class="pt-2 border-t border-slate-800/80 flex justify-between items-center">
            <span class="font-bold text-emerald-400">$${t.finalCost || 0} USD</span>
            <button onclick="openRepairDetail('${t.id}')" class="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">👁️ Ficha</button>
          </div>
        `;
        col.appendChild(card);
      });
    }
  });
}

function switchRepairsView(viewType) {
  const tableBtn = document.getElementById('btnViewTable');
  const kanbanBtn = document.getElementById('btnViewKanban');
  const tableView = document.getElementById('repairsViewTable');
  const kanbanView = document.getElementById('repairsViewKanban');

  if (viewType === 'table') {
    tableView.classList.remove('hidden');
    kanbanView.classList.add('hidden');
    tableBtn.className = 'px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1.5';
    kanbanBtn.className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-bold flex items-center gap-1.5';
  } else {
    tableView.classList.add('hidden');
    kanbanView.classList.remove('hidden');
    kanbanBtn.className = 'px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1.5';
    tableBtn.className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-bold flex items-center gap-1.5';
  }
}

function setRepairsFilter(status) {
  currentRepairsFilter = status;
  document.querySelectorAll('.rep-filter-btn').forEach(btn => {
    btn.className = 'rep-filter-btn px-3 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800';
  });

  renderRepairsTable();
}

function filterRepairsByStatus(status) {
  navigateTo('repairs');
  setRepairsFilter(status);
}

function filterRepairsTable() {
  renderRepairsTable();
}

// ----------------------------------------------------------------------------
// PANTALLA 3: 🔬 FICHA DE REPARACIÓN (EXPEDIENTE WT-XXXX CON LOS 10 BLOQUES)
// ----------------------------------------------------------------------------
function openRepairDetail(ticketId) {
  currentDetailTicketId = ticketId;
  const ticket = TechAdmin.getTicketById(ticketId);
  if (!ticket) return;

  navigateTo('repair-detail');

  document.getElementById('detailTicketId').innerText = `WT-${ticket.id.replace('WT-', '')}`;
  document.getElementById('detailStatusBadge').innerText = formatStatusLabel(ticket.status).toUpperCase();
  document.getElementById('detailDeviceSub').innerText = `${ticket.deviceBrand || ''} ${ticket.deviceModel || ''} • IMEI: ${ticket.serialOrImei || 'N/A'}`;

  // Bloque 1 — Cliente
  document.getElementById('detailClientName').innerText = ticket.clientName || 'Cliente Mostrador';
  document.getElementById('detailClientPhone').innerText = ticket.clientPhone || 'No registrado';
  document.getElementById('detailClientDni').innerText = ticket.clientDni || 'No registrado';

  // Bloque 2 — Equipo
  document.getElementById('detailModel').innerText = `${ticket.deviceBrand || ''} ${ticket.deviceModel || ''}`;
  document.getElementById('detailStorageColor').innerText = `${ticket.deviceStorage || '256 GB'} / ${ticket.deviceColor || 'Negro'}`;
  document.getElementById('detailImei').innerText = ticket.serialOrImei || 'No registrado';

  isPinVisible = false;
  document.getElementById('detailLockCode').innerText = '••••••';

  // Bloque 3 — Diagnóstico
  document.getElementById('detailReportedIssue').innerText = `"${ticket.issueDescription || 'Falla no especificada'}"`;
  document.getElementById('detailTechNotes').value = ticket.technicianNotes || 'Medición PP_VDD_MAIN: 4.2V OK. Línea LDO03 con fuga a tierra. Reemplazar capacitor C1048.';

  // Bloque 5 — Repuestos Utilizados
  renderDetailParts(ticket);

  // Bloque 6 & 8 — Presupuesto
  const partC = parseFloat(ticket.partCost) || 80;
  const finalC = parseFloat(ticket.finalCost) || 160;
  const laborC = finalC - partC - 20;

  document.getElementById('detailPresPart').innerText = `$${partC} USD`;
  document.getElementById('detailPresLabor').innerText = `$${Math.max(0, laborC)} USD`;
  document.getElementById('detailPresTotal').innerText = `$${finalC} USD`;
  document.getElementById('detailPresStatus').innerText = ticket.status === 'approved' ? '🟢 APROBADO' : '🟡 Pendiente de aprobación';

  // Bloque 9 — Historial Timeline
  renderDetailTimeline(ticket);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function togglePinVisibility() {
  if (!currentDetailTicketId) return;
  const ticket = TechAdmin.getTicketById(currentDetailTicketId);
  if (!ticket) return;

  const pinEl = document.getElementById('detailLockCode');
  if (isPinVisible) {
    pinEl.innerText = '••••••';
    isPinVisible = false;
  } else {
    pinEl.innerText = ticket.deviceLockCode || '123456';
    isPinVisible = true;
  }
}

function renderDetailParts(ticket) {
  const container = document.getElementById('detailPartsList');
  if (!container) return;

  const parts = ticket.partsUsed || ["Pantalla iPhone 15 Pro OEM - $80 USD", "IC de Carga Hydra - $12 USD"];
  let totalCost = parseFloat(ticket.partCost) || 92;

  container.innerHTML = parts.map(p => `
    <div class="flex justify-between items-center p-3 rounded-xl bg-slate-900 border border-slate-800">
      <span class="text-slate-300 font-mono">${p}</span>
      <span class="font-bold text-cyan-400">✓</span>
    </div>
  `).join('');

  document.getElementById('detailTotalPartCost').innerText = `$${totalCost} USD`;
}

function renderDetailTimeline(ticket) {
  const container = document.getElementById('detailTimelineList');
  if (!container) return;

  const logs = [
    { date: '07/10 10:15', icon: '📥', text: 'Equipo recibido en recepción' },
    { date: '07/10 10:48', icon: '🔬', text: 'Diagnóstico iniciado en banco' },
    { date: '07/10 12:32', icon: '💰', text: 'Presupuesto generado ($160 USD)' },
    { date: '07/10 13:10', icon: '📱', text: 'Presupuesto enviado por WhatsApp' },
    { date: '07/10 13:22', icon: '✅', text: 'Cliente aprobó presupuesto' },
    { date: '07/10 14:05', icon: '🔧', text: 'Reparación iniciada en microscopio' }
  ];

  container.innerHTML = logs.map(l => `
    <div class="relative pl-2 py-1 space-y-0.5">
      <div class="flex items-center gap-2">
        <span class="text-slate-500 text-[10px] font-bold">${l.date}</span>
        <span class="text-white font-bold">${l.icon} ${l.text}</span>
      </div>
    </div>
  `).join('');
}

function approveQualityControl() {
  const checkboxes = document.querySelectorAll('.qc-check');
  let allChecked = true;
  checkboxes.forEach(c => { if (!c.checked) allChecked = false; });

  if (!allChecked) {
    if (!confirm("No todos los ítems de Control de Calidad están marcados. ¿Aprobar igualmente QC?")) return;
  }

  if (currentDetailTicketId) {
    TechAdmin.updateTicketStatus(currentDetailTicketId, 'ready');
    alert("✅ Control de Calidad Aprobado. La orden pasó a estado LISTO PARA RETIRO.");
    openRepairDetail(currentDetailTicketId);
  }
}

// ----------------------------------------------------------------------------
// PANTALLA 4: 👥 CLIENTES
// ----------------------------------------------------------------------------
function renderCustomersScreen() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  const customers = TechAdmin.getAllCustomers();
  const search = (document.getElementById('customerSearchInput')?.value || '').toLowerCase().trim();

  let filtered = customers;
  if (search) {
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(search) ||
      (c.dni && c.dni.includes(search)) ||
      (c.phone && c.phone.includes(search))
    );
  }

  tbody.innerHTML = filtered.map(c => `
    <tr class="hover:bg-slate-900/80 transition-colors">
      <td class="p-4 font-semibold text-white">${c.name} ${c.type === 'Gremio' ? '⭐' : ''}<br><span class="text-slate-500 font-mono text-[10px]">DNI: ${c.dni || 'N/A'}</span></td>
      <td class="p-4 font-mono text-cyan-400">${c.phone || 'No registrado'}</td>
      <td class="p-4 font-mono">4 reparaciones</td>
      <td class="p-4 font-mono text-slate-400">Hoy</td>
      <td class="p-4 text-right">
        <button class="px-3 py-1 rounded-xl bg-slate-900 text-cyan-300 font-mono text-[11px] border border-slate-800">Ver Ficha</button>
      </td>
    </tr>
  `).join('');
}

function filterCustomersTable() {
  renderCustomersScreen();
}

// ----------------------------------------------------------------------------
// PANTALLA 5: 📦 INVENTARIO (CON UBICACIÓN FÍSICA EXACTA)
// ----------------------------------------------------------------------------
function renderInventoryScreen() {
  const tbody = document.getElementById('inventoryFullTableBody');
  if (!tbody) return;

  const inventory = [
    { code: 'SCR15', name: 'Pantalla iPhone 15 Pro OLED OEM', qty: 4, min: 2, cost: 80, location: 'Estante B → Cajón 4 → Compartimento 2' },
    { code: 'IC01', name: 'IC USB Hydra Tristar Type-C', qty: 1, min: 5, cost: 12, location: 'Estante A → Cajón 2 → Compartimento 1 ⚠️' },
    { code: 'BAT14P', name: 'Batería iPhone 14 Pro Original', qty: 6, min: 3, cost: 35, location: 'Estante B → Cajón 1' },
    { code: 'HDMI-PS5', name: 'Puerto HDMI PlayStation 5 OEM', qty: 10, min: 4, cost: 8, location: 'Estante C → Cajón 3' }
  ];

  let totalQty = 0;
  let lowQty = 0;
  let totalVal = 0;

  inventory.forEach(i => {
    totalQty += i.qty;
    if (i.qty <= i.min) lowQty++;
    totalVal += (i.qty * i.cost);
  });

  document.getElementById('invTotalCount').innerText = totalQty;
  document.getElementById('invLowCount').innerText = lowQty;
  document.getElementById('invTotalValue').innerText = `$${totalVal} USD`;

  tbody.innerHTML = inventory.map(i => `
    <tr class="hover:bg-slate-900/80 transition-colors">
      <td class="p-4 font-mono font-bold text-cyan-400">${i.code}</td>
      <td class="p-4 font-semibold text-white">${i.name}</td>
      <td class="p-4 font-mono font-bold ${i.qty <= i.min ? 'text-rose-400' : 'text-emerald-400'}">${i.qty}</td>
      <td class="p-4 font-mono text-slate-400">${i.min}</td>
      <td class="p-4 font-mono text-emerald-300">$${i.cost} USD</td>
      <td class="p-4 font-mono font-semibold text-amber-300 bg-slate-900/60">${i.location}</td>
    </tr>
  `).join('');
}

// ----------------------------------------------------------------------------
// PANTALLA 6: 💰 TARIFARIO DE REPARACIONES Y SERVICIOS
// ----------------------------------------------------------------------------
function renderTariffScreen() {
  const container = document.getElementById('tariffCategoriesGrid');
  if (!container) return;

  const categories = [
    {
      title: '🔬 Microsoldadura & Laboratorio',
      items: [
        { name: 'Diagnóstico en microscopio', cost: 10, price: 20, margin: '50%' },
        { name: 'Reballing IC de Carga / Hydra', cost: 25, price: 85, margin: '70.5%' },
        { name: 'Jumper de línea PP_VDD_MAIN', cost: 15, price: 60, margin: '75%' },
        { name: 'Reparación PMIC / Baseband', cost: 30, price: 110, margin: '72.7%' }
      ]
    },
    {
      title: '🎮 Consolas de Videojuegos',
      items: [
        { name: 'Cambio Puerto HDMI PS5 / Xbox Series', cost: 10, price: 65, margin: '84.6%' },
        { name: 'Mantenimiento Metal Líquido PS5', cost: 8, price: 40, margin: '80%' },
        { name: 'Reparación IC de Video Encoder', cost: 20, price: 90, margin: '77.7%' }
      ]
    },
    {
      title: '📱 Módulos & Pantallas',
      items: [
        { name: 'Instalación Módulo iPhone 15 Pro OLED', cost: 80, price: 160, margin: '50%' },
        { name: 'Instalación Módulo Samsung S24 Ultra', cost: 110, price: 210, margin: '47.6%' }
      ]
    }
  ];

  container.innerHTML = categories.map(c => `
    <div class="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-3">
      <div class="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 class="font-brand font-bold text-white text-sm">${c.title}</h3>
        <button onclick="openEditTariffModal()" class="text-[10px] font-mono text-cyan-400 hover:underline">✏️ Editar</button>
      </div>
      <div class="space-y-2">
        ${c.items.map(i => `
          <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div class="flex justify-between font-bold text-white"><span>${i.name}</span><span class="text-emerald-400">$${i.price} USD</span></div>
            <div class="flex justify-between text-[11px] text-slate-400"><span>Costo: $${i.cost} USD</span><span>Margen: ${i.margin}</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function openEditTariffModal() {
  const name = prompt("Nombre del Servicio / Reparación (ej: Reballing IC Tristar Hydra):");
  if (!name) return;
  const category = prompt("Categoría (ej: Microsoldadura, Consolas, Pantallas, Baterías):", "Microsoldadura");
  const cost = parseFloat(prompt("Costo interno de laboratorio (USD):", "25")) || 0;
  const price = parseFloat(prompt("Precio cobrado al cliente / gremio (USD):", "85")) || 0;

  const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) + "%" : "0%";

  fetch("/api/gremios/price-list", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Role": "admin",
      "X-Admin-Auth": "true"
    },
    body: JSON.stringify({
      title: name,
      category: category,
      price_gremio: price * 1300,
      price_retail: price * 1300 * 1.4,
      stock: "Disponible"
    })
  }).catch(() => {});

  alert(`✅ Tarifa guardada para "${name}": Costo $${cost} USD | Precio $${price} USD (Margen: ${margin})`);
  renderTariffScreen();
}

// ----------------------------------------------------------------------------
// PANTALLA 8: 📊 FINANZAS
// ----------------------------------------------------------------------------
function renderFinancesScreen() {
  document.getElementById('finTodayRev').innerText = '$340 USD';
  document.getElementById('finMonthRev').innerText = '$4,850 USD';
  document.getElementById('finMonthProfit').innerText = '$2,610 USD';
}

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS & MODALS
// ----------------------------------------------------------------------------
function calculateDaysElapsed(dateStr) {
  if (!dateStr) return 0;
  const created = new Date(dateStr.replace(' ', 'T'));
  const now = new Date();
  const diffTime = Math.abs(now - created);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatTimeInWorkshop(dateStr) {
  if (!dateStr) return '0h';
  const created = new Date(dateStr.replace(' ', 'T'));
  const now = new Date();
  const diffMs = now - created;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (days >= 7) return `${days}d ${remHours}h ⚠️`;
  if (days > 0) return `${days}d ${remHours}h`;
  return `${hours}h`;
}

function formatStatusLabel(st) {
  switch (st) {
    case 'received': return 'Recibido';
    case 'diagnosing': return 'Diagnóstico';
    case 'budget_pending': return 'Presupuesto';
    case 'approved': return 'Aprobado';
    case 'repairing': return 'Reparando';
    case 'testing': return 'Pruebas';
    case 'ready': return 'Listo';
    case 'delivered': return 'Entregado';
    default: return 'Recibido';
  }
}

function getStatusBadgeClass(st) {
  switch (st) {
    case 'received': return 'bg-emerald-950 text-emerald-400 border border-emerald-500/30';
    case 'diagnosing': return 'bg-amber-950 text-amber-300 border border-amber-500/30';
    case 'budget_pending': return 'bg-orange-950 text-orange-300 border border-orange-500/30';
    case 'approved': return 'bg-blue-950 text-blue-300 border border-blue-500/30';
    case 'repairing': return 'bg-cyan-950 text-cyan-300 border border-cyan-500/30';
    case 'ready': return 'bg-emerald-950 text-emerald-300 border border-emerald-400';
    default: return 'bg-slate-900 text-slate-400 border border-slate-800';
  }
}

function allowDrop(e) { e.preventDefault(); }

function dropTicket(e, targetStatus) {
  e.preventDefault();
  const ticketId = e.dataTransfer.getData('ticket_id');
  if (!ticketId) return;

  TechAdmin.updateTicketStatus(ticketId, targetStatus);
  renderRepairsKanban();
  renderDashboardScreen();
}

function openToolModal(url) {
  document.getElementById('toolModalFrame').src = url;
  document.getElementById('toolModalContainer').classList.remove('hidden');
}

function closeToolModal() {
  document.getElementById('toolModalContainer').classList.add('hidden');
  document.getElementById('toolModalFrame').src = '';
}

function handleGlobalSearch(e) {
  if (e.key === 'Enter') {
    const query = e.target.value.trim().toLowerCase();
    if (!query) return;

    const tickets = TechAdmin.getAllTickets();
    const match = tickets.find(t =>
      t.id.toLowerCase().includes(query) ||
      (t.serialOrImei && t.serialOrImei.toLowerCase().includes(query)) ||
      (t.clientName && t.clientName.toLowerCase().includes(query)) ||
      (t.clientPhone && t.clientPhone.includes(query))
    );

    if (match) openRepairDetail(match.id);
    else alert("No se encontró ninguna orden con ese criterio.");
  }
}

function openCreateRepairModal() {
  const name = prompt("Nombre del Cliente:");
  if (!name) return;
  const phone = prompt("WhatsApp / Teléfono:");
  const model = prompt("Modelo del Dispositivo (ej: iPhone 15 Pro):");
  const issue = prompt("Falla reportada:");

  const ticket = TechAdmin.createNewTicket({
    clientName: name,
    clientPhone: phone,
    deviceModel: model,
    issueDescription: issue
  });

  renderDashboardScreen();
  openRepairDetail(ticket.id);
}

function sendWhatsAppBudget() {
  if (currentDetailTicketId) TechAdmin.notifyClientWhatsApp(currentDetailTicketId, 'budget');
}

function copyBudgetApprovalLink() {
  if (!currentDetailTicketId) return;
  const link = `${window.location.origin}/presupuesto.html?id=${currentDetailTicketId}`;
  navigator.clipboard.writeText(link);
  alert(`Link de aprobación copiado al portapapeles:\n${link}`);
}

function triggerWhatsAppModal() {
  if (currentDetailTicketId) TechAdmin.notifyClientWhatsApp(currentDetailTicketId);
}

// ----------------------------------------------------------------------------
// GESTIÓN DE ALTA DE USUARIOS GREMIOS Y AUTORIZACIÓN POR ADMINISTRADOR
// ----------------------------------------------------------------------------
async function renderAdminGremiosUsers() {
  const tbody = document.getElementById("admin-gremio-users-tbody");
  const badgePending = document.getElementById("badgePendingCount");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="py-8 text-center text-slate-500 font-mono">
        <span class="inline-block animate-spin text-cyan-400 text-lg mr-2">⏳</span> Consultando lista de gremios registrados...
      </td>
    </tr>
  `;

  try {
    const res = await fetch("/api/gremios/users");
    if (!res.ok) throw new Error("No se pudieron cargar los usuarios de gremios");
    const users = await res.json();

    const pendingUsers = users.filter(u => u.status === 'pending');
    if (badgePending) {
      if (pendingUsers.length > 0) {
        badgePending.className = "text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full animate-pulse";
        badgePending.textContent = `🔔 ${pendingUsers.length} Solicitud(es) Pendiente(s) de Alta`;
      } else {
        badgePending.className = "text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full";
        badgePending.textContent = `✅ Sin solicitudes pendientes`;
      }
    }

    if (users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-6 text-center text-slate-400">
            No hay gremios registrados aún en el sistema.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = users.map(u => {
      let statusBadge = '';
      if (u.status === 'pending') {
        statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold uppercase text-[10px]">⏳ PENDIENTE DE ALTA</span>`;
      } else if (u.status === 'active') {
        statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px]">🟢 ACTIVO / AUTORIZADO</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold uppercase text-[10px]">🔴 DESACTIVADO</span>`;
      }

      const userRole = u.role || 'gremio';
      const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString("es-AR", { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Reciente';

      return `
        <tr class="hover:bg-slate-900/50 transition-colors">
          <td class="py-3.5 px-4 font-bold text-white font-brand">${u.name || 'Gremio Sin Nombre'}</td>
          <td class="py-3.5 px-4 font-mono text-cyan-300">${u.email}</td>
          <td class="py-3.5 px-4 font-mono text-slate-300">${u.phone || 'Sin datos'}</td>
          <td class="py-3.5 px-4 font-mono text-slate-400">${dateStr}</td>
          <td class="py-3.5 px-4">
            <select id="user-role-select-${u.id}" onchange="updateGremioUserRoleAdmin(${u.id}, this.value, '${u.status}')" class="bg-[#05070d] text-slate-200 border border-slate-700 focus:border-[#00f5a0] rounded-xl px-2.5 py-1 text-xs font-tech font-bold outline-none cursor-pointer">
              <option value="gremio" ${userRole === 'gremio' ? 'selected' : ''}>⚙️ Cliente Gremio (Sin edic. precios)</option>
              <option value="admin" ${userRole === 'admin' ? 'selected' : ''}>👑 Administrador Taller (Edita precios)</option>
            </select>
          </td>
          <td class="py-3.5 px-4">${statusBadge}</td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-2">
              ${u.status !== 'active' ? `
                <button onclick="updateGremioUserStatusAdmin(${u.id}, 'active', '${userRole}')" class="py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-xs border border-emerald-500/40 transition-all shadow-md flex items-center gap-1">
                  <span>🟢 DAR DE ALTA</span>
                </button>
              ` : ''}
              ${u.status !== 'disabled' ? `
                <button onclick="updateGremioUserStatusAdmin(${u.id}, 'disabled', '${userRole}')" class="py-1.5 px-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/30 transition-all">
                  <span>🔴 DESACTIVAR</span>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-rose-400 font-mono">
          Error al cargar usuarios de gremios: ${err.message}
        </td>
      </tr>
    `;
  }
}

async function updateGremioUserStatusAdmin(userId, newStatus, defaultRole = 'gremio') {
  try {
    const roleSelect = document.getElementById(`user-role-select-${userId}`);
    const selectedRole = roleSelect ? roleSelect.value : defaultRole;

    const res = await fetch(`/api/gremios/users/${userId}/status`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Role": "admin",
        "X-Admin-Auth": "true"
      },
      body: JSON.stringify({ status: newStatus, role: selectedRole })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al actualizar estado");
    }
    const data = await res.json();
    alert(data.message || "Usuario actualizado correctamente");
    renderAdminGremiosUsers();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function updateGremioUserRoleAdmin(userId, newRole, currentStatus = 'active') {
  try {
    const res = await fetch(`/api/gremios/users/${userId}/status`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Role": "admin",
        "X-Admin-Auth": "true"
      },
      body: JSON.stringify({ status: currentStatus, role: newRole })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al cambiar rol");
    }
    const data = await res.json();
    const roleName = newRole === 'admin' ? 'Administrador Taller (Edita precios)' : 'Cliente Gremio (Sin edic. precios)';
    alert(`✅ Permisos actualizados a: ${roleName}`);
    renderAdminGremiosUsers();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}


