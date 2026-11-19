// Vice City Nights — the cover renderer. One function, drawCover, paints the whole
// poster on any 2D canvas at any size: a sunset/neon sky title band with a big
// gradient title, and a multi-panel photo collage with white poster gutters.
// Every effect is drawn by hand on canvas — no fonts, logos or artwork borrowed
// from any game. Titles use heavy system sans-serif with a hand-built outline,
// gradient fill and drop shadow.

export const GRADES = {
  sunset: {
    sky: ['#ffd166', '#ff7b3d', '#ff2e88', '#7b2fbe'],
    sun: '#fff3c4',
    panelTop: 'rgba(255,122,61,0.10)', panelBottom: 'rgba(255,46,136,0.28)',
    title: ['#fff7d6', '#ffb347', '#ff5e3a'],
    accent: '#ffb347', band: 'rgba(20,6,32,0.35)',
  },
  neon: {
    sky: ['#0b1035', '#3b0f66', '#d63384', '#00e5ff'],
    sun: '#ff9de2',
    panelTop: 'rgba(0,229,255,0.10)', panelBottom: 'rgba(214,51,132,0.30)',
    title: ['#e6fbff', '#7df9ff', '#ff5ec4'],
    accent: '#7df9ff', band: 'rgba(6,4,28,0.45)',
  },
  dusk: {
    sky: ['#f7b267', '#c65d7b', '#5b2a86', '#14213d'],
    sun: '#ffe8a3',
    panelTop: 'rgba(198,93,123,0.12)', panelBottom: 'rgba(20,33,61,0.32)',
    title: ['#fffbe8', '#f7b267', '#c65d7b'],
    accent: '#f7b267', band: 'rgba(12,8,30,0.40)',
  },
};

export const LAYOUTS = {
  hero3: 'Hero + 3 panels',
  grid4: 'Four-panel grid',
  six: 'Six-panel grid',
  duo: 'Two-panel split',
};

/** Panel rectangles as fractions of the photo area [x, y, w, h]. */
export function layoutPanels(layout) {
  switch (layout) {
    case 'grid4':
      return [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
    case 'six':
      return [
        [0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5],
        [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5],
      ];
    case 'duo':
      return [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]];
    case 'hero3':
    default:
      return [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1 / 3], [0.62, 1 / 3, 0.38, 1 / 3], [0.62, 2 / 3, 0.38, 1 / 3]];
  }
}

function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function drawPalm(ctx, x, y, size, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = 'rgba(16,6,28,0.85)';
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.55, size * 0.22, -size * 0.95);
  ctx.stroke();
  ctx.fillStyle = 'rgba(16,6,28,0.85)';
  const tipX = size * 0.22, tipY = -size * 0.95;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.08 + i * 0.14);
    const len = size * (0.55 - Math.abs(i - 3) * 0.05);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(
      tipX + Math.cos(a) * len * 0.6, tipY + Math.sin(a) * len * 0.6 + size * 0.18,
      tipX + Math.cos(a) * len, tipY + Math.sin(a) * len + size * 0.34);
    ctx.quadraticCurveTo(
      tipX + Math.cos(a) * len * 0.55, tipY + Math.sin(a) * len * 0.55 + size * 0.1,
      tipX, tipY);
    ctx.fill();
  }
  ctx.restore();
}

