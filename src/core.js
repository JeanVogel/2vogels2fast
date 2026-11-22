// ===== 2 Vogels 2 Fast — núcleo (pistas, carros, física, ghost). Sem dependências. =====
export const G = 14;          // gravidade arcade (m/s²)
export const HALF_W = 5.5;    // meia largura da pista (m)
export const CAR_HALF = 1.0;
export const GROUND = -0.6;
export const TIRE_MU = 1.5;
export const WALL_RUB = 12;
export const WALL_HIT = 0.22;   // perda mínima de velocidade por pancada
export const SLIDE_SCRUB = 0.35; // quanto a derrapagem segura o carro (menos que o freio)     // desaceleração ao raspar na mureta (m/s²)   // aderência base dos pneus (×G)

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- carros ----------
// hp/massa reais aproximados; aceleração e velocidade final comprimidas para jogo arcade
const mk = (id, name, year, engine, hp, mass, top, color, colorName, body, extra = {}) => {
  const pw = hp / mass * 1000;
  return { id, name, year, engine, hp, mass, top, color, colorName, body,
    vmax: top / 3.6, acc: 4.6 + 0.052 * pw, steer: extra.steer ?? 1.0, grip: extra.grip ?? 1.0, ...extra };
};
export const CARS = [
  mk('escort', 'Ford Escort Hobby', 1996, '1.0 · 50 cv', 50, 900, 148, '#18264a', 'Azul-marinho', 'hatch3', { steer: 1.05 }),
  mk('corsa', 'Chevrolet Corsa Classic', 2001, '1.0 · 60 cv', 60, 900, 155, '#c0121f', 'Vermelho', 'sedan', { steer: 1.05 }),
  mk('p206', 'Peugeot 206', 2002, '1.6 · 110 cv', 110, 1040, 188, '#b9bec6', 'Prata', 'hatch5', { steer: 1.1 }),
  mk('golf', 'Volkswagen Golf', 2001, '2.0 · 116 cv', 116, 1220, 192, '#1d5a3a', 'Verde', 'hatch5b', { grip: 1.05 }),
  mk('p307', 'Peugeot 307', 2004, '2.0 · 138 cv', 138, 1300, 204, '#6a6e75', 'Cinza', 'hatchTall'),
  mk('megane', 'Renault Mégane Grand Tour', 2012, '1.6 · 115 cv', 115, 1300, 186, '#121316', 'Preta', 'wagon', { steer: 0.95 }),
  mk('rsq3', 'Audi RS Q3', 2016, '2.5 TFSI · 340 cv', 340, 1700, 250, '#b00018', 'Vermelha', 'suv', { grip: 1.15, steer: 0.95 }),
  mk('c4r', 'Citroën C4 VTR', 2009, '2.0 · 143 cv', 143, 1300, 205, '#a10d16', 'Vermelho', 'coupe', { steer: 1.05 }),
  mk('c4b', 'Citroën C4 VTR', 2008, '2.0 · 143 cv', 143, 1300, 205, '#0c0c0f', 'Preto', 'coupe', { steer: 1.05 }),
];
export const carById = id => CARS.find(c => c.id === id) || CARS[0];

// ---------- vetores ----------
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const V = { add, sub, mul, dot, cross, len, norm, lerp3 };

// ---------- gerador de pistas ----------
export const THEMES = ['campo', 'deserto', 'cidade'];
export const FLAG_GAP = 1, FLAG_LOOP = 2, FLAG_RAMP = 4, FLAG_BRIDGE = 8;

function eulerFrame(yaw, pitch, bank) {
  const F = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
  const R0 = [-Math.cos(yaw), 0, Math.sin(yaw)];
  const U0 = cross(R0, F);
  const c = Math.cos(bank), s = Math.sin(bank);
  return { F, R0, U: [U0[0] * c - R0[0] * s, U0[1] * c - R0[1] * s, U0[2] * c - R0[2] * s] };
}

