// Converte um OBJ texturizado (v + vt) para o binário do jogo, mantendo as coordenadas da textura.
// Grupos: "x__tex" (carroceria) e "x__wtex_lf" etc. (rodas, que giram). Centros das rodas em WC (JSON), textura em TEX.
import fs from 'fs';
import { MeshoptSimplifier } from 'meshoptimizer';
const [, , inPath, outPath] = process.argv;
const WC = JSON.parse(process.env.WC), TEX = process.env.TEX, RATIO = +(process.env.RATIO || 0.05);
await MeshoptSimplifier.ready; MeshoptSimplifier.useExperimentalFeatures = true;
const P = [], T = [], groups = {}; let g = null;
for (const line of fs.readFileSync(inPath, 'utf8').split('\n')) {
  if (line.startsWith('v ')) { const a = line.split(' '); P.push(+a[1], +a[2], +a[3]); }
  else if (line.startsWith('vt ')) { const a = line.split(' '); T.push(+a[1], +a[2]); }
  else if (line.startsWith('g ')) { g = line.slice(2).trim().split('__').pop(); groups[g] = groups[g] || []; }
  else if (line.startsWith('f ')) { for (const t of line.slice(2).trim().split(' ')) { const [vi, ti] = t.split('/'); groups[g].push(+vi - 1, +ti - 1); } }
}
const out = [], wheels = {};
for (const [name, fl] of Object.entries(groups)) {
  // um vértice por par (posição, uv)
  const map = new Map(), pos = [], uv = [], idx = new Uint32Array(fl.length / 2);
  for (let k = 0; k < fl.length; k += 2) {
    const key = fl[k] * 1048576 + fl[k + 1]; let id = map.get(key);
    if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(P[fl[k] * 3], P[fl[k] * 3 + 1], P[fl[k] * 3 + 2]); uv.push(T[fl[k + 1] * 2], T[fl[k + 1] * 2 + 1]); }
    idx[k / 2] = id;
  }
  const pf = new Float32Array(pos), uf = new Float32Array(uv);
  const target = Math.floor(idx.length * RATIO / 3) * 3;
  const [res] = MeshoptSimplifier.simplifyWithAttributes(idx, pf, 3, uf, 2, [0.5, 0.5], null, target, +(process.env.ERR || 0.01));
  // compacta
  const remap = new Map(), np = [], nu = [], ni = new Uint32Array(res.length);
  for (let i = 0; i < res.length; i++) { let id = remap.get(res[i]); if (id === undefined) { id = np.length / 3; remap.set(res[i], id); np.push(pf[res[i] * 3], pf[res[i] * 3 + 1], pf[res[i] * 3 + 2]); nu.push(uf[res[i] * 2], uf[res[i] * 2 + 1]); } ni[i] = id; }
  // normais suaves pela posição (atravessam as costuras da textura), com vinco acima de 50°
  const nv = np.length / 3, nt = ni.length / 3, fn = new Float32Array(nt * 3), byPos = new Map(), pk = i => Math.round(np[i * 3] * 2e3) + ',' + Math.round(np[i * 3 + 1] * 2e3) + ',' + Math.round(np[i * 3 + 2] * 2e3);
  for (let t = 0; t < nt; t++) {
    const a = ni[t * 3] * 3, b = ni[t * 3 + 1] * 3, c = ni[t * 3 + 2] * 3;
    const ux = np[b] - np[a], uy = np[b + 1] - np[a + 1], uz = np[b + 2] - np[a + 2], vx = np[c] - np[a], vy = np[c + 1] - np[a + 1], vz = np[c + 2] - np[a + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; fn[t * 3] = x / l; fn[t * 3 + 1] = y / l; fn[t * 3 + 2] = z / l;
    for (let k = 0; k < 3; k++) { const key = pk(ni[t * 3 + k]); let L = byPos.get(key); if (!L) byPos.set(key, L = []); L.push(t); }
  }
  const COS = Math.cos(50 * Math.PI / 180), nn = new Float32Array(nv * 3), done = new Uint8Array(nv);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const v = ni[t * 3 + k]; if (done[v]) continue; done[v] = 1; let sx = 0, sy = 0, sz = 0;
    for (const u of byPos.get(pk(v))) if (fn[u * 3] * fn[t * 3] + fn[u * 3 + 1] * fn[t * 3 + 1] + fn[u * 3 + 2] * fn[t * 3 + 2] > COS) { sx += fn[u * 3]; sy += fn[u * 3 + 1]; sz += fn[u * 3 + 2]; }
    const l = Math.hypot(sx, sy, sz) || 1; nn[v * 3] = sx / l; nn[v * 3 + 1] = sy / l; nn[v * 3 + 2] = sz / l;
  }
  if (name.startsWith('wtex_')) { const c = WC[name.slice(5)]; wheels[name.slice(5)] = c; for (let i = 0; i < np.length; i += 3) { np[i] -= c[0]; np[i + 1] -= c[1]; np[i + 2] -= c[2]; } }
  out.push({ name, pos: np, nor: nn, uv: nu, idx: ni });
  console.log(name.padEnd(10), idx.length / 3, '->', nt, 'tri', nv, 'vért');
}
let bbMin = [1e9, 1e9, 1e9], bbMax = [-1e9, -1e9, -1e9];
for (const p of out) for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { bbMin[k] = Math.min(bbMin[k], p.pos[i + k]); bbMax[k] = Math.max(bbMax[k], p.pos[i + k]); }
const qs = bbMax.map((m, k) => Math.max(Math.abs(m), Math.abs(bbMin[k])) / 32767);
const chunks = [], header = { v: 2, q: qs, wheels, tex: TEX, parts: [] }; let off = 0;
const al = b => (4 - b % 4) % 4;
for (const p of out) {
  const nv = p.pos.length / 3;
  const pb = new Int16Array(nv * 3); for (let i = 0; i < pb.length; i++) pb[i] = Math.round(p.pos[i] / qs[i % 3]);
  const nb = new Int8Array(nv * 3); for (let i = 0; i < nv * 3; i++) nb[i] = Math.round(Math.max(-1, Math.min(1, p.nor[i])) * 127);
  const ub = new Uint16Array(nv * 2); for (let i = 0; i < ub.length; i++) ub[i] = Math.round(Math.max(0, Math.min(1, p.uv[i])) * 65535);
  const big = nv > 65535, ib = big ? new Uint32Array(p.idx) : new Uint16Array(p.idx);
  const e = { name: p.name, nv, ni: p.idx.length, big };
  for (const [k, arr] of [['pOff', pb], ['nOff', nb], ['uOff', ub], ['iOff', ib]]) { e[k] = off; const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); chunks.push(buf, Buffer.alloc(al(buf.length))); off += buf.length + al(buf.length); }
  header.parts.push(e);
}
let hj = Buffer.from(JSON.stringify(header)); hj = Buffer.concat([hj, Buffer.alloc(al(hj.length + 4), 32)]);
const len = Buffer.alloc(4); len.writeUInt32LE(hj.length);
fs.writeFileSync(outPath, Buffer.concat([len, hj, ...chunks]));
console.log('arquivo', (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
