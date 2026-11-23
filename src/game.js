// ===== 2 Vogels 2 Fast — gráficos, som, telas, duelo =====
const $ = s => document.querySelector(s);
const fmt = t => { if (t == null || !isFinite(t)) return '—'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const toast = (msg, ms = 3200) => { const el = $('#toast'); el.textContent = msg; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', ms); };
// aviso aos outros jogadores: abre o WhatsApp com a mensagem pronta (a pessoa escolhe o contato e envia)
const SITE_URL = /github\.io$/.test(location.hostname) ? location.origin + location.pathname : 'https://jeanvogel.github.io/2vogels2fast/';
const waLink = txt => 'https://wa.me/?text=' + encodeURIComponent(txt);
const waBtn = (txt, label) => `<a class="btn wa" href="${waLink(txt)}" target="_blank" rel="noopener">${label}</a>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const THEME_NAME = { campo: 'Campo clássico', deserto: 'Deserto ao pôr do sol', cidade: 'Cidade à noite' };
const GLOW = { escort: '#20e0ff', corsa: '#a64dff', p206: '#3d7bff', golf: '#39ff88', p307: '#ff8a1f', p308: '#3d7bff', city: '#2be4ff', megane: '#b04dff', rsq3: '#7fd4ff', c4r: '#ff2a6d', c4b: '#39ff88' };

// ---------- aparelho ----------
// celular/tablet: controles na tela e gráficos mais leves
const TOUCH = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const DETAIL = TOUCH ? 0.5 : 1;
if (TOUCH) document.body.classList.add('touch');
// ---------- renderer ----------
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
} catch (e) {
  $('#screen').innerHTML = '<div class="card"><h2>WebGL indisponível</h2><p>Este navegador não conseguiu iniciar os gráficos 3D. Tente o Chrome ou o Edge atualizados.</p></div>';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TOUCH ? 1.3 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 9000);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const THEMES_CFG = {
  campo: { top: '#2f7fd8', mid: '#bfe0ff', bot: '#9cc7a0', fog: '#cfe5f5', fogN: 260, fogF: 1500, sun: '#fff4dc', sunI: 2.6, hemiS: '#cfe8ff', hemiG: '#4e7a32', hemiI: 1.0,
    ground: '#5d9a3a', ground2: '#6fab45', asphalt: '#43464d', wallA: '#e8202a', wallB: '#ffffff', mount: '#5d7fa0', sunDir: [0.5, 0.8, 0.3], night: false },
  deserto: { top: '#3b1f5e', mid: '#ff8a3d', bot: '#f6b26b', fog: '#f0a066', fogN: 220, fogF: 1300, sun: '#ffc48a', sunI: 2.4, hemiS: '#ffb27a', hemiG: '#8a5a2b', hemiI: 0.9,
    ground: '#d59a5c', ground2: '#c98a4e', asphalt: '#4a4448', wallA: '#ff7a1a', wallB: '#fff3e0', mount: '#a0523a', sunDir: [-0.7, 0.28, 0.4], night: false },
  cidade: { top: '#05061a', mid: '#2a1450', bot: '#120a24', fog: '#1d1238', fogN: 160, fogF: 1100, sun: '#9fb4ff', sunI: 0.55, hemiS: '#5a4aa8', hemiG: '#140c22', hemiI: 0.55,
    ground: '#17151d', ground2: '#1d1b25', asphalt: '#2a2a31', wallA: '#3a3a44', wallB: '#55555f', mount: '#1a1430', sunDir: [0.3, 0.7, -0.5], night: true },
};

// ---------- utilidades de geometria ----------
function mergeGeos(parts) { // parts: [geometry, color]
  let n = 0; const gs = parts.map(([g, c]) => { const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals(); n += ng.attributes.position.count; return [ng, new THREE.Color(c)]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [g, c] of gs) { const p = g.attributes.position.array, q = g.attributes.normal.array; pos.set(p, o * 3); nor.set(q, o * 3);
    for (let i = 0; i < g.attributes.position.count; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; } o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const tx = (g, x, y, z) => (g.translate(x, y, z), g);
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const gv = (A, i) => new THREE.Vector3(A[i * 3], A[i * 3 + 1], A[i * 3 + 2]);
function basisMatrix(p, R, U, T) { const m = new THREE.Matrix4(); m.makeBasis(R.clone().negate(), U, T); m.setPosition(p); return m; }

// ---------- perfis dos carros (usados no 3D e nas silhuetas) ----------
const BODY = {
  hatch3: { L: 4.05, W: 1.70, belt: 0.95, roof: 1.40, clr: 0.18, wr: 0.30, ws: .33, rf: .47, rr: .84, rb: .97 },
  sedan: { L: 4.15, W: 1.66, belt: 0.93, roof: 1.40, clr: 0.18, wr: 0.30, ws: .32, rf: .46, rr: .70, rb: .83, trunk: true },
  hatch5: { L: 3.85, W: 1.67, belt: 0.92, roof: 1.43, clr: 0.18, wr: 0.31, ws: .27, rf: .44, rr: .82, rb: .96 },
  hatch5b: { L: 4.15, W: 1.73, belt: 0.96, roof: 1.45, clr: 0.18, wr: 0.32, ws: .31, rf: .45, rr: .85, rb: .97 },
  hatchTall: { L: 4.2, W: 1.75, belt: 0.97, roof: 1.52, clr: 0.18, wr: 0.32, ws: .21, rf: .41, rr: .86, rb: .97 },
  wagon: { L: 4.5, W: 1.78, belt: 0.95, roof: 1.47, clr: 0.18, wr: 0.32, ws: .27, rf: .42, rr: .95, rb: .985 },
  suv: { L: 4.4, W: 1.84, belt: 1.10, roof: 1.62, clr: 0.26, wr: 0.38, ws: .28, rf: .43, rr: .84, rb: .95 },
  coupe: { L: 4.27, W: 1.77, belt: 0.93, roof: 1.42, clr: 0.18, wr: 0.32, ws: .27, rf: .42, rr: .68, rb: .94 },
};
function profile(type) {
  const b = BODY[type], z = f => b.L / 2 - f * b.L, zF = b.L / 2, zR = -b.L / 2;
  const body = [[zF, b.clr + 0.12], [zF + 0.02, b.belt - 0.3], [zF - 0.14, b.belt - 0.1], [z(b.ws), b.belt], [z(b.trunk ? b.rb : Math.min(b.rb, .96)), b.belt + 0.02],
    [zR + 0.06, b.belt - 0.02], [zR, b.belt - 0.32], [zR + 0.04, b.clr + 0.12], [zR + 0.3, b.clr], [zF - 0.3, b.clr]];
  const cabin = [[z(b.ws), b.belt - 0.01], [z(b.rf), b.roof], [z(b.rr), b.roof], [z(b.rb), b.belt + 0.02]];
  return { ...b, body, cabin };
}
function silhouetteSVG(type, color) {
  const p = profile(type), sx = z => 10 + (p.L / 2 - z) / 4.6 * 180 * -1 + 180, sy = y => 61 - y * 36;
  const pts = a => a.map(([z, y]) => (190 - (z + 2.3) / 4.6 * 180).toFixed(1) + ',' + sy(y).toFixed(1)).join(' ');
  const wz = [p.L / 2 - 0.75, -p.L / 2 + 0.75].map(z => 190 - (z + 2.3) / 4.6 * 180);
  return `<svg viewBox="0 0 200 64" aria-hidden="true"><polygon points="${pts(p.cabin)}" fill="#1c2738" stroke="${color}" stroke-width="2"/><polygon points="${pts(p.body)}" fill="${color}" stroke="rgba(255,255,255,.35)" stroke-width="1"/>${wz.map(x => `<circle cx="${x}" cy="${sy(p.wr)}" r="${p.wr * 36}" fill="#111" stroke="#bbb" stroke-width="3"/>`).join('')}</svg>`;
}

// ---------- modelo 3D do carro ----------
function extrude(pts, width, mat) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  g.rotateY(-Math.PI / 2); g.translate(width / 2, 0, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
function buildCarMesh(spec, ghost = false) {
  const rm = REAL_FILE[spec.id] && realModels[REAL_FILE[spec.id]];
  if (rm) return buildRealCar(spec, rm, ghost);
  const p = profile(spec.body);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const envI = world && world.C.night ? 2.2 : 1.1;
  const paint = ghost ? null : new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: 0.35, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12, envMap: envTex, envMapIntensity: envI });
  const glass = ghost ? null : new THREE.MeshStandardMaterial({ color: '#16202e', metalness: 0.7, roughness: 0.1, envMap: envTex, envMapIntensity: envI * 1.3 });
  const black = ghost ? null : new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.8 });
  const gmat = ghost ? new THREE.MeshBasicMaterial({ color: '#2be4ff', transparent: true, opacity: 0.32, depthWrite: false }) : null;
  const M = m => ghost ? gmat : m;
  body.add(extrude(p.body, p.W, M(paint)));
  body.add(extrude(p.cabin, p.W * 0.84, M(glass)));
  // teto pintado
  const zf = p.L / 2 - p.rf * p.L, zr = p.L / 2 - p.rr * p.L;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(p.W * 0.86, 0.07, Math.max(0.3, zf - zr - 0.06)), M(paint)); roof.position.set(0, p.roof + 0.01, (zf + zr) / 2); roof.castShadow = true; body.add(roof);
  if (!ghost) {
    const lightW = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6d8', emissiveIntensity: 1.4 });
    const lightR = new THREE.MeshStandardMaterial({ color: '#600', emissive: '#ff1530', emissiveIntensity: 1.6 });
    for (const sx of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.06), lightW); h.position.set(sx * (p.W / 2 - 0.3), p.belt - 0.2, p.L / 2 + 0.03); body.add(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.06), lightR); t.position.set(sx * (p.W / 2 - 0.28), p.belt - 0.14, -p.L / 2 - 0.02); body.add(t);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(p.W * 0.45, 0.14, 0.05), black); grille.position.set(0, p.belt - 0.24, p.L / 2 + 0.03); body.add(grille);
    for (const z of [p.L / 2 + 0.03, -p.L / 2 - 0.03]) { const bp = new THREE.Mesh(new THREE.BoxGeometry(p.W + 0.04, 0.16, 0.12), black); bp.position.set(0, p.clr + 0.16, z); body.add(bp); }
  }
  // rodas
  const wheels = [];
  const tire = ghost ? gmat : new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 });
  const rim = ghost ? gmat : new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.9, roughness: 0.25, envMap: envTex });
  const tg = new THREE.CylinderGeometry(p.wr, p.wr, 0.24, 18); tg.rotateZ(Math.PI / 2);
  const rg = new THREE.CylinderGeometry(p.wr * 0.62, p.wr * 0.62, 0.26, 10); rg.rotateZ(Math.PI / 2);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Group(); w.position.set(sx * (p.W / 2 - 0.12), p.wr, sz * (p.L / 2 - 0.78));
    const spin = new THREE.Group(); w.add(spin);
    const t = new THREE.Mesh(tg, tire); t.castShadow = true; spin.add(t); spin.add(new THREE.Mesh(rg, rim));
    root.add(w); wheels.push({ g: w, spin, front: sz > 0 });
  }
  // placa nos carros sem modelo 3D, quando conhecida
  const ptrim = CAR_TRIM[spec.id];
  if (!ghost && ptrim && ptrim.plate) {
    const pf = makePlate(ptrim.plate); pf.position.set(0, p.clr + 0.16, p.L / 2 + 0.095); body.add(pf);
    const pr = makePlate(ptrim.plate); pr.position.set(0, p.clr + 0.16, -p.L / 2 - 0.095); pr.rotation.y = Math.PI; body.add(pr);
  }
  const { glow, flames } = ghost ? { glow: null, flames: [] } : addExtras(root, spec, p.W, p.L, p.clr);
  root.userData = { wheels, body, glow, flames, p, spinA: 0 };
  return root;
}

function addExtras(root, spec, W, L, clr) {
  const gt = canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.6, L + 1.6), new THREE.MeshBasicMaterial({ map: gt, color: GLOW[spec.id] || '#2be4ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; root.add(glow);
  const fg = new THREE.ConeGeometry(0.13, 1.0, 8); fg.rotateX(-Math.PI / 2); fg.translate(0, 0, -0.5);
  const fm = new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const sx of [-0.35, 0.35]) { const f = new THREE.Mesh(fg, fm); f.position.set(sx, clr + 0.2, -L / 2 - 0.05); f.visible = false; root.add(f); flames.push(f); }
  return { glow, flames };
}

// ---------- modelos 3D reais (arquivos .bin ao lado da página) ----------
const REAL_FILE = { c4r: 'c4vts.json', c4b: 'c4vts.json', rsq3: 'rsq3.json', p206: 'p206.json', megane: 'megane.json', p307: 'p307.json', p308: 'p308.json', city: 'city.json' };
// acabamento de cada carro real (da foto do usuário)
const CAR_TRIM = {
  c4r: { plate: { kind: 'mercosul', text: 'MIG1J45' }, chev: 'black', tint: 0.85, badge: false, mirror: 'paint', ride: 0 },
  c4b: { plate: { kind: 'cinza', text: 'MFC-5014', city: 'SC - FLORIANÓPOLIS' }, chev: 'black', tint: 0.85, badge: false, mirror: 'carbon', ride: -0.03, blackPaint: true },
  // RS Q3 2016 vermelha (foto): rodas de 10 raios grafite com face diamantada, placa Mercosul, frisos e rack em alumínio, pinças escuras
  rsq3: { plate: { kind: 'mercosul', text: 'QIF2C03' }, plateF: [-0.02, 0.5, 2.207], plateR: [0, 0.922, -2.142], plateTilt: [0, 0.05],
    tint: 0.9, mirror: 'alu', chrome: 'alu', caliper: '#1b1c1f', paint: { color: '#c80a12', metalness: 0.05, roughness: 0.28 },
    wheel: 'audi10', wOff: 0, dims: [1.85, 4.43] },
  // Peugeot 206 1.0 16v prata: modelo 3D do usuário, com as rodas e pneus do próprio modelo; placa cinza fictícia
  p206: { plate: { kind: 'cinza', text: 'VGL-0206', city: 'SC - FLORIANÓPOLIS' }, plateF: [0, 0.37, 1.958], plateR: [0, 0.8, -1.94], plateTilt: [0, 0.04],
    tint: 0.7, paint: { color: '#b9bec6', metalness: 0.6, roughness: 0.3 }, caliper: '#3a3c40', wheel: 'model', wOff: 0, dims: [1.65, 3.84] },
  // Escort Hobby: ainda sem modelo 3D (desenho do jogo), só a placa real
  escort: { plate: { kind: 'cinza', text: 'LZE-5070', city: 'SC - FLORIANÓPOLIS' } },
  // Renault Mégane Grand Tour preta: modelo 3D do usuário (perua da 2ª geração), rodas do próprio modelo; placa real
  megane: { plate: { kind: 'cinza', text: 'MKB-4894', city: 'SC - FLORIANÓPOLIS' }, plateF: [0, 0.45, 2.258], plateR: [0, 0.63, -2.19], plateTilt: [0, 0],
    tint: 0.8, blackPaint: true, wheel: 'model', wOff: 0, dims: [1.78, 4.5] },
  // Peugeot 307 Rallye cinza: modelo 3D do usuário (307 5 portas pré-facelift), rodas do próprio modelo; placa fictícia
  p307: { plate: { kind: 'cinza', text: 'VGL-2004', city: 'SC - FLORIANÓPOLIS' }, plateF: [0, 0.565, 2.085], plateR: [0, 0.6, -2.08], plateTilt: [0, 0],
    tint: 0.75, chrome: 'alu', paint: { color: '#6a6e75', metalness: 0.6, roughness: 0.32 }, wheel: 'model', wOff: 0, dims: [1.75, 4.2] },
  // Peugeot 308 THP branco: modelo 3D do usuário (308 1ª geração), rodas do próprio modelo repetidas nas quatro posições; placa real
  p308: { plate: { kind: 'mercosul', text: 'BBS3A98' }, plateF: [0, 0.36, 2.335], plateR: [0, 0.8, -1.9], plateTilt: [0, 0.05],
    tint: 0.85, paint: { color: '#eeeeec', metalness: 0.05, roughness: 0.25 }, wheel: 'model', wOff: 0, dims: [1.82, 4.28] },
  // Honda City Hatch branco: modelo 3D do usuário (malha única com textura; peças separadas pela cor da textura), placa real
  city: { plate: { kind: 'mercosul', text: 'RXP9C72' }, plateF: [0, 0.47, 2.145], plateR: [0, 0.8, -2.03], plateTilt: [0, 0.1],
    tint: 0.85, rim: '#2a2b2e', paint: { color: '#f0f0ee', metalness: 0.05, roughness: 0.25 }, wheel: 'model', wOff: 0, dims: [1.75, 4.2] },
};
const plateTex = {};
let carbonTex = null;
function carbonMaterial(envI) {
  if (!carbonTex) { carbonTex = canvasTex(64, 64, (c, w, h) => {
    // trama sarja 2x2 de fibra de carbono
    const s = 16; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const horiz = ((x + y) >> 1) % 2 === 0; const g = horiz ? c.createLinearGradient(x * s, y * s, x * s, y * s + s) : c.createLinearGradient(x * s, y * s, x * s + s, y * s);
      g.addColorStop(0, '#0c0c0e'); g.addColorStop(0.5, horiz ? '#3a3b40' : '#26272b'); g.addColorStop(1, '#0c0c0e'); c.fillStyle = g; c.fillRect(x * s, y * s, s, s);
    } }, true); }
  return new THREE.MeshPhysicalMaterial({ map: carbonTex, metalness: 0.25, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06, envMap: envTex, envMapIntensity: envI });
}
function boxUV(geo, scale) {
  // projeção pelo eixo dominante da normal (a peça não tem coordenadas de textura)
  if (geo.attributes.uv) return; const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function makePlate(cfg) {
  const key = cfg.kind + cfg.text;
  if (!plateTex[key]) plateTex[key] = canvasTex(800, 260, (c, w, h) => {
    const font = (px, wgt = 700) => `${wgt} ${px}px "Saira Condensed", "Arial Narrow", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (cfg.kind === 'mercosul') {
      c.fillStyle = '#f7f7f5'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#0a3a99'; c.fillRect(0, 0, w, 62);
      c.fillStyle = '#fff'; c.font = font(44); c.fillText('BRASIL', w / 2, 33);
      // bandeira do Brasil à direita e símbolo do Mercosul à esquerda
      c.fillStyle = '#1a8a3a'; c.fillRect(w - 86, 12, 62, 40); c.fillStyle = '#f2d21b'; c.beginPath(); c.moveTo(w - 55, 15); c.lineTo(w - 27, 32); c.lineTo(w - 55, 49); c.lineTo(w - 83, 32); c.fill();
      c.fillStyle = '#123a8f'; c.beginPath(); c.arc(w - 55, 32, 9, 0, 7); c.fill();
      c.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(40 + (k % 2) * 16, 22 + Math.floor(k / 2) * 18, 4, 0, 7); c.fill(); }
      c.fillStyle = '#111'; c.font = font(168, 800); c.fillText(cfg.text, w / 2, 165);
      c.strokeStyle = '#111'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    } else {
      c.fillStyle = '#c4c6c4'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#111'; c.lineWidth = 10; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = '#111'; c.font = font(40); c.fillText(cfg.city || '', w / 2, 40);
      c.font = font(160, 800); c.fillText(cfg.text, w / 2, 160);
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.13), new THREE.MeshStandardMaterial({ map: plateTex[key], roughness: 0.4, metalness: 0.1 }));
  return m;
}
const realModels = {}, realLoading = {};
function loadReal(file) {
  if (realLoading[file]) return realLoading[file];
  return realLoading[file] = fetch(file).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(async js => {
    const bin = atob(js.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const buf = u8.buffer;
    const dv = new DataView(buf), hl = dv.getUint32(0, true);
    const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl, parts = {};
    for (const p of h.parts) {
      const q = new Int16Array(buf, base + p.pOff, p.nv * 3), pos = new Float32Array(p.nv * 3);
      for (let i = 0; i < pos.length; i++) pos[i] = q[i] * h.q[i % 3];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buf, base + p.nOff, p.nv * 3), 3, true));
      if (p.uOff != null) g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(buf, base + p.uOff, p.nv * 2), 2, true));
      g.setIndex(new THREE.BufferAttribute(p.big ? new Uint32Array(buf, base + p.iOff, p.ni) : new Uint16Array(buf, base + p.iOff, p.ni), 1));
      g.computeBoundingSphere(); parts[p.name] = g;
    }
    // modelo com textura (o carro inteiro pintado numa imagem): carrega a imagem junto
    let tex = null;
    if (h.tex) tex = await new Promise(res => new THREE.TextureLoader().load(h.tex, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
    return realModels[file] = { parts, wheels: h.wheels, tex };
  }).catch(e => { console.warn('modelo 3D indisponível', file, e); return null; });
}
function ensureModel(carId, ms = 8000) { const f = REAL_FILE[carId]; if (!f || realModels[f]) return Promise.resolve(); return Promise.race([loadReal(f), new Promise(r => setTimeout(r, ms))]); }
const VTR_WHEEL = { id: 'vtr', R: 0.31, w: 0.215, ri: 0.215 }, AUDI_WHEEL = { id: 'audi10', R: 0.348, w: 0.255, ri: 0.254 };
const wheelGeos = {};
function tireGeo(R, w, ri) {
  const pts = [];
  for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + Math.PI * k / 10; pts.push(new THREE.Vector2(ri + (R - ri) * (0.55 + 0.45 * Math.cos(a)), w / 2 * Math.sin(a))); }
  pts[0].x = ri; pts[pts.length - 1].x = ri;
  const tire = new THREE.LatheGeometry(pts, 40); tire.rotateZ(Math.PI / 2);
  const barrel = new THREE.CylinderGeometry(ri, ri, w * 0.92, 32, 1, true); barrel.rotateZ(Math.PI / 2);
  return { tire, barrel };
}
// roda da RS Q3 da foto: 10 raios retos, grafite com a face dos raios e o aro diamantados
function audiWheelGeo() {
  const { R, w, ri } = AUDI_WHEEL; const { tire, barrel } = tireGeo(R, w, ri);
  const Rf = ri - 0.008, D = Math.PI / 180, N = 10, step = 360 / N;
  const face = new THREE.Shape(); face.absarc(0, 0, Rf, 0, Math.PI * 2, false);
  for (let k = 0; k < N; k++) {
    const a0 = k * step * D, win = [];
    const hw = r => (0.0125 + (r - 0.09) * 0.035) / r; // meia-largura angular do raio (alarga um pouco no aro)
    const rs = [0.08, 0.1, 0.13, 0.165, 0.2, 0.224];
    rs.forEach(r => win.push(new THREE.Vector2(r * Math.cos(a0 + hw(r)), r * Math.sin(a0 + hw(r)))));
    for (let j = 1; j < 6; j++) { const a = a0 + hw(0.228) + (step * D - 2 * hw(0.228)) * j / 6; win.push(new THREE.Vector2(0.229 * Math.cos(a), 0.229 * Math.sin(a))); }
    for (let i = rs.length - 1; i >= 0; i--) { const a = a0 + step * D - hw(rs[i]); win.push(new THREE.Vector2(rs[i] * Math.cos(a), rs[i] * Math.sin(a))); }
    face.holes.push(new THREE.Path(win));
  }
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.03, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 64 });
  fg.rotateY(Math.PI / 2); fg.translate(w * 0.2, 0, 0);
  // ExtrudeGeometry: grupo 0 = tampas (face usinada), grupo 1 = laterais (pintura grafite)
  const part = gi => { const gr = fg.groups.filter(g => g.materialIndex === gi), out = new THREE.BufferGeometry();
    const cnt = gr.reduce((a, g) => a + g.count, 0), p = new Float32Array(cnt * 3); let o = 0;
    for (const g of gr) { p.set(fg.attributes.position.array.subarray(g.start * 3, (g.start + g.count) * 3), o); o += g.count * 3; }
    out.setAttribute('position', new THREE.BufferAttribute(p, 3)); return out; };
  const lip = new THREE.TorusGeometry(ri - 0.004, 0.009, 6, 48); lip.rotateY(Math.PI / 2); lip.translate(w * 0.43, 0, 0);
  const hub = new THREE.CylinderGeometry(0.078, 0.086, 0.026, 40); hub.rotateZ(Math.PI / 2); hub.translate(w * 0.36, 0, 0);
  const cap = new THREE.CylinderGeometry(0.034, 0.034, 0.012, 28); cap.rotateZ(Math.PI / 2); cap.translate(w * 0.42, 0, 0);
  const capRim = new THREE.TorusGeometry(0.034, 0.003, 4, 28); capRim.rotateY(Math.PI / 2); capRim.translate(w * 0.445, 0, 0);
  const parts = [[part(0), '#f4f6f8'], [part(1), '#3d4046'], [lip, '#eef0f3'], [hub, '#5f6268'], [cap, '#6c7076'], [capRim, '#e8eaee']];
  for (let k = 0; k < 5; k++) { const a = k * 72 * D + 18 * D, b = new THREE.CylinderGeometry(0.011, 0.012, 0.022, 6); b.rotateZ(Math.PI / 2); b.translate(w * 0.42, 0.053 * Math.cos(a), 0.053 * Math.sin(a)); parts.push([b, '#2e3034']); }
  return { tire, barrel, spokes: mergeGeos(parts) };
}
function sportWheel(side, wk = VTR_WHEEL) {
  // pneu (perfil arredondado) + roda de liga leve
  if (!wheelGeos[wk.id] && wk.id === 'audi10') wheelGeos[wk.id] = audiWheelGeo();
  if (!wheelGeos[wk.id]) {
    const R = 0.31, w = 0.215, ri = 0.215, pts = [];
    for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + Math.PI * k / 10; pts.push(new THREE.Vector2(ri + (R - ri) * (0.55 + 0.45 * Math.cos(a)) + 0.0, w / 2 * Math.sin(a))); }
    pts[0].x = ri; pts[pts.length - 1].x = ri;
    const tire = new THREE.LatheGeometry(pts, 36); tire.rotateZ(Math.PI / 2);
    const barrel = new THREE.CylinderGeometry(ri, ri, w * 0.92, 28, 1, true); barrel.rotateZ(Math.PI / 2);
    // face da roda original do C4 VTR: 5 raios que se abrem em Y, levemente torcidos, miolo grande
    const Rf = 0.205, twist = r => 0.85 * (r - 0.07), D = Math.PI / 180;
    const P2 = (r, a) => new THREE.Vector2(r * Math.cos(a + twist(r)), r * Math.sin(a + twist(r)));
    const face = new THREE.Shape(); face.absarc(0, 0, Rf, 0, Math.PI * 2, false);
    for (let k = 0; k < 5; k++) {
      const a0 = k * 72 * D;
      // janela grande entre um raio e o próximo
      const win = [], rs = [0.084, 0.1, 0.12, 0.145, 0.168, 0.184];
      const lo = [31, 27.5, 25, 23, 21.8, 21.2], hi = [41, 44.5, 47, 49, 50.2, 50.8];
      rs.forEach((r, i) => win.push(P2(r, a0 + lo[i] * D)));
      for (let j = 1; j < 5; j++) win.push(P2(0.189, a0 + (21.2 + (50.8 - 21.2) * j / 5) * D));
      for (let i = rs.length - 1; i >= 0; i--) win.push(P2(rs[i], a0 + hi[i] * D));
      face.holes.push(new THREE.Path(win));
      // fenda dentro do Y (abre do meio do raio até o aro)
      const slot = [P2(0.104, a0), P2(0.13, a0 - 2.4 * D), P2(0.16, a0 - 4 * D), P2(0.186, a0 - 5 * D), P2(0.189, a0), P2(0.186, a0 + 5 * D), P2(0.16, a0 + 4 * D), P2(0.13, a0 + 2.4 * D)];
      face.holes.push(new THREE.Path(slot));
    }
    const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.028, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 48 });
    faceGeo.rotateY(Math.PI / 2); faceGeo.translate(w * 0.24, 0, 0);
    const lip = new THREE.TorusGeometry(ri - 0.004, 0.011, 6, 40); lip.rotateY(Math.PI / 2); lip.translate(w * 0.43, 0, 0);
    const hub = new THREE.CylinderGeometry(0.068, 0.072, 0.03, 32); hub.rotateZ(Math.PI / 2); hub.translate(w * 0.38, 0, 0);
    const cap = new THREE.CylinderGeometry(0.04, 0.04, 0.012, 24); cap.rotateZ(Math.PI / 2); cap.translate(w * 0.45, 0, 0);
    wheelGeos.vtr = { tire, barrel, spokes: mergeGeos([[faceGeo, '#c9ccd1'], [lip, '#d6d9de'], [hub, '#c6c9ce'], [cap, '#8d9198']]) };
  }
  const wheelGeo = wheelGeos[wk.id];
  const g = new THREE.Group();
  const t = new THREE.Mesh(wheelGeo.tire, new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.92 })); t.castShadow = true;
  const b = new THREE.Mesh(wheelGeo.barrel, new THREE.MeshStandardMaterial({ color: wk.id === 'audi10' ? '#3c3f44' : '#8a8f97', metalness: 0.6, roughness: 0.4, envMap: envTex, envMapIntensity: 0.5, side: THREE.DoubleSide }));
  const s = new THREE.Mesh(wheelGeo.spokes, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.32, envMap: envTex, envMapIntensity: 0.35 }));
  g.add(t, b, s); g.scale.x = side; // raios virados para fora
  return g;
}
function buildRealCar(spec, rm, ghost) {
  const trim = CAR_TRIM[spec.id] || {};
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const envI = world && world.C.night ? 2.2 : 1.1;
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMap: envTex, envMapIntensity: envI }),
    black: new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.6, envMap: envTex, envMapIntensity: envI * 0.4 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 1, roughness: 0.14, envMap: envTex, envMapIntensity: envI }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#0e1520', metalness: 0.3, roughness: 0.04, transparent: true, opacity: 0.55, envMap: envTex, envMapIntensity: envI * 1.4, depthWrite: false }),
    darkglass: new THREE.MeshStandardMaterial({ color: '#07090c', metalness: 0.5, roughness: 0.1, envMap: envTex }),
    lens: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.22, envMap: envTex, depthWrite: false }),
    tail: new THREE.MeshStandardMaterial({ color: '#4a0008', emissive: '#ff1530', emissiveIntensity: 1.1, roughness: 0.3 }),
    head: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 1.3 }),
    interior: new THREE.MeshStandardMaterial({ color: '#1d1d22', roughness: 0.85 }),
    caliper: new THREE.MeshStandardMaterial({ color: '#a3121a', roughness: 0.45, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: '#7a7d83', metalness: 0.85, roughness: 0.4, envMap: envTex }),
  };
  M.taillens = new THREE.MeshPhysicalMaterial({ color: '#c0101c', emissive: '#5a0008', emissiveIntensity: 0.6, roughness: 0.05, transparent: true, opacity: 0.62, envMap: envTex, envMapIntensity: envI, depthWrite: false });
  M.tailoff = new THREE.MeshStandardMaterial({ color: '#3a0508', roughness: 0.25, envMap: envTex, envMapIntensity: envI * 0.6 });
  if (trim.chrome === 'alu') { M.chrome.color.set('#c3c7cc'); M.chrome.roughness = 0.35; M.chrome.envMapIntensity = envI * 0.55; }
  if (trim.caliper) M.caliper.color.set(trim.caliper);
  M.chev = trim.chev === 'black' ? new THREE.MeshStandardMaterial({ color: '#0a0a0c', metalness: 0.35, roughness: 0.18, envMap: envTex, envMapIntensity: envI }) : M.chrome;
  M.badge = M.chrome;
  M.mirror = trim.mirror === 'carbon' ? (boxUV(rm.parts.mirror, 12), carbonMaterial(envI)) : trim.mirror === 'alu' ? M.chrome : M.paint;
  M.paint.envMapIntensity = envI * 0.6; M.paint.metalness = 0.2;
  if (trim.paint) { M.paint.color.set(trim.paint.color); M.paint.metalness = trim.paint.metalness; M.paint.roughness = trim.paint.roughness; }
  if (trim.blackPaint) { M.paint.color.set('#040405'); M.paint.metalness = 0.0; M.paint.roughness = 0.3; M.paint.envMapIntensity = envI * 0.35; M.paint.clearcoat = 1; }
  body.position.y = trim.ride || 0;
  if (trim.tint) { M.glass.color.set('#05070a'); M.glass.opacity = trim.tint; }
  const gmat = ghost ? new THREE.MeshBasicMaterial({ color: '#2be4ff', transparent: true, opacity: 0.3, depthWrite: false }) : null;
  if (rm.tex) {
    M.tex = new THREE.MeshPhysicalMaterial({ map: rm.tex, roughness: 0.42, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2, envMap: envTex, envMapIntensity: envI * 0.5 });
    M.wtex = new THREE.MeshStandardMaterial({ map: rm.tex, roughness: 0.6, metalness: 0.2, envMap: envTex, envMapIntensity: envI * 0.3 });
  }
  for (const [name, geo] of Object.entries(rm.parts)) {
    if (/^(wheel|wtire|wrim|wtex)_/.test(name)) continue;
    if (ghost && (name === 'interior' || name === 'glass' || name === 'lens' || name === 'taillens')) continue;
    if (name === 'badge' && trim.badge === false) continue;
    const m = new THREE.Mesh(geo, ghost ? gmat : M[name] || M.black);
    m.castShadow = !ghost && (name === 'paint' || name === 'black' || name === 'mirror' || name === 'tex'); if (name === 'glass' || name === 'lens' || name === 'taillens') m.renderOrder = 2;
    body.add(m);
  }
  const wheels = [], wk = trim.wheel === 'audi10' ? AUDI_WHEEL : trim.wheel === 'model' ? { id: 'model', R: rm.wheels.lf[1], w: 0.19 } : VTR_WHEEL, wOff = trim.wOff ?? 0.03;
  M.wtire = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.9 });
  M.wrim = new THREE.MeshStandardMaterial({ color: trim.rim || '#c4c8ce', metalness: 0.8, roughness: 0.3, envMap: envTex, envMapIntensity: envI * 0.7 });
  for (const [c, ctr] of Object.entries(rm.wheels)) {
    const side = ctr[0] > 0 ? 1 : -1;
    const w = new THREE.Group(); w.position.set(ctr[0] + side * wOff, wk.R, ctr[2]);
    const spin = new THREE.Group(); w.add(spin);
    if (ghost) { const t = new THREE.Mesh(new THREE.CylinderGeometry(wk.R, wk.R, wk.w, 20).rotateZ(Math.PI / 2), gmat); spin.add(t); }
    else {
      if (wk.id !== 'model') spin.add(sportWheel(side, wk));
      for (const [pre, mat] of [['wheel_', M.metal], ['wtire_', M.wtire], ['wrim_', M.wrim], ['wtex_', M.wtex]]) if (rm.parts[pre + c]) { const m = new THREE.Mesh(rm.parts[pre + c], mat); m.position.x = -side * wOff; m.castShadow = pre === 'wtire_'; spin.add(m); }
    }
    root.add(w); wheels.push({ g: w, spin, front: c[1] === 'f' });
  }
  if (!ghost && trim.plate) {
    const PF = trim.plateF || [0, 0.45, 2.147], PR = trim.plateR || [0, 0.47, -2.146], PT = trim.plateTilt || [-0.06, 0];
    const pf = makePlate(trim.plate); pf.position.set(...PF); pf.rotation.x = PT[0]; body.add(pf);
    const pr = makePlate(trim.plate); pr.position.set(...PR); pr.rotation.set(PT[1], Math.PI, 0); body.add(pr);
  }
  const [DW, DL] = trim.dims || [1.77, 4.27];
  const { glow, flames } = ghost ? { glow: null, flames: [] } : addExtras(root, spec, DW, DL, 0.1);
  root.userData = { wheels, body, glow, flames, p: { wr: wk.R }, spinA: 0, real: true };
  return root;
}