// cada peça devolve passos de 1 m: {dyaw, dpitch, bank, flag, shift}
const ease = (i, n) => Math.sin(Math.PI * (i + 0.5) / n) ** 2;
const P = {
  straight(L) { return Array.from({ length: L }, () => ({ dyaw: 0, dpitch: 0, bank: 0, flag: 0 })); },
  curve(angle, radius, bankMax) {
    const n = Math.max(8, Math.round(Math.abs(angle) * radius));
    let sum = 0; for (let i = 0; i < n; i++) sum += ease(i, n);
    return Array.from({ length: n }, (_, i) => ({ dyaw: angle * ease(i, n) / sum, dpitch: 0,
      bank: Math.sign(angle) * bankMax * Math.sin(Math.PI * (i + 0.5) / n), flag: 0 }));
  },
  // perfil de inclinação absoluto -> convertido em dpitch
  profile(n, fn, flagFn = () => 0) {
    const out = []; let prev = fn(0);
    for (let i = 0; i < n; i++) { const t = fn((i + 1) / n); out.push({ dyaw: 0, dpitch: t - prev, bank: 0, flag: flagFn(i / n) }); prev = t; }
    return out;
  },
  hill(n, amp) { return P.profile(n, t => amp * Math.sin(2 * Math.PI * t)); },
  rise(n, amp) { return P.profile(n, t => amp * Math.sin(Math.PI * t), () => FLAG_BRIDGE); },
  jump(gap, alpha) {
    const up = P.profile(26, t => alpha * (1 - Math.cos(Math.PI * t)) / 2, () => FLAG_RAMP);
    const mid = P.profile(gap, t => alpha * (1 - 2 * t), () => FLAG_GAP);
    const down = P.profile(26, t => -alpha * (1 + Math.cos(Math.PI * t)) / 2, () => FLAG_RAMP);
    return [...up, ...mid, ...down];
  },
  loop(r, side) {
    const n = Math.round(2 * Math.PI * r);
    let sum = 0; for (let i = 0; i < n; i++) sum += ease(i, n);
    return Array.from({ length: n }, (_, i) => ({ dyaw: 0, dpitch: 2 * Math.PI / n, bank: 0, flag: FLAG_LOOP,
      shift: side * 12 * ease(i, n) / sum }));
  },
};

// tempo-alvo de ~2 min: comprimento proporcional à velocidade média esperada do carro
export function targetLength(car) { return Math.round(120 * avgSpeed(car)); }
export function avgSpeed(car) { return 13.5 + 0.318 * car.vmax; } // calibrado com piloto automático

