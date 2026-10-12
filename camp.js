/* ============================================================
   礦坑原型 · 營地（帳篷 ＋ 篝火 ＋ 睡覺）
   ------------------------------------------------------------
   位置設定在 mining.js 最上面的 CAMP。
   走到營地旁邊，開採鈕會變成「睡覺」；睡一覺，全地圖的礦石
   會收掉重新長一批，就不會只剩下挖不動的大礦。
   ============================================================ */
(function () {

const C = MINING.CAMP;

/* ============================================================
   1. 樣式：睡覺按鈕 ＋ 睡覺時的淡出畫面
   ============================================================ */
const css = document.createElement('style');
css.textContent = `
#stage #mineBtn.sleep { color:#fff0bf;
  border:2px solid #e5c47a; box-shadow:0 0 0 2px rgba(74,50,25,.72),
  0 5px 12px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.20),
  0 0 16px rgba(255,210,110,.24); }
#stage #mineBtn.sleep .txt { color:#fff0bf; }
#stage #mineBtn.sleep:active { transform:scale(.96); }

#sleepFx { position:absolute; inset:0; z-index:80; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:16px; background:#04060c;
  opacity:0; pointer-events:none; transition:opacity .8s ease; }
#sleepFx.on { opacity:1; pointer-events:auto; }
#sleepFx .zzz { font-size:34px; font-weight:700; color:#c6d1ff; letter-spacing:8px; }
#sleepFx .zzz span { display:inline-block; animation:campZ 1.6s ease-in-out infinite; }
#sleepFx .zzz span:nth-child(2) { animation-delay:.25s; font-size:.8em; }
#sleepFx .zzz span:nth-child(3) { animation-delay:.5s;  font-size:.62em; }
@keyframes campZ { 0%,100% { transform:translateY(0); opacity:.35; }
                   50%     { transform:translateY(-10px); opacity:1; } }
#sleepFx .msg { font-size:14px; letter-spacing:2px; color:#e8dcc4; text-align:center;
  line-height:1.9; min-height:3.8em; }
`;
document.head.appendChild(css);

/* 共用的柔邊光暈貼圖 */
function makeGlow() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const GLOW = makeGlow();
const additive = (color, opacity) => ({
  map: GLOW, color, transparent: true, opacity,
  blending: THREE.AdditiveBlending, depthWrite: false
});

const camp = new THREE.Group();
camp.name = '營地';
scene.add(camp);

const wood     = new THREE.MeshStandardMaterial({ color: 0x6b4527, roughness: .9 });
const logMat   = new THREE.MeshStandardMaterial({ color: 0x5a3620, roughness: .95 });
const charMat  = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 1,
                   emissive: 0x6a1c00, emissiveIntensity: .7 });

