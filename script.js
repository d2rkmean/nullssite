


let schema = {}, GROUP_KEYS = [], PARAMS_BY_GROUP = {}, OBJECT_EXAMPLES_BY_GROUP = {}, TYPE_BY_PARAM_BY_GROUP = {};
let csvData = {};

let csvBaseline = {};
let currentCsvName = null;
let csvVirtualScrollCleanup = null;
let objectsVirtualScrollCleanup = null;

let model = {
  "@title": {}, "@description": {}, "@author": "", "@version": "1.0.0",
  "@features": {}, "@feature_groups": {}, "@root": "", "@patches": [], "@categories": []
};
let rootPatchData = {};
let featureFileData = {};
let files = [], modIconFile = null, currentLanguage = "en";
let selectedFeatureJsonId = "";
let objectScope = "";
let activeGroupKey = null;

let autoRootPatches = true;

let hintFilePathsEnabled = true;

const KNOWN_LANGUAGES = ["en", "ru", "zh", "es", "pt", "tr", "fr", "de", "ar"];
const KNOWN_FOLDERS = ["movie","font","json","toml","music","sc","sc3d","sfx","shader"];
const DB_NAME = "mod-gen-db-v2", DB_VERSION = 4;
const STORE_NAME = "files", CSV_STORE = "csvtables", SCHEMA_STORE = "objectTableBlob", STATE_STORE = "modState";

const MOD_JSON_ROOT = "/json/mods";
const MODS_FILES_PREFIX = "json/mods/files";
const patchPathRootJson = () => `${MOD_JSON_ROOT}/root.json`;
const patchPathFeatureJson = id => `${MOD_JSON_ROOT}/configs/${id}.json`;
function patchToZipPath(patch) { return String(patch || "").replace(/^\/+/, ""); }
function zipPathModsFiles(featureId, fileName) {
  return `${MODS_FILES_PREFIX}/${featureId}/${fileName}`;
}

function isPatchJsonZipPath(norm) {
  const n = norm.replace(/^\/+/, "").replace(/\\/g, "/");
  if (n === "json/mods/root.json") return true;
  if (n.startsWith("json/moddata/json/") && n.toLowerCase().endsWith(".json")) return true;
  if (n.startsWith("json/mods/configs/") && n.toLowerCase().endsWith(".json")) return true;
  if (n.startsWith("json/mods/") && n.toLowerCase().endsWith(".json") && !n.startsWith("json/mods/files/")) return true;
  return false;
}

function patchJsonRouteId(norm) {
  const n = norm.replace(/^\/+/, "").replace(/\\/g, "/");
  if (n.endsWith("/root.json") || n === "json/mods/root.json") return "root";
  const mc = n.match(/\/configs\/([^/]+)\.json$/i);
  if (mc) return mc[1];
  return n.split("/").pop().replace(/\.json$/i, "");
}
const FILES_SCOPE_OFF = "__off__";
const RANDOM_ACCENTS = ["#2196f3","#4caf50","#f44336","#fbc02d"];

const REMOTE_OBJECT_TABLE_URL = "https://d2rkmean.github.io/nullssite/assets/objectTable.json";

const REMOTE_CSV_BASE = "https://d2rkmean.github.io/nullssite/assets/csvs/";

function pickRandomAccent() { return RANDOM_ACCENTS[Math.floor(Math.random() * RANDOM_ACCENTS.length)]; }