// ---------- céu ----------
const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.4,0.0,1.0),0.55)) : mix(mid, bot, clamp(-h*6.0,0.0,1.0)); gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}',
}));
sky.renderOrder = -1; scene.add(sky);
const hemi = new THREE.HemisphereLight('#fff', '#444', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
const headlight = new THREE.SpotLight('#fff3d6', 0, 120, 0.55, 0.5, 1.2); scene.add(headlight); scene.add(headlight.target);

// ---------- mundo (pista + cenário) ----------
let world = null, envTex = null;
const pmrem = new THREE.PMREMGenerator(renderer);
function makeEnv(C) {
  if (envTex) envTex.dispose();
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky.material));
  const gd = new THREE.Mesh(new THREE.CircleGeometry(100, 24), new THREE.MeshBasicMaterial({ color: C.ground })); gd.rotation.x = -Math.PI / 2; gd.position.y = -6; es.add(gd);
  const sunM = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), new THREE.MeshBasicMaterial({ color: C.night ? '#8899ff' : '#ffffff' })); sunM.position.set(...C.sunDir).multiplyScalar(80); es.add(sunM);
  envTex = pmrem.fromScene(es, 0.03).texture;
}
function disposeWorld() {
  if (!world) return;
  scene.remove(world.group);
  world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); }); } });
  world = null;
}
function ribbon(tr, edges, ok, vScale) {
  // edges(i) -> [a, b] pontos; constrói faixas entre amostras consecutivas válidas
  const pos = [], uv = [], idx = []; let prev = -1;
  for (let i = 0; i < tr.n; i++) {
    if (!ok(i)) { prev = -1; continue; }
    const [a, b] = edges(i); const base = pos.length / 3;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(0, i / vScale, 1, i / vScale);
    if (prev >= 0) idx.push(base - 2, base - 1, base, base - 1, base + 1, base);
    prev = i;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function buildWorld(tr) {
  disposeWorld();
  const C = THEMES_CFG[tr.theme]; const group = new THREE.Group(); const R = rng(tr.seed * 31 + 7);
  sky.material.uniforms.top.value.set(C.top); sky.material.uniforms.mid.value.set(C.mid); sky.material.uniforms.bot.value.set(C.bot);
  scene.fog = new THREE.Fog(C.fog, C.fogN, C.fogF); makeEnv(C);
  hemi.color.set(C.hemiS); hemi.groundColor.set(C.hemiG); hemi.intensity = C.hemiI;
  sun.color.set(C.sun); sun.intensity = C.sunI;
  const HW = HALF_W, P = i => gv(tr.P, i), Rv = i => gv(tr.R, i), Uv = i => gv(tr.U, i), F = i => tr.FL[i];
  const notGap = i => !(F(i) & FLAG_GAP);
  // asfalto
  const roadTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = C.asphalt; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) { const v = Math.random() * 30 - 15; c.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},0.08)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.fillStyle = C.night ? '#d8e6ff' : '#f2f2f2'; c.fillRect(10, 0, 7, h); c.fillRect(w - 17, 0, 7, h);
    c.fillStyle = C.night ? '#ffd23f' : '#f7d33a'; c.fillRect(w / 2 - 4, 0, 8, h * 0.5);
  }, true);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const top = new THREE.Mesh(ribbon(tr, i => { const p = P(i), r = Rv(i), u = Uv(i).multiplyScalar(0.03); return [p.clone().addScaledVector(r, -HW).add(u), p.clone().addScaledVector(r, HW).add(u)]; }, notGap, 10), roadMat);
  top.receiveShadow = true; group.add(top);
  // laje (laterais + fundo); rampas descem até o chão
  const slabMat = new THREE.MeshStandardMaterial({ color: tr.theme === 'deserto' ? '#b98a62' : tr.theme === 'cidade' ? '#3a3846' : '#9a9a92', roughness: 0.95, side: THREE.DoubleSide });
  const bottomOf = (i, side) => { const p = P(i).addScaledVector(Rv(i), side * HW); if (F(i) & FLAG_RAMP) { p.y = GROUND; return p; } return p.addScaledVector(Uv(i), -0.9); };
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(ribbon(tr, i => [P(i).addScaledVector(Rv(i), side * HW), bottomOf(i, side)], notGap, 10), slabMat); m.receiveShadow = true; group.add(m);
  }
  group.add(new THREE.Mesh(ribbon(tr, i => [bottomOf(i, -1), bottomOf(i, 1)], notGap, 10), slabMat));
  // muretas listradas (exceto loops e vãos)
  const wallTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = C.wallA; c.fillRect(0, 0, w, h); c.fillStyle = C.wallB; c.fillRect(0, 0, w, h / 2); }, true);
  const wallMat = new THREE.MeshStandardMaterial({ map: C.night ? null : wallTex, color: C.night ? C.wallA : '#fff', roughness: 0.7, side: THREE.DoubleSide });
  const walled = i => !(F(i) & (FLAG_GAP | FLAG_LOOP));
  for (const side of [-1, 1]) {
    const g = ribbon(tr, i => { const b = P(i).addScaledVector(Rv(i), side * (HW + 0.15)); return [b, b.clone().addScaledVector(Uv(i), 0.85)]; }, walled, 3);
    const m = new THREE.Mesh(g, wallMat); m.castShadow = true; m.receiveShadow = true; group.add(m);
    if (C.night) {
      const neon = new THREE.Mesh(ribbon(tr, i => { const b = P(i).addScaledVector(Rv(i), side * (HW + 0.15)).addScaledVector(Uv(i), 0.86); return [b, b.clone().addScaledVector(Uv(i), 0.12)]; }, walled, 3),
        new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff2a6d' : '#2be4ff', side: THREE.DoubleSide }));
      group.add(neon);
    }
  }
  // faixas quadriculadas de largada e chegada
  const checker = canvasTex(64, 16, (c, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 4, y * 4, 4, 4); } });
  checker.magFilter = THREE.NearestFilter;
  for (const s0 of [tr.start, tr.finish]) {
    const g = ribbon(tr, i => { const p = P(i), r = Rv(i), u = Uv(i).multiplyScalar(0.05); return [p.clone().addScaledVector(r, -HW).add(u), p.clone().addScaledVector(r, HW).add(u)]; }, i => i >= s0 && i <= s0 + 3, 3);
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 })));
    group.add(gantry(tr, s0, s0 === tr.start ? 'LARGADA' : 'CHEGADA', C));
  }
  // pilares sob trechos elevados
  const pil = []; for (let i = 0; i < tr.n; i += 12) { const p = P(i), u = Uv(i); if (F(i) & (FLAG_GAP | FLAG_LOOP | FLAG_RAMP)) continue; if (p.y > 1.4 && u.y > 0.85) pil.push([p.x, p.z, p.y - 0.9]); }
  if (pil.length) {
    const pg = new THREE.BoxGeometry(1.3, 1, 1.3); pg.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(pg, slabMat, pil.length); const m4 = new THREE.Matrix4();
    pil.forEach(([x, z, h], k) => { m4.makeScale(1, h - GROUND, 1); m4.setPosition(x, GROUND, z); im.setMatrixAt(k, m4); }); im.castShadow = true; group.add(im);
  }
  // cones nos checkpoints
  const cg = mergeGeos([[new THREE.ConeGeometry(0.35, 0.9, 10).translate(0, 0.45, 0), '#ff6a00'], [new THREE.CylinderGeometry(0.24, 0.27, 0.16, 10).translate(0, 0.5, 0), '#ffffff']]);
  const cps = tr.checkpoints.slice(1); const cones = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), cps.length * 2);
  cps.forEach((i, k) => { for (const sd of [0, 1]) { const p = P(i).addScaledVector(Rv(i), (sd ? 1 : -1) * (HW - 0.5)); cones.setMatrixAt(k * 2 + sd, basisMatrix(p, Rv(i), Uv(i), gv(tr.T, i))); } });
  cones.castShadow = true; group.add(cones);
  // chão
  const b = tr.bounds, cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2, ext = Math.max(b.maxx - b.minx, b.maxz - b.minz) / 2 + 700;
  const groundTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = C.ground; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { c.fillStyle = k % 2 ? C.ground2 : C.ground; c.globalAlpha = 0.5; const x = Math.random() * w, y = Math.random() * h; c.fillRect(x, y, 60 + Math.random() * 140, 60 + Math.random() * 140); }
    c.globalAlpha = 1;
    for (let k = 0; k < 5000; k++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    if (tr.theme === 'cidade') { c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 3; for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(k * 128, 0); c.lineTo(k * 128, h); c.moveTo(0, k * 128); c.lineTo(w, k * 128); c.stroke(); } }
  }, true);
  groundTex.repeat.set(ext / 40, ext / 40);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2, ext * 2), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, GROUND, cz); ground.receiveShadow = true; group.add(ground);
  // montanhas distantes
  const fogC = new THREE.Color(C.fog), mc = new THREE.Color(C.mount).lerp(fogC, 0.35);
  const mg = new THREE.ConeGeometry(1, 1, 6); mg.translate(0, 0.5, 0);
  const mount = new THREE.InstancedMesh(mg, new THREE.MeshBasicMaterial({ color: mc, fog: false }), 48); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const mr = ext + 400;
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2 + R() * 0.1, rr = mr + R() * 600, h = 120 + R() * 260, w = 220 + R() * 300;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6); m4.compose(new THREE.Vector3(cx + Math.cos(a) * rr, GROUND - 10, cz + Math.sin(a) * rr), q, new THREE.Vector3(w, h, w)); mount.setMatrixAt(k, m4); }
  group.add(mount);
  scatter(tr, group, C, R, { cx, cz, ext: ext - 400 });
  scene.add(group);
  const sd = new THREE.Vector3(...C.sunDir).normalize();
  world = { group, tr, C, sunDir: sd, mini: drawMiniBase(tr) };
  headlight.intensity = C.night ? 60 : 0;
}
function gantry(tr, s0, label, C) {
  const g = new THREE.Group(); const i = Math.round(s0) + 1;
  const p = gv(tr.P, i), r = gv(tr.R, i), u = gv(tr.U, i), t = gv(tr.T, i);
  g.applyMatrix4(basisMatrix(p, r, u, t));
  const post = new THREE.MeshStandardMaterial({ color: '#2a2a33', metalness: 0.6, roughness: 0.4 });
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), post); m.position.set(sx * (HALF_W + 1), 3.5 - 0.6, 0); m.castShadow = true; g.add(m); }
  const tex = canvasTex(1024, 160, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff7a1a'); gr.addColorStop(1, '#ff2a6d'); c.fillStyle = '#0e0a1f'; c.fillRect(0, 0, w, h);
    c.fillStyle = gr; c.fillRect(0, h - 14, w, 14); c.fillRect(0, 0, w, 14);
    const txt = label + "  ·  2 VOGELS 2 FAST"; let fs = 92; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; do { c.font = `italic ${fs}px "Racing Sans One", Impact, sans-serif`; fs -= 4; } while (c.measureText(txt).width > w - 60 && fs > 30); c.fillText(txt, w / 2, h / 2 + 4);
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 2.6, 1.6, 0.4), [post, post, post, post, new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
  banner.position.set(0, 6.2, 0); banner.castShadow = true; g.add(banner);
  return g;
}
function scatter(tr, group, C, R, area) {
  const place = (count, minD, cb) => { count = Math.max(1, Math.round(count * DETAIL)); let k = 0, tries = 0; while (k < count && tries++ < count * 12) { const x = area.cx + (R() * 2 - 1) * area.ext, z = area.cz + (R() * 2 - 1) * area.ext; const d = tr.distTo(x, z); if (d < minD) continue; cb(x, z, d, k++); } };
  const inst = (geo, mat, list, shadow = true) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    list.forEach(([x, z, s, rot, sy], k) => { q.setFromAxisAngle(Y, rot); m4.compose(new THREE.Vector3(x, GROUND, z), q, new THREE.Vector3(s, s * (sy || 1), s)); im.setMatrixAt(k, m4); }); im.castShadow = shadow; im.receiveShadow = true; group.add(im); };
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const billboardTexts = ['LOGO', 'NITRO', 'LOGO', 'NITRO', 'OFICINA VOGEL', 'TURBO & CIA', 'RACHA DA FAMÍLIA', 'DESDE 1990', 'POSTO 24H'];
  if (tr.theme === 'campo') {
    const pine = mergeGeos([[new THREE.CylinderGeometry(0.25, 0.35, 2, 6).translate(0, 1, 0), '#6b4a2b'], [new THREE.ConeGeometry(2.2, 5, 7).translate(0, 4.2, 0), '#2f6b2a'], [new THREE.ConeGeometry(1.6, 3.6, 7).translate(0, 6.3, 0), '#3a7f33']]);
    const round = mergeGeos([[new THREE.CylinderGeometry(0.3, 0.4, 2.4, 6).translate(0, 1.2, 0), '#6b4a2b'], [new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4, 0), '#4c8f35']]);
    const house = mergeGeos([[new THREE.BoxGeometry(8, 4, 6).translate(0, 2, 0), '#c8402e'], [new THREE.CylinderGeometry(0, 4.8, 3, 4, 1).rotateY(Math.PI / 4).scale(1.18, 1, 0.9).translate(0, 5.5, 0), '#5a3a2a'], [new THREE.BoxGeometry(2, 3, 0.2).translate(0, 1.5, 3.05), '#f2e6c8']]);
    const a = [], b2 = [], h = [];
    place(700, 18, (x, z, d, k) => (k % 3 ? a : b2).push([x, z, 0.7 + R() * 0.8, R() * 6]));
    place(26, 30, (x, z) => h.push([x, z, 1, R() * 6]));
    inst(pine, vc, a); inst(round, vc, b2); inst(house, vc, h);
  } else if (tr.theme === 'deserto') {
    const cactus = mergeGeos([[new THREE.CylinderGeometry(0.45, 0.5, 5, 7).translate(0, 2.5, 0), '#3f7a3a'], [new THREE.CylinderGeometry(0.3, 0.3, 2, 6).translate(1.0, 3.0, 0), '#3f7a3a'], [new THREE.CylinderGeometry(0.3, 0.3, 0.9, 6).rotateZ(Math.PI / 2).translate(0.55, 2.1, 0), '#3f7a3a'], [new THREE.CylinderGeometry(0.28, 0.28, 1.6, 6).translate(-0.9, 3.6, 0), '#3f7a3a'], [new THREE.CylinderGeometry(0.28, 0.28, 0.8, 6).rotateZ(Math.PI / 2).translate(-0.5, 2.9, 0), '#3f7a3a']]);
    const rock = mergeGeos([[new THREE.DodecahedronGeometry(2, 0).scale(1.4, 0.8, 1.1).translate(0, 0.8, 0), '#a8613d']]);
    const mesa = mergeGeos([[new THREE.CylinderGeometry(14, 20, 26, 7).translate(0, 13, 0), '#b35a36'], [new THREE.CylinderGeometry(14.2, 14.2, 3, 7).translate(0, 25, 0), '#8f4428']]);
    const palm = mergeGeos([[new THREE.CylinderGeometry(0.22, 0.35, 9, 6).translate(0, 4.5, 0), '#7a5a3a'], [new THREE.ConeGeometry(3.4, 1.4, 7).translate(0, 9.2, 0), '#3d7f3a']]);
    const c = [], r = [], m = [], pl = [];
    place(380, 16, (x, z) => c.push([x, z, 0.8 + R() * 0.6, R() * 6]));
    place(260, 14, (x, z) => r.push([x, z, 0.6 + R() * 1.6, R() * 6]));
    place(30, 90, (x, z) => m.push([x, z, 0.7 + R() * 1.2, R() * 6]));
    place(70, 16, (x, z) => pl.push([x, z, 0.9 + R() * 0.3, R() * 6]));
    inst(cactus, vc, c); inst(rock, vc, r); inst(mesa, vc, m); inst(palm, vc, pl);
  } else {
    // prédios com janelas acesas
    const win = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#14121c'; c.fillRect(0, 0, w, h);
      for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 14) { const r = Math.random(); c.fillStyle = r < 0.42 ? ['#ffd88a', '#fff2c4', '#8fe9ff', '#ff9ad5'][Math.floor(Math.random() * 4)] : '#1e1c28'; c.fillRect(x, y, 8, 9); } }, true);
    for (const [hgt, cnt] of [[18, 90], [34, 70], [60, 40]]) {
      const g = new THREE.BoxGeometry(14, hgt, 14); g.translate(0, hgt / 2, 0);
      const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * hgt / 30);
      const mat = new THREE.MeshStandardMaterial({ map: win, emissiveMap: win, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.8 });
      const L = []; place(cnt, 24 + hgt * 0.1, (x, z) => L.push([x, z, 0.8 + R() * 0.6, R() * 6, 1])); inst(g, mat, L);
    }
    const palm = mergeGeos([[new THREE.CylinderGeometry(0.2, 0.32, 10, 6).translate(0, 5, 0), '#3a2c22'], [new THREE.ConeGeometry(3.2, 1.2, 7).translate(0, 10.2, 0), '#1f4a2c']]);
    const pl = []; place(120, 14, (x, z) => pl.push([x, z, 1, R() * 6])); inst(palm, vc, pl);
    // postes com brilho ao longo da pista
    const glowTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,200,120,.5)'); g.addColorStop(1, 'rgba(255,160,80,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const poles = [], glows = [];
    for (let i = 20, k = 0; i < tr.n - 20; i += 28, k++) {
      const p = gv(tr.P, i), u = gv(tr.U, i); if (p.y > 1 || u.y < 0.97 || tr.FL[i]) continue;
      const side = k % 2 ? 1 : -1; const q2 = p.clone().addScaledVector(gv(tr.R, i), side * (HALF_W + 1.8));
      poles.push([q2.x, q2.z, 1, 0]); glows.push(new THREE.Vector3(q2.x, GROUND + 8, q2.z).addScaledVector(gv(tr.R, i), -side * 1.2));
    }
    inst(mergeGeos([[new THREE.CylinderGeometry(0.12, 0.16, 8.4, 6).translate(0, 4.2, 0), '#55555f']]), vc, poles, false);
    if (glows.length) { const sg = new THREE.BufferGeometry().setFromPoints(glows); group.add(new THREE.Points(sg, new THREE.PointsMaterial({ map: glowTex, size: 9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd9a0' }))); }
    // estrelas
    const st = []; for (let k = 0; k < 900; k++) { const a = R() * Math.PI * 2, e = 0.08 + R() * 1.4; st.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * 4200, Math.sin(e) * 4200, Math.sin(a) * Math.cos(e) * 4200)); }
    const stars = new THREE.Points(new THREE.BufferGeometry().setFromPoints(st), new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false }));
    stars.userData.followCam = true; group.add(stars);
  }
  // outdoors ao lado da pista
  for (let k = 0; k < 9; k++) {
    const i = 150 + Math.floor(R() * (tr.n - 300)); const p = gv(tr.P, i), u = gv(tr.U, i); if (p.y > 2 || u.y < 0.95 || tr.FL[i]) continue;
    const side = R() < 0.5 ? -1 : 1, r = gv(tr.R, i), t = gv(tr.T, i);
    const pos = p.clone().addScaledVector(r, side * (HALF_W + 7)); pos.y = GROUND;
    const text = billboardTexts[k % billboardTexts.length];
    const tex = canvasTex(512, 200, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, C.night ? '#1a0d33' : '#ffe9c2'); gr.addColorStop(1, C.night ? '#33104a' : '#ffc27a'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = C.night ? '#ff2a6d' : '#ff7a1a'; c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
      if (text === 'LOGO' && logoImg.complete && logoImg.naturalWidth) { if (!C.night) { c.fillStyle = '#16122a'; c.fillRect(12, 12, w - 24, h - 24); } const s = Math.min((w - 40) / logoImg.naturalWidth, (h - 30) / logoImg.naturalHeight); const lw = logoImg.naturalWidth * s, lh = logoImg.naturalHeight * s; c.drawImage(logoImg, (w - lw) / 2, (h - lh) / 2, lw, lh); return; }
      c.font = 'italic 64px "Racing Sans One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.night ? '#2be4ff' : '#2a1458'; c.fillText(text === 'LOGO' ? '2 VOGELS 2 FAST' : text, w / 2, h / 2 + 4); });
    const bb = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), C.night ? new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 }));
    face.position.y = 6.5; bb.add(face);
    for (const sx of [-3.5, 3.5]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), new THREE.MeshStandardMaterial({ color: '#444' })); lg.position.set(sx, 2.5, 0); bb.add(lg); }
    bb.position.copy(pos); bb.lookAt(pos.clone().addScaledVector(t, -30).addScaledVector(r, -side * 25)); bb.position.y = GROUND; group.add(bb);
  }
  // nuvens
  if (tr.theme !== 'cidade') {
    const cl = mergeGeos([[new THREE.IcosahedronGeometry(14, 0).scale(1.6, 0.6, 1), '#ffffff'], [new THREE.IcosahedronGeometry(10, 0).scale(1.4, 0.6, 1).translate(16, 2, 4), '#ffffff'], [new THREE.IcosahedronGeometry(9, 0).scale(1.3, 0.6, 1).translate(-15, 1, -3), '#f3f6ff']]);
    const L = []; for (let k = 0; k < 26; k++) L.push([area.cx + (R() * 2 - 1) * (area.ext + 300), area.cz + (R() * 2 - 1) * (area.ext + 300), 1 + R(), R() * 6]);
    const im = new THREE.InstancedMesh(cl, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: tr.theme === 'deserto' ? 0.55 : 0.9, fog: false }), L.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    L.forEach(([x, z, s, r], k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(new THREE.Vector3(x, 180 + s * 60, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(k, m4); });
    if (tr.theme === 'deserto') im.material.color.set('#ffc6a8');
    group.add(im);
  }
}

