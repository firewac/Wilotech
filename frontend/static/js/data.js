/**
 * TechFix Pro - Base de Datos Técnica y Catálogo de Fallas
 */

const TECH_CATALOG = {
  categories: [
    {
      id: "smartphones",
      name: "Celulares / Smartphones",
      icon: "smartphone",
      description: "Diagnóstico en placa, microelectrónica, pantallas OLED/In-Cell y baterías.",
      brands: [
        {
          id: "samsung",
          name: "Samsung Galaxy",
          models: [
            "Galaxy S24 / S24 Ultra",
            "Galaxy S23 / S23 Ultra / S23 FE",
            "Galaxy S22 / S22+ / S22 Ultra",
            "Galaxy Z Fold 5 / Z Flip 5",
            "Galaxy A55 / A54 / A35 / A34",
            "Galaxy A15 / A14 / A05 / A04"
          ],
          commonFaults: [
            { id: "sg_pantalla", name: "Cambio Módulo Display Super AMOLED / Dynamic AMOLED", basePrice: 90, time: "2 - 3 horas" },
            { id: "sg_bateria", name: "Reemplazo Batería de alta capacidad", basePrice: 40, time: "1 - 2 horas" },
            { id: "sg_subplaca", name: "Reemplazo de subplaca de carga rápida USB-C", basePrice: 30, time: "2 horas" },
            { id: "sg_pmic", name: "Muerte súbita / Falla en PMIC principal (Power Management)", basePrice: 85, time: "24 - 48 horas" },
            { id: "sg_humedad", name: "Humedad detectada en puerto de carga o sulfato", basePrice: 35, time: "2 horas" }
          ]
        },
        {
          id: "motorola",
          name: "Motorola Moto",
          models: [
            "Edge 40 / 30 Pro / Ultra / Neo",
            "Moto G84 / G73 / G54 5G",
            "Moto G23 / G13 / G22 / G04",
            "Moto E13 / E22 / E32"
          ],
          commonFaults: [
            { id: "mo_pantalla", name: "Cambio de Módulo completo pOLED / IPS", basePrice: 60, time: "2 horas" },
            { id: "mo_bateria", name: "Cambio de Batería original 5000 mAh", basePrice: 32, time: "1 - 2 horas" },
            { id: "mo_carga", name: "Problema TurboPower / Reemplazo pin de carga", basePrice: 25, time: "2 horas" },
            { id: "mo_placa", name: "Cortocircuito por sobretensión en cargador", basePrice: 65, time: "24 - 48 horas" }
          ]
        },
        {
          id: "apple_iphone",
          name: "Apple iPhone",
          models: [
            "iPhone 16 Pro Max / 16 Pro / 16",
            "iPhone 15 Pro Max / 15 Pro / 15",
            "iPhone 14 Pro Max / 14 Pro / 14",
            "iPhone 13 Pro Max / 13 Pro / 13",
            "iPhone 12 Pro Max / 12 Pro / 12",
            "iPhone 11 Pro Max / 11 Pro / 11",
            "iPhone XR / XS Max / X / SE"
          ],
          commonFaults: [
            { id: "sp_pantalla", name: "Reemplazo de Pantalla (OLED Original / Calidad OEM)", basePrice: 85, time: "2 - 3 horas" },
            { id: "sp_bateria", name: "Cambio de Batería con flex original / calibración de salud", basePrice: 45, time: "1 - 2 horas" },
            { id: "sp_puerto", name: "Puerto de Carga Lightning / USB-C no responde", basePrice: 35, time: "2 horas" },
            { id: "sp_corto", name: "No enciende / Corto en placa principal (VDD_MAIN)", basePrice: 95, time: "24 - 48 horas" },
            { id: "sp_tristar", name: "Falla IC Hydra / Tristar (Carga lenta o reinicio)", basePrice: 70, time: "24 horas" }
          ]
        },
        {
          id: "xiaomi",
          name: "Xiaomi / Redmi / POCO",
          models: [
            "Redmi Note 13 Pro 5G / 13 / 12 Pro",
            "POCO F5 Pro / F5 / X5 Pro / X3 Pro",
            "Xiaomi 13T / 13 / 12T / 12",
            "Redmi 13C / 12 / 10C"
          ],
          commonFaults: [
            { id: "xi_reballing", name: "Reballing CPU / Memoria UFS (Apagón / Bootloop POCO)", basePrice: 75, time: "24 - 48 horas" },
            { id: "xi_pantalla", name: "Cambio de Pantalla AMOLED / IPS 120Hz", basePrice: 65, time: "2 - 3 horas" },
            { id: "xi_bateria", name: "Cambio Batería Carga Rápida 67W / 120W", basePrice: 35, time: "2 horas" },
            { id: "xi_puerto", name: "Flex de Carga / Pin Subplaca USB-C", basePrice: 28, time: "2 horas" }
          ]
        },
        {
          id: "tcl",
          name: "TCL / Alcatel",
          models: [
            "TCL 40 SE / 403 / 408 / 30 SE",
            "TCL 20E / 20 SE / 10 Pro",
            "Alcatel 1V / 1B / 3X"
          ],
          commonFaults: [
            { id: "tcl_pantalla", name: "Cambio Módulo Display HD+ NXTVISION", basePrice: 45, time: "2 horas" },
            { id: "tcl_pin", name: "Cambio de Pin de Carga MicroUSB / Type-C", basePrice: 22, time: "1 - 2 horas" },
            { id: "tcl_bateria", name: "Reemplazo de Batería 4000/5000 mAh", basePrice: 28, time: "1 hora" }
          ]
        },
        {
          id: "zte",
          name: "ZTE / Nubia",
          models: [
            "ZTE Blade V40 Smart / V40 Design",
            "ZTE Blade A72 / A52 / A31",
            "Nubia Neo 5G / RedMagic Gaming"
          ],
          commonFaults: [
            { id: "zte_pantalla", name: "Reemplazo de Módulo Display IPS", basePrice: 45, time: "2 horas" },
            { id: "zte_pin", name: "Reparación Puerto de Carga USB-C", basePrice: 24, time: "2 horas" },
            { id: "zte_soft", name: "Flasheo de Firmware / Desbloqueo de arranque", basePrice: 25, time: "1 hora" }
          ]
        }
      ]
    },
    {
      id: "tablets",
      name: "Tablets / iPads",
      icon: "tablet",
      description: "Reparación de vidrios táctiles, pantallas Retina/AMOLED, pines de carga y baterías de gran capacidad.",
      brands: [
        {
          id: "apple_ipad",
          name: "Apple iPad",
          models: [
            "iPad Pro 11\" / 12.9\" (M1 / M2 / M4)",
            "iPad Air 5 / 4 / 3 (M1 / A14)",
            "iPad 10ma / 9na / 8va generación",
            "iPad mini 6 / 5"
          ],
          commonFaults: [
            { id: "ipad_tactil", name: "Reemplazo de Cristal Táctil / Digitalizador", basePrice: 55, time: "3 - 4 horas" },
            { id: "ipad_pantalla", name: "Cambio Módulo Completo Retina / Liquid Retina", basePrice: 110, time: "3 - 5 horas" },
            { id: "ipad_bateria", name: "Cambio Batería de Alta Capacidad mAh", basePrice: 50, time: "2 - 3 horas" },
            { id: "ipad_puerto", name: "Pin de Carga Lightning / USB-C desoldado", basePrice: 42, time: "3 horas" }
          ]
        },
        {
          id: "samsung_tab",
          name: "Samsung Galaxy Tab",
          models: [
            "Galaxy Tab S9 / S9 FE / S8 Ultra",
            "Galaxy Tab S7 / S6 Lite",
            "Galaxy Tab A9+ / A9 / A8 10.5",
            "Galaxy Tab A7 Lite / A7 10.4"
          ],
          commonFaults: [
            { id: "stab_display", name: "Cambio Módulo Display TFT / Super AMOLED", basePrice: 75, time: "2 - 3 horas" },
            { id: "stab_pin", name: "Reemplazo Ficha Carga Type-C PD", basePrice: 30, time: "2 horas" },
            { id: "stab_bateria", name: "Cambio Batería Original Samsung", basePrice: 40, time: "2 horas" }
          ]
        },
        {
          id: "lenovo_tab",
          name: "Lenovo Tab",
          models: [
            "Lenovo Tab M10 HD / FHD Plus (Gen 2/3)",
            "Lenovo Tab P11 / P11 Pro / P12",
            "Lenovo Tab K10 / Tab M8"
          ],
          commonFaults: [
            { id: "ltab_pantalla", name: "Cambio de Pantalla táctil LCD", basePrice: 50, time: "2 horas" },
            { id: "ltab_pin", name: "Reparación Puerto MicroUSB / Type-C", basePrice: 25, time: "2 horas" }
          ]
        },
        {
          id: "xiaomi_pad",
          name: "Xiaomi / Redmi Pad",
          models: [
            "Xiaomi Pad 6 / Pad 5",
            "Redmi Pad SE / Redmi Pad 10.6\""
          ],
          commonFaults: [
            { id: "xpad_display", name: "Cambio Display 120Hz 2K", basePrice: 70, time: "2 - 3 horas" },
            { id: "xpad_bateria", name: "Reemplazo Batería 8720 mAh", basePrice: 38, time: "2 horas" }
          ]
        },
        {
          id: "marcas_nacionales_tab",
          name: "Philco / Noblex / Exo / Gadnic",
          models: [
            "Tablets Educativas 7\" / 10\"",
            "Tablets Infantiles con funda goma",
            "Philco / Noblex 10.1\" HD"
          ],
          commonFaults: [
            { id: "nac_pin", name: "Cambio de Pin de Carga arrancado", basePrice: 20, time: "1 hora" },
            { id: "nac_vidrio", name: "Cambio de Cristal Táctil roto", basePrice: 30, time: "2 horas" },
            { id: "nac_firmware", name: "Reinstalación de Android / Hard Reset", basePrice: 20, time: "1 hora" }
          ]
        }
      ]
    },
    {
      id: "pc_laptops",
      name: "Notebooks / Laptops Gamer",
      icon: "laptop",
      description: "Mantenimiento térmico de alto rendimiento, reparación de placas madre y upgrades.",
      brands: [
        {
          id: "lenovo_laptop",
          name: "Lenovo (Legion / IdeaPad / ThinkPad)",
          models: [
            "Lenovo Legion 5 / 5 Pro / 7 / Slim",
            "Lenovo LOQ 15 / 16 Gaming",
            "Lenovo IdeaPad 3 / 5 / Gaming 3",
            "Lenovo ThinkPad X1 Carbon / E14 / L14",
            "Lenovo Yoga Slim / Flex"
          ],
          commonFaults: [
            { id: "len_mantenimiento", name: "Mantenimiento Térmico Full (Honeywell PTM7950 + Limpieza)", basePrice: 40, time: "3 - 5 horas" },
            { id: "len_bios", name: "No da video / Reprogramación BIOS SPI (Luz encendido fija)", basePrice: 65, time: "24 horas" },
            { id: "len_corto", name: "Cortocircuito 20V Lenovo Slim Tip / Type-C PD", basePrice: 85, time: "24 - 48 horas" },
            { id: "len_teclado", name: "Cambio Teclado Retroiluminado / Chasis", basePrice: 55, time: "4 horas" }
          ]
        },
        {
          id: "hp_laptop",
          name: "HP (Victus / OMEN / Pavilion / 14-15)",
          models: [
            "HP Victus 15 / 16 Gaming",
            "HP OMEN 16 / 17",
            "HP Pavilion Gaming / Pavilion 14 / 15",
            "HP 14-ck / 15-dw / 240 G8 / 250 G9",
            "HP Envy / Spectre x360"
          ],
          commonFaults: [
            { id: "hp_bisagras", name: "Reparación de Bisagras rotas y Chasis plásticos", basePrice: 45, time: "24 horas" },
            { id: "hp_display", name: "Cambio de Pantalla LED Slim 30/40 pines 144Hz", basePrice: 90, time: "24 horas" },
            { id: "hp_jack", name: "Pin de Carga DC Jack con cable sustitución", basePrice: 35, time: "2 horas" },
            { id: "hp_mantenimiento", name: "Limpieza profunda + Cambio Pasta Térmica Arctic MX-6", basePrice: 38, time: "3 horas" }
          ]
        },
        {
          id: "asus_laptop",
          name: "ASUS (ROG Strix / TUF / Vivobook)",
          models: [
            "ASUS ROG Strix G15 / G16 / Scar",
            "ASUS TUF Gaming A15 / F15 / FX505",
            "ASUS Vivobook 14 / 15 / Go",
            "ASUS Zenbook 14 OLED / Duo"
          ],
          commonFaults: [
            { id: "asus_liquido", name: "Mantenimiento Metal Líquido ROG / Limpieza toberas", basePrice: 50, time: "4 horas" },
            { id: "asus_vrm", name: "Falla de VRM / MOSFET de alimentación GPU en corto", basePrice: 95, time: "24 - 48 horas" },
            { id: "asus_cooler", name: "Reemplazo de Ventilador / Cooler GPU ROG TUF", basePrice: 35, time: "2 horas" }
          ]
        },
        {
          id: "dell_laptop",
          name: "Dell (Inspiron / G15 / Alienware / Vostro)",
          models: [
            "Dell G15 5511 / 5520 / 5530 Gaming",
            "Dell Inspiron 3511 / 3520 / 5410",
            "Dell Alienware m15 / x16",
            "Dell Vostro 3400 / 3500 / Latitude"
          ],
          commonFaults: [
            { id: "dell_bateria", name: "Reemplazo Batería Original Dell 3-Cell / 6-Cell", basePrice: 55, time: "2 horas" },
            { id: "dell_cargador", name: "Alerta 'Cargador No Reconocido' (Pin Central ID desoldado)", basePrice: 40, time: "3 horas" },
            { id: "dell_placa", name: "Reparación de placa principal sin encendido", basePrice: 85, time: "24 - 48 horas" }
          ]
        },
        {
          id: "acer_laptop",
          name: "Acer (Nitro 5 / Aspire / Predator)",
          models: [
            "Acer Nitro 5 AN515 / AN517",
            "Acer Aspire 3 / 5 / 7",
            "Acer Predator Helios 300 / Neo 16"
          ],
          commonFaults: [
            { id: "acer_teclado", name: "Cambio Teclado Red / RGB Nitro 5", basePrice: 50, time: "3 horas" },
            { id: "acer_thermal", name: "Mantenimiento Térmico completo de CPU/GPU", basePrice: 40, time: "3 horas" }
          ]
        },
        {
          id: "apple_macbook",
          name: "Apple MacBook (Air / Pro)",
          models: [
            "MacBook Air 13\" / 15\" (M3 / M2 / M1)",
            "MacBook Pro 14\" / 16\" (M3 / M2 / M1 Pro/Max)",
            "MacBook Air 13\" Retina Intel (2018-2020)",
            "MacBook Pro 13\" / 15\" Touch Bar Intel"
          ],
          commonFaults: [
            { id: "mac_pantalla", name: "Cambio de Pantalla Retina completa con Flex", basePrice: 160, time: "24 - 48 horas" },
            { id: "mac_mojado", name: "Limpieza Ultrasónica por derramamiento de líquido", basePrice: 90, time: "24 - 48 horas" },
            { id: "mac_bateria", name: "Cambio de Batería con adhesivo sellado", basePrice: 85, time: "3 - 4 horas" },
            { id: "mac_usbc", name: "Reemplazo de Puertos Thunderbolt / USB-C", basePrice: 60, time: "3 horas" }
          ]
        },
        {
          id: "marcas_nacionales_laptop",
          name: "Exo / Banghó / Noblex / BGH Positivo",
          models: [
            "Exo Smart / Cloud / Wings",
            "Banghó Bes / Max / Game",
            "Noblex N14 / N15",
            "BGH Positivo QFX / Motion"
          ],
          commonFaults: [
            { id: "nac_lap_jack", name: "Cambio Pin de Carga DC Jack", basePrice: 28, time: "2 horas" },
            { id: "nac_lap_ssd", name: "Upgrade Disco SSD SATA / M.2 + Sistema Operativo", basePrice: 30, time: "2 horas" },
            { id: "nac_lap_bisagras", name: "Reparación de soportes plásticos de bisagra", basePrice: 35, time: "24 horas" }
          ]
        },
        {
          id: "msi_laptop",
          name: "MSI (GF63 / Katana / Cyborg)",
          models: [
            "MSI GF63 Thin / GF76",
            "MSI Katana 15 / 17",
            "MSI Cyborg 15 / Pulse 17"
          ],
          commonFaults: [
            { id: "msi_bisagra", name: "Refuerzo y reparación de bisagras chasis MSI", basePrice: 50, time: "24 horas" },
            { id: "msi_cooler", name: "Sustitución de Cooler de alta revolución", basePrice: 40, time: "2 horas" }
          ]
        }
      ]
    },
    {
      id: "pc_escritorio",
      name: "PC de Escritorio / Gaming",
      icon: "cpu",
      description: "Diagnóstico completo, microelectrónica en placas de video, motherboards y fuentes 80 Plus.",
      brands: [
        {
          id: "asus_pc",
          name: "ASUS (Motherboards / GPUs / ROG)",
          models: [
            "Motherboards ASUS ROG Strix / TUF Gaming / Prime",
            "Placas de Video ASUS ROG Strix / TUF / Dual (RTX 40 / 30 / RX 7000)",
            "PC Armada Ensamblada ASUS TUF"
          ],
          commonFaults: [
            { id: "pc_gpu_reparacion", name: "Reparación de GPU: Cambio de VRAM, mosfets en corto o reballing", basePrice: 110, time: "48 - 72 horas" },
            { id: "pc_diagnostico", name: "Diagnóstico NO POST / Pantalla negra / BSOD", basePrice: 35, time: "24 horas" },
            { id: "pc_mantenimiento", name: "Mantenimiento Integral + Cable Management + Pasta Térmica", basePrice: 40, time: "4 horas" }
          ]
        },
        {
          id: "gigabyte_pc",
          name: "Gigabyte / AORUS",
          models: [
            "Motherboards AORUS Master / Elite / Gigabyte Gaming X / DS3H",
            "Placas de Video Gigabyte AORUS / Gaming OC / Eagle",
            "PC Gamer Ensamblada Gigabyte"
          ],
          commonFaults: [
            { id: "giga_bios", name: "Actualización / Recuperación Q-Flash BIOS corrupto", basePrice: 30, time: "2 horas" },
            { id: "giga_gpu", name: "Reemplazo Thermal Pads y Pasta Térmica en Placa de Video", basePrice: 45, time: "3 horas" }
          ]
        },
        {
          id: "msi_pc",
          name: "MSI (Gaming / MAG / Ventus)",
          models: [
            "Motherboards MSI MAG Tomahawk / Mortar / PRO",
            "Placas de Video MSI Gaming X Slim / Ventus 3X / SUPRIM",
            "Refrigeraciones Líquidas MSI MAG CoreLiquid"
          ],
          commonFaults: [
            { id: "msi_liquid", name: "Mantenimiento / purgado o reemplazo de AIO Líquida", basePrice: 50, time: "24 horas" },
            { id: "msi_socket", name: "Enderezado de pines doblados en Socket LGA1700 / AM5", basePrice: 55, time: "24 horas" }
          ]
        },
        {
          id: "asrock_pc",
          name: "AsRock (Steel Legend / Phantom Gaming)",
          models: [
            "Motherboards AsRock Steel Legend / Phantom Gaming / Pro4 / HDV",
            "Placas de Video AsRock Challenger / Phantom RX 7000/6000"
          ],
          commonFaults: [
            { id: "asrock_mosfet", name: "Reparación de fase de alimentación VRM motherboard", basePrice: 70, time: "24 - 48 horas" }
          ]
        },
        {
          id: "pc_armada_custom",
          name: "PC Armada Custom (AMD Ryzen / Intel Core)",
          models: [
            "Plataforma AMD AM5 / AM4 (Ryzen 9 / 7 / 5)",
            "Plataforma Intel LGA1700 / LGA1851 (Core i9 / i7 / i5)",
            "PC Ofimática / Workstation de Edición"
          ],
          commonFaults: [
            { id: "custom_diag", name: "Diagnóstico completo de hardware y estabilidad bajo estrés", basePrice: 35, time: "24 horas" },
            { id: "custom_fuente", name: "Prueba y cambio de Fuente de Poder 80 Plus", basePrice: 25, time: "2 horas" },
            { id: "custom_so", name: "Instalación limpia Windows 11 Pro + Drivers + BIOS", basePrice: 30, time: "2 - 3 horas" }
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
            "PlayStation 4 Slim / Fat",
            "PlayStation 3 Super Slim / Fat"
          ],
          commonFaults: [
            { id: "ps5_hdmi", name: "Reemplazo de Puerto HDMI original reforzado 4K 120Hz", basePrice: 65, time: "2 - 4 horas" },
            { id: "ps5_metal_liquido", name: "Mantenimiento Metal Líquido PS5: Limpieza disipador y sellado", basePrice: 55, time: "3 horas" },
            { id: "ps_ic_video", name: "Reemplazo de Chip Encoder HDMI (Panasonic IC)", basePrice: 85, time: "24 horas" },
            { id: "ps_fuente", name: "Falla de encendido / Luz azul (BLOD) / Fuente interna", basePrice: 80, time: "24 - 48 horas" },
            { id: "ps_lector", name: "Lector no traga disco / Láser óptico gastado", basePrice: 45, time: "3 horas" },
            { id: "ps4_pasta", name: "Mantenimiento PS4: Pasta Térmica + Thermal Pads", basePrice: 35, time: "2 horas" }
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
            { id: "ns_usbc", name: "Cambio de Puerto USB-C (no carga o no conecta al Dock)", basePrice: 50, time: "3 horas" },
            { id: "ns_m92t36", name: "Reemplazo de Chip de Carga Rohm M92T36 en corto", basePrice: 60, time: "24 horas" },
            { id: "ns_bq24193", name: "Reemplazo de Administrador de Batería BQ24193", basePrice: 55, time: "24 horas" },
            { id: "ns_pantalla", name: "Cambio de pantalla OLED / LCD o táctil roto", basePrice: 65, time: "3 horas" },
            { id: "ns_joycon", name: "Reparación Drift Joy-Con (Módulos Electromagnéticos Hall Effect)", basePrice: 20, time: "1 hora" }
          ]
        },
        {
          id: "xbox",
          name: "Microsoft Xbox",
          models: [
            "Xbox Series X",
            "Xbox Series S",
            "Xbox One X / One S",
            "Xbox 360 Slim / E"
          ],
          commonFaults: [
            { id: "xb_hdmi", name: "Reemplazo de Puerto HDMI de alta velocidad", basePrice: 65, time: "2 - 4 horas" },
            { id: "xb_retimer", name: "Reemplazo de Chip Retimer HDMI (TDP158 / NB7N)", basePrice: 80, time: "24 horas" },
            { id: "xb_mantenimiento", name: "Mantenimiento térmico y limpieza de turbina", basePrice: 40, time: "2 horas" },
            { id: "xb_apagado", name: "Se apaga a los pocos segundos (Falla etapa VRM / corto)", basePrice: 90, time: "24 - 48 horas" }
          ]
        },
        {
          id: "portatiles_pc_gaming",
          name: "Valve Steam Deck / ASUS ROG Ally / Lenovo Go",
          models: [
            "Valve Steam Deck LCD / OLED",
            "ASUS ROG Ally Z1 Extreme",
            "Lenovo Legion Go"
          ],
          commonFaults: [
            { id: "deck_analogos", name: "Reemplazo de Joysticks por sensores Hall Effect", basePrice: 40, time: "2 horas" },
            { id: "deck_usbc", name: "Reparación Puerto USB-C Carga Rápida PD", basePrice: 55, time: "3 horas" },
            { id: "deck_pantalla", name: "Cambio de Pantalla táctil 7\" / 8.8\"", basePrice: 85, time: "24 horas" }
          ]
        }
      ]
    },
    {
      id: "smartwatches",
      name: "Smartwatches / Wearables",
      icon: "watch",
      description: "Cambio de vidrios táctiles, pantallas OLED, baterías y sellado de estanqueidad.",
      brands: [
        {
          id: "apple_watch",
          name: "Apple Watch",
          models: [
            "Apple Watch Ultra 2 / Ultra (49mm)",
            "Apple Watch Series 9 / 8 / 7 (41mm / 45mm)",
            "Apple Watch Series 6 / 5 / 4 (40mm / 44mm)",
            "Apple Watch SE (2022 / 2020)"
          ],
          commonFaults: [
            { id: "aw_vidrio", name: "Reemplazo de Cristal Zafiro / Ion-X roto", basePrice: 65, time: "3 - 4 horas" },
            { id: "aw_bateria", name: "Cambio Batería Original con empaque estanco", basePrice: 45, time: "2 horas" },
            { id: "aw_pantalla", name: "Cambio Módulo Completo OLED Retina", basePrice: 95, time: "24 horas" }
          ]
        },
        {
          id: "samsung_watch",
          name: "Samsung Galaxy Watch",
          models: [
            "Galaxy Watch 6 Classic / Watch 6 (40/44/47mm)",
            "Galaxy Watch 5 Pro / Watch 5",
            "Galaxy Watch 4 Classic / Watch 4",
            "Galaxy Watch Active 2"
          ],
          commonFaults: [
            { id: "gw_pantalla", name: "Cambio Display Super AMOLED Roto", basePrice: 60, time: "2 - 3 horas" },
            { id: "gw_bateria", name: "Reemplazo Batería 300-590 mAh", basePrice: 35, time: "2 horas" }
          ]
        },
        {
          id: "xiaomi_watch",
          name: "Xiaomi / Redmi Smart Band",
          models: [
            "Redmi Watch 4 / Watch 3 Active",
            "Xiaomi Smart Band 8 / 7 Pro / 7",
            "Haylou Solar / RS4"
          ],
          commonFaults: [
            { id: "xw_bateria", name: "Cambio Batería / Limpieza bornes de carga", basePrice: 22, time: "1 - 2 horas" },
            { id: "xw_pantalla", name: "Cambio Módulo Pantalla AMOLED", basePrice: 30, time: "2 horas" }
          ]
        },
        {
          id: "amazfit_watch",
          name: "Amazfit (GTS / GTR / Bip)",
          models: [
            "Amazfit GTS 4 / GTS 3 / GTS 2 mini",
            "Amazfit GTR 4 / GTR 3 Pro",
            "Amazfit Bip 5 / Bip 3 / T-Rex 2"
          ],
          commonFaults: [
            { id: "amz_pantalla", name: "Cambio de Pantalla AMOLED", basePrice: 35, time: "2 horas" },
            { id: "amz_bateria", name: "Reemplazo de Batería", basePrice: 25, time: "1 - 2 horas" }
          ]
        },
        {
          id: "huawei_watch",
          name: "Huawei Watch",
          models: [
            "Huawei Watch GT 4 / GT 3 Pro",
            "Huawei Watch Fit 2 / Fit SE",
            "Huawei Band 8 / 7"
          ],
          commonFaults: [
            { id: "hw_pantalla", name: "Cambio Módulo Display AMOLED", basePrice: 40, time: "2 horas" },
            { id: "hw_bateria", name: "Reemplazo Batería Original Huawei", basePrice: 28, time: "1 - 2 horas" }
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
