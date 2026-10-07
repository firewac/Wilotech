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
// WILOTECH OS — CONTROLLERS & INTERACTION SYSTEM
// ============================================================================

let currentExpTicketId = null;

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-cyan-400', 'bg-slate-900', 'border', 'border-cyan-500/30', 'shadow-[0_0_15px_rgba(0,210,255,0.1)]');
    btn.classList.add('text-slate-400');
  });

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.remove('hidden');

  const targetNav = document.getElementById(`nav-${tabId}`);
  if (targetNav) {
    targetNav.classList.remove('text-slate-400');
    targetNav.classList.add('text-cyan-400', 'bg-slate-900', 'border', 'border-cyan-500/30');
  }

  if (tabId === 'dashboard') renderDashboard();
  else if (tabId === 'kanban') renderKanbanBoard();
  else if (tabId === 'repairs') renderRepairsTable();
  else if (tabId === 'customers') renderCustomersGrid();
  else if (tabId === 'inventory') renderInventoryTable();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function switchToolSubTab(subId) {
  document.querySelectorAll('.subtool-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.subtool-btn').forEach(btn => {
    btn.classList.remove('bg-cyan-950', 'text-cyan-300', 'border-cyan-500/30');
    btn.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800');
  });

  const targetSub = document.getElementById(`tool-${subId}`);
  if (targetSub) targetSub.classList.remove('hidden');

  const targetBtn = document.getElementById(`subnav-${subId}`);
  if (targetBtn) {
    targetBtn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
    targetBtn.classList.add('bg-cyan-950', 'text-cyan-300', 'border-cyan-500/30');
  }
}

// ----------------------------------------------------------------------------
// DASHBOARD & ATTENTION ALERTS
// ----------------------------------------------------------------------------
function renderDashboard() {
  const tickets = TechAdmin.getAllTickets();

  // Active Count & Profit
  const activeTickets = tickets.filter(t => t.status !== 'delivered');
  document.getElementById('dashActiveCount').innerText = activeTickets.length;

  let grossVol = 0;
  let partsTotalCost = 0;

  tickets.forEach(t => {
    grossVol += parseFloat(t.finalCost) || 0;
    partsTotalCost += parseFloat(t.partCost) || 0;
  });

  const netProfit = grossVol - partsTotalCost;

  document.getElementById('dashGrossVolume').innerText = `$${grossVol.toLocaleString('en-US')} USD`;
  document.getElementById('dashPartsCost').innerText = `$${partsTotalCost.toLocaleString('en-US')} USD`;
  document.getElementById('dashNetProfit').innerText = `$${netProfit.toLocaleString('en-US')} USD`;
  document.getElementById('dashTotalProfit').innerText = `$${netProfit.toLocaleString('en-US')} USD`;

  // Status Metrics "HOY"
  const counts = {
    received: 0,
    diagnosing: 0,
    budget_pending: 0,
    approved: 0,
    repairing: 0,
    testing: 0,
    ready: 0,
    delivered: 0,
    expired: 0
  };

  tickets.forEach(t => {
    const st = t.status || 'received';
    if (counts[st] !== undefined) counts[st]++;
    else counts.received++;

    // Check if expired / delayed (> 5 days in non-delivered)
    if (st !== 'delivered' && t.dateReceived) {
      const days = (new Date() - new Date(t.dateReceived.replace(" ", "T"))) / (1000 * 3600 * 24);
      if (days > 5) counts.expired++;
    }
  });

  for (const [key, val] of Object.entries(counts)) {
    const el = document.getElementById(`kpi-${key}`);
    if (el) el.innerText = val;
  }

  const badgeKanban = document.getElementById('badgeKanbanCount');
  if (badgeKanban) badgeKanban.innerText = activeTickets.length;

  renderAttentionAlerts(tickets);
}

function renderAttentionAlerts(tickets) {
  const list = document.getElementById('attentionAlertsList');
  if (!list) return;

  const alerts = [];

  tickets.forEach(t => {
    if (t.status === 'budget_pending') {
      alerts.push({
        type: 'amber',
        ticketId: t.id,
        title: `${t.deviceModel || 'Equipo'} — ${t.id}`,
        desc: `Esperando aprobación de presupuesto ($${t.finalCost} USD) por parte del cliente.`
      });
    } else if (t.status === 'waiting_parts') {
      alerts.push({
        type: 'purple',
        ticketId: t.id,
        title: `${t.deviceModel || 'Equipo'} — ${t.id}`,
        desc: `Esperando repuesto de proveedor.`
      });
    } else if (t.status === 'ready') {
      alerts.push({
        type: 'emerald',
        ticketId: t.id,
        title: `${t.deviceModel || 'Equipo'} — ${t.id}`,
        desc: `Reparación terminada — Listo para retirar.`
      });
    }
  });

  if (alerts.length === 0) {
    list.innerHTML = `<p class="text-xs font-mono text-slate-500">🎉 No hay alertas críticas pendientes en el taller.</p>`;
    return;
  }

  list.innerHTML = alerts.slice(0, 5).map(a => `
    <div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs">
      <div class="space-y-0.5">
        <span class="font-bold text-white font-tech">${a.title}</span>
        <p class="text-slate-400 font-mono text-[11px]">${a.desc}</p>
      </div>
      <button onclick="openExpedienteModal('${a.ticketId}')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-950 text-cyan-300 font-mono text-[11px] border border-slate-700 shrink-0">
        👁️ Expediente
      </button>
    </div>
  `).join('');
}

