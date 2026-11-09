/**
 * Data-driven 2D games with rooms, sprites, object instances and event/action lists.
 * Rendering: Canvas 2D. Interface: HTML/CSS. Uses independently versioned game-engine modules.
 * @author André Kless <andre.kless@web.de>
 * @copyright 2026 André Kless
 * @license MIT
 * @version 1.0.0
 */
/** Largest undistorted room rectangle fitting inside the available CSS area. */
export function fitGameArea(width, height, roomWidth, roomHeight) {
  if (![width, height, roomWidth, roomHeight].every(value => Number.isFinite(value) && value > 0))
    return { width: 0, height: 0 };
  const scale = Math.min(width / roomWidth, height / roomHeight);
  return { width: roomWidth * scale, height: roomHeight * scale };
}

export const component = {
  name: "game",
  ccm: "././libs/framework/ccm-28.0.0.min.js",
  config: {
    engine: ["ccm.load", "././libs/game-engine/dist/game-engine-1.0.0.mjs"],
    renderer: ["ccm.load", "././libs/game-engine/dist/canvas-renderer-1.0.0.mjs"],
    audioModule: ["ccm.load", "././libs/game-engine/dist/audio-1.0.0.mjs"],
    css: ["ccm.load", "././resources/styles.css"],

    /** Serializable game definition. See docs/game-format.md and resources/configs.mjs. */
    game: {
      id: "bouncing_orb", version: 1, schemaVersion: 1, title: "Ein Raum. Ein Objekt. Ein Spiel.",
      description: "Eine kleine Konfiguration zeigt Bewegung und Ereignisse.",
      width: 960, height: 480, fps: 60, initialRoom: "room1", globals: { score: 0 },
      sprites: {
        orb: { width: 48, height: 48, frames: ['<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="21" fill="#e5b95c"/><circle cx="19" cy="18" r="6" fill="#fff1c7"/></svg>'] },
      },
      objects: {
        orb: { sprite: "orb", events: {
          create: [{ type: "velocity", vx: 110, vy: 65 }],
          step: [
            { type: "if", condition: { op: "or", args: [
              { op: "and", args: [{ op: "gt", args: [{ ref: "self.x" }, 930] }, { op: "gt", args: [{ ref: "self.vx" }, 0] }] },
              { op: "and", args: [{ op: "lt", args: [{ ref: "self.x" }, 30] }, { op: "lt", args: [{ ref: "self.vx" }, 0] }] },
            ] }, then: [{ type: "reverse", axis: "x" }] },
            { type: "if", condition: { op: "or", args: [
              { op: "and", args: [{ op: "gt", args: [{ ref: "self.y" }, 450] }, { op: "gt", args: [{ ref: "self.vy" }, 0] }] },
              { op: "and", args: [{ op: "lt", args: [{ ref: "self.y" }, 30] }, { op: "lt", args: [{ ref: "self.vy" }, 0] }] },
            ] }, then: [{ type: "reverse", axis: "y" }] },
          ],
          pointerDown: [{ type: "score", value: 1 }, { type: "reverse", axis: "both" }],
        } },
      },
      rooms: { room1: { width: 960, height: 480, background: "#141e29", instances: [{ object: "orb", x: 100, y: 100 }] } },
      hud: [{ label: "Treffer", path: "globals.score" }],
      help: ["Klicke die Kugel an. Ihre Richtung wechselt und du erhältst einen Punkt.", "Leertaste: Pause. Der Spielstand lässt sich lokal speichern."],
    },

    /** Modules exporting custom synchronous actions and/or a canvas draw hook. */
    plugins: [],

    /** Optional CCM datastore. A name without a URL stores games locally in IndexedDB. */
    storage: { store: ["ccm.store", { name: "ccm-game-saves" }] },

    /** Optional modules called with { app, type }; never executed once per animation frame. */
    extensions: [],

    /** Start in a paused state, useful for previews and controlled embedding. */
    autoStart: true,
    sound: false,
  },
  Instance: function () {
    let runtime, painter, frame = null, controller, observer, audio, audioSettings;
    let lastTime = null, accumulator = 0, lastHud = -1, active = false, ending = false, finishPending = false;
    let manualPaused = false, blurred = false, pageHidden = false, pageFrozen = false, loopReady = false;
    let elements = {}, source = {}, statusText = "", uiBusy = false, loadSerial = 0;
    let sizeObserver, hoverPoint = null, viewportOverflow = null, fitKey = "";
    const pressed = new Set();
    this.gui = { paused: false, sound: false, selected: null, zoom: 1, fullscreen: false, fullscreenMode: null };

    this.emit = async type => {
      for (const extension of [].concat(this.extensions || [])) if (extension) await extension({ app: this, type });
    };
    this.init = async () => this.emit("init");
    this.ready = async () => this.emit("ready");

    const configureAudio = definition => {
      audioSettings ||= {
        enabled: !!(this.src?.sound ?? this.sound),
        music: definition.audio?.musicVolume ?? .45,
        effects: definition.audio?.effectsVolume ?? .70,
      };
      this.gui.sound = audioSettings.enabled;
    };
    const ensureAudio = definition => {
      if (!audio) {
        const current = new this.audioModule.GameAudio(definition.audio, {
          onStatus: status => { if (audio === current) updateAudio(status); },
        });
        audio = current;
        audio.setPaused(true);
      }
      this.audio = audio;
      audio.setVolumes(audioSettings);
      audio.setEnabled(this.gui.sound);
      return audio;
    };

    /** Call within an intro/start gesture, await decoding, then use start(true). */
    this.prepareAudio = () => {
      const definition = this.src?.game || this.game;
      configureAudio(definition);
      return ensureAudio(definition).unlock();
    };

    /** Start/restart without carrying mutable state back into the game definition. */
    this.start = async (reuseAudio = false) => {
      const fullscreenShell = reuseAudio === true && this.gui.fullscreen ? elements.shell : null;
      // A UI restart retains the gesture-unlocked context while rewinding its music.
      if (reuseAudio === true) {
        stopRuntime(!!fullscreenShell || ownsNativeFullscreen()); audio?.setPaused(true); audio?.reset();
      } else this.stop();
      const serial = ++loadSerial;
      try { await this.emit("before-start"); }
      catch (error) { if (serial === loadSerial) this.stop(); throw error; }
      if (serial !== loadSerial) return;
      source = this.src || {};
      const definition = source.game || this.game;
      manualPaused = !(source.autoStart ?? this.autoStart);
      this.gui.paused = manualPaused;
      blurred = document.hasFocus?.() === false;
      pageHidden = pageFrozen = false;
      configureAudio(definition);
      this.gui.selected = null;
      this.gui.zoom = Math.max(1, Math.min(2, definition.view?.zoom || 1));
      ending = false; finishPending = false; accumulator = 0; lastTime = null; lastHud = -1; statusText = "";
      controller = new AbortController();
      buildInterface(definition, fullscreenShell);
      try {
        ensureAudio(definition);
        audio.setPaused(true);
        runtime = new this.engine.GameRuntime(definition, {
          plugins: source.plugins || this.plugins || [],
          notify: notify,
        });
        this.runtime = runtime;
        this.state = runtime.start();
        painter = new this.renderer.CanvasRenderer(elements.canvas, runtime);
        this.painter = painter;
        await painter.load();
        if (serial !== loadSerial) return;
        paintToolIcons();
        bindEvents();
        // An intro can already have put a shared ancestor into native fullscreen.
        // Also respect Escape while assets were loading or a restart was rebuilding.
        fullscreenMode(ownsNativeFullscreen() ? "native" : this.gui.fullscreenMode === "viewport" ? "viewport" : null);
        active = true;
        syncPlayback(true);
        paint(true);
        if (!statusText) setStatus("Bereit. Wähle ein Werkzeug oder klicke ins Spielfeld.");
        // Embedders may detach/reinsert a view when switching tabs. Suspension
        // retains its runtime, decoded artwork and controls; only stop/destroy
        // permanently releases them. The observer remains able to see reattach.
        observer = new MutationObserver(() => { if (active) syncPlayback(); });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        // Document observers do not cross CCM Shadow DOM boundaries. Watch
        // each containing shadow root as well, so an embedding tab can move
        // the component's content without making its eventual return invisible.
        for (let root = this.element.getRootNode?.(); root?.host; root = root.host.getRootNode())
          observer.observe(root, { childList: true, subtree: true });
        await this.emit("start");
        if (serial !== loadSerial || !active) return;
        loopReady = true;
        requestFrame();
      } catch (error) {
        if (serial !== loadSerial) throw error;
        this.stop(); showError(error); throw error;
      }
    };

    /** Pause freezes simulation time, including alarms and action cooldowns. */
    this.pause = () => {
      manualPaused = true;
      syncPlayback();
    };
    this.resume = () => {
      if (!active || runtime?.state.finished) return;
      manualPaused = false;
      blurred = document.hasFocus?.() === false;
      // A WebView/page-cache transition can discard a pending callback. Always
      // request a fresh one; never depend on a pre-suspension rAF surviving.
      syncPlayback(true);
    };
    const stopRuntime = (preserveFullscreen = false) => {
      if (!preserveFullscreen) leaveFullscreen();
      sizeObserver?.disconnect(); sizeObserver = null; hoverPoint = null; fitKey = "";
      active = false; loopReady = false; loadSerial++; cancelFrame();
      controller?.abort(); observer?.disconnect(); painter?.destroy();
      releaseKeys(); lastTime = null;
    };
    this.stop = ({ preserveFullscreen = false } = {}) => {
      stopRuntime(preserveFullscreen);
      if (preserveFullscreen) fullscreenMode(null);
      const previousAudio = audio;
      audio = null; this.audio = null;
      void previousAudio?.destroy();
    };
    this.destroy = async () => {
      const previousAudio = audio;
      this.stop(); await previousAudio?.destroy();
      await this.emit("destroy");
    };
    this.getValue = () => runtime?.snapshot() ?? null;
    this.step = () => {
      if (!runtime || runtime.state.finished) return;
      this.pause(); runtime.step(); this.state = runtime.state; paint(true);
    };
    this.command = (name, payload = {}) => {
      if (!runtime) return;
      if (name === "tool" && !toolEnabled(runtime.definition.tools?.find(tool => tool.id === payload.tool))) {
        paint(true); return;
      }
      runtime.command(name, payload); this.state = runtime.state; paint(true);
    };
    const toolState = tool => {
      if (!tool) return { enabled: false };
      if (tool.enabled !== undefined && !runtime.evaluate(tool.enabled))
        return { enabled: false, reason: tool.disabledHint };
      for (const plugin of runtime.plugins || []) {
        const state = plugin.toolState?.(runtime, tool.id);
        if (state?.enabled === false) return state;
      }
      return { enabled: true };
    };
    const toolEnabled = tool => toolState(tool).enabled;
    this.loadState = snapshot => {
      if (!runtime) throw new Error("Das Spiel wurde noch nicht gestartet.");
      this.pause(); runtime.restore(snapshot); this.state = runtime.state;
      audio?.reset();
      ending = false; finishPending = false; elements.overlay.hidden = true; paint(true);
      setStatus("Spielstand geladen. Mit Fortsetzen geht es weiter.");
    };
    this.save = async () => {
      const storage = source.storage ?? this.storage;
      if (!storage?.store) throw new Error("Kein Datastore konfiguriert.");
      const state = this.getValue();
      await storage.store.set({ key: storageKey(storage), gameId: state.gameId,
        savedAt: new Date().toISOString(), state });
      setStatus("Spielstand gespeichert.");
      await this.emit("save");
    };
    this.load = async () => {
      const storage = source.storage ?? this.storage;
      if (!storage?.store) throw new Error("Kein Datastore konfiguriert.");
      const saved = await storage.store.get(storageKey(storage));
      if (!saved) { setStatus("Für dieses Spiel gibt es noch keinen gespeicherten Spielstand."); return; }
      this.loadState(saved.state);
      await this.emit("load");
    };

    const storageKey = storage => {
      if (storage.key !== undefined) return storage.key;
      const id = runtime.definition.id || "game";
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(id))
        throw new Error("Bitte storage.key als gültigen CCM-Datensatzschlüssel angeben (1–32 Zeichen, Kleinbuchstaben, Ziffern, Unterstrich). ");
      return id;
    };

    function node(tag, className, text) {
      const result = document.createElement(tag);
      if (className) result.className = className;
      if (text !== undefined) result.textContent = text;
      return result;
    }
    function button(text, action, title) {
      const result = node("button", "game-action", text);
      result.type = "button"; result.dataset.action = action;
      if (title) result.title = title;
      return result;
    }

    const buildInterface = (definition, retainedShell = null) => {
      const labels = definition.labels || {};
      const shell = retainedShell || node("section", "game-shell");
      shell.setAttribute("aria-label", definition.title || "2D-Spiel");
      const header = node("header", "game-header");
      const brand = node("div", "game-brand");
      brand.append(node("p", "game-eyebrow", labels.eyebrow || "Ein neues Spiel wartet"), node("h1", "game-title", definition.title || "Game"),
        node("p", "game-description", definition.description || ""));
      const actions = node("div", "game-actions");
      actions.append(button("Pause", "pause", "Leertaste"), button("Neustart", "restart"),
        button("Ton aus", "sound"), button("Speichern", "save"), button("Laden", "load"),
        button("Vollbild", "fullscreen", "Gesamtes Spielfeld einpassen; Escape beendet Vollbild"));
      if (typeof (source.onHome ?? this.onHome) === "function")
        actions.append(button("Startbildschirm", "home", "Durchgang beenden und zum Startbildschirm zurückkehren"));
      if (!(source.storage ?? this.storage)?.store) for (const item of actions.querySelectorAll('[data-action="save"], [data-action="load"]')) item.hidden = true;
      header.append(brand, actions);
      const audioControls = node("div", "game-audio-controls");
      audioControls.setAttribute("role", "group");
      audioControls.setAttribute("aria-label", "Lautstärke");
      const audioSliders = {};
      for (const [channel, title] of [["music", "Musik"], ["effects", "Effekte"]]) {
        const label = node("label", "game-audio-volume");
        const input = node("input"); input.type = "range";
        input.min = "0"; input.max = "100"; input.step = "1"; input.dataset.audio = channel;
        input.setAttribute("aria-label", `${title}lautstärke`);
        input.value = String(Math.round(audioSettings[channel] * 100));
        const value = node("output", "game-audio-value", `${input.value} %`);
        label.append(node("span", "", title), input, value);
        audioControls.append(label); audioSliders[channel] = { input, value };
        if (channel === "music" && !definition.audio?.music) label.hidden = true;
      }
      const audioStatus = node("span", "game-audio-status");
      audioStatus.setAttribute("role", "status");
      audioControls.append(audioStatus);
      const hud = node("div", "game-hud");
      const roomStat = node("div", "game-stat game-stat-room");
      const roomName = node("span", "game-stat-value");
      roomStat.append(node("span", "game-stat-label", labels.room || "Raum"), roomName); hud.append(roomStat);
      const stats = (definition.hud || []).map(item => {
        const wrapper = node("div", "game-stat");
        const value = node("span", "game-stat-value", "0");
        wrapper.append(node("span", "game-stat-label", item.label), value); hud.append(wrapper);
        return { ...item, element: value };
      });
      const stageWrap = node("div", "game-stage-wrap");
      const viewControls = node("div", "game-view-controls");
      const zoomOut = button("−", "zoom-out", "Figuren kleiner darstellen");
      const zoomIn = button("+", "zoom-in", "Figuren größer darstellen");
      zoomOut.setAttribute("aria-label", "Ansicht verkleinern");
      zoomIn.setAttribute("aria-label", "Ansicht vergrößern");
      const zoomLabel = node("span", "game-zoom-label");
      viewControls.append(node("span", "", "Ansicht"), zoomOut, zoomLabel, zoomIn);
      const stage = node("div", "game-stage");
      const canvas = node("canvas", "game-canvas");
      canvas.tabIndex = 0; canvas.setAttribute("role", "application");
      canvas.setAttribute("aria-label", `${definition.title || "Spiel"}: interaktives Spielfeld. Anleitung unter dem Spielfeld.`);
      canvas.textContent = "Dieses Spiel benötigt einen Browser mit Canvas-2D-Unterstützung.";
      const overlay = node("div", "game-overlay"); overlay.hidden = true;
      const dialog = node("div", "game-dialog");
      dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-label", "Level abgeschlossen");
      const resultTitle = node("h2", "", labels.resultTitle || "Spiel beendet");
      const resultText = node("p");
      const next = button(labels.next || "Nächster Raum", "next");
      dialog.append(resultTitle, resultText, next, button("Noch einmal spielen", "restart")); overlay.append(dialog);
      stage.append(canvas); stageWrap.append(stage, overlay);
      // Decorative room framing stays outside the scroll viewport and pointer coordinates.
      let stageFrame = stageWrap;
      if (definition.view?.frame) {
        const frame = definition.view.frame;
        stageFrame = node("div", "game-frame");
        const inset = Number(frame.inset);
        stageFrame.style.setProperty("--game-frame-inset", `${Number.isFinite(inset) ? Math.max(0, Math.min(80, inset)) : 32}px`);
        if (typeof frame.image === "string") stageFrame.style.backgroundImage = `url(${JSON.stringify(frame.image)})`;
        if (typeof frame.background === "string") stageFrame.style.backgroundColor = frame.background;
        stageFrame.append(stageWrap);
      }
      const tools = definition.tools || [];
      const groupName = tool => typeof tool.group === "string" ? tool.group.trim() : "";
      const grouped = tools.some(tool => groupName(tool));
      const toolbar = node("div", `game-tools${grouped ? " game-tools-grouped" : ""}`);
      toolbar.setAttribute("role", "toolbar"); toolbar.setAttribute("aria-label", "Werkzeuge und Aktionen");
      const toolPicker = node("select", "game-tool-picker");
      toolPicker.setAttribute("aria-label", "Werkzeug auswählen");
      const placeholder = node("option", "", "Werkzeug wählen …"); placeholder.value = "";
      toolPicker.append(placeholder);
      const toolIcons = [], toolOptions = [placeholder], toolGroups = new Map();
      for (const tool of tools) {
        let buttons = toolbar, options = toolPicker;
        if (grouped) {
          const label = groupName(tool) || "Weitere Aktionen";
          let group = toolGroups.get(label);
          if (!group) {
            const element = node("div", "game-tool-group");
            element.setAttribute("role", "group"); element.setAttribute("aria-label", label);
            const items = node("div", "game-tool-group-items");
            element.append(node("h2", "game-tool-group-label", label), items);
            const choices = node("optgroup"); choices.label = label;
            toolbar.append(element); toolPicker.append(choices);
            group = { element, items, choices }; toolGroups.set(label, group);
          }
          buttons = group.items; options = group.choices;
        }
        const option = node("option", "", tool.label); option.value = tool.id;
        options.append(option); toolOptions.push(option);
        const item = node("button", "game-tool"); item.type = "button"; item.dataset.tool = tool.id;
        item.setAttribute("aria-pressed", "false"); item.title = tool.hint || tool.label;
        const icon = tool.sprite && definition.sprites?.[tool.sprite]
          ? node("canvas", "game-icon game-sprite-icon")
          : node("span", "game-icon", tool.icon || "◇");
        icon.setAttribute("aria-hidden", "true");
        if (icon.tagName === "CANVAS") toolIcons.push({ canvas: icon, sprite: tool.sprite });
        item.append(icon, node("span", "game-tool-label", tool.label));
        if (tool.key) item.append(node("kbd", "game-key", tool.key));
        buttons.append(item);
      }
      for (const group of toolGroups.values())
        group.element.style.setProperty("--game-tool-count", group.items.children.length);
      if (tools.length) toolbar.append(toolPicker);
      const status = node("p", "game-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
      const help = node("details", "game-help");
      help.append(node("summary", "", "So spielst du"));
      const instructions = node("ol");
      for (const text of definition.help || []) instructions.append(node("li", "", text));
      help.append(instructions);
      const inspector = node("details", "game-inspector");
      inspector.append(node("summary", "", "Spielzustand ansehen"));
      const inspectTools = node("div", "game-toolbar");
      inspectTools.append(button("Ein Schritt", "step"), node("span", "game-hint", "Ein Schritt pausiert die Simulation. Zustände helfen beim Erstellen eigener Spiele."));
      const inspectText = node("pre"); inspector.append(inspectTools, inspectText);
      const footer = node("footer", "game-footer", labels.footer || "Entdecken. Ausprobieren. Noch einmal spielen.");
      // Removing the fullscreen element, even briefly, makes the browser exit.
      shell.replaceChildren(header, audioControls, hud, viewControls, stageFrame, toolbar, status, help, inspector, footer);
      if (!retainedShell) this.element.replaceChildren(shell);
      elements = { shell, canvas, stage, stageWrap, stageFrame, toolbar, toolPicker, toolOptions, hud, stats, roomName, overlay, resultTitle, resultText, next, status, inspector, inspectText, zoomLabel, zoomOut, zoomIn, toolIcons, audioSliders, audioStatus };
      updateZoom();
    };

    /** Delegate sprite previews to the renderer without inspecting its image cache. */
    const paintToolIcons = () => {
      for (const { canvas, sprite } of elements.toolIcons)
        painter.drawSpritePreview?.(canvas, sprite);
    };

    const setStatus = text => {
      if (!text || text === statusText) return;
      statusText = text;
      if (elements.status) elements.status.textContent = text;
    };

    function showError(error) {
      console.error(error);
      setStatus(`Fehler: ${error.message || error}`);
    }

    const notify = (type, payload = {}) => {
      if (type === "message") setStatus(typeof payload === "string" ? payload : payload.text);
      if (type === "sound") audio?.play(payload);
      if (type === "room") audio?.reset();
      if (type === "finish") {
        finishPending = true;
        ending = false; // Displayed by paint after the current simulation step.
      }
    };

    const ownsNativeFullscreen = () => {
      const target = elements.shell?.getRootNode?.().fullscreenElement || document.fullscreenElement;
      if (!target) return false;
      // CCM hosts the shell in a ShadowRoot: contains() on an outer intro frame
      // cannot see it, so follow the composed ancestry through shadow hosts.
      for (let node = elements.shell; node; node = node.parentNode || node.host)
        if (node === target) return true;
      return false;
    };

    const fitFullscreen = () => {
      if (!this.gui.fullscreen || !runtime || !elements.stageWrap) return;
      const width = elements.stageWrap.clientWidth, height = elements.stageWrap.clientHeight;
      const roomWidth = runtime.room.width || runtime.definition.width;
      const roomHeight = runtime.room.height || runtime.definition.height;
      const key = `${width},${height},${roomWidth},${roomHeight}`;
      if (key === fitKey) return;
      fitKey = key;
      const fit = fitGameArea(width, height, roomWidth, roomHeight);
      if (!fit.width || !fit.height) return;
      elements.stage.style.width = `${fit.width}px`;
      elements.stage.style.height = `${fit.height}px`;
      elements.stageWrap.scrollLeft = elements.stageWrap.scrollTop = 0;
    };

    const fullscreenMode = mode => {
      this.gui.fullscreen = !!mode; this.gui.fullscreenMode = mode;
      elements.shell?.classList.toggle("is-fullscreen", !!mode);
      const button = elements.shell?.querySelector('[data-action="fullscreen"]');
      if (button) { button.textContent = mode ? "Vollbild beenden" : "Vollbild"; button.setAttribute("aria-pressed", String(!!mode)); }
      if (mode === "viewport" && viewportOverflow == null) {
        viewportOverflow = document.documentElement.style.overflow || "";
        document.documentElement.style.overflow = "hidden";
      } else if (mode !== "viewport" && viewportOverflow != null) {
        document.documentElement.style.overflow = viewportOverflow;
        viewportOverflow = null;
      }
      if (!mode && elements.stage) { elements.stage.style.width = ""; elements.stage.style.height = ""; }
      fitKey = ""; hoverPoint = null;
      if (elements.canvas) elements.canvas.style.cursor = "default";
      fitFullscreen();
    };

    const leaveFullscreen = () => {
      const exit = ownsNativeFullscreen() && document.exitFullscreen
        ? Promise.resolve(document.exitFullscreen()).catch(() => {}) : Promise.resolve();
      fullscreenMode(null);
      return exit;
    };

    /** Native Fullscreen when available; the viewport fallback keeps all controls usable. */
    this.setFullscreen = async (enabled = !this.gui.fullscreen, { native = true } = {}) => {
      if (!enabled) return leaveFullscreen();
      const shell = elements.shell, serial = loadSerial;
      if (!shell || this.gui.fullscreen) return;
      if (ownsNativeFullscreen()) { fullscreenMode("native"); return; }
      if (native && typeof shell.requestFullscreen === "function") {
        try {
          await shell.requestFullscreen();
          if (serial !== loadSerial || shell !== elements.shell) {
            if (shell.getRootNode?.().fullscreenElement === shell || document.fullscreenElement === shell)
              await document.exitFullscreen?.();
            return;
          }
          if (ownsNativeFullscreen()) { fullscreenMode("native"); return; }
        } catch { /* Embedded WebViews can reject native mode; fit the viewport instead. */ }
      }
      if (serial === loadSerial && shell === elements.shell) fullscreenMode("viewport");
    };

    /** Optional game-owned hit testing; the component knows no game-specific tools. */
    const updateCursor = () => {
      if (!elements.canvas) return;
      let cursor = "default";
      if (hoverPoint && !this.gui.paused && !runtime?.state.finished && painter?.point) {
        const point = painter.point(hoverPoint.x, hoverPoint.y);
        const width = runtime.room.width || runtime.definition.width;
        const height = runtime.room.height || runtime.definition.height;
        if (point.x >= 0 && point.y >= 0 && point.x < width && point.y < height) {
          for (const plugin of runtime.plugins || []) {
            const next = plugin.cursor?.(runtime, point);
            if (typeof next === "string" && next) cursor = next;
          }
        }
      }
      if (elements.canvas.style.cursor !== cursor) elements.canvas.style.cursor = cursor;
    };

    const bindEvents = () => {
      const options = { signal: controller.signal };
      // Resume synchronously within real gestures, before awaiting network/decode work.
      const unlockAudio = () => { if (this.gui.sound) void audio?.unlock(); };
      elements.shell.addEventListener("pointerdown", unlockAudio, options);
      elements.shell.addEventListener("keydown", unlockAudio, options);
      elements.shell.addEventListener("input", event => {
        const channel = event.target.dataset?.audio;
        if (!["music", "effects"].includes(channel)) return;
        audioSettings[channel] = Math.max(0, Math.min(1, Number(event.target.value) / 100));
        audio?.setVolumes(audioSettings);
        unlockAudio();
      }, options);
      elements.toolPicker.addEventListener("change", () => {
        if (!elements.toolPicker.value) return;
        this.command("tool", { tool: elements.toolPicker.value });
      }, options);
      elements.shell.addEventListener("click", async event => {
        unlockAudio();
        const tool = event.target.closest("[data-tool]");
        if (tool) {
          try {
            const definition = runtime.definition.tools.find(item => item.id === tool.dataset.tool);
            if (!toolEnabled(definition)) return;
            const previousStatus = statusText;
            runtime.command("tool", { tool: tool.dataset.tool });
            this.state = runtime.state; this.gui.selected = tool.dataset.tool;
            if (definition?.hint && statusText === previousStatus) setStatus(definition.hint);
            paint(true);
          } catch (error) { this.pause(); showError(error); }
          return;
        }
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (!action || uiBusy) return;
        uiBusy = true;
        try {
          if (action === "pause") this.gui.paused ? this.resume() : this.pause();
          if (action === "restart") await this.start(true);
          if (action === "home") {
            const onHome = source.onHome ?? this.onHome;
            if (typeof onHome === "function") { this.pause(); await onHome({ app: this }); }
          }
          if (action === "sound") {
            this.gui.sound = !this.gui.sound;
            audioSettings.enabled = this.gui.sound;
            audio?.setEnabled(this.gui.sound);
            updatePause(); unlockAudio();
          }
          if (action === "fullscreen") await this.setFullscreen();
          if (action === "save") await this.save();
          if (action === "load") await this.load();
          if (action === "step") this.step();
          if (action === "zoom-in" || action === "zoom-out") {
            this.gui.zoom = Math.max(1, Math.min(2, this.gui.zoom + (action === "zoom-in" ? .25 : -.25)));
            updateZoom(); paint(true);
          }
          if (action === "next" && runtime.state.result?.nextRoom) {
            runtime.goToRoom(runtime.state.result.nextRoom); this.state = runtime.state;
            ending = false; elements.overlay.hidden = true; manualPaused = false;
            syncPlayback(true); paint(true);
          }
        } catch (error) { showError(error); }
        finally { uiBusy = false; }
      }, options);
      window.addEventListener("resize", fitFullscreen, options);
      window.visualViewport?.addEventListener("resize", fitFullscreen, options);
      document.addEventListener("fullscreenchange", () => {
        if (ownsNativeFullscreen()) fullscreenMode("native");
        else if (this.gui.fullscreenMode === "native") fullscreenMode(null);
      }, options);
      if (typeof ResizeObserver !== "undefined") {
        sizeObserver = new ResizeObserver(fitFullscreen);
        sizeObserver.observe(elements.stageWrap);
      }
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && this.gui.fullscreen) { event.preventDefault(); leaveFullscreen(); }
      }, options);
      elements.canvas.addEventListener("pointermove", event => {
        hoverPoint = event.pointerType === "touch" ? null : { x: event.clientX, y: event.clientY };
        updateCursor();
      }, options);
      elements.canvas.addEventListener("pointerleave", () => { hoverPoint = null; updateCursor(); }, options);
      let pointerStart = null;
      elements.canvas.addEventListener("pointerdown", event => {
        if (event.button > 0) return;
        pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
        elements.canvas.focus({ preventScroll: true });
      }, options);
      elements.canvas.addEventListener("pointercancel", () => { pointerStart = null; hoverPoint = null; updateCursor(); }, options);
      elements.canvas.addEventListener("pointerup", event => {
        const origin = pointerStart; pointerStart = null;
        if (!origin || origin.id !== event.pointerId || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8 ||
          this.gui.paused || runtime.state.finished || event.button > 0) return;
        try { const point = painter.point(event.clientX, event.clientY); runtime.pointer(point.x, point.y); paint(true); }
        catch (error) { this.pause(); showError(error); }
      }, options);
      elements.shell.addEventListener("keydown", event => {
        try {
        if (event.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
        if (event.key === " " && event.target.tagName !== "BUTTON" && event.target.tagName !== "SUMMARY") {
          event.preventDefault(); this.gui.paused ? this.resume() : this.pause(); return;
        }
        const tool = runtime.definition.tools?.find(item => String(item.key).toLowerCase() === event.key.toLowerCase());
        if (tool) {
          event.preventDefault();
          if (!toolEnabled(tool)) return;
          const previousStatus = statusText;
          runtime.command("tool", { tool: tool.id });
          this.gui.selected = tool.id;
          if (statusText === previousStatus) setStatus(tool.hint || tool.label);
          paint(true); return;
        }
        if (this.gui.paused) return;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) event.preventDefault();
        pressed.add(event.key); runtime.key(event.key, true);
        } catch (error) { this.pause(); showError(error); }
      }, options);
      elements.shell.addEventListener("keyup", event => { pressed.delete(event.key); runtime.key(event.key, false); }, options);
      elements.shell.addEventListener("focusout", event => { if (!elements.shell.contains(event.relatedTarget)) releaseKeys(); }, options);
      window.addEventListener("blur", () => { blurred = true; syncPlayback(); }, options);
      window.addEventListener("focus", () => { blurred = false; syncPlayback(true); }, options);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) blurred = document.hasFocus?.() === false;
        syncPlayback(!document.hidden);
      }, options);
      window.addEventListener("pagehide", () => { pageHidden = true; syncPlayback(); }, options);
      window.addEventListener("pageshow", () => {
        pageHidden = false; blurred = document.hasFocus?.() === false; syncPlayback(true);
      }, options);
      document.addEventListener("freeze", () => { pageFrozen = true; syncPlayback(); }, options);
      document.addEventListener("resume", () => {
        pageFrozen = false; blurred = document.hasFocus?.() === false; syncPlayback(true);
      }, options);
    };

    const suspended = () => document.hidden || blurred || pageHidden || pageFrozen || !this.element.isConnected;
    const cancelFrame = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const requestFrame = () => {
      if (active && loopReady && frame === null && !this.gui.paused && !runtime?.state.finished)
        frame = requestAnimationFrame(loop);
    };
    const syncPlayback = (restart = false) => {
      const paused = manualPaused || suspended();
      const changed = this.gui.paused !== paused;
      if (!changed && !restart) return;
      this.gui.paused = paused;
      lastTime = null; accumulator = 0;
      cancelFrame();
      if (paused) releaseKeys();
      audio?.setPaused(paused);
      updatePause();
      if (changed && runtime) void this.emit(paused ? "pause" : "resume").catch(showError);
      requestFrame();
    };

    const releaseKeys = () => {
      if (runtime) for (const key of pressed) runtime.key(key, false);
      pressed.clear(); runtime?.keys.clear();
    };

    const updateZoom = () => {
      elements.shell.style.setProperty("--game-zoom", this.gui.zoom);
      elements.zoomLabel.textContent = `${Math.round(this.gui.zoom * 100)} %`;
      elements.zoomOut.disabled = this.gui.zoom <= 1;
      elements.zoomIn.disabled = this.gui.zoom >= 2;
    };

    const updatePause = () => {
      const pause = elements.shell?.querySelector('[data-action="pause"]');
      if (pause) { pause.textContent = this.gui.paused ? "Fortsetzen" : "Pause"; pause.setAttribute("aria-pressed", String(this.gui.paused)); }
      const sound = elements.shell?.querySelector('[data-action="sound"]');
      if (sound) { sound.textContent = this.gui.sound ? "Ton an" : "Ton aus"; sound.setAttribute("aria-pressed", String(this.gui.sound)); }
      elements.shell?.classList.toggle("is-paused", this.gui.paused);
      updateCursor();
    };

    const updateAudio = status => {
      if (!elements.audioStatus) return;
      for (const [channel, slider] of Object.entries(elements.audioSliders)) {
        const value = Math.round(status[`${channel}Volume`] * 100);
        slider.input.value = String(value);
        slider.value.textContent = `${value} %`;
        slider.input.disabled = !status.supported;
      }
      const sound = elements.shell.querySelector('[data-action="sound"]');
      if (sound) sound.disabled = !status.supported;
      elements.audioStatus.textContent = !status.supported ? "Audio wird von diesem Browser nicht unterstützt."
        : !status.enabled ? "Ton ausgeschaltet."
        : status.error ? "Ein Klang konnte nicht geladen werden. Ton aus/an versucht es erneut."
        : !status.unlocked ? "Ton startet beim ersten Klick oder Tastendruck."
        : status.paused ? "Ton pausiert mit dem Spiel."
        : status.loading ? "Klänge werden geladen …" : "";
    };

    const paint = (force = false) => {
      if (!runtime || !painter) return;
      this.state = runtime.state;
      painter.draw(); fitFullscreen(); updateCursor();
      if (!force && runtime.state.time - lastHud < 0.1 && !runtime.state.finished) return;
      lastHud = runtime.state.time;
      elements.roomName.textContent = runtime.room.title || runtime.state.roomId;
      for (const item of elements.stats) {
        const value = item.path.split(".").reduce((object, key) => object?.[key], runtime.state);
        item.element.textContent = `${value ?? 0}${item.suffix || ""}`;
      }
      const selected = runtime.state.globals.tool ?? this.gui.selected;
      elements.toolPicker.value = selected || "";
      const availabilityByTool = new Map((runtime.definition.tools || []).map(tool => [tool.id, toolState(tool)]));
      for (const item of elements.shell.querySelectorAll("[data-tool]")) {
        const tool = runtime.definition.tools.find(tool => tool.id === item.dataset.tool);
        const availability = availabilityByTool.get(tool.id);
        item.disabled = !availability.enabled;
        item.title = item.disabled ? availability.reason || tool.disabledHint || tool.hint || tool.label : tool.hint || tool.label;
        item.setAttribute("aria-pressed", String(item.dataset.tool === selected));
      }
      for (const option of elements.toolOptions) {
        const tool = runtime.definition.tools?.find(tool => tool.id === option.value);
        const availability = availabilityByTool.get(tool?.id) || { enabled: false };
        option.disabled = !availability.enabled;
        option.title = option.disabled ? availability.reason || tool?.disabledHint || "" : "";
      }
      if (elements.inspector.open) elements.inspectText.textContent = JSON.stringify({
        room: runtime.state.roomId, time: Math.round(runtime.state.time * 10) / 10, globals: runtime.state.globals,
        instances: runtime.state.instances.map(({ id, object, x, y, state, mode, tool, kit }) => ({ id, object, x: Math.round(x), y: Math.round(y), state, mode, tool, kit })),
      }, null, 2);
      updatePause();
      if (runtime.state.finished && !ending) {
        ending = true;
        const result = runtime.state.result || {};
        elements.resultTitle.textContent = result.title || runtime.definition.labels?.resultTitle || "Spiel beendet";
        elements.resultText.textContent = result.message || `${result.score ?? runtime.state.globals.score ?? 0} Punkte`;
        elements.next.hidden = !result.nextRoom;
        elements.overlay.hidden = false;
        if (finishPending) {
          finishPending = false;
          void this.emit("finish").catch(showError);
        }
      }
    };

    const loop = now => {
      frame = null;
      if (!active) return;
      if (suspended()) { syncPlayback(); return; }
      try {
        if (!this.gui.paused && !runtime.state.finished) {
          const delta = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.15);
          accumulator += delta;
          const dt = 1 / (runtime.definition.fps || 60);
          let steps = 0;
          while (accumulator >= dt && steps++ < 12) { runtime.step(dt); accumulator -= dt; }
          if (steps >= 12) accumulator = 0;
        }
        lastTime = now; paint();
      } catch (error) { this.pause(); showError(error); }
      requestFrame();
    };

  },
};
