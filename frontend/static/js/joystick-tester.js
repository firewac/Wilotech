/**
 * WILOTECH Laboratorio - Probador y Calibrador de Joystick
 * Módulo de Diagnóstico, Calibración de Deriva (Drift) y Test de Circularidad para Mandos (HTML5 Gamepad API)
 */

class JoystickTester {
  constructor() {
    this.selectedPadIndex = null;
    this.animFrameId = null;
    this.isLoopRunning = false;

    // Configuración de calibración y deadzone
    this.config = {
      innerDeadzone: 0.05, // 5%
      outerDeadzone: 0.98, // 98%
      invertLX: false,
      invertLY: false,
      invertRX: false,
      invertRY: false,
    };

    // Offsets de centrado manual (Calibración Cero)
    this.offsets = {}; // { index: { lx: 0, ly: 0, rx: 0, ry: 0 } }

    // Puntos para test de circularidad
    this.circularityData = {
      left: { points: [], maxDistances: new Array(36).fill(0), count: 0, errorAvg: 0 },
      right: { points: [], maxDistances: new Array(36).fill(0), count: 0, errorAvg: 0 }
    };

    // Historial de logs
    this.logs = [];

    // Botones con mapeo estándar HTML5 Gamepad
    this.buttonNames = [
      "A / Cross (B0)",
      "B / Circle (B1)",
      "X / Square (B2)",
      "Y / Triangle (B3)",
      "L1 / LB (B4)",
      "R1 / RB (B5)",
      "L2 / LT (B6)",
      "R2 / RT (B7)",
      "Select / Share / Back (B8)",
      "Start / Options / Menu (B9)",
      "L3 / Left Stick Click (B10)",
      "R3 / Right Stick Click (B11)",
      "D-Pad Up (B12)",
      "D-Pad Down (B13)",
      "D-Pad Left (B14)",
      "D-Pad Right (B15)",
      "Home / Guide / PS (B16)",
      "Touchpad Click (B17)"
    ];
  }

  init() {
    this.bindEvents();
    this.detectGamepads();
    this.startLoop();
    this.initCanvases();
    this.addLog("Sistema de Diagnóstico de Joystick inicializado", "info");
  }

  bindEvents() {
    window.addEventListener("gamepadconnected", (e) => {
      this.addLog(`✓ Joystick Conectado: ${e.gamepad.id} (Índice #${e.gamepad.index})`, "success");
      this.detectGamepads();
      if (this.selectedPadIndex === null) {
        this.selectedPadIndex = e.gamepad.index;
      }
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      this.addLog(`⚠️ Joystick Desconectado: ${e.gamepad.id} (Índice #${e.gamepad.index})`, "warning");
      this.detectGamepads();
      if (this.selectedPadIndex === e.gamepad.index) {
        const remaining = this.getConnectedGamepads();
        this.selectedPadIndex = remaining.length > 0 ? remaining[0].index : null;
      }
    });

    // Event listeners para sliders de deadzone
    const innerSlider = document.getElementById("js-inner-deadzone");
    if (innerSlider) {
      innerSlider.addEventListener("input", (e) => {
        this.config.innerDeadzone = parseFloat(e.target.value) / 100;
        document.getElementById("js-inner-deadzone-val").textContent = `${e.target.value}%`;
      });
    }

    const outerSlider = document.getElementById("js-outer-deadzone");
    if (outerSlider) {
      outerSlider.addEventListener("input", (e) => {
        this.config.outerDeadzone = parseFloat(e.target.value) / 100;
        document.getElementById("js-outer-deadzone-val").textContent = `${e.target.value}%`;
      });
    }
  }