export function genTrack(seed, carId) {
  const car = carById(carId);
  const R = rng(seed * 7919 + 13);
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const range = (a, b) => a + (b - a) * R();
  const target = targetLength(car);
  const theme = THEMES[Math.floor(R() * THEMES.length)];

  // estado da tartaruga
  const st = { x: 0, y: 0.0, z: 0, yaw: R() * Math.PI * 2, pitch: 0 };
  const pts = [], yaws = [], pitches = [], banks = [], flags = [];
  const pieces = []; // {start, kind, state}
  const CELL = 12; let grid = new Map();
  const key = (x, z) => ((Math.floor(x / CELL) + 5000) * 10007 + Math.floor(z / CELL) + 5000);
  const gridAdd = (i) => { const p = pts[i]; const k = key(p[0], p[2]); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); };
  const rebuildGrid = () => { grid = new Map(); for (let i = 0; i < pts.length; i++) gridAdd(i); };

  function simulate(steps) {
    // devolve posições candidatas sem gravar
    let { x, y, z, yaw, pitch } = st; const out = [];
    for (const s of steps) {
      yaw += s.dyaw; pitch += s.dpitch;
      const f = eulerFrame(yaw, pitch, 0);
      x += f.F[0]; y += f.F[1]; z += f.F[2];
      if (s.shift) { x += f.R0[0] * s.shift; z += f.R0[2] * s.shift; }
      out.push({ p: [x, y, z], yaw, pitch, bank: s.bank, flag: s.flag });
    }
    return out;
  }
  function collides(cand) {
    const limit = pts.length - 45;
    for (let j = 0; j < cand.length; j += 2) {
      const p = cand[j].p;
      if (p[1] < -0.45 || p[1] > 34) return true;
      if (cand[j].flag & FLAG_LOOP) continue;
      const cx = Math.floor(p[0] / CELL), cz = Math.floor(p[2] / CELL);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const a = grid.get((cx + dx + 5000) * 10007 + cz + dz + 5000); if (!a) continue;
        for (const i of a) {
          if (i > limit) continue;
          const q = pts[i];
          if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 22 && Math.abs(q[1] - p[1]) < 11) return true;
        }
      }
    }
    return false;
  }
  function commit(kind, cand) {
    pieces.push({ start: pts.length, kind, st: { ...st } });
    for (const c of cand) {
      pts.push(c.p); yaws.push(c.yaw); pitches.push(c.pitch); banks.push(c.bank); flags.push(c.flag); gridAdd(pts.length - 1);
    }
    const last = cand[cand.length - 1];
    st.x = last.p[0]; st.y = last.p[1]; st.z = last.p[2]; st.yaw = last.yaw;
    st.pitch = Math.abs(last.pitch % (2 * Math.PI)) < 1e-6 ? 0 : last.pitch % (2 * Math.PI);
    if (Math.abs(st.pitch) < 1e-3) st.pitch = 0;
  }
  function popPiece() {
    const pc = pieces.pop(); if (!pc) return;
    pts.length = pc.start; yaws.length = pc.start; pitches.length = pc.start; banks.length = pc.start; flags.length = pc.start;
    Object.assign(st, pc.st); rebuildGrid();
  }

  // menu de peças (com retas de aproximação embutidas para loops e saltos)
  let sinceLoop = 3, sinceJump = 2;
  function makePiece(kindHint) {
    const kinds = [];
    const add = (k, w) => { for (let i = 0; i < w; i++) kinds.push(k); };
    add('straight', 2); add('curve', 5); add('sweeper', 3); add('chicane', 2); add('hairpin', 1);
    add('hill', 2); if (st.y < 14) add('rise', 1); if (st.y > 6) add('fall', 2);
    if (sinceJump >= 2) add('jump', 4);
    if (sinceLoop >= 3) add('loop', 3);
    const k = kindHint || pick(kinds);
    const side = R() < 0.5 ? -1 : 1;
    switch (k) {
      case 'straight': return [k, P.straight(Math.round(range(30, 80)))];
      case 'curve': return [k, P.curve(side * range(0.5, 1.6), range(28, 55), range(0, 0.18))];
      case 'sweeper': return [k, P.curve(side * range(0.6, 1.4), range(70, 120), range(0.08, 0.2))];
      case 'hairpin': return [k, [...P.straight(20), ...P.curve(side * range(2.4, 3.0), range(26, 34), 0.32), ...P.straight(15)]];
      case 'chicane': { const a = range(0.35, 0.7), r = range(30, 45); return [k, [...P.curve(side * a, r, 0.08), ...P.straight(8), ...P.curve(-side * a, r, 0.08)]]; }
      case 'hill': return [k, [...P.straight(20), ...P.hill(Math.round(range(70, 110)), range(0.14, 0.26))]];
      case 'rise': return [k, P.rise(Math.round(range(70, 100)), range(0.12, 0.2))];
      case 'fall': { const n = Math.round(range(70, 100)); const amp = Math.min(0.2, st.y * Math.PI / (2 * n) * 0.9); return [k, P.rise(n, -amp)]; }
      case 'jump': { const al = range(0.22, 0.28), gap = Math.round(range(10, 15)); const reach = car.vmax ** 2 * Math.sin(2 * al) / G; const out = Math.round(Math.max(35, Math.min(170, reach - gap - 26 + 25))); return [k, [...P.straight(70), ...P.jump(gap, al), ...P.straight(out)]]; }
      case 'loop': return [k, [...P.straight(120), ...P.loop(Math.round(range(9, 11)), side), ...P.straight(40)]];
    }
  }

  commit('start', simulate(P.straight(70)));
  let fails = 0, guard = 0;
  while (pts.length < target - 60 && guard++ < 3000) {
    const [kind, steps] = makePiece();
    const cand = simulate(steps);
    if (!collides(cand)) {
      commit(kind, cand); fails = 0;
      sinceLoop = kind === 'loop' ? 0 : sinceLoop + 1;
      sinceJump = kind === 'jump' ? 0 : sinceJump + 1;
    } else if (++fails > 14) { popPiece(); if (pieces.length > 1) popPiece(); fails = 0; }
  }
  // termina no chão se estiver alto
  let extra = 0;
  while (st.y > 0.5 && extra++ < 6) { const n = 90; const amp = Math.min(0.2, st.y * Math.PI / (2 * n)); const c = simulate(P.rise(n, -amp)); commit('fall', c); }
  if (st.y !== 0) { /* corrige drift residual */ }
  commit('finish', simulate(P.straight(80)));

  return buildTrack({ seed, carId, theme, pts, yaws, pitches, banks, flags, pieces });
}

