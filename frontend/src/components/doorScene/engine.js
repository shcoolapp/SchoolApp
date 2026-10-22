import { CONFIG as C, TIMING as T } from './doorConfig';

const MARKUP = `<svg id="sv" viewBox="0 0 600 700" aria-hidden="true">
<defs>
<pattern id="brk" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" style="fill:var(--brick)"/><path d="M0 0H40M0 10H40M20 0V10M0 10V20M40 10V20" fill="none" style="stroke:var(--brickDark)" stroke-opacity=".45" stroke-width="1.4"/></pattern>
<linearGradient id="hf"><stop offset="0" stop-color="#000"/><stop offset=".22" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="wm"><rect width="600" height="700" fill="url(#hf)"/></mask>
<clipPath id="dc"><path id="archClip"/></clipPath>
</defs>
<g id="A">
 <g mask="url(#wm)"><rect width="600" height="700" fill="url(#brk)"/></g>
 <path id="frame" fill="none" style="stroke:var(--cobalt)" stroke-width="84" stroke-linejoin="round"/>
 <path id="back" fill="none" style="stroke:var(--navy)" stroke-width="72" stroke-linejoin="round"/>
 <g id="band"></g>
 <path id="archFill" style="fill:var(--bg)"/>
 <path id="archLine" fill="none"/>
 <g clip-path="url(#dc)">
  <g id="LL"><g id="leaf"></g></g>
  <g id="LR"><use href="#leaf" transform="translate(600 0) scale(-1 1)"/></g>
 </g>
</g>
<g id="B" display="none"><g id="CB">
 <rect id="nb" x="150" y="170" width="300" height="360" rx="14" fill="#fff" stroke="#000" stroke-width="8"/>
 <g id="nbd">
  <g id="lines" stroke="#000" stroke-opacity=".18" stroke-width="2"></g>
  <g id="rings"></g>
  <clipPath id="wc"><rect id="wr"/></clipPath>
  <text id="tx" x="300" text-anchor="middle" direction="rtl" fill="#000" clip-path="url(#wc)"></text>
  <circle id="per" r="6" fill="#000" opacity="0"/>
 </g>
 <g id="pen"><g transform="rotate(32)"><path d="M0 0L-5 -16H5Z" fill="#000"/><rect x="-5" y="-86" width="10" height="70" fill="#fff" stroke="#000" stroke-width="3"/><rect x="-5" y="-98" width="10" height="12" fill="#000"/></g></g>
</g></g>
<rect id="veil" x="-1000" y="-1000" width="2600" height="2700" style="fill:var(--bg)" opacity="0"/>
</svg>`;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (u, r) => clamp((u - r[0]) / (r[1] - r[0]));
const eIn = (k) => k * k * k;
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const BASE = 384;

const star = (cx, cy, R, r, n = 8) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const q = i % 2 ? r : R;
    return (cx + q * Math.cos(a)).toFixed(1) + ',' + (cy + q * Math.sin(a)).toFixed(1);
  }).join(' ');

/**
 * Builds the animated door inside `root` and returns { play, success, fail, reset, destroy }.
 * Colors come from the CSS variables set by the page (see paletteVars in doorConfig.js).
 */
