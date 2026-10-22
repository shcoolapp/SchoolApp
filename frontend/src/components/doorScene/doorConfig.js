// Everything you may want to tweak for the animated login door lives in this file.

/* ===== TIMING: yours to tune (all in seconds, [start, end]) ===== */
export const TIMING = {
  open: [0, 1.6],       // door leaves swing open
  push: [1.6, 4.2],     // the door scene pushes in and fades out while the notebook grows
  grow: [4.4, 4.8],     // small notebook + pencil appear in the doorway and grow
  write: [4.8, 8.4],    // the pencil writes the sentence
  pan: [8.4, 9.8],      // camera moves toward the final dot
  dive: [9.8, 12.4],    // camera zooms toward the final dot
  whiten: [10.6, 12.4], // the screen fades to white during the zoom (end of the loop)
  restart: 1.0          // length of the fade from white back into the door when the loop starts again
};

/* ===== DESIGN ===== */
export const CONFIG = {
  fps: 12, // animation frame rate (keep under 20 for the stop-motion look)
  text: 'العلم نور',
  fontSize: 58,
  fontWeight: 400,
  font: "'KufiFont','Noto Kufi Arabic',Tahoma,sans-serif", // KufiFont is loaded in doorLogin.css
  colors: {
    bg: '#FFFFFF', // page background AND the inside of the open door
    brick: '#B68E6B',
    brickDark: '#7A5640',
    cobalt: '#24508C',
    navy: '#14295A',
    turq: '#23808C',
    gold: '#C9A24B',
    white: '#EDEFF0',
    rose: '#985251'
  },
  // door outline: top of the scene to the bottom, 280 wide, broad shoulders and a blunt point. The tile band follows it.
  arch: 'M160,700 L160,300 C160,230 190,175 230,130 C258,94 284,66 300,52 C316,66 342,94 370,130 C410,175 440,230 440,300 L440,700',
  planks: 5, // wooden slabs per door leaf
  ctr: { x: 300, y: 420 }, // where the notebook first appears (inside the doorway)
  muqarnas: [[24, 12, 12, 0], [14, 13, 13, 0.5], [4, 14, 14, 0]], // tiers: [offset, width, height, shift]
  successFallbackSec: 3 // if the tab is hidden and frames pause, still continue after this many seconds
};

// The palette as CSS variables; the login page sets these on its wrapper so the scene and the form share them.
export const paletteVars = Object.fromEntries(Object.entries(CONFIG.colors).map(([k, v]) => ['--' + k, v]));