function drawPanelPhoto(ctx, img, rect, panel) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#241238';
  ctx.fillRect(x, y, w, h);
  if (img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const zoom = (panel.zoom || 100) / 100;
    let dw, dh;
    if (panel.fit) {
      const s = Math.min(w / iw, h / ih) * zoom;
      dw = iw * s; dh = ih * s;
    } else {
      const s = Math.max(w / iw, h / ih) * zoom;
      dw = iw * s; dh = ih * s;
    }
    const excessX = Math.max(0, (dw - w) / 2);
    const excessY = Math.max(0, (dh - h) / 2);
    const dx = x + (w - dw) / 2 - (panel.ox || 0) * excessX;
    const dy = y + (h - dh) / 2 - (panel.oy || 0) * excessY;
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

function drawTitleBlock(ctx, W, H, band, grade, title, subtitle, titleScale, selected) {
  const { x, y, w, h } = band;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // Low sun disc behind the title, kept small so the lettering stays crisp.
  const sunR = h * 0.42;
  const sun = ctx.createRadialGradient(W / 2, y + h * 0.58, sunR * 0.1, W / 2, y + h * 0.58, sunR);
  sun.addColorStop(0, grade.sun);
  sun.addColorStop(0.6, grade.sun + '99');
  sun.addColorStop(1, grade.sun + '00');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(W / 2, y + h * 0.58, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Palm silhouettes flanking the title, kept inside the frame.
  drawPalm(ctx, x + w * 0.055, y + h * 0.98, h * 0.9, 0.12);
  drawPalm(ctx, x + w * 0.945, y + h * 0.98, h * 0.82, -0.14);
  // Darken the band a touch so the lettering pops.
  ctx.fillStyle = grade.band;
  ctx.fillRect(x, y, w, h);
  // Neon rule above the title.
  ctx.fillStyle = grade.accent;
  ctx.fillRect(x + w * 0.08, y + h * 0.16, w * 0.84, Math.max(2, h * 0.02));

  const text = (title || 'VICE CITY NIGHTS').trim().toUpperCase();
  let size = W * 0.105 * (titleScale || 1);
  const font = (s) => `900 ${s}px "Arial Black", Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(size);
  const maxW = w * 0.86;
  while (ctx.measureText(text).width > maxW && size > 18) { size -= 2; ctx.font = font(size); }
  const cy = y + h * (subtitle ? 0.46 : 0.56);
  // Slanted, outlined, gradient-filled title.
  ctx.save();
  ctx.translate(W / 2, cy);
  ctx.transform(1, 0, -0.06, 1, 0, 0);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.14);
  ctx.strokeStyle = '#1a0b2e';
  ctx.strokeText(text, 0, 0);
  const grad = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
  grade.title.forEach((c, i) => grad.addColorStop(i / (grade.title.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.strokeText(text, 0, 0);
  ctx.restore();

  if (subtitle && subtitle.trim()) {
    const sub = subtitle.trim();
    let ss = W * 0.032 * (titleScale || 1);
    ctx.font = `italic 700 ${ss}px Georgia, "Times New Roman", serif`;
    while (ctx.measureText(sub).width > maxW && ss > 10) { ss -= 1; ctx.font = `italic 700 ${ss}px Georgia, "Times New Roman", serif`; }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = ss * 0.7;
    ctx.fillText(sub, W / 2, y + h * 0.82);
    ctx.shadowBlur = 0;
  }
  if (selected) { /* preview selection ring is drawn by the editor, not the export */ }
}

/** Paints the full cover. `state`: {layout, grade, title, subtitle, titleSize, titlePos, panels[]}.
 *  `photos`: array of images (or nulls) indexed by panel.photo. Deterministic. */
export function drawCover(ctx, W, H, state, photos) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const gutter = Math.max(4, Math.round(Math.min(W, H) * 0.012));
  const bandH = Math.round(H * 0.21);
  const top = state.titlePos === 'top';
  const band = { x: 0, y: top ? 0 : H - bandH, w: W, h: bandH };
  const area = { x: 0, y: top ? bandH : 0, w: W, h: H - bandH };

  // White poster frame and gutters.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Photo panels.
  const rects = layoutPanels(state.layout);
  rects.forEach((r, i) => {
    const px = area.x + r[0] * area.w + gutter;
    const py = area.y + r[1] * area.h + gutter;
    const pw = r[2] * area.w - gutter * 2;
    const ph = r[3] * area.h - gutter * 2;
    const panel = (state.panels && state.panels[i]) || { photo: 0, zoom: 100, ox: 0, oy: 0, fit: false };
    const img = photos ? photos[panel.photo] : null;
    drawPanelPhoto(ctx, img, { x: px, y: py, w: pw, h: ph }, panel);
    // Sunset/neon grade wash over each panel.
    const wash = ctx.createLinearGradient(0, py, 0, py + ph);
    wash.addColorStop(0, grade.panelTop);
    wash.addColorStop(1, grade.panelBottom);
    ctx.fillStyle = wash;
    ctx.fillRect(px, py, pw, ph);
    // Thin inner keyline.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, gutter * 0.18);
    ctx.strokeRect(px, py, pw, ph);
  });

  drawTitleBlock(ctx, W, H, band, grade, state.title, state.subtitle, (state.titleSize || 100) / 100);

  // Vignette + grain for a printed-poster feel.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,4,20,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  const rand = seededRandom(W * 31 + H * 7 + (state.title || '').length);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const dots = Math.floor((W * H) / 2600);
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < dots / 2; i++) {
    ctx.fillRect(rand() * W, rand() * H, 1.2, 1.2);
  }
}
