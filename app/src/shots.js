// Fixed scenes for reproducible screenshots: ?shot=cover renders one exported
// cover full-screen; ?shot=editor shows the editor with demo photos loaded.
// Query knobs: layout, grade, title, subtitle, size (1080x1350 etc),
// photo (sample name, or comma list), titleSize, titlePos. Sets
// window.__shotReady once the scene has painted.
export function parseShot(query) {
  const shot = query.get('shot') || 'editor';
  const size = (query.get('size') || '1080x1350').split('x').map(Number);
  return {
    shot,
    layout: query.get('layout') || 'hero3',
    grade: query.get('grade') || 'sunset',
    title: query.get('title') || query.get('caption') || 'VICE CITY NIGHTS',
    subtitle: query.get('subtitle') || 'One night. Every story.',
    titleSize: Number(query.get('titleSize') || 100),
    titlePos: query.get('titlePos') || 'bottom',
    photos: (query.get('photo') || 'boulevard,pier').split(',').map((s) => s.trim()).filter(Boolean),
    sizeW: size[0] || 1080,
    sizeH: size[1] || 1350,
  };
}

export function markShotReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