// ---------- minimapa ----------
function drawMiniBase(tr) {
  const b = tr.bounds, pad = 0.08, w = b.maxx - b.minx, h = b.maxz - b.minz, sc = (1 - pad * 2) / Math.max(w, h);
  const ox = (1 - w * sc) / 2, oz = (1 - h * sc) / 2;
  const map = (x, z) => [ox + (b.maxx - x) * sc, oz + (z - b.minz) * sc]; // espelha x para ficar como visto de cima
  return { map };
}
function drawMap(cv, tr, dots = [], thick = 1) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const mp = (world && world.tr === tr ? world.mini : drawMiniBase(tr)).map;
  const path = (a, b) => { c.beginPath(); let started = false; for (let i = a; i < b; i += 3) { if (tr.FL[i] & FLAG_GAP) { started = false; continue; } const [x, y] = mp(tr.P[i * 3], tr.P[i * 3 + 2]); started ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H); started = true; } c.stroke(); };
  c.lineCap = c.lineJoin = 'round';
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 9 * thick; path(0, tr.n);
  c.strokeStyle = '#e9e4ff'; c.lineWidth = 4 * thick; path(0, tr.n);
  for (const pc of tr.pieces) {
    if (pc.kind !== 'loop' && pc.kind !== 'jump') continue;
    let i = pc.start; while (i < tr.n && !(tr.FL[i] & (pc.kind === 'loop' ? FLAG_LOOP : FLAG_RAMP))) i++;
    const [x, y] = mp(tr.P[i * 3], tr.P[i * 3 + 2]);
    c.fillStyle = pc.kind === 'loop' ? '#ff7a1a' : '#2be4ff'; c.beginPath(); c.arc(x * W, y * H, 6 * thick, 0, 7); c.fill();
  }
  const [sx, sy] = mp(tr.P[tr.start * 3], tr.P[tr.start * 3 + 2]); c.fillStyle = '#3dff9a'; c.beginPath(); c.arc(sx * W, sy * H, 7 * thick, 0, 7); c.fill();
  const [fx, fy] = mp(tr.P[tr.finish * 3], tr.P[tr.finish * 3 + 2]); c.fillStyle = '#fff'; c.fillRect(fx * W - 7 * thick, fy * H - 7 * thick, 14 * thick, 14 * thick); c.fillStyle = '#111'; c.fillRect(fx * W - 7 * thick, fy * H - 7 * thick, 7 * thick, 7 * thick); c.fillRect(fx * W, fy * H, 7 * thick, 7 * thick);
  for (const d of dots) { const [x, y] = mp(d.x, d.z); c.fillStyle = d.c; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.arc(x * W, y * H, d.r || 7, 0, 7); c.fill(); c.stroke(); }
}