function toast(msg, type = "info") {
  const tc = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast-item ${type}`;
  el.textContent = msg;
  tc.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function applyAccentColor(c) {
  document.documentElement.style.setProperty("--accent", c);
  document.documentElement.style.setProperty("--accent-dark", adjColor(c, -20));
  document.documentElement.style.setProperty("--accent-light", adjColor(c, 20));
  document.documentElement.style.setProperty("--gradient-primary", `linear-gradient(135deg,${c} 0%,${adjColor(c, 30)} 100%)`);
  document.documentElement.style.setProperty("--shadow-glow", `0 0 20px rgba(${hexRgb(c)},.3)`);
  document.documentElement.style.setProperty("--shadow-glow-hover", `0 0 40px rgba(${hexRgb(c)},.5)`);
}
function adjColor(c, a) {
  const col = c.slice(1), n = parseInt(col, 16);
  let r = (n >> 16) + a, g = (n >> 8 & 255) + a, b = (n & 255) + a;
  r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));
  return "#" + (r << 16 | g << 8 | b).toString(16).padStart(6, "0");
}
function hexRgb(h) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : "100,181,246";
}

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = e => rej(e.target.error);
    req.onsuccess = e => res(e.target.result);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains(CSV_STORE)) db.createObjectStore(CSV_STORE, { keyPath: "name" });
      if (!db.objectStoreNames.contains(SCHEMA_STORE)) db.createObjectStore(SCHEMA_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE, { keyPath: "id" });
    };
  });
}
async function dbPut(store, val) {
  try {
    const db = await openDB();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(val);
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; });
  } catch (e) { console.error(e); }
}
async function dbGetAll(store) {
  try {
    const db = await openDB();
    const tx = db.transaction(store, "readonly");
    return new Promise((r, j) => {
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => r(req.result);
      req.onerror = () => j(req.error);
    });
  } catch (e) { return []; }
}
async function dbGetById(store, id) {
  try {
    const db = await openDB();
    const tx = db.transaction(store, "readonly");
    return new Promise((r, j) => {
      const q = tx.objectStore(store).get(id);
      q.onsuccess = () => r(q.result);
      q.onerror = () => j(q.error);
    });
  } catch (e) { return null; }
}
async function dbClear(store) {
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).clear();
  await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = () => j(tx.error); });
}

async function saveObjectTableToDb(data) {
  await dbPut(SCHEMA_STORE, { id: "objectTable", data });
}
async function loadObjectTableFromDb() {
  const row = await dbGetById(SCHEMA_STORE, "objectTable");
  return row?.data || null;
}

async function saveModStateToDb() {
  await dbPut(STATE_STORE, { id: "tables", rootPatchData, featureFileData });
}
async function loadModStateFromDb() {
  const row = await dbGetById(STATE_STORE, "tables");
  if (!row) return;
  if (row.rootPatchData && typeof row.rootPatchData === "object") rootPatchData = row.rootPatchData;
  if (row.featureFileData && typeof row.featureFileData === "object") featureFileData = row.featureFileData;
}

async function saveCsvToDb(name, text) { await dbPut(CSV_STORE, { name, text }); }
function cloneCsvTable(src) {
  if (!src || !src.headers) return { headers: [], rows: [] };
  return { headers: [...src.headers], rows: src.rows.map(row => [...row]) };
}
function setCsvBaseline(name) {
  if (!name || !csvData[name]) return;
  csvBaseline[name] = cloneCsvTable(csvData[name]);
}
function ensureCsvBaseline(name) {
  if (!name || !csvData[name]) return;
  if (!csvBaseline[name]) setCsvBaseline(name);
}

async function loadAllCsvFromDb() {
  const rows = await dbGetAll(CSV_STORE);
  rows.forEach(r => {
    csvData[r.name] = parseCSV(r.text);
    setCsvBaseline(r.name);
    populateCsvSelect();
  });
}

const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function isJsonTabActive() {
  const el = document.getElementById("code-pane");
  return el && el.classList.contains("active") && el.classList.contains("show");
}


function attachPassiveRafScroll(el, handler) {
  let scheduled = false;
  const onScroll = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      handler();
    });
  };
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => el.removeEventListener("scroll", onScroll);
}
const autoSave = debounce(async () => {
  try {
    localStorage.setItem("mod-gen-v2", JSON.stringify({
      model, currentLanguage, objectScope, autoRootPatches, hintFilePathsEnabled
    }));
  } catch (e) { toast("Не удалось сохранить в localStorage: " + e.message, "error"); }
  try { await saveModStateToDb(); } catch (e) {}
}, 800);

function migrateLegacyModelIntoPatches(src) {
  if (!src || typeof src !== "object") return;
  for (const k of Object.keys(src)) {
    if (k.startsWith("@")) model[k] = JSON.parse(JSON.stringify(src[k]));
    else if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) rootPatchData[k] = JSON.parse(JSON.stringify(src[k]));
  }
}

async function loadState() {
  applyAccentColor(pickRandomAccent());
  await loadModStateFromDb();
  const raw = localStorage.getItem("mod-gen-v2");
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d.model) migrateLegacyModelIntoPatches(d.model);
      currentLanguage = d.currentLanguage || "en";
      objectScope = d.objectScope || "";
      if (typeof d.autoRootPatches === "boolean") autoRootPatches = d.autoRootPatches;
      if (typeof d.hintFilePathsEnabled === "boolean") hintFilePathsEnabled = d.hintFilePathsEnabled;
    } catch (e) {}
  }
  const stored = await dbGetAll(STORE_NAME);
  modIconFile = stored.find(f => f.type === "modIcon")?.file || null;
  files = stored.filter(f => f.type === "modFile").map(f => ({
    file: f.file,
    folder: f.folder,
    zipPath: f.zipPath || null,
    moddataSubpath: f.moddataSubpath || null
  }));
  if (modIconFile) showIconPreview(URL.createObjectURL(modIconFile));
  await loadAllCsvFromDb();
}

function getIntl(obj, lang) {
  if (typeof obj === "string") return obj;
  const u = lang.toUpperCase();
  return obj?.[u] || obj?.["EN"] || "";
}
function setIntl(obj, lang, val) {
  if (typeof obj === "object" && obj !== null) {
    const u = lang.toUpperCase();
    if (val) obj[u] = val; else delete obj[u];
  }
}

function stripNonAtKeys(obj) {
  const o = {};
  for (const k of Object.keys(obj || {})) if (k.startsWith("@")) o[k] = obj[k];
  return o;
}

function stripFeatureToAtKeys(feat) {
  const o = {};
  for (const k of Object.keys(feat || {})) if (k.startsWith("@")) o[k] = feat[k];
  return o;
}

function ensureFeatureData(fid) {
  if (!featureFileData[fid]) featureFileData[fid] = {};
}

function computeAutoPatches() {
  const p = [];
  const rootHas = Object.keys(rootPatchData).some(t => {
    const b = rootPatchData[t];
    return b && typeof b === "object" && Object.keys(b).length > 0;
  });
  if (rootHas) p.push(patchPathRootJson());
  for (const fid of Object.keys(model["@features"] || {})) {
    const fd = featureFileData[fid];
    if (fd && typeof fd === "object" && Object.keys(fd).length > 0) p.push(patchPathFeatureJson(fid));
  }
  return [...new Set(p)];
}

function applyAutoRootPatchesToModel() {
  if (!autoRootPatches) return;
  model["@root"] = MOD_JSON_ROOT;
  model["@patches"] = computeAutoPatches();
}

function syncPatchesField() {
  applyAutoRootPatchesToModel();
  const el = document.getElementById("meta-patches");
  const rootEl = document.getElementById("meta-root");
  if (el) el.value = (model["@patches"] || []).join(", ");
  if (rootEl) rootEl.value = model["@root"] || "";
}

function generateContentJson() {
  applyAutoRootPatchesToModel();
  const j = {};
  if (model["@title"] && Object.keys(model["@title"]).length) j["@title"] = model["@title"];
  if (model["@description"] && Object.keys(model["@description"]).length) j["@description"] = model["@description"];
  if (model["@author"]) j["@author"] = model["@author"];
  if (model["@version"]) j["@version"] = model["@version"];
  if (model["@gv"] !== undefined && model["@gv"] !== null && model["@gv"] !== "") j["@gv"] = model["@gv"];
  if (model["@categories"]?.length) j["@categories"] = model["@categories"];
  if (model["@features"] && Object.keys(model["@features"]).length) {
    j["@features"] = {};
    for (const fid of Object.keys(model["@features"])) {
      j["@features"][fid] = stripFeatureToAtKeys(model["@features"][fid]);
    }
  }
  if (model["@feature_groups"] && Object.keys(model["@feature_groups"]).length) j["@feature_groups"] = JSON.parse(JSON.stringify(model["@feature_groups"]));
  if (autoRootPatches) {
    j["@root"] = MOD_JSON_ROOT;
    if (model["@patches"]?.length) j["@patches"] = [...model["@patches"]];
  } else {
    if (model["@root"]) j["@root"] = model["@root"];
    if (Array.isArray(model["@patches"]) && model["@patches"].length) j["@patches"] = [...model["@patches"]];
  }
  return j;
}

function getObjectBucket() {
  if (!objectScope) return rootPatchData;
  ensureFeatureData(objectScope);
  return featureFileData[objectScope];
}

function tableKeysInBucket(bucket) {
  return Object.keys(bucket || {}).filter(k => GROUP_KEYS.includes(k));
}

const cm = CodeMirror(document.getElementById("editor"), { value: "{}", mode: { name: "javascript", json: true }, theme: "material-darker", lineNumbers: true, tabSize: 2, indentUnit: 2, lineWrapping: true });
let cmFeatureJson = CodeMirror(document.getElementById("single-feature-editor"), { value: "{}", mode: { name: "javascript", json: true }, theme: "material-darker", lineNumbers: true, tabSize: 2, indentUnit: 2, lineWrapping: true });

document.getElementById("code-tab").addEventListener("shown.bs.tab", () => {
  cm.refresh();
  try {
    const text = JSON.stringify(generateContentJson(), null, 2);
    cm.operation(() => { cm.setValue(text); });
  } catch (e) { cm.setValue("{}"); }
});
document.getElementById("features-tab").addEventListener("shown.bs.tab", () => {
  cmFeatureJson.refresh();
  renderFeatures();
  renderFeatureGroups();
  populateFeatureJsonSelect();
  populateCsvApplyScopeSelect();
  populateFileModdataScopeSelect();
  syncFeatureJsonEditor();
});
document.getElementById("objects-tab").addEventListener("shown.bs.tab", () => { updateObjectScopeSelect(); renderGroupsTab(); });
document.getElementById("tables-tab").addEventListener("shown.bs.tab", () => { populateCsvSelect(); populateCsvApplyScopeSelect(); });

function populateLangSelect() {
  const sel = document.getElementById("language-select");
  sel.innerHTML = "";
  KNOWN_LANGUAGES.forEach(l => { const o = document.createElement("option"); o.value = l; o.textContent = l.toUpperCase(); sel.appendChild(o); });
  sel.value = currentLanguage;
}
document.getElementById("language-select").addEventListener("change", e => { currentLanguage = e.target.value; loadMeta(model); updateModPreview(); autoSave(); }); 

function renderCategories() {
  const div = document.getElementById("categories-display");
  div.innerHTML = "";
  (model["@categories"] || []).forEach(cat => {
    const p = document.createElement("span");
    p.className = "cat-pill";
    p.innerHTML = `${cat} <button type="button" class="cat-pill-remove" data-cat="${cat}">×</button>`;
    p.querySelector(".cat-pill-remove").addEventListener("click", () => {
      model["@categories"] = (model["@categories"] || []).filter(c => c !== cat);
      renderCategories(); debouncedUpdateJson();
    });
    div.appendChild(p);
  });
}
document.getElementById("categories-select").addEventListener("change", e => {
  const v = e.target.value; if (!v) return;
  if (!(model["@categories"] || []).includes(v)) model["@categories"] = [...(model["@categories"] || []), v];
  e.target.value = ""; renderCategories(); debouncedUpdateJson();
});

function loadMeta(meta) {
  document.getElementById("meta-title").value = getIntl(meta["@title"] || {}, currentLanguage);
  document.getElementById("meta-description").value = getIntl(meta["@description"] || {}, currentLanguage);
  document.getElementById("meta-author").value = meta["@author"] || "";
  document.getElementById("meta-version").value = meta["@version"] || "1.0.0";
  const gvEl = document.getElementById("meta-gv");
  if (meta["@gv"] === undefined || meta["@gv"] === null || meta["@gv"] === "") gvEl.value = "";
  else gvEl.value = String(meta["@gv"]);
  syncPatchesField();
  renderCategories();
  updateModPreview();
}
function updateModPreview() {
  const title = getIntl(model["@title"] || {}, currentLanguage) || "Название мода";
  const authorEl = document.getElementById("preview-mod-author");
  document.getElementById("preview-mod-title").textContent = title;
  authorEl.replaceChildren();
  const lab = document.createElement("span");
  lab.className = "text-muted-2";
  lab.textContent = "Автор: ";
  authorEl.appendChild(lab);
  const box = document.createElement("span");
  box.className = "preview-html";
  const rawAuthor = model["@author"] || "";
  if (rawAuthor.trim()) box.innerHTML = rawAuthor;
  else { box.classList.add("text-muted-2"); box.textContent = "Не указан"; }
  authorEl.appendChild(box);
  const descEl = document.getElementById("preview-mod-description");
  const rawDesc = getIntl(model["@description"] || {}, currentLanguage) || "Описание мода";
  descEl.classList.add("preview-html");
  descEl.innerHTML = rawDesc;
}
const debouncedPreview = debounce(updateModPreview, 320);

document.getElementById("meta-title").addEventListener("input", e => { if (!model["@title"]) model["@title"] = {}; setIntl(model["@title"], currentLanguage, e.target.value); debouncedPreview(); debouncedUpdateJson(); });
document.getElementById("meta-description").addEventListener("input", e => { if (!model["@description"]) model["@description"] = {}; setIntl(model["@description"], currentLanguage, e.target.value); debouncedPreview(); debouncedUpdateJson(); });
document.getElementById("meta-author").addEventListener("input", e => { model["@author"] = e.target.value; debouncedPreview(); debouncedUpdateJson(); });
document.getElementById("meta-version").addEventListener("input", e => { model["@version"] = e.target.value; debouncedUpdateJson(); });
document.getElementById("meta-gv").addEventListener("input", e => {
  const v = e.target.value.trim();
  if (v === "") delete model["@gv"];
  else { const n = parseInt(v, 10); if (!Number.isNaN(n)) model["@gv"] = n; }
  debouncedUpdateJson();
});

function showIconPreview(src) {
  document.getElementById("icon-preview").src = src;
  document.getElementById("icon-preview").classList.remove("d-none");
  document.getElementById("icon-placeholder").classList.add("d-none");
  document.getElementById("preview-icon").src = src;
  document.getElementById("preview-icon").classList.remove("d-none");
  document.getElementById("preview-icon-placeholder").classList.add("d-none");
  document.getElementById("remove-icon-btn").classList.remove("d-none");
  debouncedPreviewGradient(src);
}

let previewGradientToken = 0;
const debouncedPreviewGradient = debounce((src) => {
  const token = ++previewGradientToken;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    if (token !== previewGradientToken) return;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 10;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 10, 10);
      const d = ctx.getImageData(0, 0, 10, 10).data;
      let r = 0, g = 0, b = 0, cnt = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; cnt++; }
      r = Math.round(r / cnt); g = Math.round(g / cnt); b = Math.round(b / cnt);
      const mid = `rgba(${Math.round(r * .6)},${Math.round(g * .6)},${Math.round(b * .6)},0.25)`;
      const dark = `rgba(${r},${g},${b},0.15)`;
      document.getElementById("mod-preview").style.background = `linear-gradient(135deg,${mid} 0%,#0a0d14 60%,${dark} 100%)`;
    } catch (e) {}
  };
  img.onerror = () => {};
  img.src = src;
}, 220);