// ----------------------------------------------------------------------------
// TABLERO VISUAL KANBAN & DRAG AND DROP
// ----------------------------------------------------------------------------
function renderKanbanBoard() {
  const tickets = TechAdmin.getAllTickets();
  const statuses = ['received', 'diagnosing', 'budget_pending', 'approved', 'repairing', 'testing', 'ready', 'delivered'];

  statuses.forEach(st => {
    const col = document.getElementById(`col-${st}`);
    const cnt = document.getElementById(`cnt-${st}`);
    if (col) col.innerHTML = '';

    const colTickets = tickets.filter(t => (t.status || 'received') === st);
    if (cnt) cnt.innerText = colTickets.length;

    if (col) {
      colTickets.forEach(t => {
        col.appendChild(createKanbanCard(t));
      });
    }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function createKanbanCard(ticket) {
  const card = document.createElement('div');
  card.className = 'kanban-card p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-cyan-500/50 cursor-grab space-y-2 shadow-lg transition-all';
  card.draggable = true;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('ticket_id', ticket.id);
    card.classList.add('opacity-40');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('opacity-40');
  });

  card.innerHTML = `
    <div class="flex justify-between items-center text-[11px] font-mono">
      <span class="font-bold text-cyan-400">#${ticket.id}</span>
      <span class="text-slate-500 text-[10px]">${(ticket.dateReceived || '').slice(0, 10)}</span>
    </div>
    <div>
      <h4 class="font-bold text-white text-xs font-tech truncate">${ticket.deviceBrand || ''} ${ticket.deviceModel || 'Modelo'}</h4>
      <p class="text-[11px] text-slate-400 truncate">${ticket.clientName || 'Cliente'}</p>
    </div>
    <p class="text-[11px] text-slate-400 font-mono line-clamp-2 leading-relaxed bg-slate-950/60 p-2 rounded-xl border border-slate-800/50">${ticket.issueDescription || 'Sin detalle'}</p>
    <div class="flex justify-between items-center pt-2 border-t border-slate-800/80 text-xs">
      <span class="font-mono font-bold text-emerald-400">$${ticket.finalCost || 0} USD</span>
      <button onclick="openExpedienteModal('${ticket.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950 text-[10px] font-mono text-cyan-300 border border-slate-700">
        👁️ Expediente
      </button>
    </div>
  `;

  return card;
}

function allowDrop(e) {
  e.preventDefault();
}

function dropTicket(e, targetStatus) {
  e.preventDefault();
  const ticketId = e.dataTransfer.getData('ticket_id');
  if (!ticketId) return;

  TechAdmin.updateTicketStatus(ticketId, targetStatus);
  renderKanbanBoard();
  renderDashboard();
}

function filterKanbanByStatus(status) {
  switchTab('kanban');
}

// ----------------------------------------------------------------------------
// EXPEDIENTE TÉCNICO DIGITAL MODAL (WT-XXXX)
// ----------------------------------------------------------------------------
function openExpedienteModal(ticketId) {
  currentExpTicketId = ticketId;
  const ticket = TechAdmin.getTicketById(ticketId);
  if (!ticket) return;

  document.getElementById('expModalTitle').innerText = `${ticket.id} — ${ticket.deviceBrand || ''} ${ticket.deviceModel || ''}`;
  document.getElementById('expModalSub').innerText = `IMEI/SN: ${ticket.serialOrImei || 'No provisto'} • Titular: ${ticket.clientName || 'Cliente'}`;
  
  const statusBadge = document.getElementById('expModalStatusBadge');
  statusBadge.innerText = (ticket.status || 'received').toUpperCase();

  // Populate info
  document.getElementById('expClientName').innerText = ticket.clientName || '--';
  document.getElementById('expClientPhone').innerText = ticket.clientPhone || '--';
  document.getElementById('expClientDni').innerText = ticket.clientDni || '--';
  document.getElementById('expDeviceModel').innerText = `${ticket.deviceBrand || ''} ${ticket.deviceModel || ''}`;
  document.getElementById('expDeviceImei').innerText = ticket.serialOrImei || '--';
  document.getElementById('expDeviceLock').innerText = `${ticket.deviceLockType || 'Sin Bloqueo'} ${ticket.deviceLockCode ? `[ ${ticket.deviceLockCode} ]` : ''}`;

  document.getElementById('expTechNotes').value = ticket.technicianNotes || ticket.issueDescription || '';

  document.getElementById('expPartCost').value = ticket.partCost || 0;
  document.getElementById('expFinalCost').value = ticket.finalCost || 0;

  const partC = parseFloat(ticket.partCost) || 0;
  const finalC = parseFloat(ticket.finalCost) || 0;
  const net = finalC - partC;
  const pct = finalC > 0 ? ((net / finalC) * 100).toFixed(1) : 0;
  document.getElementById('expProfitNet').innerText = `$${net} USD (${pct}%)`;

  // Render IMEI history
  renderExpHistory(ticket);

  document.getElementById('modalExpediente').classList.remove('hidden');
  switchExpTab('info');
}

function renderExpHistory(ticket) {
  const container = document.getElementById('expHistoryList');
  if (!container) return;

  const allTickets = TechAdmin.getAllTickets();
  const history = allTickets.filter(t => t.id !== ticket.id && (
    (t.serialOrImei && t.serialOrImei === ticket.serialOrImei) ||
    (t.clientPhone && t.clientPhone === ticket.clientPhone) ||
    (t.clientDni && t.clientDni === ticket.clientDni)
  ));

  if (history.length === 0) {
    container.innerHTML = `<p class="text-slate-500 py-2">Primera intervención registrada para este cliente/dispositivo en WILOTECH.</p>`;
    return;
  }

  container.innerHTML = history.map(h => `
    <div class="py-2.5 flex justify-between items-center">
      <div>
        <span class="font-bold text-white">#${h.id} (${h.dateReceived || ''})</span>
        <p class="text-slate-400">${h.deviceModel} — ${h.issueDescription}</p>
      </div>
      <span class="font-bold text-emerald-400">$${h.finalCost} USD</span>
    </div>
  `).join('');
}

function closeExpedienteModal() {
  document.getElementById('modalExpediente').classList.add('hidden');
}

function switchExpTab(tabName) {
  document.querySelectorAll('.exp-content-box').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.exp-tab-btn').forEach(btn => {
    btn.classList.remove('bg-cyan-950', 'text-cyan-300', 'border-cyan-500/30');
    btn.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800');
  });

  const targetBox = document.getElementById(`expcontent-${tabName}`);
  if (targetBox) targetBox.classList.remove('hidden');

  const targetBtn = document.getElementById(`exptab-${tabName}`);
  if (targetBtn) {
    targetBtn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
    targetBtn.classList.add('bg-cyan-950', 'text-cyan-300', 'border-cyan-500/30');
  }
}