// ---------- som (sintetizado) ----------
// perfil sonoro de cada motor: cilindros, marcha lenta, corte de giro, aspereza, brilho, esportividade (estalos)
const ENGINES = {
  escort: { cyl: 4, idle: 900, red: 5800, rough: 0.2, tone: 0.75, sport: 0, note: 'carburado' },
  corsa: { cyl: 4, idle: 850, red: 6000, rough: 0.17, tone: 0.8, sport: 0 },
  p206: { cyl: 4, idle: 850, red: 6800, rough: 0.14, tone: 0.95, sport: 0.15 },
  golf: { cyl: 4, idle: 800, red: 6000, rough: 0.13, tone: 0.82, sport: 0.1 },
  p307: { cyl: 4, idle: 800, red: 6800, rough: 0.14, tone: 0.95, sport: 0.45 },
  p308: { cyl: 4, idle: 750, red: 6300, rough: 0.12, tone: 1.0, sport: 0.6, turbo: true },
  city: { cyl: 4, idle: 750, red: 6800, rough: 0.1, tone: 1.05, sport: 0.25 },
  megane: { cyl: 4, idle: 800, red: 6300, rough: 0.13, tone: 0.9, sport: 0.1 },
  rsq3: { cyl: 5, idle: 750, red: 6800, rough: 0.42, tone: 1.2, sport: 1, turbo: true },
  c4r: { cyl: 4, idle: 800, red: 7000, rough: 0.14, tone: 1.1, sport: 0.6 },
  c4b: { cyl: 4, idle: 800, red: 7000, rough: 0.14, tone: 1.1, sport: 0.6 },
};
const Audio = {
  ctx: null, muted: store.get('vr_mute', false), carId: null, rf: 0, load: 0, boost: 0, prevThr: 0, prevGear: 0, cut: 0, popsUntil: 0, lim: 0,
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; this.master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // escapamento: onda com os harmônicos das explosões -> saturação -> filtro -> ressonância
      this.osc = ctx.createOscillator();
      this.pre = ctx.createGain(); this.pre.gain.value = 1;
      this.shaper = ctx.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; cv[i] = Math.tanh(2.2 * x); } this.shaper.curve = cv;
      this.lpf = ctx.createBiquadFilter(); this.lpf.type = 'lowpass'; this.lpf.Q.value = 0.9;
      this.res = ctx.createBiquadFilter(); this.res.type = 'peaking'; this.res.frequency.value = 140; this.res.Q.value = 1.4; this.res.gain.value = 7;
      this.hpf = ctx.createBiquadFilter(); this.hpf.type = 'highpass'; this.hpf.frequency.value = 60; this.hpf.Q.value = 0.7;
      this.eng = ctx.createGain(); this.eng.gain.value = 0;
      this.osc.connect(this.pre); this.pre.connect(this.shaper); this.shaper.connect(this.lpf); this.lpf.connect(this.res); this.res.connect(this.hpf); this.hpf.connect(this.eng); this.eng.connect(this.master);
      this.osc.start();
      // ronco grave do virabrequim
      this.sub = ctx.createOscillator(); this.sub.type = 'sine'; this.subG = ctx.createGain(); this.subG.gain.value = 0; this.sub.connect(this.subG); this.subG.connect(this.master); this.sub.start();
      // admissão (ar entrando), assobio do turbo
      const mk = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return { g, fl }; };
      this.intake = mk('bandpass', 600, 1.3); this.screechN = mk('bandpass', 2400, 6); this.windN = mk('lowpass', 500, 0.5); this.nosN = mk('bandpass', 1200, 0.8);
      this.turbo = ctx.createOscillator(); this.turbo.type = 'sine'; this.turboG = ctx.createGain(); this.turboG.gain.value = 0; this.turbo.connect(this.turboG); this.turboG.connect(this.master); this.turbo.start();
    } catch { this.ctx = null; }
  },
  setCar(id) {
    if (!this.ctx || this.carId === id) return; this.carId = id;
    const p = ENGINES[id] || ENGINES.golf, N = 110, re = new Float32Array(N + 1), im = new Float32Array(N + 1), R = rng(id.length * 977 + p.cyl);
    // harmônicos do ciclo do motor (2 voltas): as ordens de ignição dominam; as outras dão a aspereza
    for (let k = 1; k <= N; k++) {
      const order = k / p.cyl; let a;
      // fundamental da ignição fraca (é grave demais para alto-falantes); 2ª a 8ª ordens carregam o ronco
      if (k % p.cyl === 0) a = order === 1 ? 0.45 : 1.25 / Math.pow(order, 0.55);
      else if (p.cyl % 2 === 0 && k % (p.cyl / 2) === 0) a = 0.1 / Math.pow(order + 0.5, 0.6);
      else a = p.rough * (0.4 + R()) / Math.pow(order + 0.5, 0.6);
      const ph = R() * Math.PI * 2; re[k] = a * Math.cos(ph); im[k] = a * Math.sin(ph);
    }
    this.osc.setPeriodicWave(this.ctx.createPeriodicWave(re, im, { disableNormalization: false }));
    this.rf = 0; this.boost = 0;
  },
  toggle() { this.muted = !this.muted; store.set('vr_mute', this.muted); if (this.master) this.master.gain.value = this.muted ? 0 : 0.55; toast(this.muted ? 'Som desligado' : 'Som ligado', 1200); },
  silence() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const g of [this.eng.gain, this.subG.gain, this.turboG.gain, this.intake.g.gain, this.screechN.g.gain, this.windN.g.gain, this.nosN.g.gain]) g.setTargetAtTime(0, t, 0.08); },
  engine(car, on, inp = {}, free = false, dt = 1 / 60) {
    if (!this.ctx) return;
    if (!on || !car) { this.silence(); return; }
    this.setCar(car.spec.id);
    const p = ENGINES[car.spec.id] || ENGINES.golf, t = this.ctx.currentTime, now = performance.now() / 1000;
    const thr = car.mode === 'crash' ? 0 : (inp.throttle || 0);
    // rotação-alvo: marcha calculada pela velocidade; giro livre na largada e no ar
    let target, gear = 0;
    if (free || car.mode !== 'ground') target = thr > 0 ? 0.93 : 0.02;
    else {
      const r = Math.abs(car.v) / car.spec.vmax * 5.2; gear = Math.min(4, Math.floor(r)); const f = Math.min(1, r - gear);
      target = gear === 0 ? 0.06 + 0.94 * f : 0.56 + 0.44 * f;
      if (thr && Math.abs(car.v) < 6) target = Math.max(target, 0.32 * thr); // embreagem patinando na saída
    }
    const up = free || car.mode !== 'ground' ? 3.2 : 14, down = free || car.mode !== 'ground' ? 2.2 : 14;
    this.rf += (target - this.rf) * Math.min(1, dt * (target > this.rf ? up : down));
    this.load += ((car.nitroOn ? 1.25 : thr) - this.load) * Math.min(1, dt * 10);
    // troca de marcha: corte rápido de giro
    if (car.mode === 'ground' && gear > this.prevGear && thr > 0.5) { this.cut = 0.09; if (p.sport > 0.4) this.pop(0.5); }
    this.prevGear = gear;
    // tirou o pé em giro alto: estalos no escape e alívio do turbo
    if (this.prevThr > 0.5 && thr < 0.2 && this.rf > 0.5) { this.popsUntil = now + 0.5 + p.sport * 0.6; if (p.turbo && this.boost > 0.45) this.blowoff(this.boost); }
    this.prevThr = thr;
    if (p.sport > 0 && now < this.popsUntil && thr < 0.2 && Math.random() < dt * 14 * p.sport) this.pop(1);
    if (p.turbo) { const bt = thr * Math.max(0, Math.min(1, (this.rf - 0.25) / 0.5)); this.boost += (bt - this.boost) * Math.min(1, dt * (bt > this.boost ? 1.3 : 5)); if (thr < 0.2) this.boost *= 0.9; }
    // limitador de giro
    let limiter = 1; if (this.rf > 0.985 && thr > 0.5) { this.lim += dt * 15; limiter = Math.floor(this.lim) % 2 ? 0.25 : 1; }
    if (this.cut > 0) this.cut -= dt;
    const rpm = p.idle + this.rf * (p.red - p.idle);
    const cycle = rpm / 120, jitter = 1 + (Math.random() - 0.5) * (this.rf < 0.1 ? 0.03 : 0.006);
    this.osc.frequency.setTargetAtTime(cycle * jitter, t, 0.015);
    this.sub.frequency.setTargetAtTime(rpm / 60 * p.cyl / 2, t, 0.02);
    const overrun = thr < 0.2 && this.rf > 0.25;
    this.pre.gain.setTargetAtTime(0.5 + this.load * 2.3, t, 0.03);
    this.lpf.frequency.setTargetAtTime((overrun ? 220 + this.rf * 700 : 260 + this.rf * 1500 + this.load * 2000) * p.tone, t, 0.03);
    this.res.frequency.setTargetAtTime(110 + this.rf * 260, t, 0.05);
    let vol = (0.09 + 0.07 * this.rf + 0.08 * this.load) * (overrun ? 0.55 : 1) * limiter * (this.cut > 0 ? 0.25 : 1);
    if (car.mode === 'crash') vol = 0.02;
    this.eng.gain.setTargetAtTime(vol, t, 0.025);
    this.subG.gain.setTargetAtTime(0.05 * (1 - this.rf) + 0.01, t, 0.05);
    this.intake.fl.frequency.setTargetAtTime(350 + this.rf * 2600, t, 0.04);
    this.intake.g.gain.setTargetAtTime(0.06 * this.load * (0.3 + this.rf), t, 0.04);
    this.turbo.frequency.setTargetAtTime(2400 + this.boost * 4200, t, 0.05);
    this.turboG.gain.setTargetAtTime(p.turbo ? this.boost * 0.028 : 0, t, 0.05);
    const sl = car.mode === 'ground' ? Math.min(1, Math.abs(car.slip) * 3) * Math.min(1, Math.abs(car.v) / 15) : 0;
    this.screechN.g.gain.setTargetAtTime(sl * 0.16, t, 0.05);
    this.windN.g.gain.setTargetAtTime(Math.min(1, car.speedKmh / 250) * 0.2, t, 0.1);
    this.nosN.g.gain.setTargetAtTime(car.nitroOn ? 0.26 : 0, t, 0.05);
  },
  pop(strength = 1) {
    // estalo do escapamento: estouro curto e grave
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.6 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 900; f.Q.value = 1.2;
    const g = ctx.createGain(); const v = (0.25 + Math.random() * 0.3) * strength; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + Math.random() * 0.04);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 0.1);
  },
  blowoff(b) {
    // válvula de alívio do turbo ("psssh")
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(3800, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * b, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 0.55); this.boost = 0;
  },
  blip(freq = 660, dur = 0.12, type = 'sine', vol = 0.3) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  thump(vol = 0.6, dur = 0.35, freq = 300) {
    if (!this.ctx) return; const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur);
  },
};