function buildTrack(t) {
  const n = t.pts.length;
  const P = new Float32Array(n * 3), T = new Float32Array(n * 3), U = new Float32Array(n * 3), Rr = new Float32Array(n * 3);
  const KN = new Float32Array(n), KG = new Float32Array(n), FL = new Uint8Array(n);
  for (let i = 0; i < n; i++) { P.set(t.pts[i], i * 3); FL[i] = t.flags[i]; }
  const getP = i => t.pts[Math.max(0, Math.min(n - 1, i))];
  const Ts = [];
  for (let i = 0; i < n; i++) {
    const tt = norm(sub(getP(i + 1), getP(i - 1)));
    const e = eulerFrame(t.yaws[i], t.pitches[i], t.banks[i]);
    const r = norm(cross(tt, e.U)); const u = cross(r, tt);
    Ts.push(tt); T.set(tt, i * 3); U.set(u, i * 3); Rr.set(r, i * 3);
  }
  for (let i = 0; i < n; i++) {
    const a = Ts[Math.max(0, i - 1)], b = Ts[Math.min(n - 1, i + 1)];
    const dT = mul(sub(b, a), 0.5);
    const u = [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]], r = [Rr[i * 3], Rr[i * 3 + 1], Rr[i * 3 + 2]];
    KN[i] = dot(dT, u); KG[i] = -dot(dT, r);
  }
  // checkpoints: início das peças em trechos normais
  const cps = [];
  for (const pc of t.pieces) { const i = pc.start + 2; if (i < n - 100 && !(FL[i] & (FLAG_GAP | FLAG_LOOP | FLAG_RAMP))) cps.push(i); }
  cps.unshift(12);
  const features = { loops: 0, jumps: 0, hairpins: 0 };
  for (const pc of t.pieces) { if (pc.kind === 'loop') features.loops++; if (pc.kind === 'jump') features.jumps++; if (pc.kind === 'hairpin') features.hairpins++; }
  const track = { seed: t.seed, carId: t.carId, theme: t.theme, n, length: n - 1, P, T, U, R: Rr, KN, KG, FL,
    start: 15, finish: n - 40, checkpoints: cps, pieces: t.pieces.map(p => ({ start: p.start, kind: p.kind })), features };
  // grade espacial para consultas de distância (cenário)
  const CELL = 20, grid = new Map();
  for (let i = 0; i < n; i += 2) { const k = Math.floor(P[i * 3] / CELL) + ',' + Math.floor(P[i * 3 + 2] / CELL); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
  track.distTo = (x, z) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); let best = 1e9;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const a = grid.get((cx + dx) + ',' + (cz + dz)); if (!a) continue;
      for (const i of a) { const d = Math.hypot(P[i * 3] - x, P[i * 3 + 2] - z); if (d < best) best = d; }
    }
    return best;
  };
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (let i = 0; i < n; i++) { minx = Math.min(minx, P[i * 3]); maxx = Math.max(maxx, P[i * 3]); minz = Math.min(minz, P[i * 3 + 2]); maxz = Math.max(maxz, P[i * 3 + 2]); }
  track.bounds = { minx, maxx, minz, maxz };
  return track;
}

export function frameAt(tr, s) {
  const sc = Math.max(0, Math.min(tr.n - 1.001, s));
  const i = Math.floor(sc), f = sc - i, j = i + 1;
  const g = (A, k) => [A[k * 3], A[k * 3 + 1], A[k * 3 + 2]];
  const p = lerp3(g(tr.P, i), g(tr.P, j), f);
  const T = norm(lerp3(g(tr.T, i), g(tr.T, j), f));
  let U = lerp3(g(tr.U, i), g(tr.U, j), f);
  const R = norm(cross(T, U)); U = cross(R, T);
  return { p, T, U, R, kn: tr.KN[i] * (1 - f) + tr.KN[j] * f, kg: tr.KG[i] * (1 - f) + tr.KG[j] * f, flag: tr.FL[f < 0.5 ? i : j], i };
}