/* ============================================================
   2. 帳篷（三角形的布帳篷，門簾掀開、裡面透出暖光）
   ============================================================ */
{
  const tent = new THREE.Group();
  const W = 2.2, H = 1.55, D = 2.1;

  // 帳篷本體：三角形往後拉長
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(0, H); shape.lineTo(-W / 2, 0);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
  bodyGeo.translate(0, 0, -D / 2);
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xd4ab72, roughness: .95, side: THREE.DoubleSide });
  const body = new THREE.Mesh(bodyGeo, canvasMat);
  body.castShadow = body.receiveShadow = true;
  tent.add(body);

  // 門口（深色三角形）＋ 裡面透出來的暖光
  const dw = 0.95, dh = 1.1;
  const door = new THREE.Shape();
  door.moveTo(-dw / 2, 0); door.lineTo(dw / 2, 0); door.lineTo(0, dh); door.lineTo(-dw / 2, 0);
  const doorMesh = new THREE.Mesh(new THREE.ShapeGeometry(door), new THREE.MeshBasicMaterial({ color: 0x2a160c }));
  doorMesh.position.z = D / 2 + 0.01;
  tent.add(doorMesh);
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(door), new THREE.MeshBasicMaterial({
    color: 0xff9a3c, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false }));
  inner.scale.set(.72, .72, 1);
  inner.position.set(0, .04, D / 2 + .02);
  tent.add(inner);

  // 兩片往外掀開的門簾
  const flap = new THREE.Shape();
  flap.moveTo(0, 0); flap.lineTo(dw / 2 + .1, 0); flap.lineTo(0, dh + .05); flap.lineTo(0, 0);
  const flapMat = new THREE.MeshStandardMaterial({ color: 0xb88a52, roughness: .95, side: THREE.DoubleSide });
  [-1, 1].forEach(side => {
    const f = new THREE.Mesh(new THREE.ShapeGeometry(flap), flapMat);
    f.scale.x = side;
    f.position.set(side * dw / 2, 0, D / 2 + .02);
    f.rotation.y = -side * .95;
    f.castShadow = true;
    tent.add(f);
  });

  // 屋脊木桿、前後支柱、繩子和地釘
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, D + .3, 6), wood);
  ridge.rotation.x = Math.PI / 2; ridge.position.y = H + .02;
  tent.add(ridge);
  const ropeMat = new THREE.LineBasicMaterial({ color: 0xcdb488 });
  [-1, 1].forEach(s => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, H + .12, 6), wood);
    pole.position.set(0, (H + .12) / 2, s * (D / 2 + .12));
    pole.castShadow = true;
    tent.add(pole);
    const pts = [new THREE.Vector3(0, H + .06, s * (D / 2 + .12)), new THREE.Vector3(0, .03, s * (D / 2 + .7))];
    tent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));
    const peg = new THREE.Mesh(new THREE.ConeGeometry(.04, .16, 5), wood);
    peg.rotation.x = Math.PI; peg.position.set(0, .07, s * (D / 2 + .7));
    tent.add(peg);
  });

  // 門口露出一截睡袋（跟鼴鼠的圍巾同色）
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .9, 12),
    new THREE.MeshStandardMaterial({ color: 0x4d8790, roughness: .9 }));
  roll.rotation.z = Math.PI / 2; roll.position.set(0, .16, D / 2 - .28);
  tent.add(roll);

  // 門口方向：0 = 正對鏡頭；負數 = 往左轉（朝篝火那側）
  tent.position.set(C.tentX, 0, C.tentZ);
  tent.rotation.y = (typeof C.tentRot === 'number')
    ? C.tentRot
    : Math.atan2(C.fireX - C.tentX, C.fireZ - C.tentZ);
  camp.add(tent);

  // 帳篷旁的一小堆柴火
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.08, .09, .75, 8), logMat);
    l.rotation.z = Math.PI / 2;
    const r = tent.rotation.y, sx = 1.45, sz = .35 - i * .02;          // 帳篷右手邊
    l.position.set(C.tentX + Math.cos(r) * sx + Math.sin(r) * sz + (i === 2 ? .09 : i * .18) * Math.cos(r),
                   .09 + (i === 2 ? .15 : 0),
                   C.tentZ - Math.sin(r) * sx + Math.cos(r) * sz - (i === 2 ? .09 : i * .18) * Math.sin(r));
    l.rotation.y = r + Math.PI / 2;
    l.castShadow = true;
    camp.add(l);
  }
}

/* ============================================================
   3. 篝火（石頭圍一圈、木柴搭成小尖塔、會跳動的火焰和火星）
   ============================================================ */