export function createDoorScene(root) {
  root.innerHTML = MARKUP;
  const $ = (id) => root.querySelector('#' + id);
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mq = window.matchMedia('(orientation:portrait)');
  const fit = () => $('sv').setAttribute('preserveAspectRatio', mq.matches ? 'xMidYMid slice' : 'xMidYMid meet');
  fit();
  mq.addEventListener('change', fit); // portrait: crop the side walls so the door still reaches the top and bottom

  /* ---- static art ---- */
  ['archClip', 'archFill'].forEach((i) => $(i).setAttribute('d', C.arch + 'Z'));
  ['archLine', 'back', 'frame'].forEach((i) => $(i).setAttribute('d', C.arch));

  (function leaf() { // vertical wooden slabs with grain, nails and an old ring handle (the right leaf is the mirror image)
    const n = C.planks, pw = 140 / n;
    let s = '<rect x="160" y="30" width="140" height="672" style="fill:var(--brickDark)"/>';
    for (let i = 0; i < n; i++) {
      const x = 160 + i * pw;
      s += `<rect x="${x}" y="30" width="${pw}" height="672" fill="#fff" opacity="${i % 2 ? 0.07 : 0}"/>
<path d="M${x + pw * 0.3} 40C${x + pw * 0.45} 220 ${x + pw * 0.15} 420 ${x + pw * 0.35} 690M${x + pw * 0.7} 40C${x + pw * 0.55} 260 ${x + pw * 0.85} 460 ${x + pw * 0.65} 690" fill="none" stroke="#4A3224" stroke-opacity=".45" stroke-width="1.2"/>
<path d="M${x} 30V702" stroke="#3A271B" stroke-width="3"/>
<circle cx="${x + pw / 2}" cy="70" r="2.6" style="fill:var(--gold)"/><circle cx="${x + pw / 2}" cy="660" r="2.6" style="fill:var(--gold)"/>`;
    }
    s += `<path d="M299 30V702" stroke="#3A271B" stroke-width="3"/>
<circle cx="278" cy="420" r="13" fill="#3A271B"/><circle cx="278" cy="420" r="6" style="fill:var(--gold)"/>
<circle cx="278" cy="445" r="14" fill="none" style="stroke:var(--gold)" stroke-width="4"/><circle cx="278" cy="445" r="14" fill="none" stroke="#3A271B" stroke-opacity=".35" stroke-width="1"/>`;
    $('leaf').innerHTML = s;
  })();

  (function band() { // muqarnas band: small pointed niches stacked in tiers along the arch
    const P = $('archLine'), L = P.getTotalLength(), cols = ['cobalt', 'turq', 'white', 'gold'];
    let h = '';
    C.muqarnas.forEach(([off, w, hh, sh], ti) => {
      const sp = 13, n = Math.floor(L / sp);
      for (let i = 0; i < n; i++) {
        const s = ((i + sh) * sp + sp / 2) % L;
        const a = P.getPointAtLength(Math.max(0, s - 0.5)), b = P.getPointAtLength(Math.min(L, s + 0.5)), p = P.getPointAtLength(s);
        let tx = b.x - a.x, ty = b.y - a.y;
        const m = Math.hypot(tx, ty) || 1;
        tx /= m; ty /= m;
        const nx = ty, ny = -tx;
        h += `<path transform="matrix(${tx} ${ty} ${nx} ${ny} ${p.x + nx * off} ${p.y + ny * off})" d="M${-w / 2} 0V${hh * 0.45}Q${-w / 2} ${hh * 0.8} 0 ${hh}Q${w / 2} ${hh * 0.8} ${w / 2} ${hh * 0.45}V0Z" style="fill:var(--${cols[(i + ti) % 4]});stroke:var(--navy)" stroke-width=".8"/>`;
      }
    });
    $('band').innerHTML = h;
  })();

  $('lines').innerHTML = [0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M172 ${200 + 46 * i}H428"/>`).join('');
  $('rings').innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="150" cy="${210 + 50 * i}" r="8" fill="#fff" stroke="#000" stroke-width="4"/>`).join('');

  /* ---- text layout (needs the font) ---- */
  const tx = $('tx'), per = $('per');
  let TB = { x: 200, w: 200 };
  function layout() {
    tx.textContent = C.text;
    tx.setAttribute('y', BASE);
    tx.setAttribute('font-size', C.fontSize);
    tx.style.fontFamily = C.font;
    tx.style.fontWeight = C.fontWeight;
    const b = tx.getBBox();
    TB = { x: b.x, w: b.width };
    per.setAttribute('cx', b.x - 14);
    per.setAttribute('cy', BASE - 4);
    $('wr').setAttribute('y', BASE - 75);
    $('wr').setAttribute('height', 115);
  }
  layout();
  if (document.fonts) {
    document.fonts.load('40px KufiFont', C.text).then(layout).catch(() => {});
    document.fonts.ready.then(layout);
  }

  /* ---- timeline: everything is a function of time (the numbers come from TIMING) ---- */
  function pose(u) {
    const p = { u }, g = eOut(seg(u, T.grow)), pn = eIO(seg(u, T.pan));
    p.open = eIO(seg(u, T.open));
    p.bO = seg(u, [T.grow[0], T.grow[0] + 0.3]);
    p.aZ = 1 + 0.6 * eIn(seg(u, T.push));
    p.aO = 1 - seg(u, T.push); // the door scene pushes in and fades as the notebook grows
    p.w = seg(u, T.write);
    p.ay = lerp(C.ctr.y, 350, g); // notebook drifts from the doorway to the screen centre
    p.fx = lerp(300, TB.x - 14, pn);
    p.fy = lerp(350, BASE - 4, pn); // the pan aims straight at the final dot; the dive keeps zooming on it
    p.z2 = lerp(0.22, 1, g) * lerp(1, 2.4, pn) * (1 + 69 * eIn(seg(u, T.dive)));
    p.penFade = 1 - seg(u, [T.pan[0], T.pan[0] + 0.5]);
    p.veil = eIO(seg(u, T.whiten)); // white fades in while zooming to the dot
    return p;
  }
  const START = T.grow[0] + 0.3, END = T.dive[1], L2 = T.restart + (END - START);
  function timeline(lt) { // later loops: fade from white back to the door with the small notebook already there
    if (lt < END) return pose(lt);
    const v = (lt - END) % L2;
    if (v < T.restart) { const p = pose(START); p.veil = 1 - eOut(v / T.restart); return p; }
    return pose(START + v - T.restart);
  }
  function failPose(ft, b) { // scene fades, camera backs away from the door, door shuts
    const p = Object.assign({}, b);
    p.bO = b.bO * (1 - seg(ft, [0, 0.7]));
    p.aO = lerp(b.aO, 1, seg(ft, [0, 0.8]));
    p.aZ = lerp(b.aZ, 1, eOut(seg(ft, [0, 1])));
    p.veil = b.veil * (1 - seg(ft, [0, 0.5]));
    p.open = lerp(b.open, 0, eIO(seg(ft, [1.2, 2.3])));
    return p;
  }
  const IDLE = pose(-1);

  /* ---- drawing ---- */
  let vOk = 0;
  function render(p) {
    const c = C.ctr;
    $('A').setAttribute('transform', `translate(${c.x} ${c.y}) scale(${p.aZ}) translate(${-c.x} ${-c.y})`);
    $('A').setAttribute('opacity', p.aO);
    const s = lerp(1, 0.12, p.open);
    $('LL').setAttribute('transform', `translate(160 0) scale(${s} 1) translate(-160 0)`);
    $('LR').setAttribute('transform', `translate(440 0) scale(${s} 1) translate(-440 0)`);
    $('B').setAttribute('display', p.bO > 0.01 ? 'inline' : 'none');
    $('B').setAttribute('opacity', p.bO);
    $('CB').setAttribute('transform', `translate(300 ${p.ay}) scale(${p.z2}) translate(${-p.fx} ${-p.fy})`);
    const right = TB.x + TB.w + 4, wx = right - p.w * (TB.w + 8), writing = p.w > 0 && p.w < 1 ? 1 : 0;
    $('wr').setAttribute('x', wx);
    $('wr').setAttribute('width', right - wx);
    per.setAttribute('opacity', p.w >= 1 ? 1 : 0);
    $('pen').setAttribute('opacity', p.penFade);
    $('pen').setAttribute('transform', `translate(${wx} ${BASE - 10 + Math.sin(p.u * 8) * 4 * writing})`);
    $('veil').setAttribute('opacity', Math.max(p.veil, vOk));
  }

  /* ---- controller ---- */
  const S = { m: 'idle', last: IDLE, t0: 0, f0: 0, o0: 0, cb: null, done: false, timer: 0 };
  let last = 0, raf = 0, dead = false;
  const clearTimer = () => { clearTimeout(S.timer); S.timer = 0; };

  function tick(now) {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    if (now - last < 1000 / C.fps) return;
    last = now;
    if (S.m === 'idle') { render(IDLE); return; }
    if (S.m === 'static') { render(pose(START)); return; }
    if (S.m === 'play') { S.last = timeline((now - S.t0) / 1000); render(S.last); return; }
    if (S.m === 'fail') {
      const ft = (now - S.f0) / 1000;
      render(failPose(ft, S.last));
      if (ft > 2.4) S.m = 'idle';
      return;
    }
    if (S.m === 'ok') { // success: the scene keeps going and fades to white, then the portal opens
      S.last = timeline((now - S.t0) / 1000);
      const ot = (now - S.o0) / 1000;
      vOk = eIO(seg(ot, [0, 1.2]));
      render(S.last);
      if (ot > 1.4 && !S.done) { S.done = true; S.cb && S.cb(); }
    }
  }
  raf = requestAnimationFrame(tick);

  return {
    play() { clearTimer(); vOk = 0; S.m = RM ? 'static' : 'play'; S.t0 = performance.now(); },
    fail() { if (S.m === 'play' || S.m === 'static') { clearTimer(); S.m = RM ? 'idle' : 'fail'; S.f0 = performance.now(); } },
    success(cb) {
      let fired = false;
      const fire = () => { if (!fired) { fired = true; clearTimer(); cb && cb(); } };
      if (RM) { fire(); return; }
      S.m = 'ok'; S.o0 = performance.now(); S.cb = fire; S.done = false;
      S.timer = setTimeout(fire, C.successFallbackSec * 1000); // frames pause in a hidden tab; don't get stuck
    },
    reset() { clearTimer(); S.m = 'idle'; vOk = 0; },
    destroy() { dead = true; cancelAnimationFrame(raf); clearTimer(); mq.removeEventListener('change', fit); root.innerHTML = ''; }
  };
}