// ---------- quaternions ----------
export function quatFromBasis(X, Y, Z) {
  const m00 = X[0], m10 = X[1], m20 = X[2], m01 = Y[0], m11 = Y[1], m21 = Y[2], m02 = Z[0], m12 = Z[1], m22 = Z[2];
  const tr = m00 + m11 + m22; let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
  const l = Math.hypot(x, y, z, w); return [x / l, y / l, z / l, w / l];
}
export function quatRotate(q, v) {
  const [x, y, z, w] = q; const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
function quatMul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
function quatAxis(ax, ang) { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; }
export function nlerpQ(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; const sg = d < 0 ? -1 : 1;
  const q = [0, 1, 2, 3].map(k => a[k] + (b[k] * sg - a[k]) * t); const l = Math.hypot(...q); return q.map(c => c / l);
}

// ---------- física ----------
export class Car {
  constructor(track, spec) { this.tr = track; this.spec = spec; this.events = []; this.crashes = 0; this.hitPts = 0; this.hitEp = 0; this.reset(track.start - 6); this.lastCP = 12; }
  reset(s) {
    this.mode = 'ground'; this.s = s; this.d = 0; this.v = 0; this.psi = 0; this.beta = 0;
    this.nitro = this.nitro ?? 1; this.airT = 0; this.crashT = 0; this.vel = [0, 0, 0]; this.slip = 0; this.wallHit = 0; this.touching = false; this.stun = 0;
    this.updatePose();
  }
  respawn() { this.reset(this.lastCP); this.events.push('respawn'); }
  crash(reason) {
    if (this.mode === 'crash') return;
    if (this.mode === 'ground') { this.updatePose(); this.vel = mul(this.fwd, this.v); }
    this.mode = 'crash'; this.crashT = 0; this.crashes++; this.events.push('crash');
    this.spin = [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8];
  }
  updatePose() {
    const f = frameAt(this.tr, this.s); this.f = f;
    const c = Math.cos(this.psi), s = Math.sin(this.psi);
    const fwd = norm(sub(mul(f.T, c), mul(f.R, s)));
    const up = f.U; const right = cross(fwd, up);
    this.fwd = fwd; this.up = up;
    this.pos = add(add(f.p, mul(f.R, this.d)), mul(f.U, 0.0));
    this.quat = quatFromBasis(mul(right, -1), up, fwd);
  }
  step(dt, inp) {
    const sp = this.spec;
    const nitroOn = inp.nitro && this.nitro > 0.01 && this.mode === 'ground' && inp.throttle > 0;
    this.nitroOn = nitroOn;
    if (nitroOn) this.nitro = Math.max(0, this.nitro - dt / 3.2); else this.nitro = Math.min(1, this.nitro + dt / 45);
    if (this.mode === 'ground') this.stepGround(dt, inp, nitroOn);
    else if (this.mode === 'air') this.stepAir(dt, inp);
    else this.stepCrash(dt);
    // contador de batidas: 1 ponto por segundo (iniciado) em contato com a mureta / desgovernado
    if (this.mode === 'ground' && (this.touching || this.stun > 0)) this.hitEp += dt;
    else if (this.hitEp > 0) { this.hitPts += Math.ceil(this.hitEp - 1e-6); this.hitEp = 0; this.events.push('hitpts'); }
  }
  stepGround(dt, inp, nitroOn) {
    const sp = this.spec, tr = this.tr;
    let f = frameAt(tr, this.s);
    if (f.flag & FLAG_GAP) { this.launch(); return; }
    if (this.stun > 0) { this.stun -= dt; inp = { ...inp, throttle: inp.throttle * 0.3, steer: inp.steer * 0.3, nitro: false }; nitroOn = false; }
    const vmax = sp.vmax * (nitroOn ? 1.15 : 1);
    let a = 0; const v = this.v;
    if (inp.throttle > 0 && v > -0.5) a += sp.acc * (nitroOn ? 1.6 : 1) * Math.max(0, 1 - (v / vmax) ** 2) * inp.throttle;
    if (inp.brake > 0) { if (v > 0.5) a -= 22 * inp.brake; else if (v > -9) a -= 7 * inp.brake; }
    if (!inp.throttle && !inp.brake) a -= Math.sign(v) * 2.0; // freio-motor
    if (v > vmax && !nitroOn) a -= (v - vmax) * 1.5;
    a -= 0.00035 * v * Math.abs(v);
    const c = Math.cos(this.psi), sn = Math.sin(this.psi);
    const fwdY = f.T[1] * c - f.R[1] * sn;
    a -= G * fwdY;
    this.v += a * dt;
    if (!inp.throttle && !inp.brake && Math.abs(this.v) < 0.3 && Math.abs(fwdY) < 0.05) this.v = 0;
    // direção
    const av = Math.abs(this.v);
    const rate = sp.steer * (1.9 - 1.0 * Math.min(1, av / sp.vmax)) * Math.min(1, av / 5) * (inp.handbrake ? 1.35 : 1);
    const omega = inp.steer * rate * Math.sign(this.v || 1);
    const vs = this.v * Math.cos(this.beta);
    this.psi += (omega - f.kg * vs) * dt;
    this.beta -= f.kg * vs * dt;
    // aderência: a direção da velocidade segue o bico do carro até o limite dos pneus
    const grip = sp.grip * (inp.handbrake ? 0.45 : 1);
    const k = Math.min(1, (5.5 + 4 * grip) * grip * dt);
    let dBeta = (this.psi - this.beta) * k;
    const load = Math.max(0, G * f.U[1] + vs * vs * f.kn);       // carga nos pneus (crista alivia, loop/vale aumenta)
    const mu = TIRE_MU * grip * load;                              // aceleração lateral máxima
    const gLat = G * f.R[1];                                    // ajuda da inclinação (curva compensada)
    const vv = Math.max(2, Math.abs(this.v)), sg = Math.sign(this.v || 1);
    let lo = (gLat - mu) / vv, hi = (gLat + mu) / vv; if (sg < 0) { const t = lo; lo = -hi; hi = -t; }
    dBeta = Math.max(lo * dt, Math.min(hi * dt, dBeta));
    this.beta += dBeta;
    // o bico não pode ficar atravessado demais (exceto com freio de mão)
    const maxSlip = inp.handbrake ? 1.1 : 0.32;
    const rel = Math.atan2(Math.sin(this.psi - this.beta), Math.cos(this.psi - this.beta));
    if (Math.abs(rel) > maxSlip) this.psi = this.beta + Math.sign(rel) * maxSlip;
    const slip = Math.sin(this.psi - this.beta); this.slip = slip;
    this.v -= Math.abs(slip) * this.v * SLIDE_SCRUB * dt;
    if (inp.handbrake && this.v > 0) this.v -= 3.5 * dt;
    // integra posição
    this.s += this.v * Math.cos(this.beta) * dt;
    this.d += -this.v * Math.sin(this.beta) * dt;
    if (this.s < 0) { this.s = 0; this.v = Math.max(0, this.v); }
    const lim = HALF_W - CAR_HALF;
    if (Math.abs(this.d) > lim) {
      const side = Math.sign(this.d);
      this.d = side * lim;
      // componente da velocidade que vai contra a mureta (0 = raspão, 1 = de frente)
      const into = -side * Math.sin(this.beta) * Math.sign(this.v || 1);
      if (into > 0) {
        // perda proporcional ao ângulo do impacto, aplicada uma vez por contato
        this.v *= 1 - Math.min(0.7, WALL_HIT + into * 1.0);
        if (into > 0.04) this.stun = Math.max(this.stun || 0, 0.45 + into * 1.2);
        // desvia levemente para dentro da pista, preservando parte da derrapagem
        const away = side * 0.03;
        this.psi = away + (this.psi - this.beta) * 0.3;
        this.beta = away;
        if (into > 0.08 && !this.touching) { this.wallHit = into; this.events.push('wall'); }
      }
      // atrito leve enquanto raspa
      this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), WALL_RUB * dt);
      this.touching = true;
    } else this.touching = false;
    this.psi = Math.atan2(Math.sin(this.psi), Math.cos(this.psi));
    this.beta = Math.atan2(Math.sin(this.beta), Math.cos(this.beta));
    // checkpoints
    const cps = tr.checkpoints;
    for (let i = cps.length - 1; i >= 0; i--) { if (this.s >= cps[i]) { if (cps[i] > this.lastCP) { this.lastCP = cps[i]; this.events.push('cp'); } break; } }
    // descolamento (loop lento / crista rápida)
    f = frameAt(tr, this.s);
    const vs2 = this.v * Math.cos(this.beta);
    const N = G * f.U[1] + vs2 * vs2 * f.kn;
    if (N < -0.4) {
      if (f.U[1] < 0.35) { this.updatePose(); this.crash('loop'); return; }
      this.launch(); return;
    }
    this.updatePose();
  }
  launch() {
    this.updatePose();
    const f = this.f; const c = Math.cos(this.beta), s = Math.sin(this.beta);
    const dir = sub(mul(f.T, c), mul(f.R, s));
    this.vel = mul(dir, this.v); this.mode = 'air'; this.airT = 0; this.sEst = this.s; this.prevH = 0.1; this.events.push('air');
  }
  stepAir(dt, inp) {
    const tr = this.tr;
    this.airT += dt;
    this.vel[1] -= G * dt;
    this.pos = add(this.pos, mul(this.vel, dt));
    // nariz acompanha velocidade + leve controle de guinada
    const speed = len(this.vel);
    if (speed > 2) {
      const want = norm(this.vel); const cur = quatRotate(this.quat, [0, 0, 1]);
      const ax = cross(cur, want); const al = len(ax);
      if (al > 1e-4) this.quat = norm4(quatMul(quatAxis(mul(ax, 1 / al), Math.min(Math.asin(Math.min(1, al)), 1.6 * dt)), this.quat));
    }
    if (inp.steer) this.quat = norm4(quatMul(quatAxis([0, 1, 0], inp.steer * 0.9 * dt), this.quat));
    // busca o ponto da pista mais próximo
    for (let it = 0; it < 6; it++) {
      const f = frameAt(tr, this.sEst);
      const step = dot(sub(this.pos, f.p), f.T);
      this.sEst = Math.max(0, Math.min(tr.n - 2, this.sEst + Math.max(-20, Math.min(20, step))));
      if (Math.abs(step) < 0.05) break;
    }
    const f = frameAt(tr, this.sEst);
    const rel = sub(this.pos, f.p); const d = dot(rel, f.R), h = dot(rel, f.U);
    const onW = Math.abs(d) < HALF_W + 0.4 && !(f.flag & FLAG_GAP);
    if (onW && h < 0.15 && h > -3.5 && this.prevH > -0.6 && f.U[1] > 0.2) {
      const up = quatRotate(this.quat, [0, 1, 0]);
      const impact = -dot(this.vel, f.U);
      if (dot(up, f.U) < 0.25 || impact > 26) { this.crash('landing'); return; }
      const fwd = quatRotate(this.quat, [0, 0, 1]);
      const vs = dot(this.vel, f.T), vl = dot(this.vel, f.R);
      this.s = this.sEst; this.d = Math.max(-(HALF_W - CAR_HALF), Math.min(HALF_W - CAR_HALF, d));
      this.v = Math.hypot(vs, vl) * Math.sign(vs) * (1 - Math.min(0.25, impact / 120));
      this.psi = Math.atan2(-dot(fwd, f.R), dot(fwd, f.T));
      this.beta = Math.atan2(-vl, Math.abs(vs)) * 0.5;
      this.mode = 'ground'; this.landImpact = impact; this.events.push('land');
      this.updatePose(); return;
    }
    this.prevH = onW ? h : 1;
    if ((!onW && this.pos[1] < GROUND + 0.35) || this.airT > 7) this.crash('ground');
  }
  stepCrash(dt) {
    this.crashT += dt;
    this.vel[1] -= G * dt; this.vel = mul(this.vel, 1 - 0.9 * dt);
    this.pos = add(this.pos, mul(this.vel, dt));
    if (this.pos[1] < GROUND + 0.4) { this.pos[1] = GROUND + 0.4; this.vel[1] = Math.abs(this.vel[1]) * 0.35; this.vel[0] *= 0.7; this.vel[2] *= 0.7; this.spin = mul(this.spin, 0.7); }
    const sp = this.spin; const ang = len(sp);
    if (ang > 1e-3) this.quat = norm4(quatMul(quatAxis(mul(sp, 1 / ang), ang * dt), this.quat));
    if (this.crashT > 1.7) this.respawn();
  }
  get penalty() { return this.hitPts + (this.hitEp > 0 ? Math.ceil(this.hitEp - 1e-6) : 0); }
  get speedKmh() { return this.mode === 'ground' ? Math.abs(this.v) * 3.6 : len(this.vel) * 3.6; }
  get gear() { const r = Math.abs(this.v) / this.spec.vmax; return this.v < -0.5 ? 'R' : r < 0.02 ? 'N' : String(Math.min(5, 1 + Math.floor(r * 5.2))); }
  get rpm() { const r = Math.min(1.1, Math.abs(this.mode === 'ground' ? this.v : len(this.vel)) / this.spec.vmax); const g = Math.min(4, Math.floor(r * 5.2)); const lo = g / 5.2, hi = (g + 1) / 5.2; return 0.25 + 0.75 * Math.min(1, (r - lo) / (hi - lo)); }
}
function norm4(q) { const l = Math.hypot(...q); return q.map(c => c / l); }