const flames = [], embers = [];
let fireLight, fireGlow, firePool;
{
  const fire = new THREE.Group();

  // 一圈石頭
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7d7a80, roughness: 1, flatShading: true });
  const stoneGeo = new THREE.DodecahedronGeometry(.17, 0);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const st = new THREE.Mesh(stoneGeo, stoneMat);
    st.position.set(Math.cos(a) * .52, .08, Math.sin(a) * .52);
    st.scale.set(1, .65, 1);
    st.rotation.set(i * 1.7, i * 2.3, i * .9);
    st.castShadow = true;
    fire.add(st);
  }

  // 木柴搭成小尖塔（燒焦的和沒燒到的交錯）
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.045, .065, .62, 7), i % 2 ? logMat : charMat);
    l.rotation.order = 'YXZ';
    l.rotation.y = a;
    l.rotation.x = -.75;
    l.position.set(Math.sin(a) * .17, .2, Math.cos(a) * .17);
    l.castShadow = true;
    fire.add(l);
  }

  // 火焰：幾層半透明的錐形疊在一起
  const flameMat = c => new THREE.MeshBasicMaterial({
    color: c, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  [[0, 0, .3, .9, 0xff5a14], [.07, .04, .22, .7, 0xff9a2a],
   [-.06, -.03, .17, .55, 0xffb13a], [0, 0, .11, .42, 0xffe08a]].forEach(([x, z, r, h, c], i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8, 1, true), flameMat(c));
    f.position.set(x, .16 + h / 2, z);
    f.userData = { baseY: .16 + h / 2, h, phase: i * 1.9 };
    fire.add(f);
    flames.push(f);
  });

  // 火光：柔光球、地上的暖色光暈、真正照亮周圍的點光源
  fireGlow = new THREE.Sprite(new THREE.SpriteMaterial(additive(0xff8a2a, .55)));
  fireGlow.scale.set(2.4, 2.4, 1); fireGlow.position.y = .55;
  fire.add(fireGlow);
  firePool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial(additive(0xff7a22, .22)));
  firePool.rotation.x = -Math.PI / 2; firePool.position.y = .03;
  fire.add(firePool);
  fireLight = new THREE.PointLight(0xff8a2a, 3.2, 9, 1.8);
  fireLight.position.y = .9;
  fire.add(fireLight);

  // 往上飄的火星
  for (let i = 0; i < 14; i++) {
    const e = new THREE.Sprite(new THREE.SpriteMaterial(additive(0xffb04a, 0)));
    e.scale.set(.08, .08, 1);
    e.userData = { t: i / 14, speed: .22 + (i % 5) * .06, x: 0, z: 0 };
    fire.add(e);
    embers.push(e);
  }

  // 可以坐的圓木（放在篝火遠離帳篷的那一側，跟火堆「平行」橫躺，像一張長椅）
  // away    = 從帳篷往篝火的方向（圓木要擺在這個方向上）
  // tangent = 跟 away 垂直的方向（圓木的長邊要沿著這個方向躺）
  const away = Math.atan2(C.fireX - C.tentX, C.fireZ - C.tentZ);
  const tx = Math.cos(away), tz = -Math.sin(away);
  const BENCH_DIST = 1.15;
  const bx = Math.sin(away) * BENCH_DIST, bz = Math.cos(away) * BENCH_DIST;

  const bench = new THREE.Mesh(new THREE.CylinderGeometry(.17, .19, 1.15, 10), logMat);
  bench.rotation.z = Math.PI / 2;        // 先放倒：圓柱從直立變成沿著 X 軸躺
  bench.rotation.y = away;               // 再轉向：讓長邊沿著 tangent（之前多轉了 90 度，才會變成插進火堆）
  bench.position.set(bx, .17, bz);
  bench.castShadow = bench.receiveShadow = true;
  fire.add(bench);

  // 圓木上的馬克杯（放大一點、加上把手，從上往下看才認得出來）
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xc2483c, roughness: .6 });
  const mugX = bx + tx * .3, mugZ = bz + tz * .3, mugY = .17 + .18 + .08;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(.09, .08, .16, 14), mugMat);
  mug.position.set(mugX, mugY, mugZ);
  mug.castShadow = true;
  fire.add(mug);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(.075, 14),
    new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: .4 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(mugX, mugY + .075, mugZ);
  fire.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.05, .016, 6, 12), mugMat);
  handle.rotation.y = away;
  handle.position.set(mugX + tx * .1, mugY, mugZ + tz * .1);
  fire.add(handle);

  fire.position.set(C.fireX, 0, C.fireZ);
  fire.scale.setScalar(1.25);
  camp.add(fire);
}