// ---------- controles ----------
const keys = new Set();
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && Game.race) e.preventDefault();
  keys.add(e.code);
  if (UI.splash && !UI.pinFor && UI.who && isUnlocked(UI.who) && !Game.race && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); setWho(UI.who); return; }
  if (Game.race) {
    if (e.code === 'KeyC') Game.camMode = (Game.camMode + 1) % 3;
    if (e.code === 'KeyR' && Game.race.state === 'race' && Game.race.car.mode !== 'crash') Game.race.car.respawn();
    if (e.code === 'Escape' || e.code === 'KeyP') Game.togglePause();
  }
  if (e.code === 'KeyM') Audio.toggle();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (Game.race && Game.race.state === 'race' && !Game.paused) Game.togglePause(); });
// toque: botões na tela (vários dedos ao mesmo tempo) ou direção inclinando o aparelho
const TK = { left: 0, right: 0, gas: 0, brake: 0, nitro: 0, hand: 0 };
const tilt = { on: store.get('vr_tilt', false), v: 0, ok: false };
let lastDev = TOUCH ? 'toque' : 'teclado';
function initTouch() {
  const tc = $('#tc'); if (!tc) return;
  tc.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} TK[k] = 1; b.classList.add('on'); lastDev = 'toque'; Audio.init(); };
    const off = e => { e.preventDefault(); TK[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  tc.querySelectorAll('[data-a]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); const a = b.dataset.a, r = Game.race; if (!r) return;
    if (a === 'pause') Game.togglePause(); if (a === 'cam') { Game.camMode = (Game.camMode + 1) % 3; }
    if (a === 'reset' && r.state === 'race' && r.car.mode !== 'crash') r.car.respawn(); }));
  setTilt(tilt.on, true);
}
function onTilt(e) {
  if (e.beta == null) return; tilt.ok = true;
  const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
  // deitado: virar o aparelho como um volante muda o beta; em pé, o gamma
  const raw = ang === 90 ? e.beta : (ang === -90 || ang === 270) ? -e.beta : -e.gamma;
  tilt.v = Math.max(-1, Math.min(1, -raw / 22));
}
async function setTilt(on, silent) {
  if (on && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    try { if (await DeviceOrientationEvent.requestPermission() !== 'granted') on = false; } catch { on = false; }
  }
  tilt.on = on; store.set('vr_tilt', on); document.body.classList.toggle('tilt', on);
  removeEventListener('deviceorientation', onTilt); if (on) addEventListener('deviceorientation', onTilt);
  if (!silent) toast(on ? 'Direção: incline o celular como um volante' : 'Direção: botões ◀ ▶', 2200);
}
// tela cheia e paisagem ao começar a corrida no celular (onde o navegador deixa)
function goFullscreen() {
  if (!TOUCH) return; const el = document.documentElement;
  try { const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.(); Promise.resolve(p).then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch {}
}
let steerSmooth = 0, padPrev = {};
function readInput(dt) {
  if (window.__vr && window.__vr.autodrive && Game.race) return autopilot(Game.race.car);
  const k = c => keys.has(c);
  if (!TOUCH && keys.size) lastDev = 'teclado';
  let throttle = (k('ArrowUp') || k('KeyW')) ? 1 : 0, brake = (k('ArrowDown') || k('KeyS')) ? 1 : 0;
  let target = ((k('ArrowLeft') || k('KeyA')) ? 1 : 0) - ((k('ArrowRight') || k('KeyD')) ? 1 : 0);
  let nitro = k('ShiftLeft') || k('ShiftRight') || k('KeyN'), handbrake = k('Space');
  let analog = null;
  try {
    for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!gp) continue; const ax = gp.axes[0] || 0, bt = i => gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0;
      if (Math.abs(ax) > 0.12) { analog = -ax; lastDev = 'controle'; }
      throttle = Math.max(throttle, bt(7)); brake = Math.max(brake, bt(6));
      if (bt(0) > 0.5 || bt(5) > 0.5) nitro = true; if (bt(2) > 0.5) handbrake = true;
      const edge = (i, fn) => { const p = bt(i) > 0.5; if (p && !padPrev[i]) fn(); padPrev[i] = p; };
      edge(3, () => { if (Game.race && Game.race.state === 'race' && Game.race.car.mode !== 'crash') Game.race.car.respawn(); });
      edge(9, () => Game.race && Game.togglePause()); edge(4, () => { if (Game.race) Game.camMode = (Game.camMode + 1) % 3; });
    }
  } catch {}
  if (TK.gas || TK.brake || TK.left || TK.right || TK.nitro || TK.hand) {
    throttle = Math.max(throttle, TK.gas); brake = Math.max(brake, TK.brake); if (TK.nitro) nitro = true; if (TK.hand) handbrake = true;
    if (!tilt.on) target = TK.left - TK.right;
  }
  if (tilt.on && tilt.ok && Game.race) analog = Math.abs(tilt.v) < 0.04 ? 0 : tilt.v;
  if (analog != null) steerSmooth = analog;
  else { const rate = target === 0 ? 7 : (Math.sign(target) !== Math.sign(steerSmooth) ? 9 : 4.5); steerSmooth += (target - steerSmooth) * Math.min(1, rate * dt); if (Math.abs(steerSmooth) < 0.01 && !target) steerSmooth = 0; }
  return { throttle, brake, steer: steerSmooth, nitro, handbrake };
}

// ---------- câmera ----------
const cam = { pos: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1), fov: 62, init: false };
function updateCamera(dt, car, mode, cinematic = 0) {
  const pos = new THREE.Vector3(...car.pos), q = new THREE.Quaternion(...car.quat);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  if (car.mode === 'air') up.lerp(new THREE.Vector3(0, 1, 0), 0.5).normalize();
  const k = 1 - Math.exp(-dt * (car.mode === 'ground' ? 7 : 3));
  if (car.mode !== 'crash') cam.fwd.lerp(fwd, k).normalize();
  cam.up.lerp(car.mode === 'crash' ? new THREE.Vector3(0, 1, 0) : up, 1 - Math.exp(-dt * 4)).normalize();
  let want;
  if (cinematic) {
    const a = performance.now() / 1000 * 0.25; const side = new THREE.Vector3().crossVectors(cam.fwd, cam.up).normalize();
    want = pos.clone().addScaledVector(cam.fwd, Math.cos(a) * 10).addScaledVector(side, Math.sin(a) * 10).addScaledVector(cam.up, 3.2);
  } else if (mode === 2) want = pos.clone().addScaledVector(up, 1.3).addScaledVector(fwd, 0.4);
  else want = pos.clone().addScaledVector(cam.fwd, mode === 1 ? -7.2 : -5.0).addScaledVector(cam.up, mode === 1 ? 2.5 : 1.75);
  if (!cam.init) { cam.pos.copy(want); cam.init = true; }
  if (mode === 2 && !cinematic) cam.pos.copy(want); else if (car.mode !== 'crash' || cinematic) cam.pos.lerp(want, 1 - Math.exp(-dt * 10));
  // não deixar a câmera abaixo do chão
  if (cam.pos.y < GROUND + 0.5) cam.pos.y = GROUND + 0.5;
  camera.position.copy(cam.pos); camera.up.copy(cam.up);
  const look = mode === 2 && !cinematic ? pos.clone().addScaledVector(fwd, 30).addScaledVector(up, 1) : pos.clone().addScaledVector(cam.fwd, 3).addScaledVector(cam.up, 1.0);
  camera.lookAt(look);
  const tf = 60 + Math.min(1, car.speedKmh / 260) * 14 + (car.nitroOn ? 8 : 0);
  cam.fov += (tf - cam.fov) * Math.min(1, dt * 3); camera.fov = cam.fov; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  if (world) world.group.children.forEach(o => { if (o.userData.followCam) o.position.copy(camera.position); });
  // sol e sombra acompanham o carro
  if (world) { sun.position.copy(pos).addScaledVector(world.sunDir, 200); sun.target.position.copy(pos); }
}
function poseCar(mesh, car, dt, inp) {
  mesh.position.set(car.pos[0], car.pos[1], car.pos[2]); mesh.quaternion.set(...car.quat);
  const u = mesh.userData; if (!u.wheels) return;
  u.spinA += (car.mode === 'ground' ? car.v : car.mode === 'air' ? 0 : 0) * dt / u.p.wr;
  for (const w of u.wheels) { w.spin.rotation.x = u.spinA; if (w.front) w.g.rotation.y = (inp?.steer || 0) * 0.45; }
  u.body.rotation.z = car.mode === 'ground' ? -(inp?.steer || 0) * 0.045 * Math.min(1, Math.abs(car.v) / 20) : 0;
  if (u.glow) u.glow.visible = car.mode !== 'crash';
  for (const f of u.flames) { f.visible = !!car.nitroOn; f.scale.set(1, 1, 0.7 + Math.random() * 0.6); }
}

// ---------- jogo ----------
const Game = {
  race: null, paused: false, camMode: 0, attract: null,
  startAttract() {
    this.race = null; Audio.engine(null, false);
    const seed = Math.floor(Math.random() * 1e6), carId = CARS[Math.floor(Math.random() * CARS.length)].id;
    const tr = genTrack(seed, carId); buildWorld(tr);
    const car = new Car(tr, carById(carId)); car.s = 60 + Math.random() * 400; car.v = 25; car.updatePose();
    const mesh = buildCarMesh(car.spec); scene.add(mesh);
    if (this.attract) scene.remove(this.attract.mesh);
    this.attract = { tr, car, mesh }; cam.init = false;
    $('#hud').classList.add('hidden');
  },
  stopAttract() { if (this.attract) { scene.remove(this.attract.mesh); this.attract = null; } },
  startRace(opts) {
    // opts: {track, carId, ghost(frames), ghostSplits, target, label, mode:'treino'|'duel', onStart, onFinish}
    this.stopAttract(); Audio.init();
    const tr = opts.track; if (!world || world.tr !== tr) buildWorld(tr);
    const car = new Car(tr, carById(opts.carId));
    const mesh = buildCarMesh(car.spec); scene.add(mesh);
    let gmesh = null; if (opts.ghost) { gmesh = buildCarMesh(car.spec, true); scene.add(gmesh); }
    this.race = { opts, tr, car, mesh, gmesh, t: 0, state: 'countdown', cd: 3.6, rec: [], recT: 0, splits: [], acc: 0, lastBeep: 4, airStart: 0 };
    this.paused = false; cam.init = false; this.camMode = store.get('vr_cam', 0);
    $('#screen').classList.add('hidden'); $('#hud').classList.remove('hidden'); $('#pause').classList.remove('on'); document.body.classList.add('racing');
    for (const k in TK) TK[k] = 0; document.querySelectorAll('#tc .on').forEach(b => b.classList.remove('on'));
    $('#hWho').innerHTML = opts.label || ''; $('#hTarget').textContent = opts.target ? 'Tempo a bater: ' + fmt(opts.target) + ' (com batidas)' : '';
    $('#hDelta').textContent = ''; const hh0 = $('#hHits'); hh0.dataset.n = ''; 
    renderer.domElement.focus?.();
  },
  endRace() {
    const r = this.race; if (!r) return; scene.remove(r.mesh); if (r.gmesh) scene.remove(r.gmesh); store.set('vr_cam', this.camMode);
    this.race = null; this.paused = false; UI.activeRace = false; Audio.engine(null, false); $('#hud').classList.add('hidden'); hudMsg(''); document.body.classList.remove('racing');
  },
  togglePause() {
    const r = this.race; if (!r || r.state === 'done') return;
    this.paused = !this.paused; $('#pause').classList.toggle('on', this.paused);
    if (this.paused) {
      Audio.engine(null, false);
      const duel = r.opts.mode === 'duel';
      $('#pauseInfo').textContent = duel ? 'O cronômetro está parado. Se desistir, a corrida conta como não concluída.' : 'Treino livre — nada é registrado.';
      $('#pauseBtns').innerHTML = `<button class="btn" id="pResume">Continuar</button>${duel ? '<button class="btn alt" id="pQuit">Desistir</button>' : '<button class="btn alt" id="pRetry">Recomeçar</button><button class="btn alt" id="pQuit">Sair</button>'}`;
      if (TOUCH) { $('#pauseBtns').insertAdjacentHTML('beforeend', `<button class="btn alt" id="pTilt">Direção: ${tilt.on ? 'inclinar' : 'botões'}</button>`); $('#pTilt').onclick = async () => { await setTilt(!tilt.on); $('#pTilt').textContent = 'Direção: ' + (tilt.on ? 'inclinar' : 'botões'); }; }
      $('#pResume').onclick = () => this.togglePause();
      $('#pQuit').onclick = () => { const o = r.opts; this.endRace(); o.onQuit && o.onQuit(); };
      const rt = $('#pRetry'); if (rt) rt.onclick = () => { const o = r.opts; this.endRace(); this.startRace(o); };
    }
  },
  tick(dt) {
    const r = this.race;
    if (!r) {
      if (this.attract) { const a = this.attract; a.acc = (a.acc || 0) + dt; while (a.acc >= 1 / 120) { a.acc -= 1 / 120; a.car.step(1 / 120, autopilot(a.car)); a.car.events.length = 0; } if (a.car.s > a.tr.finish - 50) { a.car.reset(60); } poseCar(a.mesh, a.car, dt, { steer: 0 }); updateCamera(dt, a.car, 0, 1); }
      return;
    }
    const car = r.car; const inp = readInput(dt);
    if (!this.paused) {
      if (r.state === 'countdown') {
        r.cd -= dt; const n = Math.ceil(r.cd - 0.6);
        if (n < r.lastBeep && n >= 1 && n <= 3) { r.lastBeep = n; hudMsg(String(n), '#fff'); Audio.blip(520, 0.18); }
        if (r.cd <= 0.6) { r.state = 'race'; hudMsg('JÁ!', '#3dff9a', 700); Audio.blip(1040, 0.35); r.opts.onStart && r.opts.onStart(); }
      } else {
        const FIX = 1 / 120; r.acc += Math.min(dt, 0.1);
        while (r.acc >= FIX) {
          r.acc -= FIX;
          const sPrev = car.s, cmd = r.state === 'race' ? inp : autopilotSoft(car);
          car.step(FIX, cmd);
          if (r.state === 'race') {
            r.t += FIX;
            r.recT += FIX; if (r.recT >= 1 / GHOST_HZ - 1e-9) { r.recT -= 1 / GHOST_HZ; r.rec.push([...car.pos, ...car.quat]); }
            if (car.mode === 'ground' && car.s >= r.tr.finish && sPrev < r.tr.finish) {
              const tf = r.t - FIX + FIX * (r.tr.finish - sPrev) / Math.max(1e-6, car.s - sPrev);
              this.finish(tf); break;
            }
          }
          for (const e of car.events) this.onEvent(e, r);
          car.events.length = 0;
        }
      }
    }
    // ghost
    if (r.gmesh) { const g = ghostAt(r.opts.ghost, r.state === 'countdown' ? 0 : r.t); if (g) { r.gmesh.position.set(...g.pos); r.gmesh.quaternion.set(...g.quat); r.gmesh.visible = !g.done; } }
    poseCar(r.mesh, car, this.paused ? 0 : dt, inp);
    updateCamera(dt, car, this.camMode);
    if (world && world.C.night) { const p = r.mesh.position, f = new THREE.Vector3(0, 0, 1).applyQuaternion(r.mesh.quaternion); headlight.position.copy(p).add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(f, 1.5); headlight.target.position.copy(p).addScaledVector(f, 30); }
    Audio.engine(car, !this.paused, inp, r.state === 'countdown', dt);
    updateHud(r);
  },
  onEvent(e, r) {
    const car = r.car;
    if (e === 'crash') { hudMsg('CRASH!', '#ff2a6d', 1400); Audio.thump(0.9, 0.7, 500); }
    else if (e === 'wall') Audio.thump(Math.min(0.6, car.wallHit), 0.18, 900);
    else if (e === 'air') r.airStart = r.t;
    else if (e === 'land') { const at = r.t - r.airStart; Audio.thump(Math.min(0.5, (car.landImpact || 0) / 30), 0.2, 250); if (at > 0.9 && r.state === 'race') hudSmall('Voou ' + at.toFixed(1) + ' s!'); }
    else if (e === 'respawn') hudSmall('De volta ao checkpoint');
    else if (e === 'hitpts') Audio.blip(220, 0.15, 'square', 0.12);
    else if (e === 'cp' && r.state === 'race') {
      r.splits.push([car.lastCP, +r.t.toFixed(3)]); Audio.blip(880, 0.08, 'triangle', 0.18);
      const gs = r.opts.ghostSplits && r.opts.ghostSplits.find(s => s[0] === car.lastCP);
      if (gs) { const d = r.t - gs[1]; const el = $('#hDelta'); el.textContent = (d > 0 ? '+' : '−') + Math.abs(d).toFixed(2); el.style.color = d > 0 ? '#ff2a6d' : '#3dff9a'; clearTimeout(el.t); el.t = setTimeout(() => el.textContent = '', 3500); }
    }
  },
  finish(t) {
    const r = this.race; r.state = 'done'; r.t = t; r.rec.push([...r.car.pos, ...r.car.quat]);
    hudMsg('CHEGADA!', '#ffd23f', 2200); [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => Audio.blip(f, 0.2, 'square', 0.15), i * 110));
    const pen = r.car.penalty, final = t + pen;
    $('#hTime').textContent = fmt(final); if (pen) hudSmall(`${fmt(t)} + ${pen} s de batidas`);
    const res = { time: +final.toFixed(3), raw: +t.toFixed(3), penalty: pen, ghost: encodeGhost(r.rec), splits: r.splits, crashes: r.car.crashes };
    setTimeout(() => { if (this.race === r) { const o = r.opts; this.endRace(); o.onFinish && o.onFinish(res); } }, 2600);
  },
};
function autopilotSoft(car) { const a = autopilot(car); a.throttle *= 0.3; a.nitro = false; if (car.v > 20) { a.throttle = 0; a.brake = 0.4; } return a; }
let msgT = 0;
function hudMsg(text, color = '#fff', ms = 900) { const el = $('#hMsg'); el.textContent = text; el.style.color = color; el.style.textShadow = `0 0 30px ${color}, 0 4px 0 rgba(0,0,0,.5)`; el.style.opacity = text ? 1 : 0; clearTimeout(msgT); if (text) msgT = setTimeout(() => el.style.opacity = 0, ms); }
let smallT = 0;
function hudSmall(text) { const el = $('#hSmall'); el.textContent = text; clearTimeout(smallT); smallT = setTimeout(() => el.textContent = '', 1600); }
let miniT = 0;
function updateHud(r) {
  const car = r.car;
  if (r.state !== 'done') $('#hTime').textContent = fmt(r.t);
  const pen = car.penalty, hh = $('#hHits'); if (hh.dataset.n != pen) { hh.dataset.n = pen; hh.textContent = `Batidas: ${pen}` + (pen ? ` (+${pen} s)` : ''); hh.classList.toggle('on', pen > 0); if (pen) { hh.classList.add('pop'); setTimeout(() => hh.classList.remove('pop'), 180); } }
  $('#hSpeed').textContent = Math.round(car.speedKmh); $('#hGear').textContent = car.gear;
  $('#hRpm').style.width = (car.rpm * 100).toFixed(0) + '%'; $('#hNos').style.width = (car.nitro * 100).toFixed(0) + '%';
  $('#nosfx').style.opacity = car.nitroOn ? 1 : 0;
  if ((miniT += 1) % 3 === 0) {
    const dots = []; if (r.gmesh && r.gmesh.visible) dots.push({ x: r.gmesh.position.x, z: r.gmesh.position.z, c: '#2be4ff', r: 9 });
    dots.push({ x: car.pos[0], z: car.pos[2], c: '#ff7a1a', r: 11 }); drawMap($('#mini'), r.tr, dots, 1.6);
  }
}