function saveExpedienteChanges() {
  if (!currentExpTicketId) return;

  const notes = document.getElementById('expTechNotes').value.trim();
  const partCost = parseFloat(document.getElementById('expPartCost').value) || 0;
  const finalCost = parseFloat(document.getElementById('expFinalCost').value) || 0;

  TechAdmin.updateTicket(currentExpTicketId, {
    technicianNotes: notes,
    partCost: partCost,
    finalCost: finalCost
  });

  closeExpedienteModal();
  renderDashboard();
  renderKanbanBoard();
}

function sendWhatsAppTemplate(type) {
  if (!currentExpTicketId) return;
  TechAdmin.notifyClientWhatsApp(currentExpTicketId, type);
}

function copyBudgetLink() {
  if (!currentExpTicketId) return;
  const link = `${window.location.origin}/presupuesto.html?id=${currentExpTicketId}`;
  navigator.clipboard.writeText(link);
  alert(`Link copiado al portapapeles:\n${link}`);
}

function deleteExpTicket() {
  if (!currentExpTicketId) return;
  if (!confirm(`¿Eliminar definitivamente la orden #${currentExpTicketId}?`)) return;

  TechAdmin.deleteTicket(currentExpTicketId);
  closeExpedienteModal();
  renderDashboard();
  renderKanbanBoard();
}

// ----------------------------------------------------------------------------
// LISTA DE ÓRDENES Y CLIENTES
// ----------------------------------------------------------------------------
function renderRepairsTable() {
  const tbody = document.getElementById('ticketsTableBody');
  if (!tbody) return;

  const tickets = TechAdmin.getAllTickets();

  tbody.innerHTML = tickets.map(t => `
    <tr class="hover:bg-slate-900/60 transition-colors">
      <td class="p-4 font-mono font-bold text-cyan-400">#${t.id}</td>
      <td class="p-4">${t.clientName || 'Cliente'}<br><span class="text-slate-500 font-mono text-[10px]">${t.clientPhone || ''}</span></td>
      <td class="p-4 font-semibold text-white">${t.deviceBrand || ''} ${t.deviceModel || ''}<br><span class="text-slate-500 font-mono text-[10px]">SN: ${t.serialOrImei || ''}</span></td>
      <td class="p-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-cyan-300 border border-slate-700">${(t.status || 'received').toUpperCase()}</span></td>
      <td class="p-4 font-mono font-bold text-emerald-400">$${t.finalCost || 0} USD</td>
      <td class="p-4">
        <button onclick="openExpedienteModal('${t.id}')" class="px-3 py-1 rounded-xl bg-slate-800 hover:bg-cyan-950 text-cyan-300 font-mono text-[11px] border border-slate-700">
          👁️ Expediente
        </button>
      </td>
    </tr>
  `).join('');
}