// ---------- ghost (20 Hz) ----------
export const GHOST_HZ = 20;
export function encodeGhost(frames) {
  const buf = new ArrayBuffer(frames.length * 16); const dv = new DataView(buf);
  frames.forEach((f, i) => {
    const o = i * 16; dv.setFloat32(o, f[0], true); dv.setFloat32(o + 4, f[1], true); dv.setFloat32(o + 8, f[2], true);
    for (let k = 0; k < 4; k++) dv.setInt8(o + 12 + k, Math.round(Math.max(-1, Math.min(1, f[3 + k])) * 127));
  });
  let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
}
export function decodeGhost(b64) {
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const dv = new DataView(u.buffer); const out = [];
  for (let o = 0; o + 16 <= u.length; o += 16) {
    const q = [0, 1, 2, 3].map(k => dv.getInt8(o + 12 + k) / 127); const l = Math.hypot(...q) || 1;
    out.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true), ...q.map(c => c / l)]);
  }
  return out;
}
export function ghostAt(frames, t) {
  if (!frames || !frames.length) return null;
  const x = t * GHOST_HZ; const i = Math.floor(x);
  if (i >= frames.length - 1) return { pos: frames[frames.length - 1].slice(0, 3), quat: frames[frames.length - 1].slice(3), done: true };
  if (i < 0) return { pos: frames[0].slice(0, 3), quat: frames[0].slice(3) };
  const a = frames[i], b = frames[i + 1], f = x - i;
  return { pos: lerp3(a, b, f), quat: nlerpQ(a.slice(3), b.slice(3), f) };
}