document.getElementById("mod-icon").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  modIconFile = f;
  showIconPreview(URL.createObjectURL(f));
  await dbPut(STORE_NAME, { name: f.name, file: f, type: "modIcon", folder: null });
  autoSave();
});
document.getElementById("remove-icon-btn").addEventListener("click", async () => {
  modIconFile = null;
  document.getElementById("icon-preview").classList.add("d-none");
  document.getElementById("icon-placeholder").classList.remove("d-none");
  document.getElementById("preview-icon").classList.add("d-none");
  document.getElementById("preview-icon-placeholder").classList.remove("d-none");
  document.getElementById("remove-icon-btn").classList.add("d-none");
  document.getElementById("mod-preview").style.background = "";
  document.getElementById("mod-icon").value = "";
  const stored = await dbGetAll(STORE_NAME);
  await dbClear(STORE_NAME);
  for (const f of stored.filter(x => x.type !== "modIcon")) await dbPut(STORE_NAME, f);
  autoSave();
});

function populateFolderSelect() {
  const sel = document.getElementById("folder-select");
  sel.innerHTML = "";
  KNOWN_FOLDERS.forEach(f => { const o = document.createElement("option"); o.value = f; o.textContent = f; sel.appendChild(o); });
}
function populateFileModdataScopeSelect() {
  const sel = document.getElementById("file-moddata-scope");
  if (!sel) return;
  const v = sel.value;
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = FILES_SCOPE_OFF; o0.textContent = "Обычный путь (папка слева)";
  sel.appendChild(o0);
  const o1 = document.createElement("option");
  o1.value = "root"; o1.textContent = "root (корень объектов)";
  sel.appendChild(o1);
  Object.keys(model["@features"] || {}).forEach(fid => {
    const o = document.createElement("option");
    o.value = fid; o.textContent = fid;
    sel.appendChild(o);
  });
  if ([...sel.options].some(x => x.value === v)) sel.value = v;
  else sel.value = "root";
}

function resolveZipPathForFile(folder, f, scopeSel) {
  if (scopeSel && scopeSel !== FILES_SCOPE_OFF) {
    return zipPathModsFiles(scopeSel, f.name);
  }
  return `${folder}/${f.name}`;
}

document.getElementById("file-input").addEventListener("change", async e => {
  const folder = document.getElementById("folder-select").value;
  const scopeSel = document.getElementById("file-moddata-scope")?.value || FILES_SCOPE_OFF;
  for (const f of Array.from(e.target.files)) {
    const zipPath = resolveZipPathForFile(folder, f, scopeSel);
    const entry = { file: f, folder, zipPath };
    files.push(entry);
    await dbPut(STORE_NAME, { name: f.name, file: f, type: "modFile", folder, zipPath });
  }
  renderFiles();
  if (document.getElementById("objects-pane")?.classList.contains("active")) renderGroupsTab();
  autoSave(); e.target.value = "";
});

function renderFiles() {
  const ul = document.getElementById("files-list");
  ul.innerHTML = "";
  const modsRe = /^json\/mods\/files\/([^/]+)\//;
  const entries = files.map((item, idx) => ({ item, idx }));
  entries.sort((a, b) => {
    const za = a.item.zipPath || "";
    const zb = b.item.zipPath || "";
    const ma = za.match(modsRe);
    const mb = zb.match(modsRe);
    const ga = ma ? ma[1] : "\uffff";
    const gb = mb ? mb[1] : "\uffff";
    if (ga !== gb) return ga.localeCompare(gb);
    return za.localeCompare(zb);
  });
  let lastHeader = null;
  for (const { item, idx } of entries) {
    const rel = item.zipPath || (item.subfolder ? `${item.folder}/${item.subfolder}/${item.file.name}` : `${item.folder}/${item.file.name}`);
    const m = (item.zipPath || "").match(modsRe);
    const headerKey = m ? m[1] : "__other__";
    if (headerKey !== lastHeader) {
      lastHeader = headerKey;
      const sep = document.createElement("li");
      sep.className = "list-group-item py-1 px-3 small text-muted-2";
      sep.style.background = "rgba(0,0,0,.22)";
      sep.textContent = m ? `${MODS_FILES_PREFIX}/${headerKey}/` : "— вне json/mods/files —";
      ul.appendChild(sep);
    }
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `<span><strong>${rel}</strong></span><button type="button" class="btn btn-sm btn-outline-danger" data-i="${idx}">🗑️</button>`;
    ul.appendChild(li);
  }
  ul.querySelectorAll("[data-i]").forEach(btn => btn.addEventListener("click", async ev => {
    const i = parseInt(ev.target.closest("[data-i]").dataset.i, 10);
    files.splice(i, 1);
    const stored = await dbGetAll(STORE_NAME); await dbClear(STORE_NAME);
    if (modIconFile) await dbPut(STORE_NAME, { name: modIconFile.name, file: modIconFile, type: "modIcon", folder: null });
    for (const f of files) await dbPut(STORE_NAME, { name: f.file.name, file: f.file, type: "modFile", folder: f.folder, zipPath: f.zipPath || null });
    renderFiles(); autoSave();
  }));
}