function renderCustomersGrid() {
  const grid = document.getElementById('customersListGrid');
  if (!grid) return;

  const customers = TechAdmin.getAllCustomers();

  grid.innerHTML = customers.map(c => `
    <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
      <div class="flex justify-between items-center">
        <span class="font-bold text-white text-sm">${c.name}</span>
        <span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] border border-cyan-500/30">${c.type || 'Público'}</span>
      </div>
      <p class="text-slate-400">Tel: <span class="text-cyan-400">${c.phone || 'No registrado'}</span></p>
      <p class="text-slate-400">DNI: ${c.dni || 'No provisto'}</p>
    </div>
  `).join('');
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  const inventory = TechAdmin.getInventory();

  tbody.innerHTML = inventory.map((item, idx) => `
    <tr class="hover:bg-slate-900/60 transition-colors">
      <td class="p-4 font-mono font-bold text-cyan-400">${item.sku || 'SKU-001'}</td>
      <td class="p-4 font-semibold text-white">${item.description || item.name}</td>
      <td class="p-4 font-mono text-slate-300">${item.location || 'Cajón A1'}</td>
      <td class="p-4 font-mono">
        <span class="font-bold ${item.qty <= (item.minStock || 2) ? 'text-rose-400' : 'text-emerald-400'}">${item.qty}</span> / Mín: ${item.minStock || 2}
      </td>
      <td class="p-4 font-mono text-emerald-300">$${item.cost || 10} USD / Venta: $${item.price || 30} USD</td>
      <td class="p-4">
        <button onclick="TechAdmin.adjustStock(${idx}, 1); renderInventoryTable();" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono text-[10px]">+1</button>
        <button onclick="TechAdmin.adjustStock(${idx}, -1); renderInventoryTable();" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono text-[10px]">-1</button>
      </td>
    </tr>
  `).join('');
}

function calculateMargin() {
  const part = parseFloat(document.getElementById('calcPartCost').value) || 0;
  const labor = parseFloat(document.getElementById('calcLaborCost').value) || 0;
  const pct = parseFloat(document.getElementById('calcMarginPct').value) || 40;

  const base = part + labor;
  const price = base * (1 + pct / 100);

  document.getElementById('calcSuggestedPrice').innerText = `$${Math.round(price)} USD`;
}

function openNewTicketModal() {
  const name = prompt("Nombre del Cliente:");
  if (!name) return;
  const phone = prompt("Teléfono / WhatsApp:");
  const model = prompt("Modelo del Dispositivo (ej: iPhone 15 Pro):");
  const issue = prompt("Falla declarada:");

  const ticket = TechAdmin.createNewTicket({
    clientName: name,
    clientPhone: phone,
    deviceModel: model,
    issueDescription: issue
  });

  renderDashboard();
  renderKanbanBoard();
  openExpedienteModal(ticket.id);
}

function openNewPartModal() {
  const desc = prompt("Descripción del repuesto:");
  if (!desc) return;
  const sku = prompt("Código / SKU (ej: IC-HYDRA-15):");
  const qty = parseInt(prompt("Cantidad stock inicial:", "5")) || 5;

  const inventory = TechAdmin.getInventory();
  inventory.unshift({
    sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
    description: desc,
    qty: qty,
    minStock: 2,
    location: "Cajón Taller",
    cost: 15,
    price: 45
  });

  TechAdmin.saveInventory();
  renderInventoryTable();
}

function handleGlobalSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  if (!query) return;

  if (e.key === 'Enter') {
    const tickets = TechAdmin.getAllTickets();
    const match = tickets.find(t =>
      t.id.toLowerCase().includes(query) ||
      (t.serialOrImei && t.serialOrImei.toLowerCase().includes(query)) ||
      (t.clientName && t.clientName.toLowerCase().includes(query)) ||
      (t.clientPhone && t.clientPhone.includes(query))
    );

    if (match) {
      openExpedienteModal(match.id);
    } else {
      alert("No se encontró ninguna orden que coincida con la búsqueda.");
    }
  }
}

if (typeof window !== "undefined") {
  window.TechAdmin = TechAdmin;
}