// ---------- piloto automático (testes e demonstração) ----------
export function autopilot(car) {
  const tr = car.tr, sp = car.spec;
  if (car.mode !== 'ground') return { throttle: 1, brake: 0, steer: 0, nitro: false };
  // velocidade-limite pelas curvas à frente
  let vlim = 1e9;
  for (let k = 0; k < 140; k += 3) {
    const f = frameAt(tr, car.s + k);
    const kg = Math.abs(f.kg);
    if (kg > 1e-4) { const vc = Math.sqrt((TIRE_MU * sp.grip * G * f.U[1] + G * Math.abs(f.R[1])) / kg) * 0.97; vlim = Math.min(vlim, Math.sqrt(vc * vc + 2 * 16 * k)); }
  }
  const f = frameAt(tr, car.s);
  const want = Math.atan(car.d * 0.12) * 0.9;
  const av = Math.max(1, Math.abs(car.v));
  const rate = sp.steer * (1.9 - 1.0 * Math.min(1, av / sp.vmax)) * Math.min(1, av / 5);
  const omega = f.kg * car.v * Math.cos(car.beta) + (want - car.psi) * 3;
  const steer = Math.max(-1, Math.min(1, omega / rate));
  const fast = car.v > vlim;
  return { throttle: fast ? 0 : 1, brake: car.v > vlim + 3 ? 1 : 0, steer, nitro: !fast && car.nitro > 0.5 };
}