async function downloadObjectTable() {
  const prog = document.getElementById("progress-container");
  const bar = document.getElementById("progress-bar");
  
  
  const EXPECTED_SIZE = 14 * 1024 * 1024; 

  prog.classList.remove("d-none");
  bar.style.width = "0%";
  bar.textContent = "0%";

  try {
    const resp = await fetch(REMOTE_OBJECT_TABLE_URL, { cache: "default", mode: "cors" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    let loaded = 0;
    let chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      
      let p = Math.round((loaded / EXPECTED_SIZE) * 100);
      
      
      
      if (p >= 100) {
        bar.style.width = "100%";
        bar.textContent = "Почти готово...";
      } else {
        bar.style.width = p + "%";
        bar.textContent = p + "%";
      }
    }

    
    
    const text = await new Blob(chunks).text();
    const data = JSON.parse(text);

    processSchema(data);
    await saveObjectTableToDb(data);

    try { 
      localStorage.removeItem("objectTable"); 
    } catch (e) {
      console.warn("Не удалось очистить localStorage:", e);
    }

    
    bar.style.width = "100%";
    bar.textContent = "100%";

    setTimeout(() => {
      prog.classList.add("d-none");
      toast("objectTable сохранён в IndexedDB", "success");
    }, 400);

    populateCsvSelect();
    updateObjectScopeSelect();

  } catch (err) {
    prog.classList.add("d-none");
    console.error(err);
    toast("Не удалось скачать: " + err.message, "error");
  }
}
function processSchema(data) {
  schema = data; GROUP_KEYS = Object.keys(data);
  GROUP_KEYS.forEach(g => {
    const gd = data[g] || {};
    PARAMS_BY_GROUP[g] = Object.keys(gd.params || {});
    OBJECT_EXAMPLES_BY_GROUP[g] = gd.objects || ["*"];
    TYPE_BY_PARAM_BY_GROUP[g] = gd.params || {};
  });
}
document.getElementById("download-object-table").addEventListener("click", downloadObjectTable);

function syncUiTogglesFromState() {
  const a = document.getElementById("auto-root-patches");
  if (a) a.checked = autoRootPatches;
  const h = document.getElementById("hint-file-paths");
  if (h) h.checked = hintFilePathsEnabled;
}

(async function initSchema() {
  let data = await loadObjectTableFromDb();
  if (!data) {
    try {
      const ls = localStorage.getItem("objectTable");
      if (ls) { data = JSON.parse(ls); localStorage.removeItem("objectTable"); await saveObjectTableToDb(data); }
    } catch (e) {}
  }
  if (!data) {
    try {
      const resp = await fetch("./objectTable.json", { cache: "default" });
      if (resp.ok) {
        data = await resp.json();
        await saveObjectTableToDb(data);
      }
    } catch (e) {}
  }
  if (data) processSchema(data);
  populateFolderSelect();
  populateLangSelect();
  await loadState();
  syncUiTogglesFromState();
  sanitizeTopModel();
  populateFileModdataScopeSelect();
  loadMeta(model);
  renderFiles();
  populateFeatureJsonSelect();
  updateObjectScopeSelect();
  populateCsvSelect();
  repaint();
})();

document.getElementById("auto-root-patches")?.addEventListener("change", ev => {
  autoRootPatches = ev.target.checked;
  syncPatchesField();
  debouncedUpdateJson();
});
document.getElementById("hint-file-paths")?.addEventListener("change", ev => {
  hintFilePathsEnabled = ev.target.checked;
  renderGroupsTab();
  autoSave();
});

function sanitizeTopModel() {
  for (const k of Object.keys(model)) {
    if (!k.startsWith("@")) delete model[k];
  }
}

const debouncedUpdateJson = debounce(() => {
  syncPatchesField();
  if (isJsonTabActive()) {
    const text = JSON.stringify(generateContentJson(), null, 2);
    try { cm.operation(() => { cm.setValue(text); }); }
    catch (e) { cm.setValue(text); }
  }
  autoSave();
}, 700);

function repaint() {
  loadMeta(model);
  populateFileModdataScopeSelect();
  populateCsvApplyScopeSelect();
  renderGroups_side();
  debouncedUpdateJson();
  debouncedPreview();
}

function updateObjectScopeSelect() {
  const sel = document.getElementById("object-scope");
  if (!sel) return;
  const prev = objectScope;
  sel.innerHTML = "";
  const o0 = document.createElement("option"); o0.value = ""; o0.textContent = "root"; sel.appendChild(o0);
  Object.keys(model["@features"] || {}).forEach(fid => {
    const o = document.createElement("option"); o.value = fid; o.textContent = fid; sel.appendChild(o);
  });
  if ([...sel.options].some(x => x.value === prev)) sel.value = prev;
  else sel.value = "";
  objectScope = sel.value;
  sel.onchange = () => { objectScope = sel.value; activeGroupKey = null; renderGroupsTab(); autoSave(); };
}

function populateCsvApplyScopeSelect() {
  const sel = document.getElementById("csv-apply-scope");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "root";
  sel.appendChild(o0);
  Object.keys(model["@features"] || {}).forEach(fid => {
    const o = document.createElement("option");
    o.value = fid;
    o.textContent = fid;
    sel.appendChild(o);
  });
  if (prev && [...sel.options].some(x => x.value === prev)) sel.value = prev;
  else sel.value = objectScope || "";
}

function getBucketForCsvApply() {
  const v = document.getElementById("csv-apply-scope")?.value ?? "";
  if (!v) return rootPatchData;
  ensureFeatureData(v);
  return featureFileData[v];
}

function populateFeatureJsonSelect() {
  const sel = document.getElementById("feature-json-select");
  if (!sel) return;
  const prev = selectedFeatureJsonId;
  sel.innerHTML = "";
  const oRoot = document.createElement("option");
  oRoot.value = "";
  oRoot.textContent = "root";
  sel.appendChild(oRoot);
  const ids = Object.keys(model["@features"] || {});
  ids.forEach(fid => {
    const o = document.createElement("option");
    o.value = fid;
    o.textContent = fid;
    sel.appendChild(o);
  });
  const valid = ["", ...ids];
  if (valid.includes(prev)) sel.value = prev;
  else sel.value = "";
  selectedFeatureJsonId = sel.value;
  sel.onchange = () => { selectedFeatureJsonId = sel.value; syncFeatureJsonEditor(); };
}

function syncFeatureJsonEditor() {
  let body;
  if (selectedFeatureJsonId) {
    ensureFeatureData(selectedFeatureJsonId);
    body = featureFileData[selectedFeatureJsonId] || {};
  } else {
    body = rootPatchData;
  }
  cmFeatureJson.setValue(JSON.stringify(body, null, 2));
  try { cmFeatureJson.refresh(); } catch (e) {}
}

document.getElementById("format-feature-json").addEventListener("click", () => {
  try { cmFeatureJson.setValue(JSON.stringify(JSON.parse(cmFeatureJson.getValue()), null, 2)); toast("Отформатировано", "success"); }
  catch (e) { toast("Ошибка JSON", "error"); }
});
document.getElementById("apply-feature-json").addEventListener("click", () => {
  try {
    const parsed = JSON.parse(cmFeatureJson.getValue());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("ожидается объект JSON");
    if (selectedFeatureJsonId) featureFileData[selectedFeatureJsonId] = parsed;
    else rootPatchData = parsed;
    debouncedUpdateJson();
    toast(selectedFeatureJsonId ? "JSON фичи применён" : "root применён", "success");
  } catch (e) { toast("Ошибка: " + e.message, "error"); }
});

document.getElementById("add-feature-btn").addEventListener("click", () => {
  const id = document.getElementById("new-feature-id").value.trim();
  const priority = parseInt(document.getElementById("new-feature-priority").value, 10) || 0;
  const enabled = document.getElementById("new-feature-enabled").value === "true";
  if (!id) { toast("Введите ID возможности", "error"); return; }
  if (!model["@features"]) model["@features"] = {};
  model["@features"][id] = { "@name": { EN: id }, "@priority": priority };
  if (!enabled) model["@features"][id]["@enabled"] = false;
  ensureFeatureData(id);
  document.getElementById("new-feature-id").value = "";
  document.getElementById("new-feature-priority").value = "0";
  renderFeatures(); populateFeatureJsonSelect(); updateObjectScopeSelect(); populateCsvApplyScopeSelect(); populateFileModdataScopeSelect(); debouncedUpdateJson();
});

document.getElementById("add-group-btn").addEventListener("click", () => {
  const id = document.getElementById("new-group-id").value.trim();
  const type = document.getElementById("new-group-type").value;
  if (!id) { toast("Введите ID группы", "error"); return; }
  if (!model["@feature_groups"]) model["@feature_groups"] = {};
  model["@feature_groups"][id] = { "@name": { EN: id }, "@type": type, "@features": [] };
  document.getElementById("new-group-id").value = "";
  renderFeatureGroups(); debouncedUpdateJson();
});

function countFilesForFeature(fid) {
  const prefix = `${MODS_FILES_PREFIX}/${fid}/`;
  return files.filter(x => x.zipPath && x.zipPath.startsWith(prefix)).length;
}

function renderFeatures() {
  const list = document.getElementById("features-list");
  list.innerHTML = "";
  const features = model["@features"] || {};
  if (!Object.keys(features).length) { list.innerHTML = "<p class=\"text-muted-2 text-center\">Нет возможностей</p>"; return; }
  Object.keys(features).forEach(key => {
    const f = features[key];
    const others = Object.keys(features).filter(k => k !== key);
    const conflicts = f["@conflicts"] || [];
    const conflictRows = others.map(ok => `
      <div class="conflict-row">
        <span>${ok}</span>
        <div class="form-check form-switch m-0">
          <input class="form-check-input feature-switch" type="checkbox" role="switch" data-feat="${key}" data-other="${ok}" ${conflicts.includes(ok) ? "checked" : ""}>
        </div>
      </div>`).join("");
    const div = document.createElement("div");
    div.className = "feature-card fade-in-up";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <span class="feature-id">${key}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" data-del-feat="${key}">🗑️ Удалить</button>
      </div>
      <div class="row g-2">
        <div class="col-12 col-md-6">
          <label class="form-label small text-muted-2">Название (@name) <span class="text-danger">*</span></label>
          <div class="intl-lang-tabs" id="f-name-tabs-${key}"></div>
          <input type="text" class="form-control form-control-dark" id="f-name-${key}" placeholder="Название фичи" value="">
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label small text-muted-2">Описание (@description)</label>
          <div class="intl-lang-tabs" id="f-desc-tabs-${key}"></div>
          <input type="text" class="form-control form-control-dark" id="f-desc-${key}" placeholder="Описание" value="">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small text-muted-2">Приоритет</label>
          <input type="number" class="form-control form-control-dark" id="f-pri-${key}" value="${f["@priority"] ?? 0}">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small text-muted-2">По умолч.</label>
          <select class="form-select form-select-dark" id="f-enabled-${key}">
            <option value="true" ${f["@enabled"] !== false ? "selected" : ""}>Включена</option>
            <option value="false" ${f["@enabled"] === false ? "selected" : ""}>Выключена</option>
          </select>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label small text-muted-2">Конфликты (@conflicts)</label>
          ${others.length ? conflictRows : "<p class=\"text-muted-2 small mb-0\">Нет других фич</p>"}
        </div>
        <div class="col-12">
          <label class="form-label small text-muted-2">Файлы → <code>${MODS_FILES_PREFIX}/${key}/</code></label>
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <label class="btn btn-sm btn-outline-light mb-0">📁 Добавить<input type="file" class="d-none" multiple data-feat-files="${key}"></label>
            <small class="text-muted-2" id="f-files-info-${key}">${countFilesForFeature(key)} файл(ов)</small>
          </div>
        </div>
      </div>`;
    list.appendChild(div);
    document.getElementById(`f-name-${key}`).value = getIntl(f["@name"] || {}, currentLanguage);
    document.getElementById(`f-desc-${key}`).value = getIntl(f["@description"] || {}, currentLanguage);
    buildIntlTabs(`f-name-tabs-${key}`, `f-name-${key}`, key, "@name");
    buildIntlTabs(`f-desc-tabs-${key}`, `f-desc-${key}`, key, "@description", true);
    document.getElementById(`f-name-${key}`).addEventListener("input", e => { if (!f["@name"]) f["@name"] = {}; setIntl(f["@name"], currentLanguage, e.target.value); debouncedUpdateJson(); });
    document.getElementById(`f-desc-${key}`).addEventListener("input", e => { if (!f["@description"]) f["@description"] = {}; setIntl(f["@description"], currentLanguage, e.target.value); debouncedUpdateJson(); });
    document.getElementById(`f-pri-${key}`).addEventListener("input", e => { f["@priority"] = parseInt(e.target.value, 10) || 0; debouncedUpdateJson(); });
    document.getElementById(`f-enabled-${key}`).addEventListener("change", e => { if (e.target.value === "false") f["@enabled"] = false; else delete f["@enabled"]; debouncedUpdateJson(); });
    div.querySelectorAll(".feature-switch").forEach(sw => {
      sw.addEventListener("change", () => {
        const arr = [...div.querySelectorAll(".feature-switch")].filter(x => x.checked).map(x => x.dataset.other);
        if (arr.length) f["@conflicts"] = arr; else delete f["@conflicts"];
        debouncedUpdateJson();
      });
    });
    div.querySelector(`[data-del-feat="${key}"]`).addEventListener("click", () => {
      showConfirm(`Удалить возможность "${key}"?`, () => {
        delete model["@features"][key];
        delete featureFileData[key];
        renderFeatures(); populateFeatureJsonSelect(); updateObjectScopeSelect(); populateCsvApplyScopeSelect(); populateFileModdataScopeSelect(); debouncedUpdateJson();
      });
    });
    div.querySelector(`[data-feat-files="${key}"]`).addEventListener("change", async ev => {
      for (const file of Array.from(ev.target.files)) {
        const zipPath = zipPathModsFiles(key, file.name);
        files.push({ file, folder: "json", zipPath });
        await dbPut(STORE_NAME, { name: file.name, file, type: "modFile", folder: "json", zipPath });
      }
      document.getElementById(`f-files-info-${key}`).textContent = countFilesForFeature(key) + " файл(ов)";
      renderFiles();
      if (document.getElementById("objects-pane")?.classList.contains("active")) renderGroupsTab();
      debouncedUpdateJson(); ev.target.value = "";
    });
  });
}

function buildIntlTabs(tabsId, inputId, featureKey, field) {
  const tabs = document.getElementById(tabsId);
  const inp = document.getElementById(inputId);
  if (!tabs || !inp) return;
  tabs.innerHTML = "";
  KNOWN_LANGUAGES.slice(0, 5).forEach(lang => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "intl-lang-tab" + (lang === currentLanguage ? " active" : "");
    btn.textContent = lang.toUpperCase();
    btn.addEventListener("click", () => {
      tabs.querySelectorAll(".intl-lang-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const ff = model["@features"]?.[featureKey];
      if (ff) inp.value = getIntl(ff[field] || {}, lang);
      inp.dataset.lang = lang;
    });
    tabs.appendChild(btn);
  });
  inp.dataset.lang = currentLanguage;
  inp.addEventListener("input", e => {
    const lang = e.target.dataset.lang || currentLanguage;
    const ff = model["@features"]?.[featureKey];
    if (ff) { if (!ff[field]) ff[field] = {}; setIntl(ff[field], lang, e.target.value); }
    debouncedUpdateJson();
  });
}

function renderFeatureGroups() {
  const list = document.getElementById("feature-groups-list");
  list.innerHTML = "";
  const groups = model["@feature_groups"] || {};
  if (!Object.keys(groups).length) { list.innerHTML = "<p class=\"text-muted-2 text-center\">Нет групп</p>"; return; }
  const featureIds = Object.keys(model["@features"] || {});
  Object.keys(groups).forEach(gid => {
    const g = groups[gid];
    const isRadio = g["@type"] === "RADIO_GROUP";
    const members = g["@features"] || [];
    const memberRows = featureIds.map(fid => {
      const inG = members.includes(fid);
      const isStd = g["@standard"] === fid;
      return `<div class="fg-member-row">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" data-gid="${gid}" data-fid="${fid}" id="fgm-${gid}-${fid}" ${inG ? "checked" : ""}>
          <label class="form-check-label" for="fgm-${gid}-${fid}">${fid}</label>
        </div>
        ${isRadio ? `<span class="radio-default-badge${isStd ? " active" : ""}" data-set-std="${gid}" data-std-fid="${fid}" title="Стандарт для RADIO_GROUP">стандарт</span>` : ""}
      </div>`;
    }).join("");
    const div = document.createElement("div");
    div.className = "feature-card";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <span class="feature-id">${gid}</span>
        <div class="d-flex gap-2">
          <select class="form-select form-select-dark form-select-sm" data-fg-type="${gid}">
            <option value="DEFAULT" ${g["@type"] === "DEFAULT" ? "selected" : ""}>DEFAULT</option>
            <option value="RADIO_GROUP" ${g["@type"] === "RADIO_GROUP" ? "selected" : ""}>RADIO_GROUP</option>
          </select>
          <button type="button" class="btn btn-sm btn-outline-danger" data-del-grp="${gid}">🗑️</button>
        </div>
      </div>
      <label class="form-label small text-muted-2">Название</label>
      <input type="text" class="form-control form-control-dark form-control-sm mb-2" data-fg-name="${gid}" value="${getIntl(g["@name"] || {}, currentLanguage)}">
      <label class="form-label small text-muted-2">Возможности в группе</label>
      ${memberRows || "<p class=\"text-muted-2 small\">Нет фич</p>"}`;
    list.appendChild(div);
    div.querySelector(`[data-fg-name="${gid}"]`).addEventListener("input", e => { if (!g["@name"]) g["@name"] = {}; setIntl(g["@name"], currentLanguage, e.target.value); debouncedUpdateJson(); });
    div.querySelector(`[data-fg-type="${gid}"]`).addEventListener("change", e => { g["@type"] = e.target.value; renderFeatureGroups(); debouncedUpdateJson(); });
    div.querySelectorAll(`[data-gid="${gid}"]`).forEach(cb => {
      if (cb.type !== "checkbox") return;
      cb.addEventListener("change", () => {
        g["@features"] = [...div.querySelectorAll(`[data-gid="${gid}"]`)].filter(x => x.type === "checkbox" && x.checked).map(x => x.dataset.fid);
        if (isRadio && g["@standard"] && !g["@features"].includes(g["@standard"])) delete g["@standard"];
        debouncedUpdateJson();
      });
    });
    div.querySelectorAll(`[data-set-std="${gid}"]`).forEach(badge => {
      badge.addEventListener("click", () => {
        const fid = badge.dataset.stdFid;
        if (!(g["@features"] || []).includes(fid)) { toast("Сначала включите фичу в группе", "error"); return; }
        g["@standard"] = fid;
        renderFeatureGroups(); debouncedUpdateJson();
      });
    });
    div.querySelector(`[data-del-grp="${gid}"]`).addEventListener("click", () => {
      delete model["@feature_groups"][gid]; renderFeatureGroups(); debouncedUpdateJson();
    });
  });
}

function renderGroups_side() {
  if (document.getElementById("objects-pane").classList.contains("show")) renderGroupsTab();
}

function renderGroupsTab() {
  const bucket = getObjectBucket();
  const groupKeys = tableKeysInBucket(bucket);
  const sel = document.getElementById("group-selector");
  sel.innerHTML = "";
  if (!groupKeys.length) {
    document.getElementById("selected-group-pane").innerHTML = "<p class=\"text-muted-2 text-center\">Нет добавленных таблиц объектов</p>";
    return;
  }
  if (activeGroupKey && !groupKeys.includes(activeGroupKey)) activeGroupKey = groupKeys[0];
  if (!activeGroupKey) activeGroupKey = groupKeys[0];
  groupKeys.forEach(k => {
    const btn = document.createElement("span");
    btn.className = "group-tab-btn" + (k === activeGroupKey ? " active" : "");
    btn.innerHTML = `${k} <button type="button" class="group-tab-remove" title="Удалить таблицу" data-rm-grp="${k}">×</button>`;
    btn.addEventListener("click", e => {
      if (e.target.closest("[data-rm-grp]")) return;
      activeGroupKey = k; renderGroupsTab();
    });
    btn.querySelector("[data-rm-grp]").addEventListener("click", ev => {
      ev.stopPropagation();
      const kk = ev.target.dataset.rmGrp;
      showConfirm(`Удалить таблицу "${kk}"?`, () => { delete bucket[kk]; if (activeGroupKey === kk) activeGroupKey = null; renderGroupsTab(); debouncedUpdateJson(); });
    });
    sel.appendChild(btn);
  });
  renderActiveGroupVirtual(activeGroupKey, bucket);
}

function renderActiveGroupVirtual(group, bucket) {
  const pane = document.getElementById("selected-group-pane");
  if (objectsVirtualScrollCleanup) { objectsVirtualScrollCleanup(); objectsVirtualScrollCleanup = null; }
  pane.innerHTML = "";
  const getNames = () => Object.keys(bucket[group] || {});
  const addTop = document.createElement("button");
  addTop.className = "btn btn-success glow mb-3";
  addTop.textContent = "➕ Добавить объект";
  addTop.addEventListener("click", () => { addObjectToGroup(group, bucket); renderGroupsTab(); });
  pane.appendChild(addTop);
  if (!getNames().length) {
    const p = document.createElement("p");
    p.className = "text-muted-2 text-center mt-2";
    p.textContent = `Нет объектов в "${group}"`;
    pane.appendChild(p);
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "objects-grid-wrap";
  const grid = document.createElement("div");
  grid.className = "objects-grid";
  pane.appendChild(wrap);
  wrap.appendChild(grid);
  const ROW_H = 260;
  const VISIBLE = 6;
  let start = 0;
  function paint() {
    const objNames = getNames();
    const objects = bucket[group] || {};
    grid.innerHTML = "";
    const slice = objNames.slice(start, start + VISIBLE);
    slice.forEach(objName => paintObjectCard(grid, group, bucket, objects, objName));
    const sp = document.createElement("div");
    sp.className = "objects-virtual-spacer";
    sp.textContent = `Показаны ${start + 1}–${Math.min(start + VISIBLE, objNames.length)} из ${objNames.length} (прокрутка)`;
    grid.appendChild(sp);
  }
  paint();
  const detach = attachPassiveRafScroll(wrap, () => {
    const objNames = getNames();
    start = Math.min(Math.max(0, Math.floor(wrap.scrollTop / ROW_H)), Math.max(0, objNames.length - VISIBLE));
    paint();
  });
  objectsVirtualScrollCleanup = detach;
}

function paintObjectCard(grid, group, bucket, objects, objName) {
  const card = document.createElement("div");
  card.className = "object-card";
  const params = objects[objName];
  const examples = OBJECT_EXAMPLES_BY_GROUP[group] || ["*"];
  const nameEsc = objName.replace(/"/g, "&quot;");
  const nameBlock = examples[0] === "*"
    ? `<input type="text" class="form-control form-control-dark form-control-sm obj-name-input" value="${nameEsc}">`
    : `<div class="d-flex gap-1 align-items-center"><input type="text" readonly class="form-control form-control-dark form-control-sm obj-name-display" value="${nameEsc}"><button type="button" class="btn btn-sm btn-outline-light flex-shrink-0 obj-name-pick" title="Выбрать">▾</button></div>`;
  card.innerHTML = `
    <div class="mb-2">
      <label class="form-label small text-muted-2">Объект</label>
      ${nameBlock}
    </div>
    <div class="d-flex gap-2 mb-3 flex-wrap">
      <button type="button" class="btn btn-sm btn-primary flex-grow-1 add-param-btn">Параметр</button>
      <button type="button" class="btn btn-sm btn-outline-danger flex-grow-1 del-obj-btn">Удалить</button>
    </div>
    <div class="params-container d-flex flex-column gap-2"></div>`;
  grid.appendChild(card);
  const nameInput = card.querySelector(".obj-name-input");
  const nameDisp = card.querySelector(".obj-name-display");
  const namePick = card.querySelector(".obj-name-pick");
  if (nameInput) {
    nameInput.addEventListener("change", e => {
      const newName = e.target.value.trim();
      if (!newName || newName === objName) { nameInput.value = objName; return; }
      if (bucket[group][newName]) { toast("Имя занято", "error"); nameInput.value = objName; return; }
      bucket[group][newName] = bucket[group][objName];
      delete bucket[group][objName];
      renderGroupsTab(); debouncedUpdateJson();
    });
  }
  if (nameDisp && namePick) {
    namePick.addEventListener("click", () => {
      showPickModal("Объект", examples, objName, newName => {
        if (!newName || newName === objName) return;
        if (bucket[group][newName]) { toast("Имя занято", "error"); return; }
        bucket[group][newName] = bucket[group][objName];
        delete bucket[group][objName];
        renderGroupsTab(); debouncedUpdateJson();
      });
    });
  }
  card.querySelector(".del-obj-btn").addEventListener("click", () => {
    showConfirm(`Удалить объект "${objName}"?`, () => {
      delete bucket[group][objName];
      if (!Object.keys(bucket[group]).length) delete bucket[group];
      renderGroupsTab(); debouncedUpdateJson();
    });
  });
  card.querySelector(".add-param-btn").addEventListener("click", () => {
    const avail = PARAMS_BY_GROUP[group] || [];
    if (!avail.length) { toast("Нет параметров", "error"); return; }
    showPickModal("Параметр", avail, avail[0], param => {
      if (bucket[group][objName][param] !== undefined) { toast("Параметр уже добавлен", "error"); return; }
      const t = TYPE_BY_PARAM_BY_GROUP[group]?.[param] || "str";
      bucket[group][objName][param] = t === "bool" ? false : t === "int" ? 0 : "";
      renderGroupsTab(); debouncedUpdateJson();
    });
  });
  const pc = card.querySelector(".params-container");
  Object.keys(params).forEach(pName => {
    const pType = TYPE_BY_PARAM_BY_GROUP[group]?.[pName] || "str";
    const pill = document.createElement("div");
    pill.className = "param-pill";
    let inputHtml = "";
    if (pType === "bool") inputHtml = `<select class="form-select form-select-dark form-select-sm param-input"><option value="true" ${params[pName] ? "selected" : ""}>true</option><option value="false" ${!params[pName] ? "selected" : ""}>false</option></select>`;
    else if (pType === "int") inputHtml = `<input type="number" class="form-control form-control-dark form-control-sm param-input" value="${params[pName] || 0}">`;
    else inputHtml = `<input type="text" class="form-control form-control-dark form-control-sm param-input" value="${String(params[pName] ?? "").replace(/"/g, "&quot;")}" autocomplete="off">`;
    pill.innerHTML = `<div class="d-flex align-items-center justify-content-between"><span class="param-name">${pName}</span><button type="button" class="remove-value-btn-param" style="position:static;margin-left:auto">×</button></div>${inputHtml}`;
    pc.appendChild(pill);
    const inp = pill.querySelector(".param-input");
    if (pType === "str" && hintFilePathsEnabled) {
      const feat = objectScope || "root";
      const prefix = `${MODS_FILES_PREFIX}/${feat}/`;
      const hits = files.filter(x => x.zipPath?.startsWith(prefix)).map(x => "/" + x.zipPath);
      const basePath = "/" + prefix;
      const opts = [...new Set([basePath, ...hits])];
      if (opts.length) {
        const dl = document.createElement("datalist");
        dl.id = "pdl-" + Math.random().toString(36).slice(2);
        opts.forEach(v => {
          const o = document.createElement("option");
          o.value = v;
          dl.appendChild(o);
        });
        pill.appendChild(dl);
        inp.setAttribute("list", dl.id);
      }
    }
    inp.addEventListener("change", e => {
      const v = e.target.value;
      bucket[group][objName][pName] = pType === "bool" ? v === "true" : pType === "int" ? parseInt(v, 10) || 0 : v;
      debouncedUpdateJson();
    });
    pill.querySelector(".remove-value-btn-param").addEventListener("click", () => {
      delete bucket[group][objName][pName]; renderGroupsTab(); debouncedUpdateJson();
    });
  });
}

function addObjectToGroup(group, bucket) {
  if (!bucket[group]) bucket[group] = {};
  const ex = OBJECT_EXAMPLES_BY_GROUP[group] || ["*"];
  const base = ex[0] === "*" ? "NewObject" : ex[0];
  let name = base, i = 1;
  while (bucket[group][name]) name = base + i++;
  bucket[group][name] = {};
  debouncedUpdateJson();
}

document.getElementById("add-object-group-pick").addEventListener("click", () => {
  if (!GROUP_KEYS.length) { toast("Нужен objectTable", "error"); return; }
  const inp = document.getElementById("add-object-group");
  const cur = inp.value.trim();
  showPickModal("Таблица", GROUP_KEYS, cur && GROUP_KEYS.includes(cur) ? cur : GROUP_KEYS[0], v => { inp.value = v; });
});

document.getElementById("add-object-btn").addEventListener("click", () => {
  const group = document.getElementById("add-object-group").value.trim();
  if (!group) { toast("Выберите таблицу", "error"); return; }
  if (!GROUP_KEYS.includes(group)) { toast("Неизвестная таблица", "error"); return; }
  const bucket = getObjectBucket();
  if (!bucket[group]) bucket[group] = {};
  addObjectToGroup(group, bucket);
  activeGroupKey = group;
  renderGroupsTab();
});

function showPickModal(title, items, initial, onOk) {
  if (!items?.length) { toast("Нет вариантов", "error"); return; }
  const id = "pm-" + Math.random().toString(36).slice(2);
  const init = initial && items.includes(initial) ? initial : items[0];
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="${id}" tabindex="-1"><div class="modal-dialog modal-dialog-centered">
    <div class="modal-content soft"><div class="modal-header border-0">
    <h5 class="modal-title">${title}</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
    </div><div class="modal-body">
    <input type="text" class="form-control form-control-dark mb-2" id="${id}-search" placeholder="Поиск…" autocomplete="off">
    <div style="max-height:240px;overflow-y:auto" id="${id}-list"></div>
    <input type="hidden" id="${id}-val" value="">
    </div><div class="modal-footer border-0">
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
    <button type="button" class="btn btn-primary" id="${id}-ok">Ок</button>
    </div></div></div></div>`);
  const mel = document.getElementById(id);
  const list = document.getElementById(id + "-list");
  const valInput = document.getElementById(id + "-val");
  valInput.value = init;
  function paintList(filter) {
    const q = (filter || "").toLowerCase();
    list.innerHTML = "";
    const filtered = items.filter(it => it.toLowerCase().includes(q));
    if (!filtered.length) {
      list.innerHTML = "<div class=\"text-muted-2 small p-2\">Нет результатов</div>";
      return;
    }
    filtered.forEach(p => {
      const div = document.createElement("div");
      div.className = "option-item modal-pick-option";
      div.textContent = p;
      if (p === valInput.value) div.classList.add("selected");
      div.addEventListener("click", () => {
        valInput.value = p;
        list.querySelectorAll(".modal-pick-option").forEach(el => el.classList.remove("selected"));
        div.classList.add("selected");
      });
      list.appendChild(div);
    });
  }
  paintList("");
  document.getElementById(id + "-search").addEventListener("input", e => paintList(e.target.value));
  const modal = new bootstrap.Modal(mel);
  modal.show();
  document.getElementById(id + "-ok").addEventListener("click", () => { onOk(valInput.value); modal.hide(); });
  mel.addEventListener("hidden.bs.modal", () => mel.remove());
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const skipTypeRow = lines.length > 1;
  const dataStart = skipTypeRow ? 2 : 1;
  const rows = lines.slice(dataStart).map(l => parseCsvLine(l));
  return { headers, rows };
}
function parseCsvLine(line) {
  const result = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && !inQ) inQ = true;
    else if (c === '"' && inQ) { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
    else if (c === "," && !inQ) { result.push(cur); cur = ""; }
    else cur += c;
  }
  result.push(cur); return result;
}

function populateCsvSelect() {
  const sel = document.getElementById("csv-table-select");
  if (!sel) return;
  const prev = sel.value;
  const fromSchema = GROUP_KEYS.length ? [...GROUP_KEYS].sort() : [];
  const fromCache = Object.keys(csvData).filter(k => !fromSchema.includes(k)).sort();
  const names = fromSchema.length ? [...fromSchema, ...fromCache] : fromCache;
  sel.innerHTML = "<option value=\"\">—</option>";
  names.forEach(n => {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = csvData[n] ? `${n} ·` : n;
    sel.appendChild(o);
  });
  if (prev && names.includes(prev)) sel.value = prev;
}

document.getElementById("load-csv-btn").addEventListener("click", async () => {
  const name = document.getElementById("csv-table-select").value;
  if (!name) { toast("Выберите таблицу", "error"); return; }
  if (csvData[name]) { currentCsvName = name; ensureCsvBaseline(name); renderCsvTableVirtual(csvData[name]); return; }
  const tryUrls = [
    `${REMOTE_CSV_BASE}csv_logic/${name}.csv`,
    `${REMOTE_CSV_BASE}csv_client/${name}.csv`,
    `${REMOTE_CSV_BASE}${name}.csv`,
    `csvs/csv_logic/${name}.csv`,
    `csvs/${name}.csv`
  ];
  for (const url of tryUrls) {
    try {
      const resp = await fetch(url, { cache: "default", mode: "cors" });
      if (resp.ok) {
        const text = await resp.text();
        csvData[name] = parseCSV(text);
        setCsvBaseline(name);
        await saveCsvToDb(name, text);
        currentCsvName = name;
        renderCsvTableVirtual(csvData[name]);
        toast(name + ".csv загружен", "success");
        return;
      }
    } catch (e) {}
  }
  toast("Не удалось загрузить CSV", "error");
});

document.getElementById("csv-upload-input").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  const name = f.name.replace(/\.csv$/i, "");
  const text = await f.text();
  csvData[name] = parseCSV(text);
  setCsvBaseline(name);
  await saveCsvToDb(name, text);
  populateCsvSelect();
  document.getElementById("csv-table-select").value = name;
  currentCsvName = name;
  renderCsvTableVirtual(csvData[name]);
  toast("CSV загружен локально", "success");
  e.target.value = "";
});

function renderCsvTableVirtual(data) {
  if (currentCsvName) ensureCsvBaseline(currentCsvName);
  if (csvVirtualScrollCleanup) { csvVirtualScrollCleanup(); csvVirtualScrollCleanup = null; }
  const table = document.getElementById("csv-table");
  const wrap = document.getElementById("csv-table-scroll");
  table.innerHTML = "";
  const { headers, rows } = data;
  const thead = document.createElement("thead");
  const htr = document.createElement("tr");
  htr.appendChild(Object.assign(document.createElement("th"), { textContent: "#" }));
  headers.forEach(h => { htr.appendChild(Object.assign(document.createElement("th"), { textContent: h })); });
  thead.appendChild(htr);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  const ROW_H = 32;
  const vis = Math.min(40, Math.max(12, Math.ceil((wrap.clientHeight || 400) / ROW_H) + 4));
  let start = 0;
  function paint() {
    tbody.innerHTML = "";
    const slice = rows.slice(start, start + vis);
    slice.forEach((row, si) => {
      const ri = start + si;
      const tr = document.createElement("tr");
      const td0 = document.createElement("td"); td0.textContent = row[0] || String(ri); tr.appendChild(td0);
      headers.forEach((h, ci) => {
        const td = document.createElement("td");
        const inp = document.createElement("input");
        inp.className = "table-cell-input";
        inp.value = row[ci] || "";
        inp.addEventListener("input", e => { data.rows[ri][ci] = e.target.value; });
        td.appendChild(inp); tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    const hint = document.getElementById("csv-virtual-hint");
    if (hint) hint.textContent = `Строки ${start + 1}–${Math.min(start + vis, rows.length)} из ${rows.length} (прокрутка для подгрузки)`;
  }
  paint();
  const detach = attachPassiveRafScroll(wrap, () => {
    start = Math.min(Math.max(0, Math.floor(wrap.scrollTop / ROW_H)), Math.max(0, rows.length - vis));
    paint();
  });
  csvVirtualScrollCleanup = detach;
  document.getElementById("csv-editor-area").classList.remove("d-none");
  document.getElementById("csv-empty-state").classList.add("d-none");
}

document.getElementById("apply-csv-btn").addEventListener("click", () => {
  if (!currentCsvName || !csvData[currentCsvName]) { toast("Нет таблицы", "error"); return; }
  const table = currentCsvName;
  const data = csvData[table];
  const { headers, rows } = data;
  if (!headers.length) { toast("Таблица пустая", "error"); return; }
  ensureCsvBaseline(table);
  const base = csvBaseline[table];
  const bucket = getBucketForCsvApply();
  if (!bucket[table]) bucket[table] = {};

  function rowById(srcRows) {
    const m = new Map();
    (srcRows || []).forEach(r => {
      const id = String(r[0] ?? "").trim();
      if (id) m.set(id, r);
    });
    return m;
  }
  const curMap = rowById(rows);
  const baseMap = rowById(base.rows);
  const allIds = new Set([...curMap.keys(), ...baseMap.keys()]);

  for (const id of allIds) {
    const cur = curMap.get(id);
    const br = baseMap.get(id);
    if (!cur && br) {
      delete bucket[table][id];
      continue;
    }
    if (!cur) continue;
    if (!bucket[table][id]) bucket[table][id] = {};
    for (let i = 1; i < headers.length; i++) {
      const h = headers[i];
      if (!h) continue;
      const cv = String(cur[i] ?? "").trim();
      const bv = String(br?.[i] ?? "").trim();
      if (cv !== bv) {
        if (!cv) delete bucket[table][id][h];
        else bucket[table][id][h] = cv;
      } else if (bucket[table][id][h] !== undefined) {
        delete bucket[table][id][h];
      }
    }
    if (!Object.keys(bucket[table][id]).length) delete bucket[table][id];
  }
  if (!Object.keys(bucket[table]).length) delete bucket[table];

  const target = document.getElementById("csv-apply-scope")?.selectedOptions?.[0]?.textContent || "root";
  debouncedUpdateJson();
  toast(`CSV → ${target} (изменения)`, "success");
  if (activeGroupKey === table) renderGroupsTab();
});

document.getElementById("format-json").addEventListener("click", () => {
  try { cm.setValue(JSON.stringify(JSON.parse(cm.getValue()), null, 2)); }
  catch (e) { showAlert("Ошибка форматирования"); }
});
document.getElementById("apply-json").addEventListener("click", () => {
  try {
    const parsed = JSON.parse(cm.getValue());
    ["@title", "@description"].forEach(k => { if (typeof parsed[k] === "string") parsed[k] = { EN: parsed[k] }; });
    rootPatchData = {};
    featureFileData = {};
    model = { "@title": {}, "@description": {}, "@author": "", "@version": "1.0.0", "@features": {}, "@feature_groups": {}, "@root": "", "@patches": [], "@categories": [] };
    migrateLegacyModelIntoPatches(parsed);
    sanitizeTopModel();
    autoRootPatches = !parsed["@root"] && !(Array.isArray(parsed["@patches"]) && parsed["@patches"].length > 0);
    syncUiTogglesFromState();
    for (const fid of Object.keys(model["@features"] || {})) {
      const fe = model["@features"][fid];
      for (const x of Object.keys(fe || {})) if (x.startsWith("_")) delete fe[x];
      ensureFeatureData(fid);
    }
    loadMeta(model); renderFiles(); updateObjectScopeSelect(); populateFeatureJsonSelect(); populateCsvApplyScopeSelect(); populateFileModdataScopeSelect();
    renderGroupsTab();
    syncFeatureJsonEditor();
    document.getElementById("code-error").classList.add("d-none");
    autoSave(); toast("content.json применён", "success");
  } catch (e) {
    const el = document.getElementById("code-error");
    el.textContent = "Ошибка JSON: " + e.message;
    el.classList.remove("d-none");
  }
});

function mergePatchObjectIntoBucket(bucket, parsed) {
  for (const k of Object.keys(parsed || {})) {
    if (typeof parsed[k] === "object" && parsed[k] !== null && !Array.isArray(parsed[k])) bucket[k] = JSON.parse(JSON.stringify(parsed[k]));
  }
}

document.getElementById("export-btn").addEventListener("click", async () => {
  const zip = new JSZip();
  syncPatchesField();
  zip.file("content.json", JSON.stringify(generateContentJson(), null, 2));
  if (modIconFile) zip.file("icon.png", modIconFile);
  const rootHas = Object.keys(rootPatchData).some(t => {
    const b = rootPatchData[t];
    return b && typeof b === "object" && Object.keys(b).length > 0;
  });
  if (rootHas) zip.file(patchToZipPath(patchPathRootJson()), JSON.stringify(rootPatchData, null, 2));
  for (const fid of Object.keys(model["@features"] || {})) {
    const fd = featureFileData[fid];
    if (fd && typeof fd === "object" && Object.keys(fd).length > 0) zip.file(patchToZipPath(patchPathFeatureJson(fid)), JSON.stringify(fd, null, 2));
  }
  files.forEach(item => {
    const path = item.zipPath || (item.subfolder ? `${item.folder}/${item.subfolder}/${item.file.name}` : `${item.folder}/${item.file.name}`);
    zip.file(path, item.file);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mod.zip";
  a.click();
  toast("ZIP готов", "success");
});

document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-zip").click());
document.getElementById("import-zip").addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const zip = await JSZip.loadAsync(file);
    const jf = zip.file("content.json");
    if (!jf) throw new Error("content.json не найден");
    const parsed = JSON.parse(await jf.async("string"));
    ["@title", "@description"].forEach(k => { if (typeof parsed[k] === "string") parsed[k] = { EN: parsed[k] }; });
    rootPatchData = {};
    featureFileData = {};
    model = { "@title": {}, "@description": {}, "@author": "", "@version": "1.0.0", "@features": {}, "@feature_groups": {}, "@root": "", "@patches": [], "@categories": [] };
    for (const k of Object.keys(parsed)) {
      if (k.startsWith("@")) model[k] = parsed[k];
      else if (parsed[k] && typeof parsed[k] === "object") rootPatchData[k] = JSON.parse(JSON.stringify(parsed[k]));
    }
    sanitizeTopModel();
    autoRootPatches = false;
    syncUiTogglesFromState();
    for (const fid of Object.keys(model["@features"] || {})) {
      const fe = model["@features"][fid];
      for (const x of Object.keys(fe || {})) if (x.startsWith("_")) delete fe[x];
    }
    const norm = p => p.replace(/^\/+/, "").replace(/\\/g, "/");
    const loadPatch = async (relPath) => {
      const n = norm(relPath);
      const f = zip.file(relPath) || zip.file(n) || zip.file(n.split("/").join("/"));
      if (!f) return null;
      try { return JSON.parse(await f.async("string")); } catch (err) { return null; }
    };
    const patches = model["@patches"] || [];
    for (const p of patches) {
      const np = norm(p);
      const data = await loadPatch(p);
      if (!data) continue;
      const rid = patchJsonRouteId(np);
      if (rid === "root") mergePatchObjectIntoBucket(rootPatchData, data);
      else if (model["@features"] && model["@features"][rid]) featureFileData[rid] = data;
      else mergePatchObjectIntoBucket(rootPatchData, data);
    }
    const extraJson = [];
    zip.forEach((path, entry) => {
      if (entry.dir || !path.toLowerCase().endsWith(".json")) return;
      const n = norm(path);
      if (n === "content.json") return;
      if (isPatchJsonZipPath(n)) extraJson.push({ n, entry });
    });
    for (const { n, entry } of extraJson) {
      let data;
      try { data = JSON.parse(await entry.async("string")); } catch (e) { continue; }
      const rid = patchJsonRouteId(n);
      if (rid === "root") mergePatchObjectIntoBucket(rootPatchData, data);
      else if (model["@features"] && model["@features"][rid]) featureFileData[rid] = data;
    }
    const iconFile = zip.file("icon.png");
    if (iconFile) {
      const blob = await iconFile.async("blob");
      modIconFile = new File([blob], "icon.png", { type: "image/png" });
      showIconPreview(URL.createObjectURL(modIconFile));
      await dbPut(STORE_NAME, { name: "icon.png", file: modIconFile, type: "modIcon", folder: null });
    }
    files = [];
    const ps = [];
    zip.forEach((path, entry) => {
      if (entry.dir || path === "content.json" || path === "icon.png") return;
      const n = norm(path);
      if (isPatchJsonZipPath(n)) return;
      if (n.startsWith("json/moddata/files/") || n.startsWith(`${MODS_FILES_PREFIX}/`)) {
        const z = n.startsWith("json/moddata/files/") ? n.replace(/^json\/moddata\/files\//, `${MODS_FILES_PREFIX}/`) : n;
        const fn = z.split("/").pop();
        ps.push(entry.async("blob").then(blob => { files.push({ file: new File([blob], fn), folder: "json", zipPath: z }); }));
        return;
      }
      if (n.startsWith("json/moddata/")) {
        const parts = path.split("/");
        const fn = parts[parts.length - 1];
        ps.push(entry.async("blob").then(blob => { files.push({ file: new File([blob], fn), folder: "json", zipPath: n }); }));
        return;
      }
      const parts = path.split("/");
      if (parts.length >= 2 && KNOWN_FOLDERS.includes(parts[0])) {
        ps.push(entry.async("blob").then(blob => {
          const f = new File([blob], parts.slice(1).join("/"));
          files.push({ file: f, folder: parts[0], zipPath: null });
        }));
      }
    });
    await Promise.all(ps);
    await dbClear(STORE_NAME);
    if (modIconFile) await dbPut(STORE_NAME, { name: "icon.png", file: modIconFile, type: "modIcon", folder: null });
    for (const f of files) await dbPut(STORE_NAME, { name: f.file.name, file: f.file, type: "modFile", folder: f.folder, zipPath: f.zipPath || null });
    loadMeta(model); renderFiles(); updateObjectScopeSelect(); populateFeatureJsonSelect(); populateCsvApplyScopeSelect(); populateFileModdataScopeSelect(); renderGroupsTab(); debouncedUpdateJson();
    toast("Мод импортирован", "success");
  } catch (err) { toast("Ошибка импорта: " + err.message, "error"); }
  finally { e.target.value = ""; }
});

document.getElementById("reset-data-btn").addEventListener("click", () => {
  showConfirm("Сбросить все данные?", async () => {
    localStorage.clear();
    await dbClear(STORE_NAME);
    await dbClear(CSV_STORE);
    await dbClear(STATE_STORE);
    window.location.reload();
  });
});

function showConfirm(msg, onOk) {
  const id = "conf-" + Math.random().toString(36).slice(2);
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="${id}" tabindex="-1"><div class="modal-dialog modal-dialog-centered">
    <div class="modal-content soft"><div class="modal-body pt-4 text-center">${msg}</div>
    <div class="modal-footer border-0 justify-content-center gap-2">
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
    <button type="button" class="btn btn-danger" id="${id}-ok">Подтвердить</button>
    </div></div></div></div>`);
  const mel = document.getElementById(id);
  const modal = new bootstrap.Modal(mel);
  modal.show();
  document.getElementById(id + "-ok").addEventListener("click", () => { onOk(); modal.hide(); });
  mel.addEventListener("hidden.bs.modal", () => mel.remove());
}
function showAlert(msg) { toast(msg, "info"); }