/* ============================================================
   4. 每一幀：火焰跳動、火光閃爍、火星飄起來
   ============================================================ */
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const t = now * .001;

  const flick = .86 + Math.sin(t * 9.3) * .07 + Math.sin(t * 23.1) * .04 + (Math.random() - .5) * .06;
  fireLight.intensity = 3.2 * flick;
  fireGlow.material.opacity = .42 + flick * .14;
  firePool.material.opacity = .17 + flick * .06;

  flames.forEach(f => {
    const u = f.userData;
    const sy = 1 + Math.sin(t * 11 + u.phase) * .13 + (Math.random() - .5) * .05;
    f.scale.set(1 + Math.sin(t * 7 + u.phase) * .07, sy, 1 + Math.cos(t * 8 + u.phase) * .07);
    f.position.y = u.baseY + (sy - 1) * u.h * .5;
    f.rotation.y += dt * 1.4;
  });

  embers.forEach(e => {
    const u = e.userData;
    u.t += dt * u.speed;
    if (u.t > 1) { u.t -= 1; u.x = (Math.random() - .5) * .3; u.z = (Math.random() - .5) * .3; }
    e.position.set(u.x + Math.sin(u.t * 7 + u.speed * 20) * .09, .35 + u.t * 1.7, u.z);
    e.material.opacity = Math.sin(u.t * Math.PI) * .9;
  });
}
requestAnimationFrame(tick);

/* ============================================================
   5. 睡覺：畫面淡出 → 礦石重新長一批 → 天亮淡入
   ============================================================ */
const stage = document.getElementById('stage');
const fx = document.createElement('div');
fx.id = 'sleepFx';
fx.innerHTML = '<div class="zzz"><span>Z</span><span>z</span><span>z</span></div><div class="msg"></div>';
(stage || document.body).appendChild(fx);
if (!stage) fx.style.position = 'fixed';
const msg = fx.querySelector('.msg');

function sleep() {
  if (P.sleeping || P.shopOpen || P.brokeOpen) return;
  P.sleeping = true;
  P.mineRequested = false;
  G.keys = {};
  G.vel.x = G.vel.z = 0;
  G.moveDir = null;

  msg.innerHTML = '鑽進帳篷，聽著篝火劈啪作響……';
  fx.classList.add('on');

  setTimeout(() => {                         // 畫面全黑的時候偷偷換掉礦石
    MINING.refreshOres();
    msg.innerHTML = '天亮了<br><span style="font-size:12px;color:#9a9384">礦坑裡長出了一批新的礦石</span>';
  }, 1500);
  setTimeout(() => fx.classList.remove('on'), 3000);
  setTimeout(() => {
    P.sleeping = false;
    MINING.toast('睡飽了！礦坑長出了 ' + MINING.ores.length + ' 顆新礦石', '#c6d1ff');
  }, 3700);
}

window.CAMP = { ...C, sleep };

/* ============================================================
   6. 小地圖上標出營地（橘色圓點）
   ============================================================ */
if (typeof window.drawMinimap === 'function') {
  const drawBase = window.drawMinimap;
  const ctx = document.getElementById('minimap').getContext('2d');
  window.drawMinimap = function () {
    drawBase();
    const R = 17, S = 150 / (R * 2 + 1);
    const dx = (C.x - G.player.position.x) / G.cell, dz = (C.z - G.player.position.z) / G.cell;
    if (Math.abs(dx) > R || Math.abs(dz) > R) return;
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath(); ctx.arc((dx + R) * S, (dz + R) * S, 3.2, 0, Math.PI * 2); ctx.fill();
  };
}

})();
