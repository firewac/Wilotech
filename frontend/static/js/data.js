/**
 * TechFix Pro - Base de Datos Técnica y Catálogo de Fallas
 */

const TECH_CATALOG = {
  categories: [
    {
      id: "smartphones",
      name: "Celulares y Tablets",
      icon: "smartphone",
      description: "Diagnóstico en placa, microelectrónica, pantallas OLED/In-Cell y baterías.",
      brands: [
        {
          id: "apple",
          name: "Apple iPhone",
          models: [
            "iPhone 16 Pro Max",
            "iPhone 16 Pro",
            "iPhone 16 Plus",
            "iPhone 16",
            "iPhone 15 Pro Max",
            "iPhone 15 Pro",
            "iPhone 15 Plus",
            "iPhone 15",
            "iPhone 14 Pro Max",
            "iPhone 14 Pro",
            "iPhone 14 Plus",
            "iPhone 14",
            "iPhone 13 Pro Max",
            "iPhone 13 Pro",
            "iPhone 13",
            "iPhone 13 mini",
            "iPhone 12 Pro Max",
            "iPhone 12 Pro",
            "iPhone 12",
            "iPhone 12 mini",
            "iPhone 11 Pro Max",
            "iPhone 11 Pro",
            "iPhone 11",
            "iPhone XS Max",
            "iPhone XS",
            "iPhone XR",
            "iPhone X",
            "iPhone SE (3ra gen 2022)",
            "iPhone SE (2da gen 2020)",
            "iPhone 8 Plus",
            "iPhone 8",
            "iPhone 7 Plus",
            "iPhone 7"
          ],
          commonFaults: [
            { id: "sp_pantalla", name: "Reemplazo de Pantalla (OLED Original / Calidad OEM)", basePrice: 85, time: "2 - 3 horas" },
            { id: "sp_bateria", name: "Cambio de Batería con flex original / calibración de salud", basePrice: 45, time: "1 - 2 horas" },
            { id: "sp_puerto", name: "Puerto de Carga Lightning / USB-C no responde", basePrice: 35, time: "2 horas" },
            { id: "sp_corto", name: "No enciende / Corto en placa principal (Línea VDD_MAIN / VDD_BOOST)", basePrice: 95, time: "24 - 48 horas" },
            { id: "sp_tristar", name: "Falla de carga lenta o reinicio constante (IC Hydra / Tristar)", basePrice: 70, time: "24 horas" },
            { id: "sp_camara", name: "Cámara trasera / cristal roto / Face ID descalibrado", basePrice: 60, time: "3 - 4 horas" },
            { id: "sp_humedad", name: "Equipo mojado / Limpieza ultrasónica y desulfatado", basePrice: 50, time: "24 horas" }
          ]
        },
        {
          id: "samsung",
          name: "Samsung Galaxy",
          models: [
            "Galaxy S24 / S24 Ultra",
            "Galaxy S23 / S23 Ultra",
            "Galaxy S22 / S22+",
            "Galaxy Z Fold / Z Flip",
            "Galaxy A54 / A53 / A34",
            "Galaxy A14 / A13"
          ],
          commonFaults: [
            { id: "sg_pantalla", name: "Cambio Módulo Display Super AMOLED / Dynamic AMOLED", basePrice: 90, time: "2 - 3 horas" },
            { id: "sg_bateria", name: "Reemplazo Batería de alta capacidad", basePrice: 40, time: "1 - 2 horas" },
            { id: "sg_subplaca", name: "Reemplazo de subplaca de carga rápida USB-C", basePrice: 30, time: "2 horas" },
            { id: "sg_pmic", name: "Muerte súbita / Falla en PMIC principal (Power Management)", basePrice: 85, time: "24 - 48 horas" },
            { id: "sg_humedad", name: "Humedad detectada en puerto de carga o sulfato", basePrice: 35, time: "2 horas" },
            { id: "sg_software", name: "Bucle de reinicio (Bootloop) / Recuperación de firmware Odin", basePrice: 30, time: "2 horas" }
          ]
        },
        {
          id: "xiaomi",
          name: "Xiaomi / Redmi / POCO",
          models: [
            "Xiaomi 13 / 13T / 12",
            "POCO F5 / F4 / X5 Pro",
            "POCO X3 Pro (Problema CPU/PMIC)",
            "Redmi Note 13 / 12 Pro",
            "Redmi Note 11 / 10"
          ],
          commonFaults: [
            { id: "xi_reballing", name: "Reballing de CPU / Memoria UFS (Falla típica reinicio / apagón en POCO)", basePrice: 75, time: "24 - 48 horas" },
            { id: "xi_pantalla", name: "Cambio de Pantalla AMOLED / IPS 120Hz", basePrice: 65, time: "2 - 3 horas" },
            { id: "xi_bateria", name: "Cambio de Batería con soporte de carga 67W/120W", basePrice: 35, time: "2 horas" },
            { id: "xi_puerto", name: "Pin de carga / Flex Interconexión", basePrice: 28, time: "2 horas" },
            { id: "xi_sensor", name: "Sensor de proximidad / Botón Power con huella", basePrice: 25, time: "2 horas" }
          ]
        },
        {
          id: "motorola",
          name: "Motorola",
          models: [
            "Edge 40 / 30 Pro / Ultra",
            "Moto G84 / G73 / G54",
            "Moto G23 / G13 / G22",
            "Moto E Series"
          ],
          commonFaults: [
            { id: "mo_pantalla", name: "Cambio de Módulo completo pOLED / IPS", basePrice: 60, time: "2 horas" },
            { id: "mo_bateria", name: "Cambio de Batería original 5000 mAh", basePrice: 32, time: "1 - 2 horas" },
            { id: "mo_carga", name: "Problema TurboPower / Reemplazo pin de carga", basePrice: 25, time: "2 horas" },
            { id: "mo_placa", name: "Cortocircuito por sobretensión en cargador", basePrice: 65, time: "24 - 48 horas" }
          ]
        }
      ]
    },
    {
      id: "pc_laptops",
      name: "PC Gamer, Ofimática & Laptops",
      icon: "laptop",
      description: "Mantenimiento térmico de alto rendimiento, reparación de placas madre y upgrades.",
      brands: [
        {
          id: "laptops_marcas",
          name: "Laptops (ASUS, Lenovo, HP, Dell, Acer, Apple)",
          models: [
            "ASUS ROG Strix / Zephyrus / TUF Gaming",
            "Lenovo Legion / IdeaPad Gaming / ThinkPad",
            "HP OMEN / Victus / Pavilion",
            "Dell G15 / Alienware / Inspiron",
            "Acer Predator / Nitro 5",
            "MacBook Pro / Air (M1, M2, M3, Intel)"
          ],
          commonFaults: [
            { id: "lp_mantenimiento", name: "Mantenimiento Full Térmico (Pasta premium / Honeywell PTM7950 + toberas)", basePrice: 40, time: "3 - 5 horas" },
            { id: "lp_nopost", name: "Enciende pero no da video (Falla de BIOS / Corrupción SPI)", basePrice: 65, time: "24 horas" },
            { id: "lp_corto19v", name: "Corto en línea principal de entrada (19V / MOSFETs o capacitores volados)", basePrice: 85, time: "24 - 48 horas" },
            { id: "lp_pantalla", name: "Cambio de Panel Display IPS 144Hz/165Hz o Bisagras rotas", basePrice: 90, time: "24 horas" },
            { id: "lp_teclado", name: "Reemplazo de teclado retroiluminado o soldado a chasis", basePrice: 55, time: "4 - 6 horas" },
            { id: "lp_jack", name: "Reparación / Cambio de Pin de Carga (DC Jack / Type-C PD)", basePrice: 38, time: "3 horas" },
            { id: "lp_upgrade", name: "Upgrade SSD NVMe + Memoria RAM + Clonación de SO", basePrice: 30, time: "2 - 3 horas" }
          ]
        },
        {
          id: "pc_escritorio",
          name: "PC de Escritorio / Gaming Custom",
          models: [
            "Plataforma AMD AM4 / AM5 (Ryzen 5000 / 7000 / 9000)",
            "Plataforma Intel LGA1700 / LGA1851 (Core i5 / i7 / i9)",
            "Workstation / Servidor de Edición",
            "PC de Oficina / HTPC"
          ],
          commonFaults: [
            { id: "pc_diagnostico", name: "Diagnóstico completo NO POST / Reinicios aleatorios / Pantallazos azules (BSOD)", basePrice: 35, time: "24 horas" },
            { id: "pc_gpu_reparacion", name: "Reparación de Placa de Video (GPU): VRAM, cortos en VRM o reballing", basePrice: 110, time: "48 - 72 horas" },
            { id: "pc_mantenimiento", name: "Mantenimiento Integral + Cable Management + Cambio de Pasta Térmica", basePrice: 40, time: "4 horas" },
            { id: "pc_fuente", name: "Prueba y diagnóstico de Fuente de Poder (PSU) bajo carga", basePrice: 25, time: "2 horas" },
            { id: "pc_custom_water", name: "Mantenimiento / purgado de refrigeración líquida custom o AIO", basePrice: 55, time: "24 horas" },
            { id: "pc_optimizacion", name: "Instalación limpia de Windows 11/10 Pro, Drivers actualizados y BIOS Update", basePrice: 30, time: "2 - 3 horas" }
          ]
        }
      ]
    },
    {
      id: "consolas",
      name: "Consolas de Videojuegos",
      icon: "gamepad-2",
      description: "Especialistas en puertos HDMI, problemas térmicos, metal líquido y chips de carga.",
      brands: [
        {
          id: "playstation",
          name: "Sony PlayStation",
          models: [
            "PlayStation 5 (Fat / Slim)",
            "PlayStation 4 Pro",
            "PlayStation 4 Slim / Fat"
          ],
          commonFaults: [
            { id: "ps5_hdmi", name: "Reemplazo de Puerto HDMI original reforzado (Sin señal de video)", basePrice: 65, time: "2 - 4 horas" },
            { id: "ps5_metal_liquido", name: "Mantenimiento térmico PS5: Reaplicación y sellado de Metal Líquido + limpieza disipador", basePrice: 55, time: "3 horas" },
            { id: "ps_ic_video", name: "Reemplazo de Chip Controlador HDMI (Panasonic IC / Encoder)", basePrice: 85, time: "24 horas" },
            { id: "ps_fuente", name: "Falla de encendido / Luz azul de la muerte (BLOD) / Fuente de poder", basePrice: 80, time: "24 - 48 horas" },
            { id: "ps_lector", name: "Lector no traga disco / Láser óptico no reconoce juegos", basePrice: 45, time: "3 horas" },
            { id: "ps4_pasta", name: "Mantenimiento PS4: Cambio de Pasta Térmica de alto rendimiento + Thermal Pads", basePrice: 35, time: "2 horas" }
          ]
        },
        {
          id: "xbox",
          name: "Microsoft Xbox",
          models: [
            "Xbox Series X",
            "Xbox Series S",
            "Xbox One X / One S"
          ],
          commonFaults: [
            { id: "xb_hdmi", name: "Reemplazo de Puerto HDMI de alta velocidad 4K 120Hz", basePrice: 65, time: "2 - 4 horas" },
            { id: "xb_retimer", name: "Reemplazo de Chip Retimer HDMI (Texas Instruments TDP158 / NB7N)", basePrice: 80, time: "24 horas" },
            { id: "xb_mantenimiento", name: "Mantenimiento térmico profundo y eliminación de polvo en fuente y turbina", basePrice: 40, time: "2 horas" },
            { id: "xb_apagado", name: "Consola se apaga a los pocos segundos (Falla en etapa VRM o MOSFET en corto)", basePrice: 90, time: "24 - 48 horas" },
            { id: "xb_ssd_os", name: "Error de inicio del sistema (E100 / E101 / E102) / Reinstalación de SO en SSD", basePrice: 45, time: "3 - 4 horas" }
          ]
        },
        {
          id: "nintendo",
          name: "Nintendo",
          models: [
            "Nintendo Switch OLED",
            "Nintendo Switch V1 / V2",
            "Nintendo Switch Lite"
          ],
          commonFaults: [
            { id: "ns_usbc", name: "Cambio de Puerto USB-C dañado (no carga o no conecta al Dock)", basePrice: 50, time: "3 horas" },
            { id: "ns_m92t36", name: "Reemplazo de Chip de Carga y Gestión M92T36 en corto", basePrice: 60, time: "24 horas" },
            { id: "ns_bq24193", name: "Reemplazo de Administrador de Batería BQ24193", basePrice: 55, time: "24 horas" },
            { id: "ns_pantalla", name: "Cambio de pantalla OLED / LCD o digitalizador táctil roto", basePrice: 65, time: "3 horas" },
            { id: "ns_joycon", name: "Reparación de Drift en Joy-Con (Reemplazo por análogos electromagnéticos Hall Effect)", basePrice: 20, time: "1 hora" },
            { id: "ns_cooler", name: "Ventilador no gira / Consola se apaga por temperatura alta", basePrice: 35, time: "2 horas" }
          ]
        }
      ]
    }
  ],

  // Órdenes de prueba precargadas para demostrar el rastreador de tickets
  sampleTickets: [
    {
      id: "TF-8492",
      clientName: "Lucas Ferreira",
      clientDni: "38.942.105",
      clientPhone: "+54 9 11 4589-2311",
      clientAddress: "Av. Cabildo 2450, CABA",
      deviceType: "Consola",
      deviceModel: "Sony PlayStation 5 Disc Edition",
      serialOrImei: "C39482019482",
      issueDescription: "No da señal de video al televisor. Pines internos del puerto HDMI doblados y partidos tras un tirón de cable.",
      status: "ready", // 'received', 'diagnosing', 'waiting_parts', 'repairing', 'ready', 'delivered'
      statusStep: 5,
      dateReceived: "2026-09-01 10:30",
      technician: "Ing. Martín Ramos (Microelectrónica)",
      technicianNotes: "Se desoldó puerto dañado con estación de aire caliente a 380°C. Limpieza de pistas con malla desoldadora. Se instaló puerto HDMI original reforzado con aleación Sn-Pb para mayor resistencia mecánica. Prueba en 4K 120Hz con HDR durante 45 minutos superada con éxito.",
      partsUsed: ["Puerto HDMI original OEM PS5 Rev. 3", "Estaño Mechanic 183°C", "Flux Amtech NC-559-ASM"],
      finalCost: 65,
      warranty: "90 días de garantía por escrito"
    },
    {
      id: "TF-7310",
      clientName: "Valeria Gómez",
      clientDni: "41.205.882",
      clientPhone: "+54 9 11 6321-7744",
      clientAddress: "Calle Florida 890, 4º B, CABA",
      deviceType: "Celular",
      deviceModel: "Apple iPhone 14 Pro",
      serialOrImei: "359482019847123",
      issueDescription: "Equipo no enciende luego de conectar a cargador de auto genérico. Consumo fijo de 1.8A en fuente de laboratorio.",
      status: "repairing",
      statusStep: 4,
      dateReceived: "2026-09-02 14:15",
      technician: "Federico Ruiz (Laboratorio Celulares)",
      technicianNotes: "Se separaron las placas tipo sándwich en precalentadora a 185°C. Mediante cámara térmica se localizó capacitor cerámico C3201 en la línea VDD_MAIN en cortocircuito total a tierra (0.00 Ohms). Se reemplazó componente y se realizó reballing de interposer para unir placas nuevamente.",
      partsUsed: ["Capacitor SMD 0201 10uF 6.3V", "Esferas de soldadura 0.2mm Relife", "Stencil mecánico QianLi iPhone 14 Pro"],
      finalCost: 95,
      warranty: "180 días en reparación de placa madre"
    },
    {
      id: "TF-6194",
      clientName: "Matías Calderón",
      clientDni: "35.811.904",
      clientPhone: "+54 9 11 2984-1102",
      clientAddress: "Av. Rivadavia 5210, Flores",
      deviceType: "Laptop Gamer",
      deviceModel: "Lenovo Legion 5 (Ryzen 7 + RTX 3070)",
      serialOrImei: "PF39401924L",
      issueDescription: "Temperaturas extremas de CPU llegando a 102°C con caída abrupta de FPS en juegos (Thermal Throttling).",
      status: "diagnosing",
      statusStep: 2,
      dateReceived: "2026-09-03 09:00",
      technician: "Ing. Martín Ramos",
      technicianNotes: "Se constata que la pasta térmica original se encuentra totalmente cristalizada y las toberas de cobre del disipador están obstruidas por pelusa compactada. Se procederá a baño ultrasónico de disipadores y aplicación de almohadilla de cambio de fase Honeywell PTM7950.",
      partsUsed: ["Almohadilla térmica Honeywell PTM7950 40x80mm", "Thermal Putty K5 Pro para VRM/VRAM", "Alcohol isopropílico 99.9%"],
      finalCost: 40,
      warranty: "6 meses de garantía térmica"
    },
    {
      id: "TF-5520",
      clientName: "Gonzalo Peralta",
      clientDni: "39.402.118",
      clientPhone: "+54 9 11 9912-4433",
      clientAddress: "Av. Santa Fe 3120, Palermo",
      deviceType: "Consola",
      deviceModel: "Nintendo Switch V2",
      serialOrImei: "XKW100492819",
      issueDescription: "No enciende y no toma carga. Pantalla completamente en negro.",
      status: "waiting_parts",
      statusStep: 3,
      dateReceived: "2026-09-02 18:20",
      technician: "Federico Ruiz",
      technicianNotes: "Se midieron los capacitores perimetrales del integrado M92T36 (Gestor de Power Delivery). Dos líneas de 3.3V y VDDIO se encuentran a tierra. Se aguarda arribo de integrado original Rohm M92T36 para sustitución por soldadura BGA.",
      partsUsed: ["Circuito Integrado Rohm M92T36 Original"],
      finalCost: 60,
      warranty: "90 días de garantía"
    }
  ],

  // Stock de repuestos críticos del taller para el módulo administrativo
  stockInventory: [
    { code: "REP-HDMI-PS5", name: "Puertos HDMI Originales Sony PS5 (Rev 1-3)", qty: 14, min: 5, unitCost: 8 },
    { code: "REP-PTM-7950", name: "Honeywell PTM7950 Láminas 80x40mm", qty: 22, min: 6, unitCost: 9 },
    { code: "REP-IC-M92T36", name: "IC Carga Nintendo Switch Rohm M92T36", qty: 8, min: 4, unitCost: 11 },
    { code: "REP-IC-HYDRA", name: "IC Tristar / Hydra Apple iPhone 12/13/14", qty: 6, min: 3, unitCost: 14 },
    { code: "REP-HALL-JOYCON", name: "Módulos Análogos Electromagnéticos Hall Effect Switch", qty: 30, min: 10, unitCost: 4 },
    { code: "REP-OLED-IP13", name: "Módulos Pantalla iPhone 13 OLED GX Hard", qty: 5, min: 2, unitCost: 42 },
    { code: "REP-PASTA-MX6", name: "Pasta Térmica Arctic MX-6 Jeringa 8g", qty: 12, min: 4, unitCost: 12 }
  ]
};
