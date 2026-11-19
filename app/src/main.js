// Vice City Nights — wires the editor: photo uploads, panel picking and
// drag-to-pan, layout/grade/caption controls, live preview and PNG export.
// Photos are read on this machine with FileReader/object URLs and never uploaded.
import { drawCover, layoutPanels, GRADES, LAYOUTS } from './cover.js';
import { parseShot, markShotReady } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const state = {
  layout: 'hero3',
  grade: 'sunset',
  title: 'VICE CITY NIGHTS',
  subtitle: 'One night. Every story.',
  titleSize: 100,
  titlePos: 'bottom',
  panels: [],
};

let photos = []; // { img, name, url }
let selectedPanel = 0;
let exportW = 1080;
let exportH = 1350;

// Default vertical anchor: -1 shows the photo's top, +1 its bottom. Photos of
// people keep their faces in the frame, so panels start biased to the top
// instead of dead centre (which beheads a portrait photo in a wide panel).
const DEFAULT_OY = -0.55;

function panelCount() { return layoutPanels(state.layout).length; }

function ensurePanels() {
  const n = panelCount();
  while (state.panels.length < n) {
    const i = state.panels.length;
    state.panels.push({ photo: Math.min(i, Math.max(0, photos.length - 1)), zoom: 100, ox: 0, oy: DEFAULT_OY, fit: false });
  }
  state.panels.length = n;
  if (selectedPanel >= n) selectedPanel = 0;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function previewSize() {
  const scale = 900 / exportW;
  return { w: Math.round(exportW * scale), h: Math.round(exportH * scale) };
}

function redraw() {
  ensurePanels();
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  drawCover(ctx, w, h, state, photos.map((p) => p.img));
  drawSelectionRing();
  syncPanelControls();
}

function coverGeometry(w, h) {
  const gutter = Math.max(4, Math.round(Math.min(w, h) * 0.012));
  const bandH = Math.round(h * 0.21);
  const top = state.titlePos === 'top';
  return {
    gutter,
    area: { x: 0, y: top ? bandH : 0, w, h: h - bandH },
    bandH,
  };
}

function panelRects(w, h) {
  const { gutter, area } = coverGeometry(w, h);
  return layoutPanels(state.layout).map((r) => ({
    x: area.x + r[0] * area.w + gutter,
    y: area.y + r[1] * area.h + gutter,
    w: r[2] * area.w - gutter * 2,
    h: r[3] * area.h - gutter * 2,
  }));
}

function drawSelectionRing() {
  if (document.body.classList.contains('shot-cover')) return;
  const rects = panelRects(canvas.width, canvas.height);
  const r = rects[selectedPanel];
  if (!r) return;
  ctx.save();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  ctx.setLineDash([]);
  // Legible chip for the panel label: dark pill behind the text.
  ctx.font = 'bold 20px system-ui, sans-serif';
  const label = `PANEL ${selectedPanel + 1}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(20,6,32,0.85)';
  ctx.beginPath();
  ctx.roundRect(r.x + 6, r.y + 6, tw + 18, 30, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, r.x + 15, r.y + 11);
  ctx.restore();
}

function syncPanelControls() {
  const sel = document.getElementById('panelPhoto');
  const p = state.panels[selectedPanel];
  if (!p) return;
  sel.innerHTML = photos.map((ph, i) => `<option value="${i}">Photo ${i + 1} — ${ph.name}</option>`).join('')
    || '<option value="0">No photos yet</option>';
  sel.value = String(Math.min(p.photo, Math.max(0, photos.length - 1)));
  document.getElementById('zoom').value = String(p.zoom);
  document.getElementById('zoomVal').textContent = `${p.zoom}%`;
  document.getElementById('titleSizeVal').textContent = `${state.titleSize}%`;
  const tray = document.getElementById('photoTray');
  [...tray.children].forEach((el, i) => el.classList.toggle('sel', photos[i] && photos[i].img && state.panels.some((pp) => pp.photo === i)));
}

function refreshTray() {
  const tray = document.getElementById('photoTray');
  tray.innerHTML = '';
  photos.forEach((p, i) => {
    const thumb = document.createElement('img');
    thumb.src = p.url;
    thumb.alt = p.name;
    thumb.title = `${p.name} — click to put in selected panel`;
    thumb.addEventListener('click', () => {
      state.panels[selectedPanel].photo = i;
      redraw();
    });
    tray.appendChild(thumb);
  });
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  photos.push({ img, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Photo', url });
  refreshTray();
  redraw();
}

async function loadDemoPhotos() {
  const names = ['boulevard', 'pier'];
  for (const name of names) {
    if (photos.some((p) => p.name === name)) continue;
    const img = await loadImage(`samples/${name}.jpg`);
    photos.push({ img, name, url: `samples/${name}.jpg` });
  }
  refreshTray();
  redraw();
  statusEl.textContent = 'Demo photos loaded — drag a panel photo to reposition it.';
}

// ---- Controls ----
document.getElementById('photos').addEventListener('change', async (e) => {
  for (const file of e.target.files) { try { await addPhotoFile(file); } catch { /* skip unreadable file */ } }
  if (photos.length) statusEl.textContent = `${photos.length} photo${photos.length > 1 ? 's' : ''} loaded. Pick a layout, then export.`;
  e.target.value = '';
});
document.getElementById('demoPhotos').addEventListener('click', () => { loadDemoPhotos().catch(() => { statusEl.textContent = 'Demo photos could not be loaded.'; }); });
document.getElementById('fillAll').addEventListener('click', () => {
  state.panels.forEach((p) => { p.photo = 0; });
  redraw();
  statusEl.textContent = 'Every panel now shows photo 1.';
});
document.getElementById('layout').addEventListener('change', (e) => { state.layout = e.target.value; redraw(); });
document.getElementById('gradeSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-grade]');
  if (!btn) return;
  state.grade = btn.dataset.grade;
  [...document.querySelectorAll('#gradeSeg button')].forEach((b) => b.classList.toggle('on', b === btn));
  redraw();
});
document.getElementById('panelPhoto').addEventListener('change', (e) => {
  state.panels[selectedPanel].photo = Number(e.target.value);
  redraw();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('fitBtn').addEventListener('click', () => { state.panels[selectedPanel].fit = true; redraw(); });
document.getElementById('fillBtn').addEventListener('click', () => { state.panels[selectedPanel].fit = false; redraw(); });
document.getElementById('resetPan').addEventListener('click', () => {
  const p = state.panels[selectedPanel];
  p.ox = 0; p.oy = DEFAULT_OY; p.zoom = 100;
  redraw();
});
document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('titleSize').addEventListener('input', (e) => { state.titleSize = Number(e.target.value); redraw(); });
document.getElementById('posBottom').addEventListener('click', (e) => {
  state.titlePos = 'bottom';
  e.target.classList.add('on'); document.getElementById('posTop').classList.remove('on');
  redraw();
});
document.getElementById('posTop').addEventListener('click', (e) => {
  state.titlePos = 'top';
  e.target.classList.add('on'); document.getElementById('posBottom').classList.remove('on');
  redraw();
});
document.getElementById('exportSize').addEventListener('change', (e) => {
  [exportW, exportH] = e.target.value.split('x').map(Number);
  redraw();
});

// ---- Pointer: click selects a panel, drag pans its photo ----
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const rects = panelRects(canvas.width, canvas.height);
  const hit = rects.findIndex((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
  if (hit === -1) return;
  selectedPanel = hit;
  const p = state.panels[hit];
  drag = { startX: pt.x, startY: pt.y, ox: p.ox, oy: p.oy, rect: rects[hit] };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const p = state.panels[selectedPanel];
  const { rect } = drag;
  p.ox = Math.max(-1, Math.min(1, drag.ox - ((pt.x - drag.startX) / Math.max(1, rect.w)) * 2));
  p.oy = Math.max(-1, Math.min(1, drag.oy - ((pt.y - drag.startY) / Math.max(1, rect.h)) * 2));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// ---- Export ----
function renderExport(w, h) {
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawCover(off.getContext('2d'), w, h, state, photos.map((p) => p.img));
  return off;
}

/** Renders the cover at full export size and returns a PNG data URL (used by screenshots). */
export function exportCoverPNG(w, h) {
  return new Promise((resolve) => {
    renderExport(w, h).toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

document.getElementById('export').addEventListener('click', () => {
  renderExport(exportW, exportH).toBlob((blob) => {
    if (!blob) { statusEl.textContent = 'Export failed — try again.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-nights-${exportW}x${exportH}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    statusEl.textContent = `Saved vice-city-nights-${exportW}x${exportH}.png — share it!`;
  }, 'image/png');
});

// Test/automation hook: full state + export, no DOM download needed.
window.__viceCity = { state, get photos() { return photos; }, exportCoverPNG, redraw };

// ---- Shot scenes (?shot=cover / ?shot=editor) ----
const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  const scene = parseShot(query);
  (async () => {
    document.getElementById('layout').value = scene.layout;
    document.getElementById('title').value = scene.title;
    document.getElementById('subtitle').value = scene.subtitle;
    document.getElementById('titleSize').value = String(scene.titleSize);
    state.layout = scene.layout;
    state.grade = scene.grade;
    state.title = scene.title;
    state.subtitle = scene.subtitle;
    state.titleSize = scene.titleSize;
    state.titlePos = scene.titlePos;
    exportW = scene.sizeW; exportH = scene.sizeH;
    document.getElementById('exportSize').value = `${scene.sizeW}x${scene.sizeH}`;
    [...document.querySelectorAll('#gradeSeg button')].forEach((b) => b.classList.toggle('on', b.dataset.grade === scene.grade));
    for (const name of scene.photos) {
      try {
        const img = await loadImage(`samples/${name}.jpg`);
        photos.push({ img, name, url: `samples/${name}.jpg` });
      } catch { /* missing sample: keep going */ }
    }
    // Spread the demo photos across the panels: hero gets photo 1, the rest alternate.
    ensurePanels();
    state.panels.forEach((p, i) => { p.photo = photos.length ? i % photos.length : 0; });
    if (scene.shot === 'cover') document.body.classList.add('shot-cover');
    refreshTray();
    redraw();
    markShotReady();
  })();
} else {
  redraw();
}
