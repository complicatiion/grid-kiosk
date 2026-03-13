/* 
This is a private project created to support personal administration workflows.
The work on this project was not commissioned by any employer and was not carried out during company working hours.
Copyright remains with the creator and author of this software
*/

(function(){
  "use strict";

  // ==== DOM helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ==== Defaults
  const DEFAULTS = {
    layout: "grid-4",           // grid-4 | grid-2h | grid-2v
    pair: "0-1",                // used in 2-pane layouts
    globalInterval: 0,          // seconds | 0 / empty = disabled until configured
    pauseHidden: true,          // pause refresh when the pane is hidden
    title: "GRID KIOSK",
    subtitle: "",
    showLogo: true,
    logoUrl: "",                // logo URL (fallback if no upload exists)
    logoUploadPath: "assets/img/logo.png",
    faviconUrl: "",             // favicon URL
    faviconUploadPath: "assets/img/favicon.png",
    fontUrl: "",                // linked URL (optional)
    fontUploadPath: "",         // uploaded font (optional)
    panes: [
      { url: "https://example.com", interval: 0 },
      { url: "https://example.com", interval: 0 },
      { url: "https://example.com", interval: 0 },
      { url: "https://example.com", interval: 0 }
    ]
  };

  // ==== State (loaded from localStorage + optional /data/config.json)
  let state = structuredClone(DEFAULTS);

  // Timers per pane
  const timers = new Map(); // index -> {id, secs}

  // === References
  const grid = $("#grid");
  const toolbar = $("#toolbar");
  const uiHiddenHint = $("#uiHiddenHint");
  //const toggleUiBtn = $("#toggleUiBtn");
  

  // Toolbar references
  const logoImg = $("#logoImg");
  const logoFile = $("#logoFile");
  const logoUploadBtn = $("#logoUploadBtn");
  const logoUrlInput = $("#logoUrlInput");
  const showLogoSwitch = $("#showLogoSwitch");

  const titleInput = $("#titleInput");
  const subtitleInput = $("#subtitleInput");

  const reloadAllBtn = $("#reloadAllBtn");
  const fullscreenBtn = $("#fullscreenBtn");
  const layout4Btn = $("#layout4Btn");
  const layout2HBtn = $("#layout2HBtn");
  const layout2VBtn = $("#layout2VBtn");
  const settingsBtn = $("#settingsBtn");

  // Dialog references – pane
  const paneDialog = $("#paneDialog");
  const paneUrlInput = $("#paneUrlInput");
  const paneIntervalInput = $("#paneIntervalInput");
  const paneTestBtn = $("#paneTestBtn");
  const paneSaveBtn = $("#paneSaveBtn");
  let currentPaneIndex = 0;

  // Dialog references – settings
  const settingsDialog = $("#settingsDialog");
  const layoutRadios = $$("input[name='layout']");
  const pairSelect = $("#pairSelect");
  const globalIntervalInput = $("#globalIntervalInput");
  const pauseHiddenSwitch = $("#pauseHiddenSwitch");
  const paneUrlInputs = $$(".paneUrl");
  const paneIntInputs = $$(".paneInt");

  const logoUrlInputSettings = $("#logoUrlInputSettings");
  const showLogoSwitchSettings = $("#showLogoSwitchSettings");
  const logoUploadBtnSettings = $("#logoUploadBtnSettings");
  const faviconUrlInput = $("#faviconUrlInput");
  const faviconUploadBtn = $("#faviconUploadBtn");

  const fontUrlInput = $("#fontUrlInput");
  const fontUploadBtn = $("#fontUploadBtn");
  const fontStatus = $("#fontStatus");

  // Hidden form for upload reuse
  const hiddenUploadForm = $("#hiddenUploadForm");

  // Favicon link
  const faviconLink = $("#faviconLink");

  // ==== Init ====
  (async function init(){
    // 1) Try loading local storage
    try {
      const raw = localStorage.getItem("grid-kiosk-state");
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (e) {
      console.warn("Could not read localStorage", e);
    }

    // 2) Try merging optional server-side config
    try {
      const res = await fetch("data/config.json", {cache:"no-store"});
      if (res.ok) {
        const serverState = await res.json();
        Object.assign(state, serverState);
      }
    } catch (e) {
      // not critical – the file may not exist yet
    }

    // 3) Populate the UI from state
    applyStateToUI();

    // 4) Wire events
    wireEvents();

    // 5) Start timers
    rebuildAllTimers();

    // 6) Apply initial favicon/logo/font
    applyFavicon();
    applyLogo();
    applyFont();
  })();

  // ==== UI/state sync ====
  function applyStateToUI(){
    // Toolbar title/subtitle
    titleInput.value = state.title || "";
    subtitleInput.value = state.subtitle || "";

    showLogoSwitch.checked = state.showLogo;
    logoUrlInput.value = state.logoUrl || "";

    // Layout
    grid.classList.remove("grid-4", "grid-2h", "grid-2v");
    grid.classList.add(state.layout);
    layoutRadios.forEach(r => r.checked = (r.value === state.layout));
    pairSelect.value = state.pair;

    // Global interval
    globalIntervalInput.value = state.globalInterval;
    pauseHiddenSwitch.checked = !!state.pauseHidden;

    // Pane content
    $$(".pane").forEach((paneEl, i) => {
      const p = state.panes[i];
      const iframe = paneEl.querySelector(".pane-frame");
      const title = paneEl.querySelector(".pane-title");
      const host = paneEl.querySelector(".host");
      const intervalEl = paneEl.querySelector(".interval");

      iframe.src = p.url;
      title.textContent = `Pane ${i+1}`;
      host.textContent = safeHost(p.url);
      intervalEl.textContent = `${p.interval || state.globalInterval}s`;

      // Settings dialog inputs
      paneUrlInputs[i].value = p.url;
      paneIntInputs[i].value = p.interval;
    });

    // Logo image (path is set by applyLogo)
    // Favicon is set by applyFavicon
  }

  function saveState(debounceMs=0){
    const doSave = () => {
      localStorage.setItem("grid-kiosk-state", JSON.stringify(state));
      // try server-side persistence (optional)
      fetch("server/save-config.php", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(state)
      }).catch(()=>{});
    };
    if (debounceMs>0){
      clearTimeout(saveState._t);
      saveState._t = setTimeout(doSave, debounceMs);
    } else doSave();
  }

  // ==== Events ====
  function wireEvents(){
    // Toolbar: logo upload button
    logoUploadBtn.addEventListener("click", ()=> logoFile.click());
    logoFile.addEventListener("change", async (e)=>{
      const file = e.target.files?.[0];
      if (!file) return;
      const path = await uploadFile(file, "logo");
      if (path){
        state.logoUploadPath = path;
        state.showLogo = true;
        saveState(200);
        applyLogo();
      } else {
        alert("Upload failed. Check server/upload.php and write permissions.");
      }
      logoFile.value = "";
    });

    // Toolbar: logo URL + visibility
    logoUrlInput.addEventListener("input", e=>{
      state.logoUrl = e.target.value.trim();
      saveState(300);
      applyLogo();
    });
    showLogoSwitch.addEventListener("change", e=>{
      state.showLogo = e.target.checked;
      saveState(0);
      applyLogo();
    });

    // Toolbar: title/subtitle
    titleInput.addEventListener("input", e=>{
      state.title = e.target.value;
      saveState(400);
      document.title = state.title || "GRID KIOSK";
    });
    subtitleInput.addEventListener("input", e=>{
      state.subtitle = e.target.value;
      saveState(400);
    });

    // Toolbar: reload + fullscreen
    reloadAllBtn.addEventListener("click", reloadAll);
    fullscreenBtn.addEventListener("click", toggleFullscreen);

    // Toolbar: layout buttons
    layout4Btn.addEventListener("click", ()=> setLayout("grid-4"));
    layout2HBtn.addEventListener("click", ()=> setLayout("grid-2h"));
    layout2VBtn.addEventListener("click", ()=> setLayout("grid-2v"));

    // Toolbar: settings
    settingsBtn.addEventListener("click", ()=> settingsDialog.showModal());

    // Keyboard shortcuts
    document.addEventListener("keydown", onKey);

    // Pane interactions
    $$(".pane").forEach((paneEl, i)=>{
      const bar = paneEl.querySelector(".pane-bar");
      const editBtn = paneEl.querySelector(".pane-edit");

      // Pencil
      editBtn.addEventListener("click", ()=> openPaneDialog(i));

      // Double-click the title
      bar.querySelector(".pane-title").addEventListener("dblclick", ()=> openPaneDialog(i));

      // Right-click quick edit
      bar.addEventListener("contextmenu", (ev)=>{
        ev.preventDefault();
        quickEditPane(i);
      });

      // Drag & drop: URL
      bar.addEventListener("dragover", ev=>{
        ev.preventDefault();
        bar.classList.add("drag-over");
      });
      bar.addEventListener("dragleave", ()=> bar.classList.remove("drag-over"));
      bar.addEventListener("drop", ev=>{
        ev.preventDefault();
        bar.classList.remove("drag-over");
        const data = ev.dataTransfer.getData("text/uri-list") || ev.dataTransfer.getData("text/plain");
        if (data) setPaneUrl(i, data.trim());
      });
    });

    // Pane dialog – test & save
    paneTestBtn.addEventListener("click", ()=>{
      const url = paneUrlInput.value.trim();
      if (!url) return;
      const idx = currentPaneIndex;
      const paneEl = paneByIndex(idx);
      const iframe = paneEl.querySelector(".pane-frame");
      showLoading(idx, true);
      iframe.src = url;
      iframe.addEventListener("load", ()=> showLoading(idx,false), {once:true});
    });
    paneSaveBtn.addEventListener("click", ()=>{
      const url = paneUrlInput.value.trim();
      const sec = Math.max(0, Number(paneIntervalInput.value||0)|0);
      applyPaneEdit(currentPaneIndex, url, sec);
    });

    // Settings dialog – layout radio / pair
    layoutRadios.forEach(r=> r.addEventListener("change", ()=>{
      if (r.checked) setLayout(r.value);
    }));
    pairSelect.addEventListener("change", ()=>{
      state.pair = pairSelect.value;
      saveState(0);
      updateVisibilityByLayout();
    });

    // Settings dialog – global interval timer (controls website reload intervals)
    globalIntervalInput.addEventListener("input", ()=>{
      const v = Math.max(0, Number(globalIntervalInput.value||0)|0);
      state.globalInterval = v;
      saveState(300);
      rebuildAllTimers();
      updateIntervalBadges();
    });
    pauseHiddenSwitch.addEventListener("change", ()=>{
      state.pauseHidden = !!pauseHiddenSwitch.checked;
      saveState(0);
      rebuildAllTimers();
    });

    // Settings dialog – pane table inputs
    paneUrlInputs.forEach(inp=> inp.addEventListener("change", ()=>{
      const i = Number(inp.dataset.index);
      setPaneUrl(i, inp.value.trim());
    }));
    paneIntInputs.forEach(inp=> inp.addEventListener("change", ()=>{
      const i = Number(inp.dataset.index);
      const sec = Math.max(0, Number(inp.value||0)|0);
      setPaneInterval(i, sec);
    }));

    // Settings dialog – logo & favicon (in addition to toolbar)
    logoUploadBtnSettings.addEventListener("click", ()=> openFileDialog(async (file)=>{
      const path = await uploadFile(file, "logo");
      if (path){
        state.logoUploadPath = path;
        state.showLogo = true;
        saveState(200);
        applyLogo();
      }
    }, "image/png,image/webp,image/jpeg"));

    logoUrlInputSettings.addEventListener("input", e=>{
      state.logoUrl = e.target.value.trim();
      saveState(300);
      applyLogo();
    });
    showLogoSwitchSettings.addEventListener("change", e=>{
      state.showLogo = !!e.target.checked;
      showLogoSwitch.checked = state.showLogo;
      saveState(0);
      applyLogo();
    });

    faviconUploadBtn.addEventListener("click", ()=> openFileDialog(async (file)=>{
      const path = await uploadFile(file, "favicon");
      if (path){
        state.faviconUploadPath = path;
        state.faviconUrl = ""; // Upload hat Vorrang
        saveState(200);
        applyFavicon();
      }
    }, "image/png"));

    faviconUrlInput.addEventListener("input", e=>{
      state.faviconUrl = e.target.value.trim();
      saveState(300);
      applyFavicon();
    });

    // Settings dialog – font
    fontUploadBtn.addEventListener("click", ()=> openFileDialog(async (file)=>{
      const path = await uploadFile(file, "font");
      if (path){
        state.fontUploadPath = path;
        state.fontUrl = "";
        saveState(200);
        applyFont();
      } else {
        fontStatus.textContent = "Upload failed – check server/upload.php";
      }
    }, ".woff2,.woff,.ttf,.otf"));

    fontUrlInput.addEventListener("input", e=>{
      state.fontUrl = e.target.value.trim();
      saveState(300);
      applyFont();
    });

    // Save settings button (redundant – state is already written live)
    $("#saveSettingsBtn").addEventListener("click", ()=> {
      settingsDialog.close();
    });
  }

  // ==== Pane edit helpers ====
  function paneByIndex(i){ return $(`.pane[data-index="${i}"]`); }

  function openPaneDialog(index){
    currentPaneIndex = index;
    const p = state.panes[index];
    paneUrlInput.value = p.url;
    paneIntervalInput.value = p.interval|0;
    paneDialog.showModal();
  }

  function quickEditPane(index){
    const cur = state.panes[index];
    const url = prompt(`New URL for pane ${index+1}:`, cur.url || "");
    if (!url) return;
    const secStr = prompt("Refresh interval in seconds (0 = global):", String(cur.interval|0));
    const sec = Math.max(0, Number(secStr||0)|0);
    applyPaneEdit(index, url.trim(), sec);
  }

  function applyPaneEdit(index, url, sec){
    setPaneUrl(index, url);
    setPaneInterval(index, sec);
    paneDialog.close();
  }

  function setPaneUrl(index, url){
    if (!url) return;
    state.panes[index].url = url;
    saveState(300);

    const paneEl = paneByIndex(index);
    const iframe = paneEl.querySelector(".pane-frame");
    const host = paneEl.querySelector(".host");
    iframe.src = url;
    host.textContent = safeHost(url);
  }

  function setPaneInterval(index, sec){
    state.panes[index].interval = Math.max(0, Number(sec|0));
    saveState(0);
    updateIntervalBadges();
    rebuildTimer(index);
  }

  function updateIntervalBadges(){
    $$(".pane").forEach((paneEl, i)=>{
      const p = state.panes[i];
      const intervalEl = paneEl.querySelector(".interval");
      intervalEl.textContent = `${p.interval || state.globalInterval}s`;
    });
  }

  // ==== Layout ====
  function setLayout(layout){
    state.layout = layout;
    saveState(0);
    grid.classList.remove("grid-4", "grid-2h", "grid-2v");
    grid.classList.add(layout);
    updateVisibilityByLayout();
    rebuildAllTimers();
  }

  function updateVisibilityByLayout(){
    const [a,b] = state.pair.split("-").map(n=> Number(n));
    const visibleIndexes = (state.layout === "grid-4") ? [0,1,2,3]
                          : [a,b];
    $$(".pane").forEach((paneEl, i)=>{
      paneEl.classList.toggle("hidden", !visibleIndexes.includes(i));
    });
  }

  // ==== Timers ====
  function clearTimer(i){
    const t = timers.get(i);
    if (t){ clearInterval(t.id); timers.delete(i); }
  }

  function rebuildTimer(i){
    clearTimer(i);

    const paneEl = paneByIndex(i);
    if (!paneEl) return;

    // If pause-hidden is active and the pane is not visible: no timer
    if (state.pauseHidden && paneEl.classList.contains("hidden")) return;

    const secs = (state.panes[i].interval || state.globalInterval);
    if (secs <= 0) return; // should not happen unless someone sets global 0 via DevTools

    const tick = ()=> reloadPane(i);
    const id = setInterval(tick, secs*1000);
    timers.set(i, {id, secs});
  }

  function rebuildAllTimers(){
    [0,1,2,3].forEach(i => rebuildTimer(i));
  }

  // ==== Reloads ====
  function reloadAll(){
    [0,1,2,3].forEach(reloadPane);
  }

  function reloadPane(i){
    const paneEl = paneByIndex(i);
    if (!paneEl) return;
    if (state.pauseHidden && paneEl.classList.contains("hidden")) return;

    const iframe = paneEl.querySelector(".pane-frame");
    showLoading(i, true);
    // Trick: reassign the same URL to force a reload
    const src = iframe.src;
    iframe.src = src;
    iframe.addEventListener("load", ()=> showLoading(i,false), {once:true});
  }

  function showLoading(i, on){
    const paneEl = paneByIndex(i);
    const loading = paneEl.querySelector(".loading");
    loading.hidden = !on;
  }

  // ==== Favicon/logo/font ====
  function applyLogo(){
    const visible = state.showLogo;
    const src = state.logoUploadPath || state.logoUrl || "assets/img/logo-placeholder.png";
    logoImg.src = src;
    logoImg.style.display = visible ? "block" : "none";
    // Settings sync
    logoUrlInputSettings.value = state.logoUrl || "";
    showLogoSwitchSettings.checked = !!visible;
    showLogoSwitch.checked = !!visible;
  }

  function applyFavicon(){
    const href = state.faviconUrl || state.faviconUploadPath || "assets/img/favicon.png";
    faviconLink.href = href;
  }

  function applyFont(){
    const url = state.fontUploadPath || state.fontUrl;
    // remove previous dynamic @font-face
    const prev = document.getElementById("dynamicFont");
    if (prev) prev.remove();

    if (url){
      const style = document.createElement("style");
      style.id = "dynamicFont";
      style.textContent = `
        @font-face{
          font-family: "CustomKioskFont";
          src: url("${url}") format("${guessFontFormat(url)}");
          font-display: swap;
        }
        :root{ --font-custom: "CustomKioskFont", system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif; }
      `;
      document.head.appendChild(style);
      fontStatus.textContent = "Custom font active.";
    } else {
      fontStatus.textContent = "System font active.";
    }
  }

  function guessFontFormat(url){
    if (url.endsWith(".woff2")) return "woff2";
    if (url.endsWith(".woff")) return "woff";
    if (url.endsWith(".ttf")) return "truetype";
    if (url.endsWith(".otf")) return "opentype";
    return "woff2";
  }

  // ==== Upload helper ====
  async function uploadFile(file, type){
    // Sends multipart/form-data to server/upload.php
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    try {
      const res = await fetch("server/upload.php", { method:"POST", body: fd });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.path || null;
    } catch (e) {
      return null;
    }
  }

  function openFileDialog(onPick, accept){
    const inp = document.createElement("input");
    inp.type = "file";
    if (accept) inp.accept = accept;
    inp.addEventListener("change", ()=>{
      const file = inp.files?.[0];
      if (file) onPick(file);
    }, {once:true});
    inp.click();
  }

  // ==== Shortcuts ====
  
    // ==== Shortcuts ====
//  function onKey(ev){
//    const k = ev.key.toLowerCase();
//    if (k === "f"){
//      ev.preventDefault();
//      toggleFullscreen();
//      return;
//    }
  
function onKey(ev){
  const k = ev.key.toLowerCase();

  // Fullscreen via keyboard: REMOVED
  // if (k === "f"){ ... }

  // R (reload) REMOVED
  // if (k === "r"){ ev.preventDefault(); reloadAll(); return; }
  
  if (k === "#"){
    ev.preventDefault();
    toggleUI();
    return;
  }
  // 1–4: solo view for this pane
  if (["1","2","3","4"].includes(k)){
    ev.preventDefault();
    const idx = Number(k)-1;
    toggleSolo(idx);
  }
}


  async function toggleFullscreen(){
    if (!document.fullscreenElement){
      await document.documentElement.requestFullscreen().catch(()=>{});
    } else {
      await document.exitFullscreen().catch(()=>{});
    }
  }

  function toggleUI(){
    const hidden = toolbar.classList.toggle("hidden");
    uiHiddenHint.hidden = !hidden;
  }

  let previousLayoutBeforeSolo = null;
  function toggleSolo(index){
    if (previousLayoutBeforeSolo !== null){
      // back
      setLayout(previousLayoutBeforeSolo);
      previousLayoutBeforeSolo = null;
      return;
    }
    previousLayoutBeforeSolo = state.layout;
    // Solo: show only the selected pane (set pair to index + 2v)
    state.pair = `${index}-${index}`;
    setLayout("grid-2v");
  }

  // ==== Utilities ====
  function safeHost(url){
    try { return new URL(url).host.replace(/^www\./,""); }
    catch { return url; }
  }

})();