  getConnectedGamepads() {
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    const list = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] && raw[i].connected) {
        list.push(raw[i]);
      }
    }
    return list;
  }

  detectGamepads() {
    const gamepads = this.getConnectedGamepads();
    const select = document.getElementById("js-gamepad-select");
    const statusBanner = document.getElementById("js-status-banner");
    const statusText = document.getElementById("js-status-text");

    if (!select || !statusBanner) return;

    select.innerHTML = "";

    if (gamepads.length === 0) {
      this.selectedPadIndex = null;
      select.innerHTML = '<option value="">Sin mandos detectados</option>';
      statusBanner.className = "p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between";
      statusText.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <div>
            <span class="font-brand font-bold text-amber-400 text-sm block">ESPERANDO CONEXIÓN DE JOYSTICK</span>
            <span class="text-xs text-slate-400">Conectá un mando USB o Bluetooth (Xbox, DualShock, DualSense, Switch Pro, etc.) y presioná cualquier botón.</span>
          </div>
        </div>
      `;
      return;
    }

    statusBanner.className = "p-4 rounded-2xl bg-[#00f5a0]/10 border border-[#00f5a0]/40 flex items-center justify-between";

    gamepads.forEach((gp) => {
      const opt = document.createElement("option");
      opt.value = gp.index;
      opt.textContent = `[ID #${gp.index}] ${gp.id} (${gp.buttons.length} botones, ${gp.axes.length} ejes)`;
      select.appendChild(opt);
    });

    if (this.selectedPadIndex === null || !gamepads.some(g => g.index === this.selectedPadIndex)) {
      this.selectedPadIndex = gamepads[0].index;
    }
    select.value = this.selectedPadIndex;

    const currentGp = gamepads.find(g => g.index === this.selectedPadIndex) || gamepads[0];
    statusText.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f5a0] opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-[#00f5a0]"></span>
        </span>
        <div>
          <span class="font-brand font-bold text-[#00f5a0] text-sm block">CONTROL CONECTADO Y EN TIEMPO REAL</span>
          <span class="text-xs text-slate-300 font-brand">${currentGp.id}</span>
        </div>
      </div>
    `;
  }

  onSelectGamepad(index) {
    this.selectedPadIndex = parseInt(index);
    this.detectGamepads();
    this.resetCircularityTest();
  }

  startLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    const render = () => {
      this.update();
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  stopLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.isLoopRunning = false;
    }
  }

  update() {
    const gamepads = this.getConnectedGamepads();
    if (this.selectedPadIndex === null || gamepads.length === 0) {
      this.resetUIState();
      return;
    }

    const gp = gamepads.find(g => g.index === this.selectedPadIndex);
    if (!gp) {
      this.resetUIState();
      return;
    }

    // 1. Lectura de Ejes (Sticks Analógicos)
    const rawLX = gp.axes[0] || 0;
    const rawLY = gp.axes[1] || 0;
    const rawRX = gp.axes[2] !== undefined ? gp.axes[2] : (gp.axes[3] !== undefined ? gp.axes[2] : 0);
    const rawRY = gp.axes[3] !== undefined ? gp.axes[3] : 0;

    // Aplicar Offset de Centrado Manual si existe
    const off = this.offsets[gp.index] || { lx: 0, ly: 0, rx: 0, ry: 0 };
    let lx = rawLX - off.lx;
    let ly = rawLY - off.ly;
    let rx = rawRX - off.rx;
    let ry = rawRY - off.ry;

    // Inversión opcional
    if (this.config.invertLX) lx = -lx;
    if (this.config.invertLY) ly = -ly;
    if (this.config.invertRX) rx = -rx;
    if (this.config.invertRY) ry = -ry;

    // Aplicar Deadzones
    const normL = this.applyDeadzone(lx, ly);
    const normR = this.applyDeadzone(rx, ry);

    // 2. Actualizar interfaz visual
    this.updateSticksUI(rawLX, rawLY, normL, rawRX, rawRY, normR);
    this.updateButtonsUI(gp.buttons);
    this.updateControllerSVG(gp.buttons, normL, normR);

    // 3. Renderizar Canvas de Circularidad
    this.renderStickCanvas("js-left-stick-canvas", normL.x, normL.y, "left");
    this.renderStickCanvas("js-right-stick-canvas", normR.x, normR.y, "right");
  }

  applyDeadzone(x, y) {
    const r = Math.sqrt(x * x + y * y);
    const inner = this.config.innerDeadzone;
    const outer = this.config.outerDeadzone;

    if (r < inner) {
      return { x: 0, y: 0, r: 0, rawR: r, inDeadzone: true };
    }

    let normR = Math.min(1.0, (r - inner) / (outer - inner));
    const factor = normR / r;
    return {
      x: Math.max(-1, Math.min(1, x * factor)),
      y: Math.max(-1, Math.min(1, y * factor)),
      r: normR,
      rawR: r,
      inDeadzone: false
    };
  }

  updateSticksUI(rawLX, rawLY, normL, rawRX, rawRY, normR) {
    // Stick Izquierdo Textos
    document.getElementById("js-lx-val").textContent = normL.x.toFixed(4);
    document.getElementById("js-ly-val").textContent = normL.y.toFixed(4);
    document.getElementById("js-lr-val").textContent = normL.rawR.toFixed(4);
    const angleL = (Math.atan2(normL.y, normL.x) * (180 / Math.PI) + 360) % 360;
    document.getElementById("js-[#00d2ff]-angle") ? document.getElementById("js-[#00d2ff]-angle").textContent = `${Math.round(angleL)}°` : null;

    // Stick Derecho Textos
    document.getElementById("js-rx-val").textContent = normR.x.toFixed(4);
    document.getElementById("js-ry-val").textContent = normR.y.toFixed(4);
    document.getElementById("js-rr-val").textContent = normR.rawR.toFixed(4);

    // Deriva en Reposo (Drift Indicator)
    const driftBadgeL = document.getElementById("js-left-drift-badge");
    if (driftBadgeL) {
      if (normL.rawR > 0.08) {
        driftBadgeL.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse";
        driftBadgeL.textContent = "DERIVA / DRIFT DETECTADO";
      } else if (normL.rawR > 0.03) {
        driftBadgeL.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40";
        driftBadgeL.textContent = "DESVIACIÓN LEVE";
      } else {
        driftBadgeL.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40";
        driftBadgeL.textContent = "CENTRO EXACTO ✓";
      }
    }

    const driftBadgeR = document.getElementById("js-right-drift-badge");
    if (driftBadgeR) {
      if (normR.rawR > 0.08) {
        driftBadgeR.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse";
        driftBadgeR.textContent = "DERIVA / DRIFT DETECTADO";
      } else if (normR.rawR > 0.03) {
        driftBadgeR.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40";
        driftBadgeR.textContent = "DESVIACIÓN LEVE";
      } else {
        driftBadgeR.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40";
        driftBadgeR.textContent = "CENTRO EXACTO ✓";
      }
    }
  }

  updateButtonsUI(buttons) {
    const grid = document.getElementById("js-buttons-grid");
    if (!grid) return;

    let html = "";
    buttons.forEach((btn, idx) => {
      const name = this.buttonNames[idx] || `Botón B${idx}`;
      const pressed = btn.pressed;
      const val = typeof btn.value === "number" ? btn.value : (pressed ? 1 : 0);
      const isAnalog = idx === 6 || idx === 7; // Gatillos L2 / RT

      const activeClass = pressed
        ? "bg-[#00f5a0]/20 border-[#00f5a0] text-[#00f5a0] shadow-lg shadow-[#00f5a0]/20 scale-[1.02]"
        : "bg-[#0a101c] border-slate-800 text-slate-400";

      html += `
        <div class="p-2.5 rounded-xl border transition-all ${activeClass} flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full ${pressed ? 'bg-[#00f5a0] shadow-[0_0_8px_#00f5a0]' : 'bg-slate-700'}"></div>
            <span class="font-brand text-xs font-bold">${name}</span>
          </div>
          <div class="font-mono text-xs font-bold ${pressed ? 'text-[#00f5a0]' : 'text-slate-500'}">
            ${isAnalog ? `${Math.round(val * 100)}% (${val.toFixed(2)})` : (pressed ? "PRESIONADO" : "SOLTADO")}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    // Actualizar barras de profundidad de gatillos analógicos
    const l2Val = buttons[6] ? buttons[6].value : 0;
    const r2Val = buttons[7] ? buttons[7].value : 0;

    const l2Bar = document.getElementById("js-l2-bar");
    const r2Bar = document.getElementById("js-r2-bar");
    const l2Txt = document.getElementById("js-l2-text");
    const r2Txt = document.getElementById("js-r2-text");

    if (l2Bar) l2Bar.style.width = `${Math.round(l2Val * 100)}%`;
    if (r2Bar) r2Bar.style.width = `${Math.round(r2Val * 100)}%`;
    if (l2Txt) l2Txt.textContent = `GATILLO L2: ${Math.round(l2Val * 100)}%`;
    if (r2Txt) r2Txt.textContent = `GATILLO R2: ${Math.round(r2Val * 100)}%`;
  }

  updateControllerSVG(buttons, normL, normR) {
    // Mover thumbs analógicos en SVG si existen
    const svgLS = document.getElementById("svg-stick-left");
    const svgRS = document.getElementById("svg-stick-right");

    if (svgLS) {
      const cx = 140 + normL.x * 25;
      const cy = 190 + normL.y * 25;
      svgLS.setAttribute("cx", cx);
      svgLS.setAttribute("cy", cy);
    }
    if (svgRS) {
      const cx = 260 + normR.x * 25;
      const cy = 190 + normR.y * 25;
      svgRS.setAttribute("cx", cx);
      svgRS.setAttribute("cy", cy);
    }

    // Iluminar elementos SVG de botones
    const mapSVG = {
      0: "svg-btn-a",
      1: "svg-btn-b",
      2: "svg-btn-x",
      3: "svg-btn-y",
      4: "svg-btn-l1",
      5: "svg-btn-r1",
      8: "svg-btn-select",
      9: "svg-btn-start",
      10: "svg-stick-left-click",
      11: "svg-stick-right-click",
      12: "svg-dpad-up",
      13: "svg-dpad-down",
      14: "svg-dpad-left",
      15: "svg-dpad-right",
      16: "svg-btn-home"
    };

    buttons.forEach((btn, idx) => {
      const svgId = mapSVG[idx];
      if (svgId) {
        const el = document.getElementById(svgId);
        if (el) {
          if (btn.pressed) {
            el.setAttribute("fill", "#00f5a0");
            el.setAttribute("filter", "drop-shadow(0px 0px 6px #00f5a0)");
          } else {
            el.setAttribute("fill", el.getAttribute("data-default-fill") || "#1e293b");
            el.removeAttribute("filter");
          }
        }
      }
    });
  }

  initCanvases() {
    ["js-left-stick-canvas", "js-right-stick-canvas"].forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas) {
        canvas.width = 240;
        canvas.height = 240;
      }
    });
  }

  renderStickCanvas(canvasId, x, y, side) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 100; // Radio del círculo límite

    // Limpiar canvas
    ctx.clearRect(0, 0, w, h);

    // Fondo grid cibernético
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, w, h);

    // Ejes de cruz (Center Crosshair)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10);
    ctx.moveTo(10, cy); ctx.lineTo(w - 10, cy);
    ctx.stroke();

    // Círculo Límite Ideal (Ideal 1.0 boundary)
    ctx.strokeStyle = "#00d2ff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zona Muerta Interna
    const deadzoneR = radius * this.config.innerDeadzone;
    ctx.fillStyle = "rgba(244, 63, 94, 0.15)";
    ctx.beginPath();
    ctx.arc(cx, cy, deadzoneR, 0, Math.PI * 2);
    ctx.fill();

    // Registrar trayectorias para test de circularidad
    const data = this.circularityData[side];
    const stickR = Math.sqrt(x * x + y * y);

    if (stickR > 0.4) {
      data.points.push({ x, y });
      if (data.points.length > 300) data.points.shift();

      // Calcular sector de 360 grados
      const angle = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
      const binIndex = Math.floor(angle / 10); // 36 sectores
      data.maxDistances[binIndex] = Math.max(data.maxDistances[binIndex], stickR);

      // Recalcular error de circularidad promedio
      let sumError = 0;
      let countedBins = 0;
      for (let i = 0; i < 36; i++) {
        if (data.maxDistances[i] > 0) {
          sumError += Math.abs(data.maxDistances[i] - 1.0);
          countedBins++;
        }
      }
      if (countedBins > 0) {
        data.errorAvg = (sumError / countedBins) * 100;
      }
    }

    // Dibujar traza de movimiento grabado
    if (data.points.length > 1) {
      ctx.strokeStyle = "rgba(0, 245, 160, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      data.points.forEach((pt, i) => {
        const px = cx + pt.x * radius;
        const py = cy + pt.y * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Dibujar posición actual del stick (Cursor Target)
    const posX = cx + x * radius;
    const posY = cy + y * radius;

    // Conexión vector desde el centro
    ctx.strokeStyle = stickR > 0.05 ? "#00f5a0" : "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(posX, posY);
    ctx.stroke();

    // Puntero Glowing
    ctx.fillStyle = stickR > 0.95 ? "#00f5a0" : (stickR < 0.05 ? "#38bdf8" : "#f59e0b");
    ctx.beginPath();
    ctx.arc(posX, posY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Actualizar badges de circularidad
    const errorElem = document.getElementById(`js-${side}-circularity-val`);
    if (errorElem) {
      const errStr = `${data.errorAvg.toFixed(1)}%`;
      errorElem.textContent = errStr;

      const badge = document.getElementById(`js-${side}-circularity-badge`);
      if (badge) {
        if (data.errorAvg < 8) {
          badge.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40";
          badge.textContent = "CIRCULARIDAD ÓPTIMA";
        } else if (data.errorAvg < 15) {
          badge.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40";
          badge.textContent = "DESVIACIÓN MODERADA";
        } else {
          badge.className = "px-2 py-0.5 rounded text-[10px] font-brand font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40";
          badge.textContent = "DESGASTE / DERIVA ELEVADA";
        }
      }
    }
  }

  resetCircularityTest() {
    this.circularityData = {
      left: { points: [], maxDistances: new Array(36).fill(0), count: 0, errorAvg: 0 },
      right: { points: [], maxDistances: new Array(36).fill(0), count: 0, errorAvg: 0 }
    };
    this.addLog("Test de circularidad reiniciado", "info");
    if (typeof showToast === "function") showToast("Test de circularidad reseteado", "info");
  }

  calibrateZero() {
    const gamepads = this.getConnectedGamepads();
    if (this.selectedPadIndex === null || gamepads.length === 0) return;
    const gp = gamepads.find(g => g.index === this.selectedPadIndex);
    if (!gp) return;

    this.offsets[gp.index] = {
      lx: gp.axes[0] || 0,
      ly: gp.axes[1] || 0,
      rx: gp.axes[2] !== undefined ? gp.axes[2] : 0,
      ry: gp.axes[3] !== undefined ? gp.axes[3] : 0,
    };

    this.addLog(`✓ Centrado cero registrado para Joystick #${gp.index}: LX=${this.offsets[gp.index].lx.toFixed(3)}, LY=${this.offsets[gp.index].ly.toFixed(3)}`, "success");
    if (typeof showToast === "function") showToast("✓ Calibración de punto cero guardada", "success");
  }

  resetZeroCalibration() {
    if (this.selectedPadIndex !== null) {
      delete this.offsets[this.selectedPadIndex];
    }
    this.addLog("Calibración de punto cero restaurada a fábrica", "info");
    if (typeof showToast === "function") showToast("Calibración de fábrica reseteada", "info");
  }

  testVibration(weak = 0.5, strong = 1.0, duration = 600) {
    const gamepads = this.getConnectedGamepads();
    if (this.selectedPadIndex === null || gamepads.length === 0) {
      if (typeof showToast === "function") showToast("No hay joystick conectado para probar vibración", "warning");
      return;
    }

    const gp = gamepads.find(g => g.index === this.selectedPadIndex);
    if (gp && gp.vibrationActuator) {
      gp.vibrationActuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: duration,
        weakMagnitude: weak,
        strongMagnitude: strong
      }).then(() => {
        this.addLog("🎮 Prueba de vibración ejecutada exitosamente", "success");
      }).catch(err => {
        this.addLog(`⚠️ El mando no respondió a la vibración API: ${err.message}`, "warning");
      });
    } else {
      if (typeof showToast === "function") {
        showToast("Este mando no soporta la API de vibración háptica direct-rumble en este navegador", "warning");
      }
      this.addLog("Vibración háptica no soportada por el driver del mando en este navegador", "warning");
    }
  }

  resetUIState() {
    ["js-lx-val", "js-ly-val", "js-lr-val", "js-rx-val", "js-ry-val", "js-rr-val"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "0.0000";
    });

    const grid = document.getElementById("js-buttons-grid");
    if (grid && grid.children.length === 0) {
      grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-500 font-brand text-xs">Conectá un joystick para comenzar las pruebas táctiles</div>';
    }
  }

  addLog(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.unshift({ msg, type, timestamp });
    if (this.logs.length > 50) this.logs.pop();

    const container = document.getElementById("js-diagnostic-logs");
    if (!container) return;

    const colors = {
      success: "text-[#00f5a0] border-[#00f5a0]/30 bg-[#00f5a0]/10",
      warning: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      error: "text-rose-400 border-rose-500/30 bg-rose-500/10",
      info: "text-[#00d2ff] border-[#00d2ff]/30 bg-[#00d2ff]/10"
    };

    const item = document.createElement("div");
    item.className = `p-2 rounded-lg border text-xs font-mono flex items-center justify-between gap-2 ${colors[type] || colors.info}`;
    item.innerHTML = `<span>${msg}</span><span class="text-[10px] text-slate-400 shrink-0">${timestamp}</span>`;

    container.insertBefore(item, container.firstChild);
  }

  generateDiagnosticReport() {
    const gamepads = this.getConnectedGamepads();
    if (this.selectedPadIndex === null || gamepads.length === 0) {
      return "⚠️ No hay joystick conectado para generar diagnóstico.";
    }

    const gp = gamepads.find(g => g.index === this.selectedPadIndex);
    const errL = this.circularityData.left.errorAvg.toFixed(1);
    const errR = this.circularityData.right.errorAvg.toFixed(1);

    const report = `=== INFORME DE DIAGNÓSTICO TÉCNICO DE JOYSTICK (WILOTECH LAB) ===
Fecha/Hora: ${new Date().toLocaleString()}
Dispositivo: ${gp ? gp.id : 'Mando Genérico'}
Ejes Detectados: ${gp ? gp.axes.length : 4} | Botones: ${gp ? gp.buttons.length : 17}

STICK IZQUIERDO:
  - Error Promedio de Circularidad: ${errL}% ${errL < 8 ? '[ÓPTIMO ✓]' : (errL < 15 ? '[DESVIACIÓN MODERADA]' : '[DERIVA ELEVADA - RECOMIENDA CAMBIO POTENCIÓMETRO/HALL]')}
  - Centrado Cero Activo: ${this.offsets[gp.index] ? 'Sí (Calibrado)' : 'No (Original)'}

STICK DERECHO:
  - Error Promedio de Circularidad: ${errR}% ${errR < 8 ? '[ÓPTIMO ✓]' : (errR < 15 ? '[DESVIACIÓN MODERADA]' : '[DERIVA ELEVADA - RECOMIENDA CAMBIO POTENCIÓMETRO/HALL]')}

CONFIGURACIÓN DE PRUEBA:
  - Zona Muerta Interna: ${(this.config.innerDeadzone * 100).toFixed(0)}%
  - Zona Muerta Externa: ${(this.config.outerDeadzone * 100).toFixed(0)}%

DIAGNÓSTICO GENERAL: Mando probado en banco de calibración de taller.
`;
    return report;
  }

  copyReportToClipboard() {
    const report = this.generateDiagnosticReport();
    navigator.clipboard.writeText(report).then(() => {
      this.addLog("📋 Diagnóstico copiado al portapapeles con éxito", "success");
      if (typeof showToast === "function") showToast("✓ Informe copiado al portapapeles", "success");
    }).catch(err => {
      this.addLog(`Error al copiar informe: ${err.message}`, "error");
    });
  }
}

// Instancia global
window.joystickTester = new JoystickTester();

function initJoystickTester() {
  window.joystickTester.init();
}