// ---------- loop principal ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { Game.tick(dt); } catch (e) { console.error(e); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ================= JOGADORES / RODADAS / BANCO =================
// Cada desafio é uma rodada: todos correm a mesma pista com o mesmo carro, uma vez cada. A rodada fecha quando o Pai e o
// Filho tiverem corrido (os convidados correm enquanto ela estiver aberta). Melhor tempo vence e lança a próxima.
// Rodada parada há mais de ROUND_DAYS fecha sozinha.
const DEFAULT_PLAYERS = [{ id: 'pai', name: 'Vogel Pai', color: '#ff7a1a', order: 1 }, { id: 'filho', name: 'Vogel Filho', color: '#2be4ff', order: 2 }];
const PALETTE = ['#3dff9a', '#ffd23f', '#ff2a6d', '#b04dff', '#7fd4ff', '#ff9ad5', '#c6ff3d'];
const ROUND_DAYS = 7;
const CORE = ['pai', 'filho']; // a rodada só espera por eles
const DB = { db: null, ready: false, duels: [], players: DEFAULT_PLAYERS.slice(), playersReady: false, playersErr: null, local: false };
const PL = id => DB.players.find(p => p.id === id) || DEFAULT_PLAYERS.find(p => p.id === id) || { id, name: id, color: '#cccccc' };
const pname = id => PL(id).name;
const pshort = id => pname(id).replace(/^Vogel\s+/i, '');
const ptag = id => `<b style="color:${PL(id).color}">${esc(pname(id))}</b>`;
// PIN de 4 dígitos: guardado só como resumo (não é segurança forte, é uma tranca de porta)
function cyrb53(str, seed = 7) { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
const pinHash = (id, pin) => cyrb53(`vogels:${id}:${pin}`);
const unlocked = () => store.get('vr_unlocked', []);
const isUnlocked = id => DB.playersErr ? true : unlocked().includes(id);
const unlock = id => store.set('vr_unlocked', [...new Set([...unlocked(), id])]);
const lock = id => store.set('vr_unlocked', unlocked().filter(x => x !== id));

// fora do Claude: Firestore (Firebase) com a mesma interface do banco do artefato
async function firebaseDB(cfg) {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const { initializeApp } = await import(base + 'firebase-app.js');
  const F = await import(base + 'firebase-firestore.js');
  const fs = F.getFirestore(initializeApp(cfg));
  // o Firestore não aceita lista dentro de lista (as parciais são [[distância, tempo], ...]): vão como texto JSON
  const enc = v => Array.isArray(v) ? (v.some(Array.isArray) ? { __json: JSON.stringify(v) } : v.map(enc)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) : v;
  const dec = v => Array.isArray(v) ? v.map(dec) : v && typeof v === 'object' ? ('__json' in v ? JSON.parse(v.__json) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]))) : v;
  const doc = p => { const r = F.doc(fs, p); return { set: d => F.setDoc(r, enc(d)), update: d => F.updateDoc(r, enc(d)), get: async () => { const s = await F.getDoc(r); return { exists: s.exists(), data: () => dec(s.data()) }; } }; };
  const collection = name => ({ orderBy: (f, dir) => ({ limit: n => ({ onSnapshot: (cb, err) => F.onSnapshot(F.query(F.collection(fs, name), F.orderBy(f, dir), F.limit(n)), { includeMetadataChanges: true },
    s => cb({ docs: s.docs.map(d => ({ id: d.id, data: () => dec(d.data()) })), metadata: { fromCache: s.metadata.fromCache } }), err) }) }) });
  return { doc, collection };
}
async function initDB() {
  let cl = null;
  if (window.VR_FIREBASE) { try { DB.db = await firebaseDB(window.VR_FIREBASE); } catch (e) { console.warn('Firebase', e); DB.db = null; } }
  else {
    for (let k = 0; k < 30 && !(cl = window.claude); k++) await new Promise(r => setTimeout(r, 100));
    try { DB.db = cl && cl.use ? await cl.use('db') : null; } catch { DB.db = null; }
  }
  if (!DB.db) {
    DB.local = true; DB.duels = store.get('vr_local_duels', []); DB.players = store.get('vr_local_players', DEFAULT_PLAYERS.slice());
    DB.ready = true; DB.playersReady = true; render(); return;
  }
  const to = setTimeout(() => { if (!DB.ready) { DB.ready = true; DB.offline = true; render(); } }, 10000);
  DB.db.collection('duels').orderBy('n', 'desc').limit(300).onSnapshot(snap => {
    DB.duels = snap.docs.map(d => ({ id: d.id, ...d.data() })); if (!snap.metadata.fromCache) { clearTimeout(to); DB.offline = false; }
    DB.ready = true; if (!snap.metadata.fromCache) finalizeExpired(); render();
  }, err => { clearTimeout(to); DB.ready = true; DB.err = err.code; render(); });
  DB.db.collection('players').orderBy('order', 'asc').limit(50).onSnapshot(snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!list.length && !snap.metadata.fromCache && !DB.seeded) { DB.seeded = true; for (const p of DEFAULT_PLAYERS) DB.db.doc('players/' + p.id).set({ name: p.name, color: p.color, order: p.order }).catch(() => {}); }
    if (list.length) DB.players = list;
    if (!snap.metadata.fromCache || list.length) { DB.playersReady = true; DB.playersErr = null; }
    render();
  }, err => { console.warn('players', err); DB.playersErr = err.code || 'erro'; DB.playersReady = true; render(); });
}
async function dbSetDuel(id, data, merge) {
  if (DB.local) { const all = store.get('vr_local_duels', []); const i = all.findIndex(d => d.id === id); if (i < 0) all.unshift({ id, ...data }); else all[i] = deepMerge(all[i], data); store.set('vr_local_duels', all); DB.duels = all; render(); return; }
  const ref = DB.db.doc('duels/' + id);
  try { merge ? await ref.update(data) : await ref.set(data); }
  catch (e) { if (e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); merge ? await ref.update(data) : await ref.set(data); } else throw e; }
}
async function dbSetPlayer(id, data, merge) {
  if (DB.local) { const all = store.get('vr_local_players', DEFAULT_PLAYERS.slice()); const i = all.findIndex(p => p.id === id); if (i < 0) all.push({ id, ...data }); else all[i] = { ...all[i], ...data }; all.sort((a, b) => a.order - b.order); store.set('vr_local_players', all); DB.players = all; render(); return; }
  const ref = DB.db.doc('players/' + id); merge ? await ref.update(data) : await ref.set(data);
}
async function dbSetGhost(id, g) { if (DB.local) { store.set('vr_ghost_' + id, g); return; } await DB.db.doc('ghosts/' + id).set({ g }); }
async function dbGetGhost(id) { if (DB.local) return store.get('vr_ghost_' + id, null); try { const s = await DB.db.doc('ghosts/' + id).get(); return s.exists ? s.data().g : null; } catch { return null; } }
function deepMerge(a, b) { const o = { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deepMerge(a[k] || {}, b[k]) : b[k]; return o; }

// ---------- regras da rodada ----------
const partsOf = d => d.players || ['pai', 'filho'];
const finished = r => !!r && (r.state === 'done' || r.state === 'dnf');
const tval = r => r && r.state === 'done' ? r.time : Infinity;
const expired = d => Date.now() - (d.createdAt || 0) > ROUND_DAYS * 864e5;
function decide(d) {
  if (Array.isArray(d.winners)) return { winners: d.winners, next: d.winner || d.challenger };
  if (d.winner && d.winner !== 'empate') return { winners: [d.winner], next: d.winner }; // duelos antigos
  if (d.winner === 'empate') return { winners: partsOf(d).slice(), next: d.challenger === 'pai' ? 'filho' : 'pai' };
  const ps = partsOf(d), core = ps.filter(id => CORE.includes(id)), wait = core.length ? core : ps;
  if (wait.some(id => !finished(d[id])) && !expired(d)) return null;
  const best = Math.min(...ps.map(id => tval(d[id])));
  if (!isFinite(best)) return { winners: [], next: d.challenger };
  const winners = ps.filter(id => Math.abs(tval(d[id]) - best) < 0.005);
  const next = winners.includes(d.challenger) ? d.challenger : winners.slice().sort((a, b) => (d[a].at || 0) - (d[b].at || 0))[0];
  return { winners, next };
}
const listJoin = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];
// posição com empate: 1 + quantos fizeram tempo melhor
const placeOf = (d, id) => { const t = tval(d[id]); return isFinite(t) ? 1 + partsOf(d).filter(x => tval(d[x]) < t - 0.0049).length : null; };
const coreOf = d => { const c = partsOf(d).filter(id => CORE.includes(id)); return c.length ? c : partsOf(d); };
// classificação; com a rodada fechada, quem não correu (e não é Pai/Filho) não aparece
function standings(d) { const closed = !!(d.winners || d.winner) || !!decide(d); return partsOf(d).filter(id => d[id] || !closed || CORE.includes(id)).map(id => ({ id, run: d[id] || null })).sort((a, b) => tval(a.run) - tval(b.run) || (finished(b.run) - finished(a.run))); }
function leader(d, except) { let b = null; for (const id of partsOf(d)) { if (id === except) continue; const r = d[id]; if (r && r.state === 'done' && (!b || r.time < b.run.time)) b = { id, run: r }; } return b; }
function scoreboard() {
  const s = {}; for (const p of DB.players) s[p.id] = { wins: 0, played: 0 };
  for (const d of DB.duels) { const r = decide(d); if (!r) continue; for (const id of partsOf(d)) { s[id] = s[id] || { wins: 0, played: 0 }; if (finished(d[id])) s[id].played++; } for (const w of r.winners) { s[w] = s[w] || { wins: 0, played: 0 }; s[w].wins++; } }
  return s;
}
function duelState(me) {
  const last = DB.duels[0], res = last ? decide(last) : null;
  if (!last || res) { const next = res ? res.next : null; const known = next && DB.players.some(p => p.id === next);
    return { kind: 'new', starter: known ? next : null, mine: !known || next === me, n: (last ? last.n : 0) + 1, prev: last, res }; }
  const ps = partsOf(last);
  if (!ps.includes(me)) return { kind: 'spectator', duel: last };
  const mine = (last[me] || {}).state;
  if (!mine) return { kind: 'run', duel: last };
  if (mine === 'started') return { kind: 'abandoned', duel: last };
  return { kind: 'waiting', duel: last, pending: coreOf(last).filter(id => !finished(last[id])) };
}
// rodada encerrada (Pai e Filho correram, ou prazo vencido) sem resultado gravado: quem abrir o jogo registra
function finalizeExpired() {
  const last = DB.duels[0]; if (!last || last.winners || DB.finalizing === last.id || !DB.ready) return;
  const res = decide(last); if (!res) return;
  DB.finalizing = last.id; dbSetDuel(last.id, { winner: res.next, winners: res.winners }, true).catch(() => {});
}

// ---------- mensagens de WhatsApp ----------
const tmTxt = r => !r ? 'não correu' : r.state === 'dnf' ? 'não concluiu' : r.state === 'started' ? 'correndo' : fmt(r.time);
function waChallenge(d) {
  const car = carById(d.car), b = leader(d);
  return `🏁 *2 Vogels 2 Fast* · Desafio nº ${d.n}!\n${pname(d.challenger)} lançou o desafio com o ${car.name} ${car.year}.\n`
    + (b ? `Tempo a bater: ${fmt(b.run.time)} (${pname(b.id)})` : 'Ninguém completou ainda: basta terminar a pista para liderar.')
    + `\nCada um corre uma vez; o desafio fecha quando o Pai e o Filho tiverem corrido, e quem vencer lança o próximo. Bora: ${SITE_URL}`;
}
function waResult(d, res) {
  const head = !res.winners.length ? 'ninguém concluiu' : res.winners.length > 1 ? `empate entre ${listJoin(res.winners.map(pname))}` : `${pname(res.winners[0])} venceu`;
  const lines = standings(d).map(x => `${placeOf(d, x.id) ? placeOf(d, x.id) + 'º' : '–'} ${pname(x.id)}: ${tmTxt(x.run)}`).join('\n');
  return `🏆 *2 Vogels 2 Fast* · Desafio nº ${d.n}: ${head}!\n${lines}\nPróximo desafio é do ${pname(res.next)}: ${SITE_URL}`;
}

