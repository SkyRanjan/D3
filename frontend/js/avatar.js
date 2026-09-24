/* Avatar engine — particle UST mark inside circular HUD (voice mode visual). */
const Avatar = (() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const C = { r: 79, g: 208, b: 240 };
  let W, H, CX, CY, R, particles = [], state = 'idle', stateT = 0, t = 0;
  let amp = 0, ampSmooth = 0, ampSource = () => 0;

  function buildLogoPts() {
    const s = 400, off = document.createElement('canvas'); off.width = off.height = s;
    const o = off.getContext('2d');
    o.fillStyle = '#000'; o.textBaseline = 'middle'; o.textAlign = 'center';
    o.font = '900 150px "Arial Black","Helvetica Neue",Helvetica,Arial,sans-serif';
    o.fillText('U', 115, 105); o.fillText('S', 115, 290); o.fillText('T', 290, 290); o.fillRect(258, 75, 62, 62);
    const d = o.getImageData(0, 0, s, s).data, pts = [];
    for (let y = 0; y < s; y += 5) for (let x = 0; x < s; x += 5)
      if (d[(y * s + x) * 4 + 3] > 128) pts.push({ x: (x - s / 2) / s, y: (y - s / 2) / s });
    return pts;
  }
  const logoPts = buildLogoPts();

  const sprite = document.createElement('canvas');
  (() => { const s = 32; sprite.width = sprite.height = s; const g = sprite.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, `rgba(${C.r},${C.g},${C.b},1)`); gr.addColorStop(.25, `rgba(${C.r},${C.g},${C.b},.6)`); gr.addColorStop(1, `rgba(${C.r},${C.g},${C.b},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, s, s); })();

  function initParticles() {
    const sc = R * .95;
    particles = logoPts.map(p => { const hx = p.x * sc, hy = p.y * sc;
      return { hx, hy, x: hx, y: hy, ang: Math.atan2(hy, hx) + (Math.random() - .5) * .9,
        seed: Math.random() * 6.28, speed: .6 + Math.random() * .8, size: 1.2 + Math.random() * 1.6, phase: Math.random() }; });
  }
  function resize() {
    const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
    canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2; CY = H / 2 - 20; R = Math.min(W, H) * .17; initParticles();
  }
  window.addEventListener('resize', resize); resize();

  const rgba = a => `rgba(${C.r},${C.g},${C.b},${a})`;
  function ring(rad, a, w, dash, rot) { ctx.save(); ctx.translate(CX, CY); ctx.rotate(rot || 0); ctx.strokeStyle = rgba(a); ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.arc(0, 0, rad, 0, 6.283); ctx.stroke(); ctx.restore(); }
  function arc(rad, s, l, a, w) { ctx.strokeStyle = rgba(a); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(CX, CY, rad, s, s + l); ctx.stroke(); }
  function ticks(rad, n, a, len) { ctx.strokeStyle = rgba(a); ctx.lineWidth = 1; for (let i = 0; i < n; i++) { const an = i / n * 6.283, l = i % 5 ? len : len * 1.8; ctx.beginPath(); ctx.moveTo(CX + Math.cos(an) * rad, CY + Math.sin(an) * rad); ctx.lineTo(CX + Math.cos(an) * (rad + l), CY + Math.sin(an) * (rad + l)); ctx.stroke(); } }

  function frame() {
    t += 1 / 60; stateT += 1 / 60;
    amp = state === 'speaking' || state === 'listening' ? ampSource() : 0;
    ampSmooth += (amp - ampSmooth) * (amp > ampSmooth ? .35 : .08);
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(CX, CY, R * .3, CX, CY, R * 3.4);
    bg.addColorStop(0, rgba(.06 + ampSmooth * .14)); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const outer = R * 2.15, br = state === 'listening' ? Math.sin(t * 2) * 4 + ampSmooth * 10 : 0;
    ring(outer + br, .55 + ampSmooth * .4, 1.6); ring(outer + 16 + br, .12, 1); ticks(outer + 6 + br, 60, .35, 4);
    const rot = t * (state === 'thinking' ? 1.8 : state === 'speaking' ? .9 : .25);
    for (let i = 0; i < 3; i++) arc(outer + 28 + br, rot + i * 2.094, 1.1, .5, 2.2);
    for (let i = 0; i < 4; i++) arc(outer - 12 + br, -rot * .6 + i * 1.571, .565, .25, 1.2);
    ring(R * 1.35, .14, 1, [3, 9], -rot * .4);
    if (state === 'speaking' || state === 'thinking') for (let k = 0; k < 3; k++) {
      const p = (t * .55 + k / 3) % 1; ring(R * 1.2 + p * (outer - R * 1.35), (1 - p) * (.18 + ampSmooth * .25), 1); }

    const dissolve = state === 'speaking' ? Math.min(1, stateT * 1.4) : Math.max(0, 1 - stateT * 1.6);
    const spread = dissolve * (.35 + ampSmooth * 1.15);
    const swirl = state === 'thinking' ? Math.min(1, stateT * 1.2) : Math.max(0, 1 - stateT * 1.6);

    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      let tx, ty;
      if (dissolve > 0) {
        const wob = Math.sin(t * 3 * p.speed + p.seed) * .5 + .5, dir = p.ang + Math.sin(t * .8 + p.seed) * .35;
        const dist = R * (.3 + wob * .5 + p.phase * .4) * spread;
        tx = p.hx * (1 - dissolve * .7) + Math.cos(dir) * dist + Math.sin(t * 2.4 * p.speed + p.seed * 3) * 6 * dissolve;
        ty = p.hy * (1 - dissolve * .7) + Math.sin(dir) * dist + Math.cos(t * 2.1 * p.speed + p.seed * 2) * 6 * dissolve;
      } else if (swirl > 0) {
        const a = Math.atan2(p.hy, p.hx) + swirl * t * 1.4 + Math.sin(p.seed) * swirl * .4;
        const d = Math.hypot(p.hx, p.hy) * (1 + swirl * .25 * Math.sin(t * 2 + p.seed));
        tx = Math.cos(a) * d; ty = Math.sin(a) * d;
      } else {
        const j = state === 'listening' ? 1.2 + ampSmooth * 4 : .4;
        tx = p.hx + Math.sin(t * 1.5 + p.seed) * j; ty = p.hy + Math.cos(t * 1.3 + p.seed) * j;
      }
      p.x += (tx - p.x) * (dissolve > 0 ? .14 : .1); p.y += (ty - p.y) * (dissolve > 0 ? .14 : .1);
      const fl = .7 + .3 * Math.sin(t * 6 * p.speed + p.seed);
      ctx.globalAlpha = (dissolve > 0 ? .55 + ampSmooth * .45 : .9) * fl;
      const s = p.size * (1 + dissolve * (.8 + ampSmooth * 1.4)) * 4;
      ctx.drawImage(sprite, CX + p.x - s / 2, CY + p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    if (state === 'speaking') {
      const wy = CY + R * 1.55, ww = R * 1.5;
      ctx.strokeStyle = rgba(.35 + ampSmooth * .5); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 80; i++) { const x = CX - ww / 2 + i / 80 * ww, e = Math.sin(i / 80 * Math.PI);
        const y = wy + Math.sin(i * .6 + t * 14) * 8 * e * ampSmooth + Math.sin(i * 1.3 - t * 9) * 4 * e * ampSmooth;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    if (running) requestAnimationFrame(frame);
  }
  let running = false;

  return {
    start() { if (running) return; running = true; resize(); frame(); },
    stop() { running = false; },
    setState(s) { if (s === state) return; state = s; stateT = 0; document.getElementById('stateLabel').textContent = s[0].toUpperCase() + s.slice(1); },
    setAmpSource(fn) { ampSource = fn; },
    get state() { return state; }
  };
})();