// ================= TELAS =================
const UI = { who: store.get('vr_who', null), splash: true, view: 'home', sel: null, seed: null, track: null, busy: false, activeRace: false };
function setWho(w) { Audio.init(); UI.who = w; UI.splash = false; UI.pinFor = null; store.set('vr_who', w); render(); }
function render() {
  if (Game.race || UI.activeRace) return;
  const el = $('#screen'); el.classList.remove('hidden');
  if (UI.splash || !UI.who || !isUnlocked(UI.who)) { el.innerHTML = splashView(); bindWho(); const pi = $('#pinIn'); if (pi) pi.focus(); return; }
  const v = UI.view;
  el.innerHTML = v === 'home' ? homeView() : v === 'cars' ? carsView() : v === 'track' ? trackView() : v === 'history' ? historyView() : v === 'help' ? helpView() : v === 'result' ? resultView() : v === 'invite' ? inviteView() : homeView();
  bind();
  if (v === 'track' && UI.track) requestAnimationFrame(() => { const c = $('#bigmap'); if (c) { const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2; drawMap(c, UI.track, [], 2.2); } });
}
function logo() { return `<div><button class="logobtn" data-go="splash" title="Voltar à abertura"><img class="logoimg" src="logo.webp" alt="2 Vogels 2 Fast · Bloodline Racing"></button></div>`; }
const logoImg = new Image(); logoImg.src = 'logo.webp';
// tela de abertura: a capa e um botão por jogador; entrar pede o PIN do perfil (só na primeira vez em cada aparelho)
function splashView() {
  const many = DB.players.length > 3;
  const tag = p => { const m = /^vogel\s+(.+)$/i.exec(p.name); const small = m ? 'VOGEL' : '', big = m ? m[1] : p.name;
    const hint = isUnlocked(p.id) ? (UI.who === p.id ? 'Enter para entrar' : 'entrar') : DB.playersReady && !p.pin ? 'criar PIN' : 'PIN';
    return `<button class="stag${UI.who === p.id && isUnlocked(p.id) ? ' last' : ''}" style="color:${p.color}" data-who="${esc(p.id)}"><span>${small}</span><b style="text-shadow:0 0 24px ${p.color}99">${esc(big.toUpperCase())}</b><i>${hint}</i></button>`; };
  return `<div class="splash"><div class="art169"><img src="abertura.jpg" alt="2 Vogels 2 Fast: o Pai e o Lucas com os carros da família"><div class="spick${many ? ' many' : ''}">${DB.players.map(tag).join('')}</div>${UI.pinFor ? pinBox() : ''}</div></div>`;
}
function pinBox() {
  const p = PL(UI.pinFor), st = UI.pinStep;
  const title = !DB.playersReady ? 'Carregando os perfis…' : st === 'create' ? 'Crie o seu PIN' : st === 'confirm' ? 'Repita o PIN' : 'Digite o seu PIN';
  const sub = st === 'create' ? 'Quatro números. É fixo: guarde bem, ele vai ser pedido para entrar neste perfil em outro aparelho.' : st === 'confirm' ? 'Só para conferir.' : 'Pedido só na primeira vez neste aparelho.';
  return `<div class="pinbox"><div class="card"><div class="muted">Entrar como</div><h2 style="color:${p.color};margin:0 0 6px">${esc(p.name)}</h2><h3>${title}</h3><p class="muted">${sub}</p>
   <input id="pinIn" class="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]*" placeholder="••••" ${DB.playersReady ? '' : 'disabled'}>
   <p class="warn" id="pinErr">${UI.pinErr || ''}</p>
   <div class="row" style="justify-content:center"><button class="btn" data-pin="ok" ${DB.playersReady ? '' : 'disabled'}>Entrar</button><button class="btn alt" data-pin="cancel">Cancelar</button></div></div></div>`;
}
function bindWho() {
  document.querySelectorAll('[data-who]').forEach(b => b.onclick = () => pickProfile(b.dataset.who));
  const ok = $('[data-pin=ok]'), cancel = $('[data-pin=cancel]'), inp = $('#pinIn');
  if (ok) ok.onclick = () => submitPin();
  if (cancel) cancel.onclick = () => { UI.pinFor = null; UI.pinErr = ''; render(); };
  if (inp) inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') submitPin(); if (e.key === 'Escape') { UI.pinFor = null; render(); } };
}
function pickProfile(id) {
  Audio.init();
  if (isUnlocked(id)) { setWho(id); return; }
  UI.pinFor = id; UI.pinErr = ''; UI.pinStep = PL(id).pin ? 'enter' : 'create'; render();
}
async function submitPin() {
  const id = UI.pinFor, v = ($('#pinIn')?.value || '').trim(), p = PL(id);
  if (!DB.playersReady) return;
  if (!/^\d{4}$/.test(v)) { UI.pinErr = 'O PIN tem 4 números.'; render(); return; }
  if (UI.pinStep === 'enter' || p.pin) {
    if (p.pin && pinHash(id, v) === p.pin) { unlock(id); setWho(id); } else { UI.pinErr = 'PIN incorreto.'; UI.pinStep = 'enter'; render(); }
    return;
  }
  if (UI.pinStep === 'create') { UI.pinTmp = v; UI.pinStep = 'confirm'; UI.pinErr = ''; render(); return; }
  if (v !== UI.pinTmp) { UI.pinErr = 'Os dois PINs não batem. Comece de novo.'; UI.pinStep = 'create'; render(); return; }
  try { await dbSetPlayer(id, { pin: pinHash(id, v) }, true); unlock(id); toast('PIN criado. Bem-vindo, ' + p.name + '!'); setWho(id); }
  catch (e) { UI.pinErr = 'Não consegui salvar o PIN (' + (e.code || e.message) + ').'; UI.pinStep = 'create'; render(); }
}
function rankHTML(sc, big) {
  const list = DB.players.map(p => ({ p, s: sc[p.id] || { wins: 0, played: 0 } })).sort((a, b) => b.s.wins - a.s.wins || a.p.order - b.p.order);
  if (big && list.length === 2) {
    const [a, b] = DB.players; return `<div class="score"><div><div class="n" style="color:${a.color}">${(sc[a.id] || {}).wins || 0}</div><div class="who">${esc(pshort(a.id))}</div></div><div class="x">×</div><div><div class="n" style="color:${b.color}">${(sc[b.id] || {}).wins || 0}</div><div class="who">${esc(pshort(b.id))}</div></div></div>`;
  }
  return `<div class="rank">${list.map(x => `<div class="rk"><span class="pos">${1 + list.filter(y => y.s.wins > x.s.wins).length}º</span><b style="color:${x.p.color}">${esc(x.p.name)}</b><span class="w">${x.s.wins} vitória${x.s.wins === 1 ? '' : 's'}</span><span class="muted">${x.s.played} desafio${x.s.played === 1 ? '' : 's'}</span></div>`).join('')}</div>`;
}
function standingsHTML(d) {
  return `<div class="rank">${standings(d).map(x => `<div class="rk"><span class="pos">${placeOf(d, x.id) ? placeOf(d, x.id) + 'º' : '–'}</span><b style="color:${PL(x.id).color}">${esc(pname(x.id))}</b><span class="w">${tmTxt(x.run)}${devTag(x.run)}</span><span class="muted">${x.run && x.run.penalty ? x.run.penalty + ' s de batidas' : ''}</span></div>`).join('')}</div>`;
}
function homeView() {
  const sc = scoreboard(), me = UI.who;
  let action = '';
  if (!DB.ready) action = `<div class="state"><div class="big">Carregando o placar…</div></div>`;
  else {
    const st = duelState(me);
    if (st.kind === 'new') {
      const why = st.res && st.res.winners.includes(me) ? `Você venceu o desafio nº ${st.prev.n} e lança o próximo.` : !st.prev ? 'Primeiro desafio!' : 'Você lança o próximo desafio.';
      if (st.mine) action = `<div class="state"><div class="big">Sua vez de lançar o desafio nº ${st.n}</div><div class="muted">${why} Você escolhe o carro, sorteia a pista e corre; depois todos correm a mesma pista com o mesmo carro.</div></div><button class="btn" data-go="newduel">Lançar desafio nº ${st.n}</button>`;
      else action = `<div class="state cy"><div class="big">Aguardando ${esc(pname(st.starter))} lançar o desafio nº ${st.n}</div><div class="muted">Quem vence um desafio lança o próximo. Enquanto isso, que tal um treino livre?</div></div>`;
    } else {
      const d = st.duel, car = carById(d.car), b = leader(d, me);
      const info = `<div class="muted">Desafio nº ${d.n} de ${esc(pname(d.challenger))} · ${car.name} ${car.year} ${car.colorName.toLowerCase()} · pista #${d.seed}</div>`;
      if (st.kind === 'run') action = `<div class="state"><div class="big">${esc(pname(d.challenger))} lançou o desafio nº ${d.n}! ${b ? 'Tempo a bater: ' + fmt(b.run.time) + ' (' + esc(pshort(b.id)) + ')' : 'Ninguém completou ainda.'}</div>${info}<div class="warn" style="margin-top:6px">Você terá uma única tentativa.</div></div><button class="btn" data-go="respond">Ver a pista e correr</button>`;
      else if (st.kind === 'waiting') action = `<div class="state cy"><div class="big">Seu tempo: ${tmTxt(d[me])}. Falta correr: ${esc(listJoin(st.pending.map(pname)))}.</div>${info}<div class="muted">O desafio fecha quando o Pai e o Filho tiverem corrido; os convidados correm até lá.</div></div>${standingsHTML(d)}${waBtn(waChallenge(d), 'Avisar no WhatsApp')}`;
      else if (st.kind === 'abandoned') action = `<div class="state"><div class="big">Sua corrida do desafio nº ${d.n} foi interrompida.</div><div class="muted">Pela regra de uma tentativa, ela conta como não concluída.</div></div><button class="btn" data-go="markdnf">Entendi</button>`;
      else action = `<div class="state cy"><div class="big">Desafio nº ${d.n} em andamento.</div>${info}<div class="muted">Você entrou depois que ele foi lançado: participa a partir do próximo.</div></div>${standingsHTML(d)}`;
    }
  }
  const lastDone = DB.duels.find(d => decide(d));
  const lastRes = lastDone && decide(lastDone);
  const lastLine = lastRes ? `<p class="muted">Último desafio (nº ${lastDone.n}): ${lastRes.winners.length > 1 ? 'empate entre ' + esc(listJoin(lastRes.winners.map(pname))) : lastRes.winners.length ? 'vitória do ' + esc(pname(lastRes.winners[0])) : 'ninguém concluiu'} · ${standings(lastDone).map(x => esc(pshort(x.id)) + ' ' + tmTxt(x.run)).join(' · ')}</p>` : '';
  const note = DB.local ? `<p class="muted">Placar salvo só neste navegador (sem conexão com o banco compartilhado).</p>` : DB.err ? `<p class="warn">Não foi possível acessar o placar compartilhado (${DB.err}).</p>` : DB.playersErr ? `<p class="warn">Os perfis e PINs ainda não estão liberados no banco (${DB.playersErr}).</p>` : DB.offline ? `<p class="warn">O placar ainda não respondeu; pode estar desatualizado.</p>` : '';
  return `<div class="wrap">${logo()}<div class="grid2">
   <div class="card"><h3>Placar geral</h3>${rankHTML(sc, true)}
     <p class="muted" style="text-align:center;margin:8px 0 0">${DB.duels.length} desafio${DB.duels.length === 1 ? '' : 's'} · quem vence lança o próximo</p>${lastLine}${note}</div>
   <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Jogando como ${ptag(me)}</h3><div class="row" style="gap:6px"><button class="btn alt sm" data-go="splash">Trocar</button><button class="btn alt sm" data-go="logout" title="Pede o PIN de novo neste aparelho">Sair</button></div></div>
     ${action}
     <div class="row" style="margin-top:16px"><button class="btn alt" data-go="treino">Treino livre</button><button class="btn alt" data-go="history">Histórico</button><button class="btn alt" data-go="invite">Convidar jogador</button><button class="btn alt" data-go="help">Controles</button></div></div>
  </div></div>`;
}
function inviteView() {
  const used = DB.players.map(p => p.color), free = PALETTE.filter(c => !used.includes(c));
  UI.inviteColor = UI.inviteColor && free.includes(UI.inviteColor) ? UI.inviteColor : free[0] || PALETTE[0];
  const done = UI.invited ? PL(UI.invited) : null;
  return `<div class="wrap" style="max-width:680px">${logo()}<div class="card"><h2>Convidar jogador</h2>
  ${done ? `<div class="state"><div class="big">Perfil ${ptag(done.id)} criado!</div><div class="muted">Mande o link para ele. Na primeira vez, ele toca no próprio nome na abertura e cria o PIN. Ele entra a partir do próximo desafio lançado.</div></div>
   <div class="row">${waBtn(`🏁 Você foi convidado para o *2 Vogels 2 Fast · Bloodline Racing*!\nEntre no perfil ${done.name}, crie o seu PIN e prepare-se: todos correm a mesma pista e quem vencer lança o próximo desafio.\n${SITE_URL}`, 'Mandar o convite no WhatsApp')}<button class="btn alt" data-go="home">Voltar</button></div>`
  : `<p class="muted">Quem for convidado entra nos desafios a partir do próximo lançado. O PIN é criado pela própria pessoa no primeiro acesso.</p>
   <label class="muted" for="invName">Nome do perfil</label><input id="invName" class="txt" maxlength="20" placeholder="Vogel Avô" value="${esc(UI.inviteName || '')}">
   <div class="muted" style="margin-top:12px">Cor</div><div class="row" style="gap:8px;margin:6px 0 4px">${(free.length ? free : PALETTE).map(c => `<button class="sw${c === UI.inviteColor ? ' on' : ''}" style="background:${c}" data-color="${c}" aria-label="cor ${c}"></button>`).join('')}</div>
   <p class="warn">${UI.inviteErr || ''}</p>
   <div class="row"><button class="btn" data-go="createplayer">Criar perfil</button><button class="btn alt" data-go="home">Voltar</button></div>`}</div></div>`;
}
function carsView() {
  const mode = UI.flow;
  const bar = (v, max) => `<div class="bar"><i style="width:${Math.round(Math.min(1, v / max) * 100)}%"></i></div>`;
  return `<div class="wrap">${logo()}<div class="card"><h2>${mode === 'duel' ? 'Escolha o carro do desafio' : 'Escolha o carro do treino'}</h2><p class="muted">${mode === 'duel' ? 'Todos os jogadores vão correr com este mesmo carro.' : 'Nada é registrado no treino.'}</p>
  <div class="cars">${CARS.map(c => `<button class="carc ${UI.sel === c.id ? 'on' : ''}" data-car="${c.id}">${silhouetteSVG(c.body, c.color)}<span class="brand">${c.name.split(' ')[0]}</span><b class="${c.name.split(' ').slice(1).join(' ').length > 13 ? 'long' : ''}">${c.name.split(' ').slice(1).join(' ')}</b><span class="muted meta">${c.year} · ${c.engine}</span>
   <div class="bars"><span>Velocidade</span>${bar(c.top - 100, 155)}<span>Aceleração</span>${bar(c.acc - 5, 11)}<span>Direção</span>${bar(c.steer * c.grip - 0.75, 0.45)}</div></button>`).join('')}</div>
  <div class="row" style="margin-top:16px"><button class="btn" data-go="pickcar" ${UI.sel ? '' : 'disabled'}>Sortear pista</button><button class="btn alt" data-go="home">Voltar</button></div></div></div>`;
}
function trackView() {
  const tr = UI.track, car = carById(tr.carId), mode = UI.flow;
  const resp = mode === 'respond';
  const d = UI.duel, b = resp ? leader(d, UI.who) : null;
  return `<div class="wrap">${logo()}<div class="grid2"><div class="card"><div class="mapbox"><canvas id="bigmap"></canvas></div><p class="muted" style="margin:8px 0 0"><span style="color:#3dff9a">●</span> largada · ■ chegada · <span style="color:#ff7a1a">●</span> loop · <span style="color:#2be4ff">●</span> salto</p></div>
  <div class="card"><h2>Pista #${tr.seed}</h2><div class="muted">${THEME_NAME[tr.theme]}</div>
   <div class="stats"><div class="stat"><span class="muted">Extensão</span><b>${(tr.length / 1000).toFixed(2)} km</b></div><div class="stat"><span class="muted">Carro</span><b style="font-size:20px">${car.name.replace(/^(Ford|Chevrolet|Volkswagen|Renault|Citroën|Peugeot|Audi) /, '')} ${car.year}</b></div>
   <div class="stat"><span class="muted">Loops</span><b>${tr.features.loops}</b></div><div class="stat"><span class="muted">Saltos</span><b>${tr.features.jumps}</b></div></div>
   ${resp ? (b ? `<p class="big">Tempo a bater: ${fmt(b.run.time)} <span class="muted">(${esc(pname(b.id))}${b.run.penalty ? `, inclui ${b.run.penalty} s de batidas` : ''})</span></p><p class="muted">O ghost do melhor tempo corre junto com você. Cada segundo batendo na mureta soma 1 s ao seu tempo final.</p>`
     : `<p class="big">Ninguém completou ainda: basta chegar para liderar.</p>`) : ''}
   ${mode === 'treino' ? '' : '<p class="warn">Uma única tentativa: ao começar a contagem, a corrida vale.</p>'}
   ${UI.confirm && mode !== 'treino' ? confirmBox(mode, d) : ''}
   <div class="row"${UI.confirm && mode !== 'treino' ? ' hidden' : ''}><button class="btn" data-go="${mode === 'treino' ? 'race' : 'askrace'}">${mode === 'treino' ? 'Correr' : 'Começar a corrida'}</button>${resp ? '' : '<button class="btn alt" data-go="reroll">Sortear outra pista</button>'}<button class="btn alt" data-go="home">Voltar</button></div></div></div></div>`;
}
function historyView() {
  const rows = DB.duels.map(d => { const r = decide(d); const c = carById(d.car);
    const times = standings(d).map(x => `<span style="color:${PL(x.id).color}">${esc(pshort(x.id))}</span> ${x.run && x.run.state === 'done' ? fmt(x.run.time) + (x.run.penalty ? ` <span class="muted">(+${x.run.penalty})</span>` : '') : tmTxt(x.run)}`).join(' · ');
    return `<tr><td class="num">${d.n}</td><td>${new Date(d.createdAt || 0).toLocaleDateString('pt-BR')}</td><td>${esc(pshort(d.challenger))}</td><td>${c.name} ${c.year}</td><td>${times}</td><td>${r ? (r.winners.length ? listJoin(r.winners.map(ptag)) : 'ninguém concluiu') : 'em andamento'}</td></tr>`; }).join('');
  return `<div class="wrap">${logo()}<div class="card"><h2>Histórico de desafios</h2>${DB.duels.length ? `<div class="scroll"><table><thead><tr><th>Nº</th><th>Data</th><th>Lançado por</th><th>Carro</th><th>Tempos</th><th>Vencedor</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Nenhum desafio ainda. O primeiro está esperando!</p>'}
  <div class="row" style="margin-top:14px"><button class="btn alt" data-go="home">Voltar</button></div></div></div>`;
}
function helpView() {
  const k = (a, b) => `<div>${a}</div><div>${b}</div>`;
  return `<div class="wrap" style="max-width:760px">${logo()}<div class="card"><h2>Controles</h2><div class="keys">
  ${k('<kbd>↑</kbd> ou <kbd>W</kbd>', 'Acelerar')}${k('<kbd>↓</kbd> ou <kbd>S</kbd>', 'Frear / ré')}${k('<kbd>←</kbd> <kbd>→</kbd> ou <kbd>A</kbd> <kbd>D</kbd>', 'Virar')}
  ${k('<kbd>Shift</kbd> ou <kbd>N</kbd>', 'Nitro (recarrega devagar)')}${k('<kbd>Espaço</kbd>', 'Freio de mão (para derrapar)')}${k('<kbd>C</kbd>', 'Trocar câmera')}
  ${k('<kbd>R</kbd>', 'Voltar ao último checkpoint')}${k('<kbd>Esc</kbd>', 'Pausa')}${k('<kbd>M</kbd>', 'Liga/desliga o som')}</div>
  <h3 style="margin-top:18px">No celular</h3><p class="muted">Deite o celular. ◀ ▶ à esquerda para virar; à direita, acelerar, frear (e ré), NOS e freio de mão. No alto: câmera, checkpoint e pausa. Na pausa dá para trocar a direção para "inclinar", virando o celular como um volante. Um controle Bluetooth também funciona. No histórico, 📱 ⌨️ 🎮 mostram com o que cada um correu.</p>
  <h3>Controle de videogame</h3><p class="muted">Gatilho direito acelera, esquerdo freia, analógico esquerdo vira, A ou RB = nitro, X = freio de mão, Y = checkpoint, LB = câmera, Start = pausa.</p>
  <h3>Desafios</h3><p class="muted">Quem lança escolhe o carro e a pista; cada jogador corre uma vez, com o mesmo carro, contra o ghost do melhor tempo até ali. O desafio fecha quando o Pai e o Filho tiverem corrido: os convidados precisam correr antes disso. Quem fizer o melhor tempo vence e lança o próximo. Se ficar parado ${ROUND_DAYS} dias, fecha sozinho.</p>
  <h3>Batidas</h3><p class="muted">Cada segundo batendo ou raspando na mureta vale 1 ponto (uma pancada rápida já conta 1). No final, cada ponto soma 1 s ao tempo. Frear antes da curva compensa!</p>
  <h3>Dicas</h3><p class="muted">Loops pedem velocidade: entre embalado. Nos saltos, chegue reto e rápido. Se cair ou capotar, o carro volta ao último checkpoint e o tempo continua correndo.</p>
  <div class="row"><button class="btn alt" data-go="home">Voltar</button></div></div></div>`;
}
function resultView() {
  const r = UI.result; if (!r) return homeView();
  return `<div class="wrap" style="max-width:720px">${logo()}<div class="card" style="text-align:center"><h2 style="font-size:44px;color:${r.color}">${r.title}</h2><p class="big">${r.line}</p><p class="muted">${r.sub || ''}</p>
  ${r.table || ''}${r.score ? `<h3 style="margin-top:14px">Placar geral</h3>${rankHTML(r.score, true)}` : ''}
  <div class="row" style="justify-content:center;margin-top:12px">${r.wa ? waBtn(r.wa, r.waLabel) : ''}${r.retry ? '<button class="btn" data-go="retry">Tentar de novo (com seu ghost)</button><button class="btn alt" data-go="treino">Outra pista</button>' : ''}<button class="btn ${r.retry ? 'alt' : ''}" data-go="home">Voltar ao início</button></div></div></div>`;
}
function bind() {
  document.querySelectorAll('[data-car]').forEach(b => b.onclick = () => { UI.sel = b.dataset.car; render(); });
  document.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { UI.inviteName = $('#invName')?.value || ''; UI.inviteColor = b.dataset.color; render(); });
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}
function confirmBox(mode, d) {
  const txt = mode === 'respond'
    ? `Você vai correr o desafio nº ${d.n}, lançado por ${esc(pname(d.challenger))}. É a sua única tentativa nesta pista: ao começar a contagem, o tempo vale para o placar, e desistir conta como não concluída.`
    : `Isto é um desafio oficial para todos os jogadores, não um treino. É a sua única tentativa: ao começar a contagem, o tempo fica registrado e os outros vão correr contra o seu ghost. Para testar o carro, use o Treino livre.`;
  return `<div class="confirm"><h3>${mode === 'respond' ? 'Valendo?' : 'Valendo para o placar?'}</h3><p>${txt}</p>
   <div class="row"><button class="btn" data-go="race">Valendo! Começar</button><button class="btn alt" data-go="noconfirm">Ainda não</button></div></div>`;
}
function newSeed() { return 10000 + Math.floor(Math.random() * 89999); }
function slugId(name) { let s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^vogel\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16) || 'jogador'; let id = s, k = 2; while (DB.players.some(p => p.id === id)) id = s + k++; return id; }
async function go(a) {
  Audio.init();
  if (a !== 'askrace' && a !== 'race') UI.confirm = false;
  if (a === 'home') { UI.view = 'home'; UI.result = null; UI.invited = null; render(); if (!Game.attract) Game.startAttract(); return; }
  if (a === 'history' || a === 'help') { UI.view = a; render(); return; }
  if (a === 'invite') { UI.view = 'invite'; UI.invited = null; UI.inviteErr = ''; UI.inviteName = ''; render(); return; }
  if (a === 'createplayer') {
    const name = ($('#invName')?.value || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) { UI.inviteErr = 'Escreva o nome do perfil.'; UI.inviteName = name; render(); return; }
    if (DB.players.some(p => p.name.toLowerCase() === name.toLowerCase())) { UI.inviteErr = 'Já existe um perfil com esse nome.'; UI.inviteName = name; render(); return; }
    const id = slugId(name), order = Math.max(0, ...DB.players.map(p => p.order || 0)) + 1;
    try { await dbSetPlayer(id, { name, color: UI.inviteColor, order, createdBy: UI.who, createdAt: Date.now() }, false); UI.invited = id; UI.inviteErr = ''; DB.players.some(p => p.id === id) || DB.players.push({ id, name, color: UI.inviteColor, order }); }
    catch (e) { UI.inviteErr = 'Não consegui criar o perfil (' + (e.code || e.message) + ').'; UI.inviteName = name; }
    render(); return;
  }
  if (a === 'logout') { lock(UI.who); UI.splash = true; render(); toast('Este aparelho vai pedir o PIN de novo.'); return; }
  if (a === 'newduel') { UI.flow = 'duel'; UI.sel = null; UI.view = 'cars'; render(); return; }
  if (a === 'treino') { UI.flow = 'treino'; UI.sel = UI.sel || null; UI.view = 'cars'; render(); return; }
  if (a === 'pickcar' || a === 'reroll') { await ensureModel(UI.sel, 4000); UI.seed = newSeed(); UI.track = genTrack(UI.seed, UI.sel); UI.view = 'track'; showTrackPreview(); render(); return; }
  if (a === 'respond') { await ensureModel(duelState(UI.who).duel?.car, 4000); const st = duelState(UI.who); if (st.kind !== 'run') { render(); return; } UI.flow = 'respond'; UI.duel = st.duel; UI.sel = st.duel.car; UI.seed = st.duel.seed; UI.track = genTrack(st.duel.seed, st.duel.car); UI.view = 'track'; showTrackPreview(); render(); return; }
  if (a === 'markdnf') { const st = duelState(UI.who); if (st.kind === 'abandoned') await finishRun(st.duel, { state: 'dnf', at: Date.now() }); render(); return; }
  if (a === 'askrace') { UI.confirm = true; render(); requestAnimationFrame(() => document.querySelector('.confirm')?.scrollIntoView({ block: 'center', behavior: 'smooth' })); return; }
  if (a === 'noconfirm') { UI.confirm = false; render(); return; }
  if (a === 'splash') { UI.splash = true; UI.confirm = false; render(); return; }
  if (a === 'race') { UI.confirm = false; goFullscreen(); return beginRace(); }
  if (a === 'retry') { const o = UI.lastTreino; if (o) { UI.activeRace = true; Game.startRace({ ...o, ghost: o.bestGhost, target: o.best, label: o.label }); } return; }
}
function showTrackPreview() { Game.stopAttract(); buildWorld(UI.track); const car = new Car(UI.track, carById(UI.track.carId)); car.s = 20; car.v = 22; car.updatePose(); const mesh = buildCarMesh(car.spec); scene.add(mesh); Game.attract = { tr: UI.track, car, mesh }; cam.init = false; }
const runOf = res => ({ state: 'done', time: res.time, raw: res.raw, penalty: res.penalty, splits: res.splits, crashes: res.crashes, at: Date.now(), dev: lastDev });
const DEV_ICON = { toque: '📱', teclado: '⌨️', controle: '🎮' };
const devTag = r => r && r.dev ? ` <span title="${r.dev}">${DEV_ICON[r.dev] || ''}</span>` : '';
async function beginRace() {
  await ensureModel(UI.track.carId);
  const me = UI.who, tr = UI.track, car = carById(tr.carId);
  const label = `<b style="color:${PL(me).color}">${esc(pshort(me))}</b><br>${car.name} ${car.year}`;
  if (UI.flow === 'treino') {
    const o = { track: tr, carId: tr.carId, mode: 'treino', label: label + '<br><span class="muted">Treino</span>', onQuit: () => go('home'),
      onFinish: res => { UI.activeRace = false; const prev = UI.lastTreino && UI.lastTreino.track === tr ? UI.lastTreino : null; const better = !prev || res.time < prev.best;
        UI.lastTreino = { ...o, best: better ? res.time : prev.best, bestGhost: better ? decodeGhost(res.ghost) : prev.bestGhost };
        UI.result = { title: better && prev ? 'NOVO RECORDE!' : 'CHEGOU!', color: '#ffd23f', line: 'Tempo: ' + fmt(res.time), sub: penLine(res) + (prev ? ' · Melhor nesta pista: ' + fmt(UI.lastTreino.best) : '') + (res.crashes ? ` · ${res.crashes} capotagem(ns)` : ''), retry: true };
        UI.view = 'result'; render(); showTrackPreview(); } };
    UI.activeRace = true; Game.startRace(o); return;
  }
  if (UI.flow === 'duel') {
    const st = duelState(me); if (st.kind !== 'new' || !st.mine) { toast('O estado do desafio mudou. Confira a tela inicial.'); go('home'); return; }
    const id = `d${st.n}_${tr.seed}`;
    const base = { n: st.n, seed: tr.seed, car: tr.carId, challenger: me, createdAt: Date.now(), players: DB.players.map(p => p.id), [me]: { state: 'started' } };
    UI.activeRace = true;
    Game.startRace({ track: tr, carId: tr.carId, mode: 'duel', label: label + `<br><span class="muted">Desafio nº ${st.n}</span>`,
      onStart: () => dbSetDuel(id, base, false).catch(e => toast('Erro ao registrar o desafio: ' + (e.code || e.message))),
      onQuit: async () => { UI.activeRace = false; showRunResult(await finishRun({ id, ...base }, { state: 'dnf', at: Date.now() }), me, null); },
      onFinish: async res => { UI.activeRace = false; showRunResult(await finishRun({ id, ...base }, runOf(res), res.ghost), me, res); } });
    return;
  }
  if (UI.flow === 'respond') {
    const d = UI.duel, b = leader(d, me);
    let ghost = null; const gb = b ? await dbGetGhost(d.id + '_' + b.id) : null; if (gb) try { ghost = decodeGhost(gb); } catch {}
    UI.activeRace = true;
    Game.startRace({ track: tr, carId: tr.carId, mode: 'duel', ghost, ghostSplits: b ? b.run.splits || null : null, target: b ? b.run.time : null,
      label: label + `<br><span class="muted">Desafio nº ${d.n}${b ? ' · ghost: ' + esc(pshort(b.id)) : ''}</span>`,
      onStart: () => dbSetDuel(d.id, { [me]: { state: 'started' } }, true).catch(e => toast('Erro ao registrar: ' + (e.code || e.message))),
      onQuit: async () => { UI.activeRace = false; showRunResult(await finishRun(d, { state: 'dnf', at: Date.now() }), me, null); },
      onFinish: async res => { UI.activeRace = false; showRunResult(await finishRun(d, runOf(res), res.ghost), me, res); } });
  }
}
async function finishRun(d, run, ghost) {
  const me = UI.who;
  // usa o estado mais novo do desafio (outros podem ter corrido enquanto isso)
  const fresh = DB.duels.find(x => x.id === d.id) || d;
  const merged = deepMerge(fresh, { [me]: run });
  try {
    if (ghost) await dbSetGhost(d.id + '_' + me, ghost).catch(() => {});
    const upd = { [me]: run }, res = decide({ ...merged, winners: undefined, winner: undefined });
    if (res) { upd.winner = res.next; upd.winners = res.winners; merged.winner = res.next; merged.winners = res.winners; }
    await dbSetDuel(d.id, upd, true);
  } catch (e) { toast('Não consegui salvar o resultado: ' + (e.code || e.message), 6000); }
  return merged;
}
function penLine(res) { return res.penalty ? `${fmt(res.raw)} na pista + ${res.penalty} s de batidas` : 'Sem batidas — volta limpa!'; }
function showRunResult(d, me, res) {
  const r = decide(d), sc = scoreboard();
  if (r && !DB.duels.find(x => x.id === d.id && decide(x))) for (const w of r.winners) { sc[w] = sc[w] || { wins: 0, played: 0 }; sc[w].wins++; } // o banco pode responder depois
  const mine = d[me] || {}, pos = placeOf(d, me);
  if (r) {
    const won = r.winners.includes(me);
    UI.result = { title: won ? (r.winners.length > 1 ? 'EMPATE NA PONTA!' : 'VOCÊ VENCEU!') : 'FIM DO DESAFIO', color: won ? '#3dff9a' : '#ff2a6d',
      line: mine.state === 'done' ? 'Seu tempo: ' + fmt(mine.time) : 'Corrida não concluída',
      sub: (res ? penLine(res) + ' · ' : '') + (r.winners.length > 1 ? `Empate na ponta: ${listJoin(r.winners.map(pname))}. ` : r.winners.length ? `Vencedor: ${pname(r.winners[0])}. ` : 'Ninguém concluiu. ') + `Próximo desafio é do ${pname(r.next)}.`,
      table: standingsHTML(d), score: sc, wa: waResult(d, r), waLabel: 'Contar o resultado no WhatsApp' };
  } else {
    const pend = coreOf(d).filter(id => !finished(d[id]));
    UI.result = { title: mine.state === 'done' ? 'TEMPO REGISTRADO' : 'DESISTÊNCIA', color: mine.state === 'done' ? '#ff7a1a' : '#ff2a6d',
      line: mine.state === 'done' ? fmt(mine.time) : 'A corrida conta como não concluída.',
      sub: (res ? penLine(res) + ' · ' : '') + (mine.state === 'done' ? `Por enquanto você está em ${pos}º. ` : '') + `Falta correr: ${listJoin(pend.map(pname))}. O desafio fecha quando ${pend.length > 1 ? 'eles correrem' : 'ele correr'}; os convidados correm até lá.`,
      table: standingsHTML(d), wa: waChallenge(d), waLabel: 'Avisar no WhatsApp' };
  }
  UI.view = 'result'; render(); Game.startAttract();
}

// ---------- início ----------
if (TOUCH) addEventListener('resize', () => { const r = Game.race; if (r && innerHeight > innerWidth && r.state === 'race' && !Game.paused) Game.togglePause(); });
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > 20000 && !Game.race && !UI.activeRace) { UI.splash = true; UI.confirm = false; UI.view = 'home'; render(); }
});
addEventListener('pageshow', e => { if (e.persisted && !Game.race && !UI.activeRace) { UI.splash = true; UI.view = 'home'; render(); } });
for (const f of new Set(Object.values(REAL_FILE))) loadReal(f);
window.__vr = { Game, UI, camera, THREE, genTrack, showTrackPreview: () => showTrackPreview(), render: () => render(), renderer, buildCarMesh, carById, ensureModel, CARS, env: () => envTex, decide, standings, scoreboard, DB };
initTouch();
Game.startAttract();
requestAnimationFrame(frame);
render();
initDB();
