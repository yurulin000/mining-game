/* ============================================================
   礦坑原型 · STEP 2　挖礦 × 十字鎬 × 商店
   ------------------------------------------------------------
   這個檔案是「加上去的」，沒有動到 index.html 原本的場景程式。
   要調整數值（價格、速度、稀有度），全部集中在最上面的設定區。
   ============================================================ */
(function () {

/* ============================================================
   ★ 設定區：想調整平衡就改這裡
   ============================================================ */

// 四種礦石（由小到大、由便宜到貴）
const ORE_TYPES = [
  { key:'blue', name:'藍霧原礦', gemName:'藍霧寶石', color:0x168cff, glow:0x005bd6, size:0.56,
    rawImg:'images/raw_ore_01.png', gemImg:'images/polished_gem_01.png', aspect:1.20,
    polishCost:40, hits:3, varMax:2.5, needPick:0, weight:42 },
  { key:'red', name:'赤焰原礦', gemName:'赤焰寶石', color:0xff382e, glow:0xd41414, size:0.68,
    rawImg:'images/raw_ore_02.png', gemImg:'images/polished_gem_02.png', aspect:1.28,
    polishCost:90, hits:4, varMax:5, needPick:1, weight:27 },
  { key:'purple', name:'紫月原礦', gemName:'紫月寶石', color:0x922cff, glow:0x5d0bd4, size:0.82,
    rawImg:'images/raw_ore_03.png', gemImg:'images/polished_gem_03.png', aspect:1.03,
    polishCost:180, hits:5, varMax:12, needPick:2, weight:17 },
  { key:'gold', name:'日耀原礦', gemName:'日耀寶石', color:0xffa614, glow:0xd96800, size:0.98,
    rawImg:'images/raw_ore_04.png', gemImg:'images/polished_gem_04.png', aspect:1.05,
    polishCost:350, hits:6, varMax:25, needPick:3, weight:10 },
  { key:'rainbow', name:'星虹原礦', gemName:'星虹寶石', color:0x12d8ff, glow:0x6b27ff, size:1.12,
    rawImg:'images/raw_ore_05.png', gemImg:'images/polished_gem_05.png', aspect:1.08,
    polishCost:700, hits:8, varMax:45, needPick:3, weight:4 },
];
//  hits     = 用「順手」的十字鎬要敲幾下
//  varMax   = 倍率天花板（這種礦最多能開出幾倍）
//             越大＝偶爾爆很高但很罕見（高風險）；越小＝倍率穩穩貼著平均（好預測）
//             ★不管天花板多高，長期平均一律等於下面的 PAYOUT_RTP★
//  needPick = 順手的十字鎬階級（0=木 1=石 2=鐵 3=金）
//             ★任何十字鎬都挖得動任何礦★，只是階級每差一階，就要多敲 EXTRA_HITS_PER_TIER 倍
//  weight   = 出現機率的權重（數字越大越常見）

// 四階十字鎬：剛好跟四種礦石一一對應
const PICKS = [
  { key:'wood',  name:'木十字鎬', price:100,  speed:1.0, unlockAt:0,  img:'images/pickaxe_wood.png',
    desc:'什麼礦都能挖，但高級礦要敲很多下' },
  { key:'stone', name:'石十字鎬', price:200,  speed:1.5, unlockAt:10, img:'images/pickaxe_stone.png',
    desc:'敲赤焰原礦很順手　揮鎬速度 1.5 倍' },
  { key:'iron',  name:'鐵十字鎬', price:400,  speed:2.2, unlockAt:30, img:'images/pickaxe_iron.png',
    desc:'敲紫月原礦很順手　揮鎬速度 2.2 倍' },
  { key:'gold',  name:'金十字鎬', price:800, speed:3.0, unlockAt:60, img:'images/pickaxe_gold.png',
    desc:'敲日耀、星虹原礦很順手　揮鎬速度 3 倍' },
];
//  price    = 每挖一次要付的場地費，也就是這一次的下注金額
//  unlockAt = 累積挖到幾顆礦之後自動解鎖（十字鎬不用買、不會消耗，靠挖礦升級）
//  img   = 商店和下方 BET 列用的圖示

/* --- 賺賠設定（做法參考「打殭屍」）---
   每挖一次礦，先扣掉「目前十字鎬的價格」當作下注金額，
   挖到的礦石會當場抽一個倍率，帶回商店可以賣出「下注金額 × 倍率」。
   倍率低於 1 就是這一趟賠了，高於 1 就是賺了。                        */
const START_MONEY  = 20000; // 開局金額
                            //  ★這個數字決定「能玩多久」★
                            //  RTP 0.9 代表每下注 $100 平均就蒸發 $10，
                            //  本金太少會在十幾次開採內就破產。
                            //  實測：$1,000 撐 12 次／$5,000 撐 52 次／$20,000 撐 359 次
// ★十字鎬是消耗品★：挖完一顆礦就用掉一把，十字鎬的價格就是這一次的下注金額
// （所以挖礦當下不會再另外扣錢 —— 錢在買十字鎬的時候就付過了）
// 十字鎬改成等級制：一開始只有木十字鎬，累積挖到一定數量會自動解鎖下一階
// 門檻寫在上面 PICKS 的 unlockAt

const PAYOUT_RTP   = 0.9;   // 整體回收率＝長期平均倍率
                            //  0.9 = 偏莊家（玩家長期會慢慢輸）
                            //  1.0 = 打平　　>1 = 偏玩家
const MULT_FLOOR   = 0.1;   // 最低倍率（再怎麼衰，至少拿回下注的一成）
/* --- 高階十字鎬：大獎更大更常見，但平常收成更差 ---
   每次開採分兩段抽：
     1) 少數機率抽「大獎」，上限 = 礦石天花板 × JACK_SPAN
     2) 其餘時候抽「平常收成」，上限固定 ORD_CEIL
   兩段加權後的平均永遠等於 PAYOUT_RTP，所以回收率不會變。
   想更刺激就把 JACK_SHARE 調高（大獎更大，但平常更常空手）。 */
const ORD_CEIL   = 3.0;                       // 平常收成的倍率上限
const JACK_SHARE = [.10, .20, .30, .40];      // 木/石/鐵/金：多少比例的回收撥去當大獎
const JACK_RATE  = [.012, .014, .016, .018];  // 中大獎的機率
const JACK_SPAN  = [1.0, 1.8, 3.0, 4.5];      // 大獎上限 = 礦石天花板 × 這個倍數
const SUBSIDY      = 3000;  // 礦工工會補助金：錢包空了、背包也空了的時候發給你
                            //  只夠再撐一陣子，不是重新開局（開局是 $20,000）

const SWING_SEC    = 0.55;  // 木十字鎬揮一下要幾秒（好鎬子會照 speed 變快）
const EXTRA_HITS_PER_TIER = 0.8;  // 鎬子每比礦「低一階」，要多敲原本的 80%
                                  //  例：金髓礦順手是 6 下，木鎬低 3 階 → 6 × (1 + 3×0.8) ≈ 21 下

const ACTIVE_ORES  = 30;    // 場上同時存在幾顆礦石（全地圖約有 47 個合格礦點，留空位給重生）
const RESPAWN_SEC  = 15;    // 挖掉之後幾秒補一顆新的（位置隨機）
const MINE_RANGE   = 1.9;   // 距離礦石多近才能開採
const SHOP_RANGE   = 2.4;   // 距離商店多近才能開啟

// 商店位置：出生大廳的右上角，背後和側面都貼著岩壁，不擋主要通道
//（原本在出生點正前方 4 公尺，剛好卡在南北通道的正中間）
const SHOP = { x: 7.5, z: 12.0 };

// 營地（帳篷＋篝火）：在商店下方，靠著右側岩壁
// 走到營地旁邊按「睡覺」，全地圖的礦石會重新長一批（解決小礦挖光只剩大礦的問題）
const CAMP = { tentX: 7.5, tentZ: 16.0, tentRot: -0.4,   // tentRot：0＝門口正對鏡頭，負數＝往左轉向篝火
               fireX: 4.0, fireZ: 18.8, range: 2.4 };   // 篝火往左下移，離帳篷至少 2.6 公尺，不會看起來燒到帳篷
                                                          // （帳篷正下方大廳變窄，放不下篝火＋圓木，所以往左下）
CAMP.x = (CAMP.tentX + CAMP.fireX) / 2;
CAMP.z = (CAMP.tentZ + CAMP.fireZ) / 2;

/* ============================================================
   玩家的錢包與背包
   ============================================================ */
const P = {
  money: START_MONEY,
  pick: 0,                                   // 目前十字鎬（0=木，一開始就有）
  mined: 0,           // 累積挖到幾顆礦（用來解鎖十字鎬）
  // 背包裡每一顆礦石都記著自己的倍率和當初的下注金額
  // 例如 { mult:2.34, bet:300, value:702 }
  bag: { blue:[], red:[], purple:[], gold:[], rainbow:[] },
  shopOpen: false,
  polishing: false,   // 正在播放打磨演出；此時不能關閉商店或重複操作
  brokeOpen: false,   // 破產面板是不是開著
  sleeping: false,    // 正在帳篷裡睡覺（這段時間遊戲暫停）
  // TURBO：開啟後挖到的礦不放進背包，當場賣掉（會記住上次的設定）
  turbo: (() => { try { return localStorage.getItem('mole-mine-turbo') === '1'; } catch (_) { return false; } })(),
  turboSold: 0,       // TURBO 當場賣掉的礦石數（給音效判斷用）
  nearTent: false,    // 現在站在營地旁邊嗎
  mineRequested: false, // 玩家按下「開採」了嗎
  nearShop: false,    // 現在站在商店旁邊嗎
  subsidyCount: 0,    // 一共領過幾次補助金
  mining: null,      // 正在挖的礦石
  progress: 0,       // 開採進度 0~1
  swingPhase: 0,     // 單次揮鎬 0~1；角色動作、碰撞特效與音效共用這個節拍
  miningHitCount: 0  // 這顆礦已經實際敲中的次數
};
window.P = P;        // 方便你之後在瀏覽器主控台查看

/* ============================================================
   抽倍率：偏態隨機 —— 大多數時候倍率偏低、偶爾爆高，
   但長期平均會精準等於 PAYOUT_RTP。
   （跟「打殭屍」擊殺結算用的是同一條公式）
   ============================================================ */
// 這把十字鎬敲這種礦，總共要敲幾下
function hitsNeeded(type, pickIndex) {
  const gap = Math.max(0, type.needPick - pickIndex);
  return Math.ceil(type.hits * (1 + gap * EXTRA_HITS_PER_TIER));
}

function skewRoll(mean, ceil, floor) {
  if (ceil <= mean) ceil = mean * 1.5;
  const power = (ceil - floor) / (mean - floor) - 1;
  return floor + (ceil - floor) * Math.pow(Math.random(), power);
}
function rollMult(type, pickIndex) {
  const i = Math.max(0, Math.min(JACK_SHARE.length - 1, pickIndex | 0));
  const share = JACK_SHARE[i], rate = JACK_RATE[i];
  if (Math.random() < rate) {                       // 大獎
    const jackMean = PAYOUT_RTP * share / rate;
    return skewRoll(jackMean, type.varMax * JACK_SPAN[i], jackMean * .35);
  }
  return skewRoll(PAYOUT_RTP * (1 - share) / (1 - rate), ORD_CEIL, MULT_FLOOR);  // 平常收成
}

// 每次開採會得到 1～5 顆；數量越多越稀有。
function rollOreQuantity() {
  const r = Math.random();
  if (r < .44) return 1;
  if (r < .72) return 2;
  if (r < .88) return 3;
  if (r < .97) return 4;
  return 5;
}

/* ============================================================
   1. 決定礦石可以長在哪裡
   規則：挑「走得到、而且緊貼著岩壁」的位置 —— 礦脈長在牆上才自然。
   再把太靠近的點刷掉，讓礦石分散在整座礦坑，不會擠成一堆。
   ============================================================ */
const STEP = CAVERN.step;
const cellSet = new Set(CAVERN.cells.map(c => c[0] + ',' + c[1]));
const isFloor = (x, z) => cellSet.has(x + ',' + z);
const ORE_EDGE_INSET = 1.20;   // 從視覺岩壁往可行走區內縮，避開向內突出的裝飾石塊
const ORE_FOOTPRINT  = 0.95;   // 以最大金髓礦的底部寬度預留空間

const isFloorWorld = (x, z) => isFloor(Math.round(x / STEP), Math.round(z / STEP));
function hasFloorClearance(x, z, radius = ORE_FOOTPRINT) {
  if (!isFloorWorld(x, z)) return false;
  // 不只檢查中心；環狀取樣可排除轉角、窄縫及凹形邊緣。
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    if (!isFloorWorld(x + Math.cos(a) * radius, z + Math.sin(a) * radius)) return false;
  }
  return true;
}

const spawnPoints = [];
{
  const raw = [];
  const B = CAVERN.bridge;
  for (const [cx, cz] of CAVERN.cells) {
    // 找出這格有哪幾面是牆
    const walls = [[1,0],[-1,0],[0,1],[0,-1]].filter(d => !isFloor(cx + d[0], cz + d[1]));
    if (!walls.length) continue;                       // 空曠處不長礦

    const wx = cx * STEP, wz = cz * STEP;

    // nx/nz 指向牆外；礦石要往相反方向移，才會落在可行走區內側。
    let nx = 0, nz = 0;
    walls.forEach(d => { nx += d[0]; nz += d[1]; });
    const len = Math.hypot(nx, nz);
    if (len < 0.5) continue;  // 兩側同時是牆的窄縫沒有安全的內縮方向

    const x = wx - (nx / len) * ORE_EDGE_INSET;
    const z = wz - (nz / len) * ORE_EDGE_INSET;

    if (!hasFloorClearance(x, z)) continue;
    if (x + ORE_FOOTPRINT >= B[0] && x - ORE_FOOTPRINT <= B[1] &&
        z + ORE_FOOTPRINT >= B[2] && z - ORE_FOOTPRINT <= B[3]) continue; // 木橋周圍淨空
    if (Math.hypot(x - CAVERN.spawn[0], z - CAVERN.spawn[1]) < 6) continue;
    if (Math.hypot(x - SHOP.x, z - SHOP.z) < 3.5) continue;          // 商店周圍淨空
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 4.2) continue;          // 營地周圍淨空
    if (CAVERN.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + ORE_FOOTPRINT + 0.18)) continue;

    raw.push({ x, z });
  }

  // 固定順序地打散（用固定種子，所以候選點每次一樣，只有「選中哪些」是隨機）
  let s = 987654321;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }

  // 保持彼此至少 2.4 距離，避免礦石擠在一起
  for (const p of raw) {
    if (spawnPoints.every(q => Math.hypot(p.x - q.x, p.z - q.z) > 2.4)) spawnPoints.push(p);
  }
}

// 場景裡三位正在工作的同事。實際位置從「已通過完整地板淨空檢查」的礦點中挑選，
// 避免手填座標落在視覺岩壁外或不可到達區域。
const MINER_LAYOUT = [
  // 阿土固定在整張地圖下方的大礦區，靠左下側工作但不佔中央通道。
  { name:'阿土', fixedX:-3.5, fixedZ:37.5, targetX:-3.5, targetZ:37.5,
    rot:0.0, fur:0x86563f, hat:0xd98d32, scarf:0x4fae9e, speed:1.00 },
  { name:'米可', targetX: 8.0,  targetZ:-6.5,  rot:-1.15, fur:0x70483c, hat:0x4d8fc8, scarf:0xe58a9a, speed:1.12 },
  { name:'賴瑞', targetX:-8.0,  targetZ:-22.0, rot: .72, fur:0xa16a47, hat:0xb76fc8, scarf:0xe1b64a, speed:.92 }
];
const chosenMinerPoints = [];
const MINER_SPOTS = MINER_LAYOUT.map(spec => {
  if (Number.isFinite(spec.fixedX) && Number.isFinite(spec.fixedZ)) {
    const fixed = { x:spec.fixedX, z:spec.fixedZ };
    chosenMinerPoints.push(fixed);
    return { ...spec, ...fixed };
  }
  let best = null, bestScore = Infinity;
  spawnPoints.forEach(p => {
    if (chosenMinerPoints.some(q => Math.hypot(p.x - q.x, p.z - q.z) < 13)) return;
    const score = Math.hypot(p.x - spec.targetX, p.z - spec.targetZ);
    if (score < bestScore) { best = p; bestScore = score; }
  });
  if (!best) best = spawnPoints.find(p => !chosenMinerPoints.includes(p));
  chosenMinerPoints.push(best);
  return { ...spec, x:best.x, z:best.z };
});
// 不讓隨機礦脈生成在同事與表演用岩石上。
for (let i = spawnPoints.length - 1; i >= 0; i--) {
  if (MINER_SPOTS.some(m => Math.hypot(spawnPoints[i].x - m.x, spawnPoints[i].z - m.z) < 2.35)) {
    spawnPoints.splice(i, 1);
  }
}
console.log('礦石可用位置：' + spawnPoints.length + ' 個');

/* ============================================================
   2. 礦石的外觀
   一顆礦 = 幾塊大小不一的結晶，會自己發光（在黑暗的礦坑裡才看得到）
   ============================================================ */
const oreLayer = new THREE.Group();
scene.add(oreLayer);

// 六角晶柱與尖晶面分開製作，輪廓會比原本的二十面體更像真正的礦脈。
const crystalBodyGeo = new THREE.CylinderGeometry(0.34, 0.46, 1, 6, 1, false);
const crystalTipGeo  = new THREE.ConeGeometry(0.34, 1, 6, 1, false);
const baseRockGeo    = new THREE.DodecahedronGeometry(1, 0);

function makeHalo() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const haloTex = makeHalo();

function buildOreMesh(type) {
  const g = new THREE.Group();
  const size = type.size * 1.35;  // 配合手機直式遠景，提高晶簇辨識度
  const crystalColor = new THREE.Color(type.color).lerp(new THREE.Color(0xffffff), 0.12);
  const tipColor = new THREE.Color(type.color).lerp(new THREE.Color(0xffffff), 0.30);
  const rockColor = new THREE.Color(type.color).lerp(new THREE.Color(0x182238), 0.72);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: crystalColor, emissive: type.glow, emissiveIntensity: 0.48,
    roughness: 0.12, metalness: 0, flatShading: true,
    transparent: true, opacity: 0.56, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.08
  });
  const tipMat = new THREE.MeshPhysicalMaterial({
    color: tipColor, emissive: type.color, emissiveIntensity: 0.62,
    roughness: 0.08, metalness: 0, flatShading: true,
    transparent: true, opacity: 0.70, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.06
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: tipColor, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: rockColor, emissive: type.glow, emissiveIntensity: 0.08,
    roughness: 0.95, metalness: 0, flatShading: true
  });
  const edgeMat = new THREE.LineBasicMaterial({color:tipColor,
    transparent:true,opacity:0.28,depthWrite:false,blending:THREE.AdditiveBlending});

  const layouts = [
    { x: 0.00, z: 0.02, h: 1.65, w: 0.54, rx: 0.02, rz: -0.04 },
    { x:-0.46, z: 0.08, h: 1.08, w: 0.40, rx: 0.05, rz: -0.27 },
    { x: 0.43, z: 0.10, h: 0.93, w: 0.38, rx:-0.03, rz:  0.25 },
    { x: 0.18, z:-0.42, h: 0.73, w: 0.31, rx:-0.25, rz:  0.10 },
    { x:-0.28, z:-0.37, h: 0.61, w: 0.29, rx:-0.21, rz: -0.12 }
  ];

  // 稀有礦的晶簇較完整；常見藍晶石保留四根，畫面不會過度擁擠。
  const shardCount = type.key === 'blue' ? 4 : 5;
  layouts.slice(0, shardCount).forEach((p, i) => {
    const shard = new THREE.Group();
    const h = p.h * size;
    const w = p.w * size;

    const body = new THREE.Mesh(crystalBodyGeo, bodyMat);
    body.scale.set(w, h, w);
    body.position.y = h * 0.50;
    body.castShadow = false;
    shard.add(body);

    const tip = new THREE.Mesh(crystalTipGeo, tipMat);
    tip.scale.set(w, w * 0.90, w);
    tip.position.y = h + w * 0.45;
    tip.castShadow = false;
    shard.add(tip);
    const bodyEdge = new THREE.LineSegments(new THREE.EdgesGeometry(crystalBodyGeo, 25), edgeMat);
    bodyEdge.scale.copy(body.scale);bodyEdge.position.copy(body.position);shard.add(bodyEdge);
    const tipEdge = new THREE.LineSegments(new THREE.EdgesGeometry(crystalTipGeo, 25), edgeMat);
    tipEdge.scale.copy(tip.scale);tipEdge.position.copy(tip.position);shard.add(tipEdge);

    // 晶體內部的一小層柔光，亮但不會整顆白掉。
    const core = new THREE.Mesh(crystalBodyGeo, coreMat);
    core.scale.set(w * 0.58, h * 0.91, w * 0.58);
    core.position.y = h * 0.50;
    shard.add(core);

    shard.position.set(p.x * size, 0.08 * size, p.z * size);
    shard.rotation.set(p.rx, i * 0.83 + Math.random() * 0.35, p.rz);
    g.add(shard);
  });

  // 晶簇底部加入不規則碎岩，讓礦石像是從地面長出來，而不是漂浮模型。
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.random() * 0.35;
    const r = size * (0.38 + Math.random() * 0.18);
    const rock = new THREE.Mesh(baseRockGeo, baseMat);
    const s = size * (0.20 + Math.random() * 0.12);
    rock.scale.set(s * (0.8 + Math.random() * 0.5), s * 0.65, s);
    rock.position.set(Math.cos(a) * r, s * 0.30, Math.sin(a) * r);
    rock.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
    rock.castShadow = true;
    g.add(rock);
  }

  // 光暈：讓玩家遠遠就看得到礦脈
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, color: type.color, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const halo = new THREE.Sprite(haloMat);
  const hs = size * 2.75;
  halo.scale.set(hs, hs, 1);
  halo.position.y = size * 0.92;
  g.add(halo);

  const auraMat = new THREE.MeshBasicMaterial({
    map: haloTex, color: type.color, transparent: true, opacity: 0.09,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.025;
  aura.scale.set(size * 2.45, size * 2.45, 1);
  g.add(aura);

  g.userData.halo = halo;
  g.userData.aura = aura;
  g.userData.haloSize = hs;
  g.userData.auraSize = size * 2.45;
  g.userData.pulsePhase = Math.random() * Math.PI * 2;
  g.userData.mat = bodyMat;
  g.userData.tipMat = tipMat;
  g.userData.coreMat = coreMat;
  g.userData.materials = [bodyMat, tipMat, coreMat, baseMat, haloMat, auraMat, edgeMat];
  return g;
}

// 新版礦脈：深色母岩佔大部分體積，晶體從裂縫與岩塊之間露出。
// 五個等級共用同一套造型語言，但高級礦會有更多晶體、更大的露出面積與發光礦脈。
function buildEmbeddedOreMesh(type) {
  const g = new THREE.Group();
  const rank = Math.max(0, ORE_TYPES.indexOf(type));
  const overall = 0.90 + rank * 0.045;
  const crystalColor = new THREE.Color(type.color);
  const brightColor = crystalColor.clone().lerp(new THREE.Color(0xffffff), 0.07);
  const rockColor = new THREE.Color(0x202a3a).lerp(new THREE.Color(0x182233), rank * 0.045);

  const rockMat = new THREE.MeshStandardMaterial({
    color: rockColor, emissive: 0x0b1220, emissiveIntensity: 0.16,
    roughness: 0.97, metalness: 0, flatShading: true
  });
  const rockAccentMat = new THREE.MeshStandardMaterial({
    color: rockColor.clone().lerp(new THREE.Color(0x465269), 0.22),
    emissive: type.glow, emissiveIntensity: 0.025 + rank * 0.008,
    roughness: 0.94, metalness: 0, flatShading: true
  });
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: crystalColor.clone().lerp(new THREE.Color(0xffffff), 0.025),
    emissive: crystalColor, emissiveIntensity: 0.56 + rank * 0.045,
    roughness: 0.12, metalness: 0, flatShading: true,
    transparent: true, opacity: 0.84, depthWrite: false,
    transmission: 0.045, thickness: 0.45,
    clearcoat: 1, clearcoatRoughness: 0.08
  });
  const tipMat = new THREE.MeshPhysicalMaterial({
    color: brightColor, emissive: crystalColor, emissiveIntensity: 0.76 + rank * 0.05,
    roughness: 0.08, metalness: 0, flatShading: true,
    transparent: true, opacity: 0.91, depthWrite: false,
    transmission: 0.055, thickness: 0.34,
    clearcoat: 1, clearcoatRoughness: 0.05
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: crystalColor, transparent: true, opacity: 0.16 + rank * 0.014,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const seamMat = new THREE.MeshBasicMaterial({
    color: crystalColor, transparent: true, opacity: 0.34 + rank * 0.045,
    blending: THREE.AdditiveBlending, depthWrite: false
  });

  // 不規則、互相交疊的母岩。每顆岩塊的長寬高與方向都不同，避免像整齊排好的球。
  const moundLayout = [
    [-0.56, 0.24,  0.03, 0.50, 0.38, 0.48,  0.16,  0.38,  0.10],
    [ 0.02, 0.31,  0.09, 0.62, 0.50, 0.56, -0.08, -0.52,  0.06],
    [ 0.58, 0.23,  0.07, 0.47, 0.36, 0.43,  0.12,  0.72, -0.14],
    [-0.30, 0.39, -0.25, 0.47, 0.55, 0.45, -0.18,  0.20,  0.12],
    [ 0.34, 0.42, -0.24, 0.52, 0.58, 0.49,  0.14, -0.28, -0.10],
    [-0.68, 0.18, -0.27, 0.32, 0.28, 0.34, -0.05,  0.86,  0.18],
    [ 0.70, 0.17, -0.28, 0.34, 0.27, 0.36,  0.18, -0.74, -0.12]
  ];
  moundLayout.forEach((p, i) => {
    const rock = new THREE.Mesh(baseRockGeo, i % 3 === 0 ? rockAccentMat : rockMat);
    rock.scale.set(p[3] * overall, p[4] * overall, p[5] * overall);
    rock.position.set(p[0] * overall, p[1] * overall, p[2] * overall);
    rock.rotation.set(p[6], p[7], p[8]);
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
  });

  // 露出的晶體隨等級增加；底部刻意埋入岩石內，讓它看起來是礦脈而非放在地上的寶石。
  const crystalLayouts = [
    [
      {x: 0.24, z:-0.17, h:0.66, w:0.16, rx:-0.10, rz:-0.10},
      {x:-0.48, z: 0.02, h:0.40, w:0.12, rx: 0.09, rz: 0.18},
      {x: 0.53, z: 0.08, h:0.29, w:0.10, rx:-0.05, rz: 0.21}
    ],
    [
      {x: 0.34, z:-0.13, h:0.56, w:0.17, rx:-0.08, rz:-0.13},
      {x:-0.42, z: 0.02, h:0.36, w:0.13, rx: 0.10, rz: 0.18},
      {x: 0.03, z: 0.18, h:0.27, w:0.11, rx:-0.10, rz: 0.08}
    ],
    [
      {x:-0.10, z:-0.13, h:0.83, w:0.22, rx:-0.08, rz:-0.08},
      {x: 0.31, z:-0.08, h:0.65, w:0.19, rx: 0.05, rz: 0.18},
      {x: 0.54, z: 0.02, h:0.40, w:0.14, rx:-0.04, rz: 0.25}
    ],
    [
      {x:-0.28, z:-0.10, h:0.62, w:0.19, rx:-0.05, rz:-0.18},
      {x: 0.10, z:-0.17, h:0.76, w:0.22, rx: 0.04, rz: 0.04},
      {x: 0.46, z:-0.08, h:0.55, w:0.17, rx:-0.08, rz: 0.20},
      {x:-0.53, z: 0.05, h:0.34, w:0.13, rx: 0.07, rz:-0.22}
    ],
    [
      {x:-0.15, z:-0.16, h:0.94, w:0.25, rx:-0.07, rz:-0.10},
      {x: 0.28, z:-0.12, h:0.73, w:0.22, rx: 0.04, rz: 0.18},
      {x: 0.55, z: 0.00, h:0.48, w:0.16, rx:-0.07, rz: 0.27},
      {x:-0.52, z: 0.03, h:0.41, w:0.15, rx: 0.08, rz:-0.23}
    ]
  ];

  crystalLayouts[rank].forEach((p, i) => {
    const shard = new THREE.Group();
    const h = p.h * overall;
    const w = p.w * overall;
    const body = new THREE.Mesh(crystalBodyGeo, bodyMat);
    body.scale.set(w, h, w);
    body.position.y = h * 0.50;
    shard.add(body);
    const tip = new THREE.Mesh(crystalTipGeo, tipMat);
    tip.scale.set(w, w * 0.92, w);
    tip.position.y = h + w * 0.45;
    shard.add(tip);
    const core = new THREE.Mesh(crystalBodyGeo, coreMat);
    core.scale.set(w * 0.62, h * 0.88, w * 0.62);
    core.position.y = h * 0.50;
    shard.add(core);
    shard.position.set(p.x * overall, (0.34 + rank * 0.008) * overall, p.z * overall);
    shard.rotation.set(p.rx, i * 1.17 + rank * 0.37, p.rz);
    g.add(shard);
  });

  // 岩石表面的發光礦脈。低階只有短裂紋，高階才延伸成更醒目的分岔。
  const seamPaths = [
    [new THREE.Vector3(-0.54,0.39,0.40), new THREE.Vector3(-0.18,0.46,0.48), new THREE.Vector3(0.13,0.43,0.50)],
    [new THREE.Vector3(-0.18,0.49,0.47), new THREE.Vector3(0.10,0.54,0.50), new THREE.Vector3(0.48,0.39,0.42)]
  ];
  const seamGeometries = [];
  const seamCount = rank < 2 ? 1 : 2;
  for (let i = 0; i < seamCount; i++) {
    const points = seamPaths[i].map(v => v.clone().multiplyScalar(overall));
    const seamGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points), 8, (0.024 + rank * 0.0035) * overall, 5, false
    );
    seamGeometries.push(seamGeo);
    const seam = new THREE.Mesh(seamGeo, seamMat);
    g.add(seam);
  }

  // 稀有的星虹礦加入一顆帶紫色偏光的副晶，仍維持「包在母岩裡」的比例。
  let rainbowMat = null;
  if (rank === 4) {
    rainbowMat = tipMat.clone();
    rainbowMat.color.set(0xc17cff);
    rainbowMat.emissive.set(0x7f48ff);
    const rainbowShard = new THREE.Group();
    const body = new THREE.Mesh(crystalBodyGeo, rainbowMat);
    body.scale.set(0.14, 0.46, 0.14);
    body.position.y = 0.23;
    rainbowShard.add(body);
    const tip = new THREE.Mesh(crystalTipGeo, rainbowMat);
    tip.scale.set(0.14, 0.13, 0.14);
    tip.position.y = 0.52;
    rainbowShard.add(tip);
    rainbowShard.position.set(-0.43, 0.29, -0.10);
    rainbowShard.rotation.z = -0.20;
    g.add(rainbowShard);
  }

  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, color: type.color, transparent: true, opacity: 0.12 + rank * 0.014,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const halo = new THREE.Sprite(haloMat);
  const hs = (2.05 + rank * 0.10) * overall;
  halo.scale.set(hs, hs, 1);
  halo.position.y = (0.56 + rank * 0.05) * overall;
  g.add(halo);

  const auraMat = new THREE.MeshBasicMaterial({
    map: haloTex, color: type.color, transparent: true, opacity: 0.045 + rank * 0.009,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.022;
  const auraSize = (1.85 + rank * 0.10) * overall;
  aura.scale.set(auraSize, auraSize, 1);
  g.add(aura);

  g.rotation.y = (rank * 0.73 + Math.random() * 0.35) % (Math.PI * 2);
  g.userData.halo = halo;
  g.userData.aura = aura;
  g.userData.haloSize = hs;
  g.userData.auraSize = auraSize;
  g.userData.pulsePhase = Math.random() * Math.PI * 2;
  g.userData.mat = bodyMat;
  g.userData.tipMat = tipMat;
  g.userData.coreMat = coreMat;
  g.userData.seamMat = seamMat;
  g.userData.extraCrystalMats = rainbowMat ? [rainbowMat] : [];
  g.userData.geometries = seamGeometries;
  g.userData.materials = [rockMat, rockAccentMat, bodyMat, tipMat, coreMat, seamMat, haloMat, auraMat];
  if (rainbowMat) g.userData.materials.push(rainbowMat);
  return g;
}

/* ============================================================
   3. 生成 / 挖掉礦石
   ============================================================ */
const ores = [];                       // 場上現有的礦石
const usedPoints = new Set();          // 已被佔用的位置

/* ---------- 玩家敲擊特效：碎岩、礦色火花、撞擊閃光 ---------- */
const miningFxLayer = new THREE.Group();
miningFxLayer.name = '玩家敲礦特效';
scene.add(miningFxLayer);
const miningFx = [];
const impactShardGeo = new THREE.TetrahedronGeometry(0.075, 0);

function triggerMiningImpact(ore, finalHit = false) {
  if (!ore || !ore.mesh.parent) return;
  const rank = Math.max(0, ORE_TYPES.indexOf(ore.type));
  const heavy = finalHit || Math.random() < 0.13;
  const dx = ore.x - G.player.position.x;
  const dz = ore.z - G.player.position.z;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const nx = dx / len, nz = dz / len;
  const hitX = ore.x - nx * 0.34;
  const hitZ = ore.z - nz * 0.34;
  const hitY = 0.48 + rank * 0.035;
  const count = finalHit ? 17 : (heavy ? 11 : 7);

  for (let i = 0; i < count; i++) {
    const crystalChip = i < Math.ceil(count * (finalHit ? .58 : .34));
    const color = crystalChip
      ? new THREE.Color(ore.type.color).lerp(new THREE.Color(0xffffff), .08 + Math.random() * .16)
      : new THREE.Color(0x222b39).lerp(new THREE.Color(0x596273), Math.random() * .24);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: crystalChip ? ore.type.color : 0x000000,
      emissiveIntensity: crystalChip ? (finalHit ? 1.15 : .62) : 0,
      roughness: crystalChip ? .28 : .92, flatShading:true,
      transparent:true, opacity:1, depthWrite:false
    });
    const chip = new THREE.Mesh(impactShardGeo, mat);
    const size = (crystalChip ? .72 : 1) * (.62 + Math.random() * .78) * (finalHit ? 1.18 : 1);
    chip.scale.setScalar(size);
    chip.position.set(hitX + (Math.random() - .5) * .22, hitY + Math.random() * .18, hitZ + (Math.random() - .5) * .22);
    chip.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    miningFxLayer.add(chip);
    const side = (Math.random() - .5) * (finalHit ? 1.65 : 1.05);
    const forward = .55 + Math.random() * (finalHit ? 1.25 : .72);
    miningFx.push({
      object:chip, material:mat, kind:'chip', life:0, maxLife:.36 + Math.random() * .28,
      velocity:new THREE.Vector3(-nx * forward + nz * side, 1.2 + Math.random() * (finalHit ? 1.9 : 1.25), -nz * forward - nx * side),
      spin:new THREE.Vector3((Math.random()-.5)*13,(Math.random()-.5)*13,(Math.random()-.5)*13)
    });
  }

  const flashMat = new THREE.SpriteMaterial({
    map:haloTex, color:ore.type.color, transparent:true, opacity:finalHit ? .92 : .68,
    blending:THREE.AdditiveBlending, depthWrite:false
  });
  const flash = new THREE.Sprite(flashMat);
  const flashSize = finalHit ? 1.65 : (heavy ? 1.18 : .86);
  flash.scale.setScalar(flashSize);
  flash.position.set(hitX, hitY + .08, hitZ);
  flash.renderOrder = 12;
  miningFxLayer.add(flash);
  miningFx.push({object:flash, material:flashMat, kind:'flash', life:0, maxLife:finalHit ? .26 : .15, baseScale:flashSize});

  ore.hitPulse = finalHit ? 1.45 : (heavy ? 1.05 : .72);
  G.mineShake = Math.max(G.mineShake || 0, finalHit ? .22 : (heavy ? .13 : .075));
  window.dispatchEvent(new CustomEvent('mine-impact', {
    detail:{ finalHit, heavy, rank, pick:P.pick, color:ore.type.color }
  }));
}

function updateMiningFx(dt) {
  for (let i = miningFx.length - 1; i >= 0; i--) {
    const fx = miningFx[i];
    fx.life += dt;
    const q = Math.min(1, fx.life / fx.maxLife);
    if (fx.kind === 'chip') {
      fx.velocity.y -= 5.8 * dt;
      fx.object.position.addScaledVector(fx.velocity, dt);
      fx.object.rotation.x += fx.spin.x * dt;
      fx.object.rotation.y += fx.spin.y * dt;
      fx.object.rotation.z += fx.spin.z * dt;
      fx.material.opacity = 1 - Math.max(0, (q - .58) / .42);
    } else {
      const s = fx.baseScale * (1 + q * 1.15);
      fx.object.scale.setScalar(s);
      fx.material.opacity = (1 - q) * (1 - q) * .88;
    }
    if (q >= 1) {
      miningFxLayer.remove(fx.object);
      fx.material.dispose();
      miningFx.splice(i, 1);
    }
  }
}

// 使用 images 資料夾中的透明 PNG 作為地圖原礦。
// Sprite 永遠朝向鏡頭，能保留使用者繪製素材的輪廓與色彩，同時仍位於 3D 場景中。
const oreTextureLoader = new THREE.TextureLoader();
const oreTextures = new Map();
function getOreTexture(path) {
  if (!oreTextures.has(path)) {
    const texture = oreTextureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    oreTextures.set(path, texture);
  }
  return oreTextures.get(path);
}

function buildOreImageMesh(type) {
  const group = new THREE.Group();
  const height = 1.12 + type.size * .72;
  const width = height * type.aspect;

  const spriteMat = new THREE.SpriteMaterial({
    map: getOreTexture(type.rawImg), color: 0xffffff, transparent: true,
    alphaTest: .035, depthWrite: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.name = type.name;
  sprite.scale.set(width, height, 1);
  sprite.position.y = height * .48;
  sprite.renderOrder = 4;
  group.add(sprite);

  // 地面上的柔和陰影讓 2D 素材穩定地「站」在 3D 地板上。
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(width * .36, 18),
    new THREE.MeshBasicMaterial({color:0x050914,transparent:true,opacity:.32,depthWrite:false})
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.z = .48;
  shadow.position.y = .018;
  group.add(shadow);

  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, color: type.color, transparent: true, opacity: .12,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const halo = new THREE.Sprite(haloMat);
  const haloSize = width * 1.32;
  halo.scale.set(haloSize, haloSize, 1);
  halo.position.y = height * .49;
  halo.renderOrder = 3;
  group.add(halo);

  const auraMat = new THREE.MeshBasicMaterial({
    map: haloTex, color: type.color, transparent: true, opacity: .055,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = .02;
  aura.scale.set(width * 1.25, width * 1.25, 1);
  group.add(aura);

  group.userData.rawSprite = sprite;
  group.userData.halo = halo;
  group.userData.aura = aura;
  group.userData.haloSize = haloSize;
  group.userData.auraSize = width * 1.25;
  group.userData.pulsePhase = Math.random() * Math.PI * 2;
  // 保留既有動畫與美術加強檔案讀取的欄位。
  group.userData.mat = spriteMat;
  group.userData.tipMat = spriteMat;
  group.userData.coreMat = haloMat;
  group.userData.materials = [spriteMat, haloMat, auraMat, shadow.material];
  group.userData.imageAsset = true;
  return group;
}

function pickType() {
  const total = ORE_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of ORE_TYPES) { r -= t.weight; if (r <= 0) return t; }
  return ORE_TYPES[0];
}

function spawnOre() {
  if (ores.length >= ACTIVE_ORES) return;      // 已經滿了就不再長
  const free = spawnPoints.filter((p, i) => !usedPoints.has(i));
  if (!free.length) return;
  const idx = spawnPoints.indexOf(free[Math.floor(Math.random() * free.length)]);
  const pt = spawnPoints[idx];
  const type = pickType();

  const mesh = buildEmbeddedOreMesh(type);
  mesh.position.set(pt.x, 0, pt.z);
  mesh.scale.setScalar(0.01);                 // 從小長大，出現時有動畫
  oreLayer.add(mesh);

  usedPoints.add(idx);
  ores.push({ type, mesh, x: pt.x, z: pt.z, pointIndex: idx, grow: 0 });
}

function removeOre(ore) {
  oreLayer.remove(ore.mesh);
  ore.mesh.userData.materials.forEach(m => m.dispose());
  if (ore.mesh.userData.geometries) ore.mesh.userData.geometries.forEach(geo => geo.dispose());
  usedPoints.delete(ore.pointIndex);
  ores.splice(ores.indexOf(ore), 1);
  setTimeout(spawnOre, RESPAWN_SEC * 1000);   // 15 秒後在別的地方補一顆
}

for (let i = 0; i < ACTIVE_ORES; i++) spawnOre();

// 睡覺用：把地圖上所有礦石收掉，重新隨機長滿一批（種類和位置都重抽）
function refreshOres() {
  ores.slice().forEach(o => {
    oreLayer.remove(o.mesh);
    o.mesh.userData.materials.forEach(m => m.dispose());
    if (o.mesh.userData.geometries) o.mesh.userData.geometries.forEach(geo => geo.dispose());
  });
  ores.length = 0;
  usedPoints.clear();
  P.mining = null; P.progress = 0; P.mineRequested = false;
  for (let i = 0; i < ACTIVE_ORES; i++) spawnOre();
  refreshHUD();
}

/* ============================================================
   4. 商店：蓋在出生大廳的角落（位置在最上面的設定區 SHOP）
   ============================================================ */
{
  const g = new THREE.Group();
  const wood  = new THREE.MeshStandardMaterial({ color: 0x7a5433, roughness: .9 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xc2483c, roughness: .95 });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.8), wood);
  counter.position.y = 0.47; counter.castShadow = counter.receiveShadow = true; g.add(counter);

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 1.1), wood);
  top.position.y = 1.0; top.castShadow = true; g.add(top);

  [-1.25, 1.25].forEach(x => {                       // 兩根柱子
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.14), wood);
    post.position.set(x, 1.05, -0.42); post.castShadow = true; g.add(post);
  });

  const awning = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.1, 1.0), cloth);
  awning.position.set(0, 2.1, -0.1); awning.rotation.x = -0.18;
  awning.castShadow = true; g.add(awning);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshBasicMaterial({
    map: (() => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 84;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2a1c10'; ctx.fillRect(0, 0, 300, 84);
      ctx.fillStyle = '#ffd79a'; ctx.font = 'bold 44px "Microsoft JhengHei"';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('礦 石 商 會', 150, 46);
      return new THREE.CanvasTexture(c);
    })(), transparent: true
  }));
  sign.position.set(0, 1.62, -0.5); g.add(sign);

  const warm = new THREE.PointLight(0xffc074, 4.5, 9, 2);
  warm.position.set(0, 1.9, 0.3); g.add(warm);

  g.position.set(SHOP.x, 0, SHOP.z);
  scene.add(g);
}

/* 商店旁的小鼴鼠店員：沿用玩家的圓潤、粉嫩、頭大身小造型。 */
function buildShopMole() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color:0x9a674d, roughness:.72 });
  const face = new THREE.MeshStandardMaterial({ color:0xdca98f, roughness:.66 });
  const belly = new THREE.MeshStandardMaterial({ color:0xf2cfb8, roughness:.72 });
  const pink = new THREE.MeshStandardMaterial({ color:0xf18f9f, roughness:.6 });
  const dark = new THREE.MeshStandardMaterial({ color:0x201a1e, roughness:.38 });
  const hat = new THREE.MeshStandardMaterial({ color:0xe6a53b, emissive:0x5a2b05,
    emissiveIntensity:.10, roughness:.62 });
  const scarf = new THREE.MeshStandardMaterial({ color:0x5cc3bb, roughness:.58 });
  const add = (geo, mat, pos, scale) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; g.add(m); return m;
  };
  add(new THREE.SphereGeometry(.5,18,14), fur, [0,.63,0], [.76,.86,.68]);
  add(new THREE.SphereGeometry(.5,18,14), belly, [0,.62,.30], [.50,.66,.20]);
  add(new THREE.SphereGeometry(.5,20,16), fur, [0,1.18,.04], [1.02,.90,.90]);
  add(new THREE.SphereGeometry(.28,16,12), face, [0,1.10,.45], [1.25,.74,.55]);
  add(new THREE.SphereGeometry(.12,14,10), pink, [0,1.10,.64], [1.05,.78,.72]);
  [-1,1].forEach(side => {
    add(new THREE.SphereGeometry(.10,12,10), dark, [side*.20,1.30,.49], [.78,1,.48]);
    add(new THREE.SphereGeometry(.16,14,10), fur, [side*.43,1.38,.01], [.78,.86,.62]);
    add(new THREE.SphereGeometry(.12,14,10), pink, [side*.44,1.39,.025], [.62,.68,.48]);
  });
  const leftArm = add(new THREE.SphereGeometry(.18,14,10), fur, [-.38,.70,.24], [.65,1.05,.65]);
  leftArm.rotation.z = -.38;
  const rightArm = add(new THREE.SphereGeometry(.18,14,10), fur, [.39,.76,.25], [.65,1.10,.65]);
  rightArm.rotation.z = .52;
  [-1,1].forEach(side => add(new THREE.SphereGeometry(.18,14,10), pink,
    [side*.24,.17,.20], [1.10,.42,.72]));
  add(new THREE.TorusGeometry(.34,.055,8,22), scarf, [0,.87,.10], [1.18,.82,1]);
  add(new THREE.SphereGeometry(.48,18,10,0,Math.PI*2,0,Math.PI*.55), hat,
    [0,1.52,.02], [1.02,.50,.94]);
  const brim = add(new THREE.BoxGeometry(.82,.06,.24), hat, [0,1.50,.36], [1,1,1]);
  brim.rotation.x = -.08;
  const lamp = add(new THREE.SphereGeometry(.085,12,8),
    new THREE.MeshBasicMaterial({color:0xffe7a0}), [0,1.61,.39], [1,1,.58]);
  const glow = new THREE.PointLight(0xffc76b,.65,3.2,2); glow.position.set(0,1.63,.46); g.add(glow);
  g.userData.rightArm = rightArm;
  g.userData.leftArm = leftArm;
  g.userData.baseY = 0;
  g.userData.lamp = lamp;
  g.scale.setScalar(.72);
  g.position.set(SHOP.x - 2.05, 0, SHOP.z + .18);
  g.rotation.y = .30;
  scene.add(g);
  return g;
}
const shopMole = buildShopMole();

/* 礦坑裡只負責演出的鼴鼠同事：各自帶著十字鎬，站在岩塊旁持續工作。 */
function buildWorkerMole(spec, index) {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color:spec.fur, roughness:.74 });
  const face = new THREE.MeshStandardMaterial({ color:0xd8a185, roughness:.68 });
  const belly = new THREE.MeshStandardMaterial({ color:0xe9bea5, roughness:.74 });
  const pink = new THREE.MeshStandardMaterial({ color:0xea8496, roughness:.62 });
  const dark = new THREE.MeshStandardMaterial({ color:0x1d181c, roughness:.40 });
  const hat = new THREE.MeshStandardMaterial({ color:spec.hat, roughness:.64 });
  const scarf = new THREE.MeshStandardMaterial({ color:spec.scarf, roughness:.58 });
  const steel = new THREE.MeshStandardMaterial({ color:0x8290a0, metalness:.72, roughness:.35 });
  const woodMat = new THREE.MeshStandardMaterial({ color:0x78451f, roughness:.78 });
  const rockMat = new THREE.MeshStandardMaterial({ color:0x202839, roughness:.90 });
  const crystalColors = [0x43bfff, 0xd66cff, 0xffb83d];
  const crystalMat = new THREE.MeshStandardMaterial({ color:crystalColors[index], emissive:crystalColors[index],
    emissiveIntensity:.72, roughness:.28, transparent:true, opacity:.88 });
  const add = (parent, geo, mat, pos, scale) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; parent.add(m); return m;
  };

  add(g, new THREE.SphereGeometry(.5,18,14), fur, [0,.63,0], [.76,.86,.68]);
  add(g, new THREE.SphereGeometry(.5,18,14), belly, [0,.62,.30], [.50,.66,.20]);
  add(g, new THREE.SphereGeometry(.5,20,16), fur, [0,1.18,.04], [1.02,.90,.90]);
  add(g, new THREE.SphereGeometry(.28,16,12), face, [0,1.10,.45], [1.25,.74,.55]);
  add(g, new THREE.SphereGeometry(.12,14,10), pink, [0,1.10,.64], [1.05,.78,.72]);
  [-1,1].forEach(side => {
    add(g, new THREE.SphereGeometry(.10,12,10), dark, [side*.20,1.30,.49], [.78,1,.48]);
    add(g, new THREE.SphereGeometry(.16,14,10), fur, [side*.43,1.38,.01], [.78,.86,.62]);
    add(g, new THREE.SphereGeometry(.12,14,10), pink, [side*.44,1.39,.025], [.62,.68,.48]);
  });
  const leftArm = add(g, new THREE.SphereGeometry(.18,14,10), fur, [-.34,.76,.27], [.68,1.10,.66]);
  const rightArm = add(g, new THREE.SphereGeometry(.18,14,10), fur, [.35,.78,.27], [.68,1.12,.66]);
  [-1,1].forEach(side => add(g, new THREE.SphereGeometry(.18,14,10), pink,
    [side*.24,.17,.20], [1.10,.42,.72]));
  add(g, new THREE.TorusGeometry(.34,.055,8,22), scarf, [0,.87,.10], [1.18,.82,1]);
  add(g, new THREE.SphereGeometry(.48,18,10,0,Math.PI*2,0,Math.PI*.55), hat,
    [0,1.52,.02], [1.02,.50,.94]);
  const brim = add(g, new THREE.BoxGeometry(.82,.06,.24), hat, [0,1.50,.36], [1,1,1]);
  brim.rotation.x = -.08;
  add(g, new THREE.SphereGeometry(.075,12,8), new THREE.MeshBasicMaterial({color:0xffdc83}),
    [0,1.61,.39], [1,1,.58]);

  const pickPivot = new THREE.Group();
  pickPivot.position.set(.33,.78,.30);
  pickPivot.rotation.z = -.28;
  const handle = add(pickPivot, new THREE.CylinderGeometry(.038,.048,.92,8), woodMat,
    [0,.36,0], [1,1,1]);
  handle.rotation.z = .06;
  // 鎬頭沿前後方向配置：朝岩石的一端是尖錐，後端則是短而鈍的平頭。
  add(pickPivot, new THREE.BoxGeometry(.22,.15,.24), steel, [0,.80,0], [1,1,1]);
  add(pickPivot, new THREE.BoxGeometry(.20,.13,.30), steel, [0,.80,-.22], [1,1,1]);
  const pickTip = add(pickPivot, new THREE.ConeGeometry(.12,.62,8), steel,
    [0,.80,.39], [1,1,1]);
  pickTip.rotation.x = Math.PI / 2;
  g.add(pickPivot);

  const workRock = new THREE.Group();
  add(workRock, new THREE.DodecahedronGeometry(.48,0), rockMat, [0,.29,.93], [1.18,.68,.82]);
  add(workRock, new THREE.DodecahedronGeometry(.30,0), rockMat, [-.35,.20,.84], [.90,.72,.74]);
  const crystal = add(workRock, new THREE.ConeGeometry(.12,.42,6), crystalMat, [.16,.58,.88], [1,1,1]);
  crystal.rotation.z = -.16;
  g.add(workRock);

  const spark = add(g, new THREE.SphereGeometry(.055,8,6),
    new THREE.MeshBasicMaterial({color:0xffdc79,transparent:true,opacity:0}), [.02,.46,.92], [1,1,1]);

  // A real child anchor follows scale, rotation and idle motion exactly; dialogue projection uses this point.
  const talkAnchor = new THREE.Object3D();
  talkAnchor.position.set(0, 1.92, 0);
  g.add(talkAnchor);

  g.userData = { ...g.userData, name:spec.name, baseY:0, leftArm, rightArm, pickPivot, spark,
    talkAnchor, speed:spec.speed, phase:index * .29, lastCycle:0 };
  // The player is about 2.04 world-units tall; this makes coworkers about 2.0 as well.
  g.scale.setScalar(1.20);
  g.position.set(spec.x, 0, spec.z);
  g.rotation.y = spec.rot;
  scene.add(g);
  return g;
}
const workerMoles = MINER_SPOTS.map(buildWorkerMole);

// 讓 mobile.js（點擊操作）能取用這些資料
window.MINING = { ores, SHOP, ORE_TYPES, PICKS, workerMoles };

/* ============================================================
   5. 畫面上的文字（HUD）與商店介面
   ============================================================ */
const css = document.createElement('style');
css.textContent = `
#hud{position:fixed;left:50%;top:14px;transform:translateX(-50%);display:flex;gap:10px;
  align-items:center;font-size:13px;pointer-events:none;z-index:20}
#hud .box{background:rgba(10,12,18,.75);border:1px solid rgba(255,220,160,.2);
  border-radius:8px;padding:7px 13px;backdrop-filter:blur(4px);white-space:nowrap}
#hud .coin{color:#ffd44d;font-weight:700;font-size:15px}
#hud .pick{color:#cfe4ff}
#hud .bag b{font-weight:700;margin-left:2px}
#hud .hsep{display:inline-block;width:1px;height:12px;background:rgba(255,220,160,.28);
  margin:0 9px;vertical-align:-1px}
#hud .hpk{color:#cfc8b8;margin-right:6px;white-space:nowrap}
#hud .hpk:last-child{margin-right:0}
#hud .hpk img{width:16px;height:16px;object-fit:contain;vertical-align:-4px;
  filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))}
#hud .hpk.eq b{color:#ffd24d}
#hud .hpk.zero{opacity:.38}
#hud .hore.zero{opacity:.38}   /* 礦石數量是 0 也壓暗，跟十字鎬一致 */
#hud .hore{display:inline-flex;align-items:center;margin-right:5px;vertical-align:middle}
#hud .hore img{width:18px;height:18px;object-fit:contain;margin-right:1px;
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.65))}
#prompt{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:20;
  background:rgba(10,12,18,.82);border:1px solid rgba(255,220,160,.28);border-radius:10px;
  padding:9px 18px;font-size:13px;text-align:center;pointer-events:none;display:none;
  backdrop-filter:blur(4px);min-width:210px}
#prompt .key{display:inline-block;background:#ffd79a;color:#241a0d;border-radius:4px;
  padding:1px 7px;font-weight:700;margin:0 3px}
#oreTargetLabel{position:absolute;left:0;top:0;z-index:24;display:none;pointer-events:none;
  transform:translate(-50%,-100%);padding:5px 12px 6px;border-radius:999px;
  background:rgba(7,10,18,.78);border:1px solid var(--ore-label-color,#8bdcff);
  color:#fff;font-size:13px;font-weight:900;letter-spacing:2px;white-space:nowrap;
  text-shadow:0 2px 4px #000,0 0 9px var(--ore-label-color,#8bdcff);
  box-shadow:0 3px 10px rgba(0,0,0,.55),0 0 12px color-mix(in srgb,var(--ore-label-color,#8bdcff) 55%,transparent)}
#oreTargetLabel.show{display:block;animation:oreTargetNamePop .22s cubic-bezier(.2,.85,.3,1.25) both}
#oreTargetLabel::after{content:'';position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);
  border:4px solid transparent;border-top-color:var(--ore-label-color,#8bdcff)}
@keyframes oreTargetNamePop{from{opacity:0;transform:translate(-50%,-82%) scale(.72)}
  to{opacity:1;transform:translate(-50%,-100%) scale(1)}}
#shopMoleTalk{position:absolute;left:0;top:0;z-index:23;display:none;pointer-events:none;
  width:max-content;max-width:min(230px,70%);padding:9px 12px 10px;border-radius:14px;
  background:linear-gradient(180deg,rgba(18,23,34,.84),rgba(8,12,20,.82));
  border:1.5px solid rgba(224,180,100,.78);color:#f5eddd;font-size:12px;font-weight:700;line-height:1.5;
  text-align:left;box-shadow:0 6px 18px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.10);
  -webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);transform:translate(-50%,-100%)}
#shopMoleTalk.show{display:block;animation:shopMoleTalkFade .22s ease-out both}
#shopMoleTalk .speaker{display:block;margin-bottom:2px;color:#ffd582;font-size:10px;
  letter-spacing:2px;font-weight:900}
#shopMoleTalk::after{content:'';position:absolute;left:calc(50% + var(--talk-tail-x,0px));bottom:-10px;
  transform:translateX(-50%);border:6px solid transparent;border-top-color:rgba(224,180,100,.78)}
@keyframes shopMoleTalkFade{from{opacity:0;transform:translate(-50%,-100%)}
  to{opacity:1;transform:translate(-50%,-100%)}}
.workerMoleTalk{position:absolute;left:0;top:0;z-index:22;display:none;pointer-events:none;
  width:max-content;max-width:min(218px,68%);padding:8px 11px 9px;border-radius:13px;
  background:linear-gradient(180deg,rgba(18,23,34,.84),rgba(8,12,20,.81));
  border:1.5px solid rgba(150,205,225,.70);color:#f3eee3;font-size:12px;font-weight:700;
  line-height:1.48;text-align:left;box-shadow:0 6px 18px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.09);
  -webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);transform:translate(-50%,-100%)}
.workerMoleTalk.show{display:block;animation:workerMoleTalkFade .22s ease-out both}
.workerMoleTalk .speaker{display:block;margin-bottom:2px;color:#9fe7ff;font-size:10px;
  letter-spacing:2px;font-weight:900}
.workerMoleTalk::after{content:'';position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);
  border:6px solid transparent;border-top-color:rgba(150,205,225,.70)}
@keyframes workerMoleTalkFade{from{opacity:0;transform:translate(-50%,-100%)}
  to{opacity:1;transform:translate(-50%,-100%)}}
#bar{height:6px;background:rgba(255,255,255,.13);border-radius:3px;margin-top:8px;overflow:hidden;display:none}
#bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffd79a,#ffb03a);border-radius:3px}
#toast{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:25;
  font-size:15px;font-weight:700;pointer-events:none;opacity:0;transition:opacity .3s,bottom .5s}

/* 挖到礦石後的三秒獲得演出：位置在畫面中央偏上，不阻擋任何操作。 */
#oreReward{--ore:#78c8ff;--ore-soft:rgba(120,200,255,.36);--reward-size:176px;
  position:absolute;left:50%;top:17%;width:260px;height:230px;z-index:48;
  transform:translateX(-50%);pointer-events:none;display:none;text-align:center}
#oreReward.show{display:block;animation:oreRewardLife var(--life,3s) cubic-bezier(.2,.72,.22,1) both}
#oreReward .rewardGlow{position:absolute;left:50%;top:var(--ore-center,78px);width:var(--reward-size);height:var(--reward-size);
  transform:translate(-50%,-50%);border-radius:50%;opacity:var(--glow-opacity,.48);
  background:radial-gradient(circle,var(--ore-soft) 0%,rgba(255,255,255,.10) 24%,transparent 68%);
  filter:blur(5px);animation:oreRewardPulse 1.05s ease-in-out infinite alternate}
#oreReward .rewardRays{position:absolute;left:50%;top:var(--ore-center,78px);width:calc(var(--reward-size) * 1.16);
  height:calc(var(--reward-size) * 1.16);transform:translate(-50%,-50%);border-radius:50%;
  opacity:var(--ray-opacity,.38);background:repeating-conic-gradient(from 0deg,
  transparent 0deg 10deg,var(--ore-soft) 10deg 14deg,transparent 14deg 29deg);
  -webkit-mask-image:radial-gradient(circle,transparent 0 18%,#000 31%,transparent 72%);
  mask-image:radial-gradient(circle,transparent 0 18%,#000 31%,transparent 72%);
  animation:oreRewardSpin 4.8s linear infinite}
#oreReward .rewardRing{position:absolute;left:50%;top:var(--ore-center,78px);width:calc(var(--reward-size) * .70);
  height:calc(var(--reward-size) * .70);transform:translate(-50%,-50%) rotateX(68deg);
  border:2px solid var(--ore);border-radius:50%;opacity:var(--ring-opacity,.55);
  box-shadow:0 0 12px var(--ore),inset 0 0 10px var(--ore-soft);
  animation:oreRewardRing 2.1s linear infinite}
#oreReward .rewardRing.two{width:calc(var(--reward-size) * .55);height:calc(var(--reward-size) * .55);
  animation-direction:reverse;animation-duration:1.45s;opacity:var(--ring2-opacity,.30)}
#oreReward .rewardOre{position:absolute;left:50%;top:var(--ore-center,78px);width:var(--ore-image,104px);height:var(--ore-image,104px);
  object-fit:contain;transform:translate(-50%,-50%);z-index:3;
  filter:saturate(1.16) drop-shadow(0 0 8px var(--ore)) drop-shadow(0 6px 10px rgba(0,0,0,.66));
  animation:oreRewardFloat 1.35s ease-in-out infinite alternate}
#oreReward.collecting .rewardOre{animation:oreRewardCollectSource .20s ease-in forwards}
#oreReward.collecting .rewardText{opacity:0;transition:opacity .18s ease-out}
#oreReward .rewardText{position:absolute;top:var(--text-top,142px);left:0;right:0;z-index:5;
  color:#fff;font-size:12px;letter-spacing:2px;text-shadow:0 2px 5px #000,0 0 8px var(--ore)}
#oreReward .rewardText b{display:block;margin-top:4px;color:var(--ore);font-size:20px;
  letter-spacing:3px;text-shadow:0 2px 5px #000,0 0 12px var(--ore)}
#oreReward .rewardTier{display:block;margin-top:4px;color:#ffe8ae;font-size:10px;letter-spacing:2px}
#oreReward .rewardSpark{position:absolute;left:50%;top:var(--ore-center,78px);width:5px;height:5px;border-radius:50%;
  background:var(--ore);box-shadow:0 0 8px var(--ore),0 0 14px var(--ore);
  animation:oreRewardSpark var(--duration,1.7s) ease-out var(--delay,0s) infinite}
@keyframes oreRewardLife{0%{opacity:0;transform:translateX(-50%) translateY(18px) scale(.35)}
  9%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.08)}
  15%,80%{opacity:1;transform:translateX(-50%) scale(1)}
  100%{opacity:0;transform:translateX(-50%) translateY(-22px) scale(.92)}}
@keyframes oreRewardSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes oreRewardRing{to{transform:translate(-50%,-50%) rotateX(68deg) rotateZ(360deg)}}
@keyframes oreRewardPulse{from{transform:translate(-50%,-50%) scale(.88);opacity:var(--glow-low,.30)}
  to{transform:translate(-50%,-50%) scale(1.10);opacity:var(--glow-opacity,.48)}}
@keyframes oreRewardFloat{from{transform:translate(-50%,-53%) scale(.96)}to{transform:translate(-50%,-47%) scale(1.04)}}
@keyframes oreRewardCollectSource{to{opacity:0;transform:translate(-50%,-50%) scale(.72)}}
@keyframes oreRewardSpark{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}18%{opacity:1}
  100%{opacity:0;transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(.05)}}
@media(max-height:600px){#oreReward{top:12%;transform:translateX(-50%) scale(.86);transform-origin:top center}}

/* 挖到好礦時的加強版演出：礦脈等級變成大標題、倍率放大、礦石浮空發光，
   後面兩層炫光反向旋轉，停留時間也更久（g1 精良 → g4 極品）。 */
#oreReward .rewardRays.two,#oreReward .rewardBanner,#oreReward .rewardMult{display:none}
#oreReward.grand{width:340px;height:330px;top:10%;--ore-center:142px;--text-top:252px;--mult-top:206px}
#oreReward.grand .rewardRays.two{display:block;width:calc(var(--reward-size) * 1.62);
  height:calc(var(--reward-size) * 1.62);opacity:calc(var(--ray-opacity,.4) * .60);
  animation-direction:reverse;animation-duration:9.5s}
#oreReward.grand .rewardOre{animation:oreGrandFloat 2.1s ease-in-out infinite alternate;
  filter:saturate(1.26) drop-shadow(0 0 16px var(--ore)) drop-shadow(0 0 32px var(--ore))
    drop-shadow(0 8px 12px rgba(0,0,0,.70))}
#oreReward.grand .rewardBanner{display:block;position:absolute;left:0;right:0;top:4px;z-index:6;
  white-space:nowrap;font-size:var(--banner,30px);font-weight:1000;letter-spacing:var(--banner-gap,7px);
  color:#fff4d2;text-shadow:0 3px 6px #000,0 0 14px var(--ore),0 0 28px var(--ore);
  animation:oreBannerPop .55s cubic-bezier(.18,.9,.25,1.4) both}
#oreReward.grand .rewardMult{display:block;position:absolute;left:0;right:0;top:var(--mult-top,206px);
  z-index:6;font-size:var(--mult,30px);font-weight:1000;letter-spacing:2px;color:#ffe08a;
  text-shadow:0 3px 6px #000,0 0 14px #ffb43c,0 0 26px rgba(255,150,40,.6);
  animation:oreMultPop .50s .16s cubic-bezier(.18,.9,.25,1.4) both}
#oreReward.grand .rewardText{font-size:13px}
#oreReward.grand .rewardText b{font-size:18px}
#oreReward.grand .rewardTier{margin-top:6px}
#oreReward.collecting .rewardBanner,#oreReward.collecting .rewardMult{opacity:0;transition:opacity .18s ease-out}
#oreReward.g1{--banner:30px;--mult:29px;--life:3.6s}
#oreReward.g2{--banner:36px;--mult:33px;--life:4.2s;--banner-gap:8px}
#oreReward.g3{--banner:42px;--mult:38px;--life:4.9s;--banner-gap:9px}
#oreReward.g4{--banner:47px;--mult:43px;--life:5.6s;--banner-gap:10px}
@keyframes oreGrandFloat{from{transform:translate(-50%,-56%) scale(.97) rotate(-4deg)}
  to{transform:translate(-50%,-44%) scale(1.06) rotate(4deg)}}
@keyframes oreBannerPop{0%{opacity:0;transform:scale(.30)}
  70%{opacity:1;transform:scale(1.14)}100%{transform:scale(1)}}
@keyframes oreMultPop{0%{opacity:0;transform:scale(.40)}
  70%{opacity:1;transform:scale(1.16)}100%{transform:scale(1)}}
@media(max-height:600px){#oreReward.grand{top:7%;transform:translateX(-50%) scale(.82)}}

/* 大獎時整個畫面染上顏色：一道白光閃過，接著留下有呼吸感的色光，
   四周再壓一圈同色的邊光。mix-blend-mode:screen 等於「加上去的光」，
   所以只會讓畫面變亮，不會把底下的遊戲畫面蓋黑。 */
#screenTint{position:absolute;inset:0;pointer-events:none;display:none;overflow:hidden;
  --tint:#6a4dff;--tint2:#38e0ff;--tint-life:4s;--tint-alpha:.5;--edge-alpha:.42}
#screenTint.show{display:block;animation:tintLife var(--tint-life) ease-out both}
#screenTint .tintWash{position:absolute;inset:0;mix-blend-mode:screen;opacity:var(--tint-alpha);
  background:radial-gradient(ellipse at 50% 40%,var(--tint2) 0%,transparent 46%),
    linear-gradient(158deg,var(--tint) 0%,transparent 44%,transparent 58%,var(--tint2) 100%);
  animation:tintPulse 1.6s ease-in-out infinite alternate}
#screenTint .tintEdge{position:absolute;inset:0;mix-blend-mode:screen;opacity:var(--edge-alpha);
  background:radial-gradient(ellipse at 50% 44%,transparent 42%,var(--tint) 88%,var(--tint2) 100%)}
#screenTint .tintFlash{position:absolute;inset:0;mix-blend-mode:screen;
  background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.92) 0%,
    rgba(255,255,255,.30) 32%,transparent 68%);
  animation:tintFlash .62s ease-out both}
@keyframes tintLife{0%{opacity:0}7%{opacity:1}82%{opacity:1}100%{opacity:0}}
@keyframes tintPulse{from{opacity:calc(var(--tint-alpha) * .62)}to{opacity:var(--tint-alpha)}}
@keyframes tintFlash{0%{opacity:0;transform:scale(.55)}12%{opacity:1}100%{opacity:0;transform:scale(1.35)}}

.oreHudFly{position:fixed;z-index:95;pointer-events:none;object-fit:contain;transform-origin:center;
  filter:saturate(1.2) drop-shadow(0 0 9px var(--fly-color,#8bdcff)) drop-shadow(0 5px 7px rgba(0,0,0,.65));
  animation:oreFlyToHud .78s cubic-bezier(.20,.66,.24,1) both}
@keyframes oreFlyToHud{
  0%{opacity:1;transform:translate(0,0) scale(1) rotate(0deg)}
  55%{opacity:1;transform:translate(var(--fly-mid-x),var(--fly-mid-y)) scale(.56) rotate(190deg)}
  100%{opacity:.9;transform:translate(var(--fly-x),var(--fly-y)) scale(.16) rotate(350deg)}}
#hud .hore.oreCollected{animation:hudOreCollected .55s cubic-bezier(.2,.8,.25,1.25) both}
#hud .hore.oreCollected img{filter:brightness(1.42) saturate(1.35)
  drop-shadow(0 0 5px currentColor) drop-shadow(0 0 11px currentColor)}
#hud .hore.oreCollected b{color:#fff;text-shadow:0 0 7px currentColor}
@keyframes hudOreCollected{0%{transform:scale(1)}38%{transform:scale(1.34)}100%{transform:scale(1)}}

/* 商店賣出：金幣從品項飛進左下錢包，抵達後才讓數字跳升。 */
.shopCoinFly{position:fixed;left:0;top:0;z-index:110;width:25px;height:25px;object-fit:contain;
  pointer-events:none;transform-origin:center;opacity:0;
  filter:drop-shadow(0 2px 3px rgba(0,0,0,.72)) drop-shadow(0 0 6px rgba(255,205,70,.68));
  animation:shopCoinToWallet var(--coin-time,.82s) cubic-bezier(.20,.62,.25,1) var(--coin-delay,0s) both}
@keyframes shopCoinToWallet{
  0%{opacity:0;transform:translate(0,0) scale(.45) rotate(0deg)}
  12%{opacity:1;transform:translate(var(--coin-hop-x),var(--coin-hop-y)) scale(1.06) rotate(90deg)}
  56%{opacity:1;transform:translate(var(--coin-mid-x),var(--coin-mid-y)) scale(.92) rotate(300deg)}
  100%{opacity:.95;transform:translate(var(--coin-x),var(--coin-y)) scale(.30) rotate(620deg)}}
#walletVal.moneyGain{display:inline-block;animation:walletMoneyGain .42s cubic-bezier(.18,.78,.25,1.35)}
@keyframes walletMoneyGain{0%{transform:scale(1);color:#fff}42%{transform:scale(1.34);color:#ffe36b;
  text-shadow:0 0 7px #ffbd32,0 0 15px rgba(255,184,40,.75)}100%{transform:scale(1);color:#fff}}

/* 三階大獎演出：使用拆好的標題／分數框，以及 coin01~05 真實金幣素材。 */
#winReward{--win:#ffd76b;--win2:#ff9d3d;--life:3s;--title-w:260px;--panel-w:410px;
  --burst-size:390px;--coin-glow:rgba(255,191,51,.68);position:absolute;inset:0;z-index:80;
  display:none;overflow:hidden;pointer-events:none;text-align:center}
#winReward.show{display:block;animation:winRewardLife var(--life) ease-out both}
#winReward .winShade{position:absolute;inset:0;background:radial-gradient(circle at 50% 43%,
  rgba(25,27,45,.09) 0,rgba(5,7,13,.48) 55%,rgba(2,3,8,.72) 100%);backdrop-filter:blur(1.5px)}
#winReward .winBurst{position:absolute;left:50%;top:40%;width:var(--burst-size);height:var(--burst-size);
  transform:translate(-50%,-50%);border-radius:50%;opacity:.68;
  background:repeating-conic-gradient(from 0deg,transparent 0 8deg,var(--win) 9deg 11deg,
    transparent 12deg 21deg,var(--win2) 22deg 24deg,transparent 25deg 34deg);
  -webkit-mask-image:radial-gradient(circle,transparent 0 16%,#000 31%,transparent 70%);
  mask-image:radial-gradient(circle,transparent 0 16%,#000 31%,transparent 70%);
  animation:winBurstSpin var(--spin,8s) linear infinite}
#winReward .winHalo{position:absolute;left:50%;top:41%;width:calc(var(--burst-size) * .66);
  height:calc(var(--burst-size) * .66);transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.86) 0,var(--win) 10%,rgba(255,215,107,.26) 38%,transparent 72%);
  filter:blur(9px);animation:winHaloPulse .82s ease-in-out infinite alternate}
#winReward .winRing{position:absolute;left:50%;top:41%;width:calc(var(--burst-size) * .54);
  height:calc(var(--burst-size) * .54);transform:translate(-50%,-50%);border:3px solid var(--win);
  border-radius:50%;box-shadow:0 0 18px var(--win),inset 0 0 20px var(--win2);
  animation:winRingPulse 1s ease-in-out infinite alternate}
#winReward .winContent{position:absolute;left:50%;top:43%;width:min(96%,520px);height:440px;
  transform:translate(-50%,-50%);z-index:4}
#winReward .winTitleAsset{position:absolute;left:50%;top:0;width:var(--title-w);max-width:92%;height:auto;
  transform:translateX(-50%);object-fit:contain;filter:drop-shadow(0 6px 8px rgba(0,0,0,.78))
  drop-shadow(0 0 15px var(--win));animation:winTitlePop .58s cubic-bezier(.18,.9,.25,1.35) both}
#winReward .winScorePanel{position:absolute;left:50%;top:220px;width:var(--panel-w);max-width:94%;
  height:145px;transform:translateX(-50%);animation:winPanelIn .55s .12s cubic-bezier(.18,.9,.25,1.2) both}
#winReward .winPanelAsset{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;
  filter:drop-shadow(0 7px 10px rgba(0,0,0,.75)) drop-shadow(0 0 12px var(--win))}
#winReward .winAmount{position:absolute;inset:18% 12% 15%;z-index:2;display:flex;flex-direction:column;
  align-items:center;justify-content:center;color:#fff8d6;font-size:34px;font-weight:1000;letter-spacing:1px;
  text-shadow:0 3px 5px #000,0 0 14px var(--win)}
#winReward .winAmount b{line-height:1.05}
#winReward .winMult{display:block;margin-top:7px;color:var(--win);font-size:14px;letter-spacing:2px;
  text-shadow:0 2px 4px #000,0 0 9px var(--win)}
#winReward .winParticles{position:absolute;inset:0;z-index:3}
#winReward .winCoin{position:absolute;left:50%;top:39%;width:var(--coin-size,30px);height:var(--coin-size,30px);
  object-fit:contain;opacity:0;will-change:transform,opacity;
  filter:drop-shadow(0 0 7px var(--coin-glow)) drop-shadow(0 4px 4px rgba(0,0,0,.55));
  animation:winCoinSpray var(--dur,1.75s) linear var(--delay,0s) 1 both}
#winReward.win{--title-w:235px;--burst-size:330px;--spin:9s}
#winReward.win .winContent{top:44%}
#winReward.win .winScorePanel{top:170px}
#winReward.big{--title-w:390px;--burst-size:445px;--spin:5.8s}
#winReward.super{--title-w:405px;--burst-size:540px;--spin:3.8s}
#winReward.super .winContent{top:42%;height:475px}
#winReward.super .winScorePanel{top:260px}
#winReward.super .winRing{border-width:5px;box-shadow:0 0 28px var(--win),0 0 52px var(--win2),inset 0 0 26px var(--win2)}
#winReward.super .winAmount{font-size:38px;color:#fff}
@keyframes winRewardLife{0%{opacity:0}6%,88%{opacity:1}100%{opacity:0}}
@keyframes winBurstSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes winHaloPulse{from{transform:translate(-50%,-50%) scale(.82);opacity:.54}
  to{transform:translate(-50%,-50%) scale(1.13);opacity:.95}}
@keyframes winRingPulse{from{transform:translate(-50%,-50%) scale(.92) rotate(-5deg)}
  to{transform:translate(-50%,-50%) scale(1.06) rotate(5deg)}}
@keyframes winTitlePop{0%{opacity:0;transform:translateX(-50%) scale(.18) rotate(-4deg)}
  70%{opacity:1;transform:translateX(-50%) scale(1.12) rotate(1deg)}100%{transform:translateX(-50%) scale(1)}}
@keyframes winPanelIn{0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(.55)}
  100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes winCoinSpray{
  0%{opacity:0;transform:translate(calc(-50% + var(--start-x)),-20%) scale(.48) rotate(var(--rot-start));
    animation-timing-function:cubic-bezier(.12,.62,.28,1)}
  7%{opacity:1}
  23%{opacity:1;transform:translate(calc(-50% + var(--apex-x)),calc(-50% + var(--peak)))
    scale(1.02) rotate(var(--rot));animation-timing-function:cubic-bezier(.28,.06,.9,.68)}
  70%{opacity:1}
  100%{opacity:0;transform:translate(calc(-50% + var(--end-x)),calc(-50% + var(--fall)))
    scale(.72) rotate(var(--rot-end))}}
@media(max-height:650px){#winReward .winContent{top:44%;transform:translate(-50%,-50%) scale(.78)}
  #winReward.super .winContent{transform:translate(-50%,-50%) scale(.78)}}

#broke{position:fixed;inset:0;background:rgba(4,6,12,.82);z-index:70;display:none;
  align-items:center;justify-content:center;backdrop-filter:blur(6px)}
#brokewin{width:min(420px,88%);background:#161a24;border:1px solid rgba(255,210,77,.35);
  border-radius:14px;padding:26px 24px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.75)}
#brokewin h2{font-size:18px;letter-spacing:3px;color:#ffd24d;margin-bottom:12px}
#brokewin p{font-size:13px;color:#a8a294;line-height:1.9;margin-bottom:6px}
#brokewin .amt{font-size:30px;font-weight:700;color:#ffd44d;margin:14px 0 4px}
#brokewin .times{font-size:11px;color:#6f6a5d;margin-bottom:18px}
#brokewin button{background:linear-gradient(#ffd24d,#e89b1c);color:#4a2c00;border:0;
  border-radius:8px;padding:11px 30px;font-size:15px;font-weight:700;cursor:pointer;
  font-family:inherit}
#brokewin button:hover{filter:brightness(1.08)}

#shop{position:fixed;inset:0;background:transparent;z-index:60;display:none;
  align-items:stretch;justify-content:stretch;backdrop-filter:blur(8px)}
#shopwin{width:100%;height:100%;max-height:none;overflow:auto;box-sizing:border-box;
  background:radial-gradient(circle at 50% -12%,rgba(41,53,82,.70) 0,
    rgba(23,28,41,.70) 42%,rgba(16,20,30,.70) 100%);
  border:0;border-radius:0;padding:16px 18px 84px;box-shadow:none;scrollbar-gutter:stable}
#shopwin h2{font-size:18px;letter-spacing:4px;color:#ffd79a;margin:0 0 2px;text-align:center}
#shopwin .sub{font-size:11px;color:#928a7b;margin-bottom:9px;text-align:center}
#shopwin h3{font-size:12px;color:#afc4e5;letter-spacing:2px;margin:10px 0 6px;
  border-bottom:1px solid rgba(255,255,255,.09);padding-bottom:6px}
.row{display:flex;align-items:center;gap:8px;padding:7px;font-size:12px;background:rgba(255,255,255,.025);
  border:1px solid rgba(255,255,255,.055);border-radius:9px;box-sizing:border-box}
.row .dot{width:13px;height:13px;border-radius:50%;flex:none;box-shadow:0 0 9px currentColor}
.row .oreimg{width:42px;height:42px;object-fit:contain;flex:none;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.62))}
.row.polished{background:linear-gradient(90deg,rgba(95,165,255,.08),transparent);border-radius:8px}
.row .orestate{display:block;font-size:10px;color:#777f91;margin-top:2px}
.row .polishgain{color:#78dfa0;font-weight:700}
.row .actions{display:flex;gap:5px;flex:none}
.row .polishbtn{background:#493d68;border-color:#8f78c4;color:#eadcff}
.row .polishbtn:hover:not(:disabled){background:#5b4b80}
#sellList,#buyList{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:7px}
#sellList .row{display:grid;grid-template-columns:38px minmax(72px,1fr) auto;
  grid-template-areas:"ore name value" "ore mult actions";column-gap:9px;row-gap:3px;
  padding:7px;margin:0;min-height:60px}
#sellList .oreimg{grid-area:ore;align-self:center}
#sellList .nm{grid-area:name;min-width:0;line-height:1.25}
#sellList .num{grid-area:mult;align-self:center}
#sellList .val{grid-area:value;width:auto;align-self:center;white-space:nowrap}
#sellList .actions{grid-area:actions;justify-self:end}
#sellList .actions button{padding:5px 8px;white-space:nowrap}
.orepreview{width:38px;height:38px;object-fit:contain;vertical-align:middle;margin-right:7px;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.7))}
.row .pickimg{width:40px;height:40px;object-fit:contain;flex:none;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.row.own .pickimg{filter:drop-shadow(0 0 7px rgba(126,224,138,.45))}
.row .nm{flex:1}
.row .num{color:#9a9384;font-variant-numeric:tabular-nums}
.row .val{color:#ffd44d;width:74px;text-align:right;font-variant-numeric:tabular-nums}
.row button,#closeshop,#sellall{background:#2c3a52;color:#ffe0ad;border:1px solid #66738a;
  border-radius:6px;padding:6px 13px;cursor:pointer;font-size:12px;font-family:inherit;
  transition:transform .12s ease,filter .12s ease,box-shadow .12s ease,border-color .12s ease}
.row button:hover:not(:disabled),#sellall:hover,#closeshop:hover{background:#3b4d6b}
.row .polishbtn{box-shadow:0 0 8px rgba(177,134,255,.12)}
.row .polishbtn:hover:not(:disabled){box-shadow:0 0 13px rgba(177,134,255,.38)}
.row .sellbtn,#sellall{background:linear-gradient(145deg,#72571f,#40351e);color:#ffe391;
  border-color:#c69b3d;box-shadow:inset 0 1px 0 rgba(255,235,160,.14),0 0 8px rgba(255,195,55,.16)}
.row .sellbtn:hover:not(:disabled),#sellall:hover{background:linear-gradient(145deg,#94722b,#59471e);
  border-color:#f0c84d;box-shadow:inset 0 1px 0 rgba(255,245,190,.2),0 0 14px rgba(255,202,63,.42)}
.row button:active:not(:disabled),#sellall:active,#closeshop:active{transform:scale(.94);filter:brightness(1.2)}
.row .sellbtn:active:not(:disabled),#sellall:active{box-shadow:0 0 18px rgba(255,207,66,.72),inset 0 0 8px rgba(255,237,155,.22)}
.row .polishbtn:active:not(:disabled){box-shadow:0 0 17px rgba(188,146,255,.7),inset 0 0 8px rgba(238,218,255,.18)}
.row button:disabled{opacity:.32;cursor:not-allowed}
.row.own{color:#7ee08a}
.foot{display:flex;gap:10px;justify-content:center;margin-top:10px}
.hintline{font-size:10px;color:#777164;margin-top:8px;line-height:1.55}
.pickrow{align-items:flex-start}
.pinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ptop{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.pname{font-size:13px;color:#e8e2d6;white-space:nowrap}
.row.own .pname{color:#7ee08a}
.pprice{color:#ffd44d;font-size:12px;white-space:nowrap}
.pdesc{font-size:10px;color:#7f7a6c;line-height:1.35}
.pbot{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap}
.pstock{font-size:12px;color:#9a9384;white-space:nowrap}
.pbtns{display:flex;gap:5px}
.pbtns button{padding:4px 8px}
#closeshop{display:none}

/* 打磨是第二次風險選擇：先確認，再等待機器揭曉結果。 */
#polishStage{--polish:#8bdcff;position:fixed;inset:0;z-index:68;display:none;
  align-items:center;justify-content:center;padding:18px;box-sizing:border-box;
  background:rgba(4,7,13,.78);backdrop-filter:blur(9px)}
#polishCard{position:relative;width:min(390px,94vw);box-sizing:border-box;overflow:hidden;
  padding:18px 18px 16px;border-radius:20px;text-align:center;color:#eee7db;
  background:linear-gradient(180deg,rgba(28,35,51,.98),rgba(12,16,26,.98));
  border:1px solid color-mix(in srgb,var(--polish) 55%,#665941);
  box-shadow:0 24px 80px rgba(0,0,0,.78),0 0 30px color-mix(in srgb,var(--polish) 18%,transparent)}
#polishCard .polishEyebrow{font-size:10px;letter-spacing:4px;color:#b9aec8;margin-bottom:4px}
#polishCard h2{margin:0;color:#fff0c6;font-size:19px;letter-spacing:3px}
#polishMachine{position:relative;width:180px;height:168px;margin:4px auto 2px}
#polishMachine::before{content:'';position:absolute;left:50%;top:50%;width:158px;height:158px;
  transform:translate(-50%,-50%);border-radius:50%;opacity:0;z-index:0;
  background:repeating-conic-gradient(from 0deg,transparent 0 15deg,
    color-mix(in srgb,var(--polish) 28%,transparent) 16deg 18deg,transparent 19deg 33deg);
  -webkit-mask-image:radial-gradient(circle,transparent 0 34%,#000 48%,transparent 73%);
  mask-image:radial-gradient(circle,transparent 0 34%,#000 48%,transparent 73%)}
#polishMachine .polishGlow,#polishMachine .polishRing{position:absolute;left:50%;top:50%;
  transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}
#polishMachine .polishGlow{width:138px;height:138px;background:radial-gradient(circle,
  color-mix(in srgb,var(--polish) 48%,transparent),transparent 68%);filter:blur(5px);opacity:.65}
#polishMachine .polishRing{width:126px;height:126px;border:1px solid var(--polish);opacity:.35;
  box-shadow:0 0 14px color-mix(in srgb,var(--polish) 55%,transparent)}
#polishMachine img{position:absolute;left:50%;top:50%;width:105px;height:105px;object-fit:contain;
  transform:translate(-50%,-50%);z-index:3;filter:saturate(1.12) drop-shadow(0 7px 9px #000)}
#polishMachine .polishSweep{position:absolute;left:50%;top:50%;width:112px;height:112px;
  transform:translate(-50%,-50%);border-radius:46%;overflow:hidden;z-index:4;
  opacity:0;pointer-events:none;mix-blend-mode:screen}
#polishMachine .polishSweep::after{content:'';position:absolute;left:-72px;top:-30px;width:34px;height:175px;
  transform:rotate(24deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.92),transparent);
  filter:blur(2px);box-shadow:0 0 12px #fff}
#polishMachine .polishStars{position:absolute;inset:0;z-index:5;pointer-events:none}
#polishMachine .polishStars i{position:absolute;width:8px;height:8px;opacity:0;
  background:#fff;transform:rotate(45deg) scale(.1);border-radius:1px;
  box-shadow:0 0 5px #fff,0 0 11px var(--polish),0 0 18px var(--polish)}
#polishMachine .polishStars i::after{content:'';position:absolute;left:3px;top:-4px;width:2px;height:16px;
  background:linear-gradient(transparent,#fff,transparent)}
#polishMachine .polishStars i:nth-child(1){left:42px;top:52px;animation-delay:.06s}
#polishMachine .polishStars i:nth-child(2){right:38px;top:66px;animation-delay:.32s}
#polishMachine .polishStars i:nth-child(3){left:72px;top:35px;animation-delay:.58s}
#polishMachine .polishStars i:nth-child(4){right:55px;bottom:39px;animation-delay:.84s}
#polishMachine .polishStars i:nth-child(5){left:47px;bottom:48px;animation-delay:1.10s}
#polishMachine .polishSparks{position:absolute;inset:0;z-index:4;pointer-events:none}
#polishMachine .polishSparks i{position:absolute;left:50%;top:50%;width:4px;height:4px;
  border-radius:50%;background:var(--polish);box-shadow:0 0 7px var(--polish);opacity:0}
#polishStage.working #polishMachine::before{opacity:.65;animation:polishEnergyRays 3.2s linear infinite}
#polishStage.working #polishMachine img{animation:polishOreWork .42s ease-in-out infinite alternate,
  polishOreLuster .78s ease-in-out infinite alternate}
#polishStage.working #polishMachine .polishGlow{animation:polishGlowWork .72s ease-in-out infinite alternate}
#polishStage.working #polishMachine .polishRing{animation:polishRingWork .82s linear infinite}
#polishStage.working #polishMachine .polishSweep{opacity:.72}
#polishStage.working #polishMachine .polishSweep::after{animation:polishSweep 1.08s ease-in-out infinite}
#polishStage.working #polishMachine .polishStars i{animation:polishStar 1.30s ease-out infinite}
#polishStage.working #polishMachine .polishSparks i{animation:polishSpark 1.05s ease-out infinite;
  animation-delay:var(--spark-delay,0s)}
#polishStage.working.revealSoon #polishMachine img{filter:saturate(1.55) brightness(1.42)
  drop-shadow(0 0 9px #fff) drop-shadow(0 0 20px var(--polish))}
#polishStage.working.revealSoon #polishMachine .polishGlow{opacity:1;transform:translate(-50%,-50%) scale(1.35)}
#polishStage.result #polishMachine img{animation:polishReveal .62s cubic-bezier(.18,.78,.24,1.28) both;
  filter:saturate(1.28) brightness(1.08) drop-shadow(0 0 12px var(--polish)) drop-shadow(0 8px 10px #000)}
#polishStage.perfect #polishMachine .polishGlow{opacity:1;transform:translate(-50%,-50%) scale(1.35)}
@keyframes polishOreWork{from{transform:translate(-50%,-50%) rotate(-4deg) scale(.95)}
  to{transform:translate(-50%,-50%) rotate(4deg) scale(1.04)}}
@keyframes polishOreLuster{from{filter:saturate(1.12) brightness(.96) drop-shadow(0 5px 8px #000)
  drop-shadow(0 0 4px var(--polish))}to{filter:saturate(1.42) brightness(1.28)
  drop-shadow(0 6px 8px #000) drop-shadow(0 0 13px var(--polish))}}
@keyframes polishGlowWork{to{opacity:1;transform:translate(-50%,-50%) scale(1.18)}}
@keyframes polishRingWork{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes polishEnergyRays{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes polishSweep{0%{transform:translateX(0) rotate(24deg);opacity:0}18%{opacity:1}
  72%,100%{transform:translateX(205px) rotate(24deg);opacity:0}}
@keyframes polishStar{0%,12%{opacity:0;transform:rotate(45deg) scale(.1)}35%{opacity:1;
  transform:rotate(45deg) scale(1.15)}62%,100%{opacity:0;transform:rotate(45deg) scale(.25)}}
@keyframes polishSpark{0%{opacity:0;transform:rotate(var(--spark-angle)) translateX(24px) scale(.2)}
  18%{opacity:1}100%{opacity:0;transform:rotate(var(--spark-angle)) translateX(82px) scale(.05)}}
@keyframes polishReveal{0%{opacity:.25;transform:translate(-50%,-50%) scale(.25) rotate(-16deg)}
  65%{opacity:1;transform:translate(-50%,-50%) scale(1.18) rotate(4deg)}
  100%{transform:translate(-50%,-50%) scale(1) rotate(0)}}
#polishMessage{min-height:42px;font-size:13px;line-height:1.55;color:#d9d2c7}
#polishMessage strong{display:block;color:#fff;font-size:17px;letter-spacing:2px;margin-bottom:2px}
#polishValue{margin:10px 0;padding:9px 10px;border-radius:10px;background:rgba(0,0,0,.28);
  color:#c9c2b6;font-size:12px;line-height:1.65}
#polishValue b{color:#ffd66f;font-size:17px}
.polishOdds{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:10px 0 13px}
.polishOdd{padding:7px 3px;border-radius:8px;background:rgba(255,255,255,.035);
  border:1px solid rgba(255,255,255,.07);font-size:9px;color:#9e98a3;line-height:1.45}
.polishOdd b{display:block;font-size:13px;color:#e9e0d2}
.polishOdd.good b{color:#7ee0a0}.polishOdd.perfect b{color:#ffd66f}
.polishActions{display:flex;gap:9px;justify-content:center}
.polishActions button{min-width:118px;padding:10px 12px;border-radius:9px;font-family:inherit;
  font-size:13px;font-weight:700;cursor:pointer}
#polishCancel{background:#252c39;color:#aaa6a0;border:1px solid #4d5666}
#polishConfirm,#polishCollect{background:linear-gradient(#8a68c4,#574080);color:#fff5d8;
  border:1px solid #b79be5;box-shadow:0 0 12px rgba(154,112,220,.25)}
#polishStage.working .polishOdds,#polishStage.result .polishOdds{display:none}
#polishStage.working .polishActions{visibility:hidden}
#polishCollect{display:none}#polishStage.result #polishConfirm,#polishStage.result #polishCancel{display:none}
#polishStage.result #polishCollect{display:inline-block}
`;
document.head.appendChild(css);

const hud = document.createElement('div');
hud.id = 'hud';
// 錢包和目前十字鎬改放在畫面最下方的橫條（參考「打殭屍」的配置），
// 上面這一列只留背包裡的礦石數量。
hud.innerHTML = `<div class="box bag" id="hudBag"></div>`;
document.body.appendChild(hud);

const prompt = document.createElement('div');
prompt.id = 'prompt';
prompt.innerHTML = `<div id="ptext"></div>`;
document.body.appendChild(prompt);

const oreTargetLabel = document.createElement('div');
oreTargetLabel.id = 'oreTargetLabel';
(document.getElementById('stage') || document.body).appendChild(oreTargetLabel);
let highlightedOre = null;
const oreTargetScreen = new THREE.Vector3();
function setTargetOre(ore) {
  if (!ore || !ores.includes(ore)) {
    highlightedOre = null;
    oreTargetLabel.classList.remove('show');
    oreTargetLabel.style.display = 'none';
    return;
  }
  if (highlightedOre !== ore) {
    highlightedOre = ore;
    oreTargetLabel.textContent = ore.type.name;
    oreTargetLabel.style.setProperty('--ore-label-color', '#' + ore.type.color.toString(16).padStart(6, '0'));
    oreTargetLabel.classList.remove('show');
    void oreTargetLabel.offsetWidth;
    oreTargetLabel.classList.add('show');
  }
  const stageEl = document.getElementById('stage');
  if (!stageEl) return;
  // mobile.js 會在稍後才建立／整理 9:16 舞台；顯示前再次確認標籤屬於舞台，
  // 避免拿舞台座標定位到整個瀏覽器頁面，跑進左右黑邊。
  if (oreTargetLabel.parentElement !== stageEl) stageEl.appendChild(oreTargetLabel);
  const rank = Math.max(0, ORE_TYPES.indexOf(ore.type));
  oreTargetScreen.set(ore.mesh.position.x, 1.40 + rank * .08, ore.mesh.position.z).project(camera);
  if (oreTargetScreen.z < -1 || oreTargetScreen.z > 1) {
    oreTargetLabel.style.display = 'none';
    return;
  }
  oreTargetLabel.style.display = 'block';
  const rawX = (oreTargetScreen.x * .5 + .5) * stageEl.clientWidth;
  const rawY = (-.5 * oreTargetScreen.y + .5) * stageEl.clientHeight - 8;
  const halfLabel = Math.max(42, oreTargetLabel.offsetWidth * .5);
  const safeX = Math.max(halfLabel + 8, Math.min(stageEl.clientWidth - halfLabel - 8, rawX));
  const safeY = Math.max(oreTargetLabel.offsetHeight + 12, Math.min(stageEl.clientHeight - 12, rawY));
  oreTargetLabel.style.left = safeX.toFixed(1) + 'px';
  oreTargetLabel.style.top = safeY.toFixed(1) + 'px';
}

const SHOP_MOLE_TIPS = [
  '背包裡的原礦，可以進商店直接賣掉換成錢喔！',
  '想試試手氣嗎？付費打磨有機會讓礦石賣得更高！',
  '越高級的原礦，打磨費越高，記得先看看錢包。',
  '到營地睡一覺，礦坑裡會重新長出一批礦石！',
  '累積挖到更多礦石，就能解鎖更快的十字鎬。',
  'TURBO 會把挖到的礦立刻賣掉，背包就不會塞滿。',
  '今天也挖得很棒！慢慢來，寶物就在前面。',
  '別灰心，每一鎬都有可能敲出大驚喜！'
];
const shopMoleTalk = document.createElement('div');
shopMoleTalk.id = 'shopMoleTalk';
(document.getElementById('stage') || document.body).appendChild(shopMoleTalk);
const shopMoleScreen = new THREE.Vector3();
let shopMoleTipIndex = -1;
let shopMoleNextTipAt = 0;
let shopMoleTalkExpiresAt = 0;
let shopMoleTalkVisible = false;
function updateShopMole(now) {
  const px = G.player.position.x, pz = G.player.position.z;
  const distance = Math.hypot(px - shopMole.position.x, pz - shopMole.position.z);
  const nearby = distance < 8.5 && !P.shopOpen && !P.brokeOpen && !P.sleeping;
  shopMole.position.y = shopMole.userData.baseY + Math.sin(now * .0024) * .025;
  shopMole.rotation.y = Math.atan2(px - shopMole.position.x, pz - shopMole.position.z);
  shopMole.userData.rightArm.rotation.z = .50 + Math.sin(now * .0042) * (nearby ? .18 : .06);
  shopMole.userData.leftArm.rotation.z = -.38 + Math.sin(now * .0028 + 1.4) * .04;
  // Once a line appears it remains in the world for its full duration, even if
  // the player walks away, so it can naturally travel beyond the viewport.
  if (!nearby && now >= shopMoleTalkExpiresAt) {
    shopMoleTalk.classList.remove('show');
    shopMoleTalk.style.display = 'none';
    shopMoleTalkVisible = false;
    return;
  }
  if (now >= shopMoleNextTipAt) {
    let next = Math.floor(Math.random() * SHOP_MOLE_TIPS.length);
    if (next === shopMoleTipIndex) next = (next + 1) % SHOP_MOLE_TIPS.length;
    shopMoleTipIndex = next;
    shopMoleTalk.innerHTML = `<span class="speaker">小礦掌櫃</span>${SHOP_MOLE_TIPS[next]}`;
    shopMoleNextTipAt = now + 11000;
    shopMoleTalkExpiresAt = now + 11000;
  }
  const stageEl = document.getElementById('stage');
  if (!stageEl) return;
  if (shopMoleTalk.parentElement !== stageEl) stageEl.appendChild(shopMoleTalk);
  // Anchor the bubble to the mole's resting head position so its idle bob does not shake the UI.
  shopMoleScreen.set(shopMole.position.x, shopMole.userData.baseY + 1.42, shopMole.position.z);
  shopMoleScreen.project(camera);
  if (shopMoleScreen.z < -1 || shopMoleScreen.z > 1) {
    shopMoleTalk.style.display = 'none';
    shopMoleTalkVisible = false;
    return;
  }
  shopMoleTalk.style.display = 'block';
  if (!shopMoleTalkVisible) {
    shopMoleTalk.classList.add('show');
    shopMoleTalkVisible = true;
  }
  const rawX = (shopMoleScreen.x * .5 + .5) * stageEl.clientWidth;
  const rawY = (-shopMoleScreen.y * .5 + .5) * stageEl.clientHeight - 8;
  // Keep this in world space: never pull the bubble back inside the viewport.
  // When the mole leaves the camera view, its speech naturally leaves with it.
  shopMoleTalk.style.setProperty('--talk-tail-x', '0px');
  shopMoleTalk.style.left = rawX.toFixed(1) + 'px';
  shopMoleTalk.style.top = rawY.toFixed(1) + 'px';
}

const WORKER_MOLE_LINES = [
  [
    '高級礦真的很硬，每敲一下手都麻……不過賣價漂亮就值得啦！',
    '慢慢敲、站穩一點，十字鎬才不會反彈到自己的腳。',
    '今天的岩層聲音很脆，我猜附近藏著不錯的礦脈。',
    '午餐又是飯糰。等我發財，一定要加兩顆滷蛋！',
    '下班前再挖一顆就好……我每次都這樣說。',
    '礦坑裡最可靠的不是運氣，是一把保養得亮晶晶的十字鎬。',
    '你如果聽見岩壁在喀喀響，先退兩步比較保險喔。'
  ],
  [
    '聽說上次賴瑞挖到好多顆虹彩礦石，發財後在信義區買了一套房！',
    '我也想挖到虹彩礦……先從今天不要挖到普通石頭開始吧。',
    '紫色礦很漂亮，可是打磨費也漂亮得讓錢包發抖。',
    '商店老闆說我很有潛力。希望不是指花錢的潛力。',
    '剛才有隻蝙蝠偷看我工作，牠大概是工會派來巡班的。',
    '我媽又寄了三箱地瓜來，等等休息一起吃吧！',
    '今天空氣特別涼，燈也看起來更暖了。'
  ],
  [
    '咳，那間信義區的房子不大啦……但窗戶真的看得到台北101。',
    '虹彩礦不是想找就有，挖久了你會先學會跟運氣相處。',
    '賺得多的那天要記得存錢，礦脈可不會天天都大方。',
    '高級礦要敲很久，肩膀痠歸痠，開出好價錢時還是會笑。',
    '我以前也只拿木十字鎬。每天多敲一點，就慢慢升上來了。',
    '樓上的鄰居說半夜會聽到敲礦聲……奇怪，我明明有休假。',
    '累了就去營地睡一覺，硬撐只會把岩石看成寶石。'
  ]
];

const workerMoleTalkStates = workerMoles.map((mole, index) => {
  const el = document.createElement('div');
  el.className = 'workerMoleTalk';
  (document.getElementById('stage') || document.body).appendChild(el);
  return {
    mole, index, el, screen:new THREE.Vector3(), lineIndex:-1,
    nextAt:performance.now() + 2500 + index * 3900 + Math.random() * 2600,
    expiresAt:0, showing:false
  };
});

// 同事敲礦聲的可聽範圍（世界單位）；超過這個距離完全聽不到。
const COWORKER_SFX_RANGE = 9.0;

function updateWorkerMoles(now) {
  const stageEl = document.getElementById('stage');
  if (!stageEl) return;
  const px = G.player.position.x, pz = G.player.position.z;

  workerMoleTalkStates.forEach(state => {
    const { mole, index, el } = state;
    // mining.js loads before mobile.js creates the 9:16 stage, so move bubbles
    // into the finished stage before using stage-local projected coordinates.
    if (el.parentElement !== stageEl) stageEl.appendChild(el);
    const u = mole.userData;
    const cycle = (now * .001 * u.speed + u.phase) % 1;
    let swing;
    if (cycle < .70) {
      const q = cycle / .70;
      swing = .48 + (-1.02 - .48) * (1 - Math.pow(1 - q, 2));
    } else {
      const q = (cycle - .70) / .30;
      swing = -1.02 + (.82 + 1.02) * q * q;
    }
    u.pickPivot.rotation.x = swing;
    u.rightArm.rotation.x = swing * .30;
    u.leftArm.rotation.x = swing * .22;
    u.rightArm.rotation.z = .34 + Math.sin(now * .006 * u.speed) * .08;
    u.leftArm.rotation.z = -.30 - Math.sin(now * .006 * u.speed) * .06;
    mole.position.y = u.baseY + Math.sin(now * .006 * u.speed + index) * .018;

    const impact = cycle > .935;
    u.spark.material.opacity = impact ? (cycle - .935) / .065 * .90 : 0;
    const sparkScale = .65 + Math.max(0, (cycle - .935) / .065) * 2.4;
    u.spark.scale.setScalar(sparkScale);

    // 鎬尖剛碰到岩石的那一幀發出事件，audio.js 依距離決定音量。
    const dist = Math.hypot(px - mole.position.x, pz - mole.position.z);
    const struck = impact && u.lastCycle <= .935;
    u.lastCycle = cycle;
    if (struck && dist < COWORKER_SFX_RANGE && !P.shopOpen && !P.brokeOpen && !P.sleeping) {
      window.dispatchEvent(new CustomEvent('coworker-impact',
        { detail:{ index, distance:dist, range:COWORKER_SFX_RANGE } }));
    }

    const nearby = dist < 10.5 && !P.shopOpen && !P.brokeOpen && !P.sleeping;
    if (nearby && now >= state.nextAt && now >= state.expiresAt) {
      const lines = WORKER_MOLE_LINES[index];
      let next = Math.floor(Math.random() * lines.length);
      if (next === state.lineIndex) next = (next + 1) % lines.length;
      state.lineIndex = next;
      el.innerHTML = `<span class="speaker">${mole.userData.name}</span>${lines[next]}`;
      state.expiresAt = now + 6800;
      state.nextAt = state.expiresAt + 11000 + Math.random() * 9000;
      state.showing = true;
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
    }

    if (now >= state.expiresAt) {
      if (state.showing) {
        el.classList.remove('show');
        el.style.display = 'none';
        state.showing = false;
      }
      return;
    }

    // Project the model's real head anchor (including its scale, rotation and idle bob) into screen space.
    // Like every physical object in the scene, this bubble may travel completely off-screen.
    u.talkAnchor.getWorldPosition(state.screen);
    state.screen.project(camera);
    if (state.screen.z < -1 || state.screen.z > 1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = ((state.screen.x * .5 + .5) * stageEl.clientWidth).toFixed(1) + 'px';
    el.style.top = ((-state.screen.y * .5 + .5) * stageEl.clientHeight - 8).toFixed(1) + 'px';
  });
}

const toast = document.createElement('div');
toast.id = 'toast';
document.body.appendChild(toast);

const oreReward = document.createElement('div');
oreReward.id = 'oreReward';
oreReward.innerHTML = `<div class="rewardGlow"></div><div class="rewardRays"></div>
  <div class="rewardRays two"></div>
  <div class="rewardRing one"></div><div class="rewardRing two"></div>
  <div class="rewardSparks"></div><img class="rewardOre" alt="獲得的原礦">
  <div class="rewardBanner"></div><div class="rewardMult"></div>
  <div class="rewardText">獲得原礦<b></b><span class="rewardTier"></span></div>`;
(document.getElementById('stage') || document.body).appendChild(oreReward);

const screenTint = document.createElement('div');
screenTint.id = 'screenTint';
screenTint.innerHTML = `<div class="tintWash"></div><div class="tintEdge"></div>
  <div class="tintFlash"></div>`;
(document.getElementById('stage') || document.body).appendChild(screenTint);

/* 大獎染色的四種配方。zIndex 決定它蓋在哪一層：
   礦脈演出在 48，所以用 46（染色在演出後面）；WIN 在 80，所以用 78。 */
const SCREEN_TINTS = {
  epic:  { tint:'#ff9d1f', tint2:'#ffe08a', alpha:.38, edge:.34, z:46 },   // 史詩：金黃
  ultra: { tint:'#6a4dff', tint2:'#38e0ff', alpha:.54, edge:.48, z:46 },   // 極品：紫藍
  big:   { tint:'#ff8f2b', tint2:'#ffd76b', alpha:.34, edge:.30, z:78 },   // BIG：金橘
  super: { tint:'#7a4dff', tint2:'#5ef0ff', alpha:.58, edge:.52, z:78 },   // SUPER：紫藍
};
/* mining.js 比 mobile.js 早執行，建立這些元素時 9:16 的舞台還不存在，
   會被掛到整個網頁上、光效就溢出遊戲框外。播放前先搬回舞台裡。 */
function mountInStage(el) {
  const stage = document.getElementById('stage');
  if (stage && el.parentElement !== stage) stage.appendChild(el);
}

function showScreenTint(preset, life) {
  const t = SCREEN_TINTS[preset];
  if (!t) return;
  mountInStage(screenTint);
  screenTint.style.zIndex = t.z;
  screenTint.style.setProperty('--tint', t.tint);
  screenTint.style.setProperty('--tint2', t.tint2);
  screenTint.style.setProperty('--tint-alpha', t.alpha);
  screenTint.style.setProperty('--edge-alpha', t.edge);
  screenTint.style.setProperty('--tint-life', (life / 1000).toFixed(2) + 's');
  clearTimeout(screenTint._hideTimer);
  screenTint.classList.remove('show');
  void screenTint.offsetWidth;
  screenTint.classList.add('show');
  screenTint._hideTimer = setTimeout(() => screenTint.classList.remove('show'), life);
}

const winReward = document.createElement('div');
winReward.id = 'winReward';
winReward.innerHTML = `<div class="winShade"></div><div class="winBurst"></div>
  <div class="winHalo"></div><div class="winRing"></div><div class="winParticles"></div>
  <div class="winContent"><img class="winTitleAsset" alt="WIN">
    <div class="winScorePanel"><img class="winPanelAsset" alt="">
      <div class="winAmount"><b>$0</b><span class="winMult">×0.00</span></div>
    </div>
  </div>`;
(document.getElementById('stage') || document.body).appendChild(winReward);

const shopEl = document.createElement('div');
shopEl.id = 'shop';
shopEl.innerHTML = `<div id="shopwin">
  <h2>礦 石 商 會</h2>
  <div class="sub">把挖到的礦換成錢</div>
  <h3>背包</h3><div id="sellList"></div>
  <div class="hintline">· 倍率 <b>×1</b> 以上是賺，以下是賠<br>
  · 打磨每顆限一次，失敗不退費<br>
  · 挖滿一定數量，十字鎬自動升級</div>
  <div class="foot"><button id="sellall">全部賣出</button><button id="closeshop">離開</button></div>
</div>`;
document.body.appendChild(shopEl);

const polishStage = document.createElement('div');
polishStage.id = 'polishStage';
polishStage.innerHTML = `<div id="polishCard">
  <div class="polishEyebrow">GEM POLISHING</div><h2 id="polishTitle">打磨這顆原礦？</h2>
  <div id="polishMachine"><div class="polishGlow"></div><div class="polishRing"></div>
    <img id="polishOreImage" alt="待打磨原礦"><div class="polishSweep"></div>
    <div class="polishStars"><i></i><i></i><i></i><i></i><i></i></div><div class="polishSparks"></div></div>
  <div id="polishMessage"></div><div id="polishValue"></div>
  <div class="polishOdds"><div class="polishOdd"><b>22%</b>原價</div>
    <div class="polishOdd good"><b>66%</b>×1.25～2.10</div>
    <div class="polishOdd perfect"><b>12%</b>×2.20～3.50</div></div>
  <div class="polishActions"><button id="polishCancel">取消</button>
    <button id="polishConfirm">打磨</button><button id="polishCollect">收下</button></div>
</div>`;
document.body.appendChild(polishStage);
const polishSparks = polishStage.querySelector('.polishSparks');
for (let i = 0; i < 14; i++) {
  const spark = document.createElement('i');
  spark.style.setProperty('--spark-angle', (i / 14 * 360).toFixed(1) + 'deg');
  spark.style.setProperty('--spark-delay', (-i * .075).toFixed(3) + 's');
  polishSparks.appendChild(spark);
}

/* --- 礦工工會：錢包和背包都空了的時候，發一筆錢讓你能繼續 --- */
const brokeEl = document.createElement('div');
brokeEl.id = 'broke';
brokeEl.innerHTML = `<div id="brokewin">
  <h2>礦 工 工 會</h2>
  <p>又輸光啦？老礦工從抽屜數了幾張鈔票給你。</p>
  <div class="amt">＋$${SUBSIDY.toLocaleString('en-US')}</div>
  <div class="times" id="brokeTimes"></div>
  <button id="brokeTake">收下</button>
</div>`;
document.body.appendChild(brokeEl);

// 目前身上最便宜的十字鎬要多少錢（低於這個數字就連一次都挖不起）
// 這一階解鎖了嗎（看累積挖了幾顆礦）
function unlocked(i) { return P.mined >= (PICKS[i].unlockAt || 0); }
// 下一階還差幾顆
function nextUnlock() {
  const i = PICKS.findIndex((pk, k) => !unlocked(k));
  return i < 0 ? null : { index: i, left: PICKS[i].unlockAt - P.mined };
}
// 挖完一顆後檢查有沒有升級，有的話跳提示
function checkUnlock() {
  const i = PICKS.findIndex((pk, k) => P.mined === pk.unlockAt && pk.unlockAt > 0);
  if (i < 0) return -1;
  setTimeout(() => showToast('⛏ 升級！解鎖 ' + PICKS[i].name, '#7ee08a'), 1300);
  return i;
}
function cheapestBet() {
  return Math.min(...PICKS.filter((pk, i) => unlocked(i)).map(pk => pk.price));
}
function bagEmpty() {
  return ORE_TYPES.every(t => P.bag[t.key].length === 0);
}
function checkBroke() {
  if (P.brokeOpen || P.shopOpen || P.sleeping) return;
  // 還付得起最便宜的場地費、或還有礦石能賣 → 都不算破產
  if (P.money >= cheapestBet() || !bagEmpty()) return;
  P.brokeOpen = true;
  document.getElementById('brokeTimes').textContent =
    P.subsidyCount === 0 ? '這是第一次，工會不收你利息。'
                         : '你已經領過 ' + P.subsidyCount + ' 次了。';
  brokeEl.style.display = 'flex';
  G.keys = {};
}
document.getElementById('brokeTake').onclick = () => {
  P.money += SUBSIDY;
  P.subsidyCount++;
  P.brokeOpen = false;
  brokeEl.style.display = 'none';
  G.keys = {};
  refreshHUD();
  showToast('工會補助 ＋$' + SUBSIDY.toLocaleString('en-US'), '#ffd44d');
};

function showToast(text, color) {
  toast.textContent = text;
  toast.style.color = color || '#ffd79a';
  toast.style.opacity = 1; toast.style.bottom = '150px';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = 0; toast.style.bottom = '178px'; }, 900);
}

const pendingHudOreAdds = Object.create(null);
function visibleHudOreCount(type) {
  return Math.max(0, P.bag[type.key].length - (pendingHudOreAdds[type.key] || 0));
}
function refreshHUD() {
  // 讓角色手中的 3D 十字鎬與目前裝備保持一致。
  if (typeof G.setPickaxeTier === 'function') G.setPickaxeTier(P.pick);
  // 下方橫條：左邊錢包、右邊目前十字鎬（＝這一版的 BET）
  const wallet = document.getElementById('walletVal');
  const betPick = document.getElementById('betPick');
  const betVal = document.getElementById('betVal');
  if (wallet)  wallet.textContent  = P.money.toLocaleString('en-US');
  if (betPick) betPick.textContent = PICKS[P.pick].name;
  const betImg = document.getElementById('betPickImg');
  if (betImg) betImg.src = PICKS[P.pick].img;
  const pickImg = document.getElementById('pickBtnImg');
  if (pickImg) pickImg.src = PICKS[P.pick].img;
  if (betVal)  betVal.textContent  = '$' + PICKS[P.pick].price.toLocaleString('en-US');

  // 上方背包列：只顯示背包裡的礦石數量
  //（十字鎬的解鎖狀態改成只在換鎬面板裡看，這一排不再顯示）
  document.getElementById('hudBag').innerHTML = ORE_TYPES.map(t => {
    const shown = visibleHudOreCount(t);
    return `<span class="hore${shown ? '' : ' zero'}" data-ore-key="${t.key}" style="color:#${t.color.toString(16).padStart(6,'0')}"><img src="${t.rawImg}" alt="${t.name}"><b>${shown}</b></span>`;
  }).join('');
  const left = document.getElementById('oreleft');
  if (left) left.textContent = ores.length;
}

let walletAnimationToken = 0;
function displayedWalletValue() {
  const wallet = document.getElementById('walletVal');
  if (!wallet) return P.money;
  const value = Number(wallet.textContent.replace(/[^0-9-]/g, ''));
  return Number.isFinite(value) ? value : P.money;
}
function animateMoneyToWallet(sourceRect, visualStart, totalMoney, requestedCoins = 5) {
  const wallet = document.getElementById('walletVal');
  if (!wallet || !sourceRect) return;
  const targetRect = wallet.getBoundingClientRect();
  const token = ++walletAnimationToken;
  const coinCount = Math.max(4, Math.min(12, Math.round(requestedCoins)));
  const startX = sourceRect.left + sourceRect.width * .5 - 12;
  const startY = sourceRect.top + sourceRect.height * .5 - 12;
  const endX = targetRect.left + targetRect.width * .5 - 12;
  const endY = targetRect.top + targetRect.height * .5 - 12;
  const dx = endX - startX, dy = endY - startY;
  const amount = Math.max(0, totalMoney - visualStart);
  let arrivedCount = 0;
  wallet.textContent = visualStart.toLocaleString('en-US');

  for (let i = 0; i < coinCount; i++) {
    const coin = document.createElement('img');
    coin.className = 'shopCoinFly';
    coin.src = 'images/coin0' + ((i % 5) + 1) + '.png';
    coin.alt = '';
    coin.style.left = (startX + (Math.random() - .5) * 16).toFixed(1) + 'px';
    coin.style.top = (startY + (Math.random() - .5) * 9).toFixed(1) + 'px';
    coin.style.setProperty('--coin-hop-x', ((Math.random() - .5) * 42).toFixed(1) + 'px');
    coin.style.setProperty('--coin-hop-y', (-28 - Math.random() * 24).toFixed(1) + 'px');
    coin.style.setProperty('--coin-mid-x', (dx * (.46 + Math.random() * .10)).toFixed(1) + 'px');
    coin.style.setProperty('--coin-mid-y', (dy * .48 - 38 - Math.random() * 25).toFixed(1) + 'px');
    coin.style.setProperty('--coin-x', dx.toFixed(1) + 'px');
    coin.style.setProperty('--coin-y', dy.toFixed(1) + 'px');
    coin.style.setProperty('--coin-delay', (i * .075).toFixed(3) + 's');
    coin.style.setProperty('--coin-time', (.72 + Math.random() * .16).toFixed(3) + 's');
    document.body.appendChild(coin);
    coin.addEventListener('animationend', () => {
      coin.remove();
      if (token !== walletAnimationToken) return;
      arrivedCount++;
      const nextValue = arrivedCount >= coinCount
        ? totalMoney : Math.round(visualStart + amount * arrivedCount / coinCount);
      wallet.textContent = nextValue.toLocaleString('en-US');
      wallet.classList.remove('moneyGain');
      void wallet.offsetWidth;
      wallet.classList.add('moneyGain');
      if (arrivedCount >= coinCount) {
        setTimeout(() => wallet.classList.remove('moneyGain'), 450);
        window.dispatchEvent(new CustomEvent('money-arrived', { detail:{ amount } }));
      }
    }, { once:true });
  }
}

/* ---------- 商店的內容 ---------- */
function resolvePolishOre(type, item) {
  if (!item || item.polished) return null;
  const roll = Math.random();
  let gain = 1;
  let result = '打磨完成，但品質普通，售價維持不變';
  if (roll >= .22 && roll < .88) {
    gain = 1.25 + Math.random() * .85;
    result = '打磨成功，寶石價值提升';
  } else if (roll >= .88) {
    gain = 2.2 + Math.random() * 1.3;
    result = '完美打磨！寶石價值大幅提升';
  }
  item.baseValue = item.baseValue || item.value;
  item.polished = true;
  item.polishGain = gain;
  item.value = Math.max(item.baseValue, Math.round(item.baseValue * gain));
  return result;
}

let pendingPolish = null;
let polishTimers = [];
function clearPolishTimers() { polishTimers.forEach(clearTimeout); polishTimers = []; }
function closePolishStage() {
  if (P.polishing) return false;
  clearPolishTimers();
  pendingPolish = null;
  polishStage.style.display = 'none';
  polishStage.className = '';
  return true;
}
function openPolishDecision(type, item) {
  if (!type || !item || item.polished || P.money < type.polishCost) return;
  pendingPolish = { type, item };
  clearPolishTimers();
  const color = '#' + type.color.toString(16).padStart(6, '0');
  polishStage.style.setProperty('--polish', color);
  polishStage.className = 'confirm';
  polishStage.style.display = 'flex';
  document.getElementById('polishTitle').textContent = '要打磨這顆原礦嗎？';
  const image = document.getElementById('polishOreImage');
  image.src = type.rawImg; image.alt = type.name;
  document.getElementById('polishMessage').innerHTML =
    `<strong>${type.name}</strong>你可以現在確定賣出，或再付一次費用挑戰更高價值。`;
  document.getElementById('polishValue').innerHTML =
    `目前可直接賣　<b>$${item.value.toLocaleString('en-US')}</b><br>` +
    `打磨費　<b>−$${type.polishCost.toLocaleString('en-US')}</b>　每顆只能嘗試一次`;
  document.getElementById('polishConfirm').disabled = false;
}
function startPolishing() {
  const job = pendingPolish;
  if (!job || P.polishing || job.item.polished || !P.bag[job.type.key].includes(job.item)) return;
  if (P.money < job.type.polishCost) {
    document.getElementById('polishMessage').innerHTML = '<strong>錢不夠</strong>先賣出其他礦石，再回來挑戰打磨。';
    return;
  }
  P.money -= job.type.polishCost;
  P.polishing = true;
  polishStage.className = 'working';
  document.getElementById('polishConfirm').disabled = true;
  document.getElementById('polishTitle').textContent = '正在打磨…';
  document.getElementById('polishMessage').innerHTML = '<strong>固定原礦</strong>機器正在尋找最好的切割角度…';
  document.getElementById('polishValue').innerHTML =
    `已支付打磨費　<b>−$${job.type.polishCost.toLocaleString('en-US')}</b><br>結果即將揭曉`;
  refreshHUD(); renderShop();
  window.dispatchEvent(new CustomEvent('polish-start', { detail:{ type:job.type.key } }));
  polishTimers.push(setTimeout(() => {
    document.getElementById('polishMessage').innerHTML = '<strong>切割晶面</strong>光線開始進入礦石內部…';
  }, 650));
  polishTimers.push(setTimeout(() => {
    document.getElementById('polishMessage').innerHTML = '<strong>最後拋光</strong>會是普通、升值，還是完美寶石？';
  }, 1320));
  polishTimers.push(setTimeout(() => polishStage.classList.add('revealSoon'), 1780));
  polishTimers.push(setTimeout(finishPolishing, 2250));
}
function finishPolishing() {
  const job = pendingPolish;
  if (!job) return;
  const before = job.item.value;
  resolvePolishOre(job.type, job.item);
  P.polishing = false;
  const gain = job.item.polishGain || 1;
  const tier = gain >= 2.2 ? 'perfect' : (gain > 1 ? 'success' : 'normal');
  polishStage.className = `result ${tier}`;
  document.getElementById('polishOreImage').src = job.type.gemImg;
  document.getElementById('polishOreImage').alt = job.type.gemName;
  document.getElementById('polishTitle').textContent =
    tier === 'perfect' ? '完美打磨！' : (tier === 'success' ? '打磨成功！' : '普通品質');
  document.getElementById('polishMessage').innerHTML = `<strong>${job.type.gemName}</strong>`;
  const delta = job.item.value - before;
  document.getElementById('polishValue').innerHTML =
    `$${before.toLocaleString('en-US')}　→　<b>$${job.item.value.toLocaleString('en-US')}</b><br>` +
    `<span style="color:${delta > 0 ? '#7ee0a0' : '#aaa6a0'}">${delta > 0 ? `+$${delta.toLocaleString('en-US')}` : '沒有增加'}</span>`;
  refreshHUD(); renderShop();
  window.dispatchEvent(new CustomEvent('polish-reveal', { detail:{ tier, gain } }));
}

const REWARD_TIERS = ['普通礦脈','精良礦脈','稀有礦脈','史詩礦脈','傳說礦脈'];
/* 挖到好礦時的加強版演出。門檻用「這次抽到的倍率」決定，
   倍率越高標題越大、停留越久。賣出時的 WIN 演出是另一套。 */
const GRAND_GRADES = [
  { min:2,  cls:'g1', word:'精 良 礦 脈', life:3600, size:1.10, tint:null },
  { min:5,  cls:'g2', word:'稀 有 礦 脈', life:4200, size:1.22, tint:null },
  { min:10, cls:'g3', word:'史 詩 礦 脈', life:4900, size:1.34, tint:'epic' },
  { min:25, cls:'g4', word:'極 品 礦 脈', life:5600, size:1.48, tint:'ultra' },
];
function gradeForMult(mult) {
  let found = null;
  GRAND_GRADES.forEach(g => { if (mult >= g.min) found = g; });
  return found;
}
function showOreReward(type, quantity = 1, mult = 0) {
  mountInStage(oreReward);
  const rewardToken = (oreReward._rewardToken || 0) + 1;
  oreReward._rewardToken = rewardToken;
  const rank = Math.max(0, ORE_TYPES.indexOf(type));
  const grand = gradeForMult(mult);
  const bigger = grand ? grand.size : 1;
  const life = grand ? grand.life : 3000;
  oreReward.className = grand ? 'grand ' + grand.cls : '';
  if (grand && grand.tint) showScreenTint(grand.tint, life);
  oreReward.style.setProperty('--life', (life / 1000).toFixed(2) + 's');
  oreReward.querySelector('.rewardBanner').textContent = grand ? grand.word : '';
  oreReward.querySelector('.rewardMult').textContent = grand ? '×' + mult.toFixed(2) : '';
  const hex = '#' + type.color.toString(16).padStart(6, '0');
  const r = (type.color >> 16) & 255, g = (type.color >> 8) & 255, b = type.color & 255;
  oreReward.style.setProperty('--ore', hex);
  oreReward.style.setProperty('--ore-soft', `rgba(${r},${g},${b},${(0.30 + rank * 0.055).toFixed(2)})`);
  oreReward.style.setProperty('--reward-size', Math.round((168 + rank * 17) * bigger) + 'px');
  oreReward.style.setProperty('--ore-image', Math.round((92 + rank * 8) * bigger) + 'px');
  oreReward.style.setProperty('--glow-opacity', (0.38 + rank * 0.10).toFixed(2));
  oreReward.style.setProperty('--glow-low', (0.27 + rank * 0.07).toFixed(2));
  oreReward.style.setProperty('--ray-opacity', (0.25 + rank * 0.105).toFixed(2));
  oreReward.style.setProperty('--ring-opacity', (0.38 + rank * 0.10).toFixed(2));
  oreReward.style.setProperty('--ring2-opacity', (0.24 + rank * 0.075).toFixed(2));
  oreReward.querySelector('.rewardOre').src = type.rawImg;
  oreReward.querySelector('.rewardOre').alt = type.name;
  oreReward.querySelector('.rewardText b').textContent = type.name + '　×' + quantity + ' 顆';
  oreReward.querySelector('.rewardTier').textContent = grand
    ? '✦'.repeat(rank + 1)                                   // 大標題已經寫了等級，這裡只留星星
    : '✦'.repeat(rank + 1) + '　' + REWARD_TIERS[rank];

  const sparks = oreReward.querySelector('.rewardSparks');
  sparks.innerHTML = '';
  const count = 8 + rank * 5;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('i');
    spark.className = 'rewardSpark';
    const angle = (i / count) * Math.PI * 2 + rank * .19;
    const distance = 66 + rank * 8 + (i % 3) * 9;
    spark.style.setProperty('--sx', (Math.cos(angle) * distance).toFixed(1) + 'px');
    spark.style.setProperty('--sy', (Math.sin(angle) * distance).toFixed(1) + 'px');
    spark.style.setProperty('--delay', (-i * .11).toFixed(2) + 's');
    spark.style.setProperty('--duration', (1.35 + (i % 4) * .16 - rank * .025).toFixed(2) + 's');
    sparks.appendChild(spark);
  }

  clearTimeout(oreReward._hideTimer);
  oreReward.classList.remove('show', 'collecting');
  void oreReward.offsetWidth; // 連續挖到礦時也能從頭重播演出
  oreReward.classList.add('show');
  // 礦石飛進背包的時間跟著演出長度走，才不會演到一半礦石就不見了
  oreReward._flyDelay = Math.max(1200, life - 950);
  oreReward._hideTimer = setTimeout(() => oreReward.classList.remove('show'), life);
  return rewardToken;
}
window.showOreReward = showOreReward;
window.MINING.showOreReward = showOreReward;

function queueOreToHud(type, rewardToken, quantity = 1, delay = 2050) {
  pendingHudOreAdds[type.key] = (pendingHudOreAdds[type.key] || 0) + quantity;
  for (let i = 0; i < quantity; i++) {
    setTimeout(() => flyOreToHud(type, rewardToken), delay + i * 105);
  }
}
function flyOreToHud(type, rewardToken) {
  const target = document.querySelector(`#hudBag .hore[data-ore-key="${type.key}"]`);
  const source = oreReward.querySelector('.rewardOre');
  if (!target || !source) {
    pendingHudOreAdds[type.key] = Math.max(0, (pendingHudOreAdds[type.key] || 1) - 1);
    refreshHUD();
    return;
  }
  if (oreReward._rewardToken === rewardToken) oreReward.classList.add('collecting');
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.querySelector('img').getBoundingClientRect();
  const startX = sourceRect.left;
  const startY = sourceRect.top;
  const endX = targetRect.left + targetRect.width * .5 - sourceRect.width * .5;
  const endY = targetRect.top + targetRect.height * .5 - sourceRect.height * .5;
  const dx = endX - startX;
  const dy = endY - startY;
  const flyer = document.createElement('img');
  flyer.className = 'oreHudFly';
  flyer.src = type.rawImg;
  flyer.alt = '';
  flyer.style.left = startX.toFixed(1) + 'px';
  flyer.style.top = startY.toFixed(1) + 'px';
  flyer.style.width = sourceRect.width.toFixed(1) + 'px';
  flyer.style.height = sourceRect.height.toFixed(1) + 'px';
  flyer.style.setProperty('--fly-color', '#' + type.color.toString(16).padStart(6, '0'));
  flyer.style.setProperty('--fly-x', dx.toFixed(1) + 'px');
  flyer.style.setProperty('--fly-y', dy.toFixed(1) + 'px');
  flyer.style.setProperty('--fly-mid-x', (dx * .56).toFixed(1) + 'px');
  flyer.style.setProperty('--fly-mid-y', (dy * .46 - 48).toFixed(1) + 'px');
  document.body.appendChild(flyer);
  flyer.addEventListener('animationend', () => {
    flyer.remove();
    pendingHudOreAdds[type.key] = Math.max(0, (pendingHudOreAdds[type.key] || 1) - 1);
    const liveTarget = document.querySelector(`#hudBag .hore[data-ore-key="${type.key}"]`);
    if (liveTarget) {
      const count = liveTarget.querySelector('b');
      if (count) count.textContent = visibleHudOreCount(type);
      liveTarget.classList.toggle('zero', visibleHudOreCount(type) === 0);
      liveTarget.classList.remove('oreCollected');
      void liveTarget.offsetWidth;
      liveTarget.classList.add('oreCollected');
      setTimeout(() => liveTarget.classList.remove('oreCollected'), 580);
    }
  }, { once:true });
}

const WIN_LEVELS = [
  { cls:'win', tint:null, title:'WIN', titleImg:'images/ui_win_title.png',
    panelImg:'images/ui_big_win_number_panel.png', color:'#ffd76b', color2:'#ff9d3d',
    particles:18, distance:155, life:2850, countMs:900 },
  { cls:'big', tint:'big', title:'BIG WIN', titleImg:'images/ui_big_win_title_v2.png',
    panelImg:'images/ui_big_win_number_panel.png', color:'#ffbd48', color2:'#ff6d2e',
    particles:36, distance:225, life:3900, countMs:1450 },
  { cls:'super', tint:'super', title:'SUPER WIN', titleImg:'images/ui_super_win_title_v2.png',
    panelImg:'images/ui_big_win_number_panel.png', color:'#72f5ff', color2:'#db62ff',
    particles:58, distance:295, life:5200, countMs:2100 },
];
function showWinReward(mult, value, type, quantity = 1, label = '賣出') {
  mountInStage(winReward);
  const levelIndex = mult >= 10 ? 2 : (mult >= 5 ? 1 : 0);
  const level = WIN_LEVELS[levelIndex];
  winReward.className = level.cls;
  winReward.style.setProperty('--win', level.color);
  winReward.style.setProperty('--win2', level.color2);
  winReward.style.setProperty('--life', (level.life / 1000).toFixed(2) + 's');
  if (level.tint) showScreenTint(level.tint, level.life);
  const titleAsset = winReward.querySelector('.winTitleAsset');
  titleAsset.src = level.titleImg;
  titleAsset.alt = level.title;
  winReward.querySelector('.winPanelAsset').src = level.panelImg;
  winReward.querySelector('.winMult').textContent =
    '×' + mult.toFixed(2) + '　' + label + ' ' + quantity + ' 顆';

  const particles = winReward.querySelector('.winParticles');
  particles.innerHTML = '';
  for (let i = 0; i < level.particles; i++) {
    const coin = document.createElement('img');
    coin.className = 'winCoin';
    coin.src = 'images/coin0' + ((i % 5) + 1) + '.png';
    coin.alt = '';
    const side = Math.random() < .5 ? -1 : 1;
    const startX = side * (42 + Math.random() * 42);
    const travel = side * (88 + Math.random() * Math.max(64, level.distance * .88));
    const apexX = startX + travel * (.72 + Math.random() * .18);
    const endX = startX + travel * (1.30 + Math.random() * .24);
    const peak = -(92 + Math.random() * (78 + levelIndex * 22));
    const fall = 285 + Math.random() * 190 + levelIndex * 38;
    coin.style.setProperty('--start-x', startX.toFixed(1) + 'px');
    coin.style.setProperty('--apex-x', apexX.toFixed(1) + 'px');
    coin.style.setProperty('--peak', peak.toFixed(1) + 'px');
    coin.style.setProperty('--end-x', endX.toFixed(1) + 'px');
    coin.style.setProperty('--fall', fall.toFixed(1) + 'px');
    const rotation = side * (300 + Math.random() * 520);
    coin.style.setProperty('--rot-start', ((Math.random() - .5) * 80).toFixed(1) + 'deg');
    coin.style.setProperty('--rot', rotation + 'deg');
    coin.style.setProperty('--rot-end', (rotation * (1.65 + Math.random() * .42)).toFixed(1) + 'deg');
    coin.style.setProperty('--coin-size', (23 + levelIndex * 4 + Math.random() * 11).toFixed(1) + 'px');
    const duration = 1.18 + levelIndex * .10 + Math.random() * .38;
    const launchWindow = Math.max(.55, level.life / 1000 - duration - .42);
    const delay = .06 + (i / Math.max(1, level.particles - 1)) * launchWindow + Math.random() * .12;
    coin.style.setProperty('--delay', delay.toFixed(2) + 's');
    coin.style.setProperty('--dur', duration.toFixed(2) + 's');
    particles.appendChild(coin);
  }

  if (winReward._countFrame) cancelAnimationFrame(winReward._countFrame);
  const amount = winReward.querySelector('.winAmount b');
  amount.textContent = '$0';
  const start = performance.now(), countMs = level.countMs;
  const countUp = now => {
    const t = Math.min(1, (now - start) / countMs);
    const eased = 1 - Math.pow(1 - t, 3);
    amount.textContent = '$' + Math.round(value * eased).toLocaleString('en-US');
    if (t < 1) winReward._countFrame = requestAnimationFrame(countUp);
  };
  winReward._countFrame = requestAnimationFrame(countUp);

  clearTimeout(winReward._hideTimer);
  winReward.classList.remove('show');
  void winReward.offsetWidth;
  winReward.classList.add('show');
  winReward._hideTimer = setTimeout(() => winReward.classList.remove('show'), level.life);
}
window.showWinReward = showWinReward;
window.MINING.showWinReward = showWinReward;
window.MINING.showScreenTint = showScreenTint;
window.MINING.testOreReward = (mult = 6, oreIndex = 2, quantity = 2) =>
  showOreReward(ORE_TYPES[oreIndex] || ORE_TYPES[0], quantity, mult);
window.MINING.testWinReward = level => {
  const samples = {
    win:   { mult:2.8,  value:280,  type:ORE_TYPES[1] },
    big:   { mult:7.5,  value:750,  type:ORE_TYPES[3] },
    super: { mult:18.8, value:1880, type:ORE_TYPES[4] },
  };
  const sample = samples[level] || samples.win;
  showWinReward(sample.mult, sample.value, sample.type);
};

function renderShop() {
  // 每一顆礦石都有自己的倍率，所以一顆一列（價值高的排前面）
  const items = [];
  ORE_TYPES.forEach(t => P.bag[t.key].forEach((it, i) => items.push({ t, it, i })));
  items.sort((a, b) => b.it.value - a.it.value);
  const total = items.reduce((sum, x) => sum + x.it.value, 0);
  const MAX_ROWS = 40;

  document.getElementById('sellList').innerHTML = items.length
    ? items.slice(0, MAX_ROWS).map(x => {
        const win = x.it.mult >= 1;
        const polished = !!x.it.polished;
        const img = polished ? x.t.gemImg : x.t.rawImg;
        const name = polished ? x.t.gemName : x.t.name;
        const state = polished
          ? `<span class="orestate polishgain">已打磨 ×${(x.it.polishGain || 1).toFixed(2)}</span>`
          : `<span class="orestate">打磨 $${x.t.polishCost.toLocaleString('en-US')}</span>`;
        const canPolish = P.money >= x.t.polishCost ? '' : 'disabled';
        return `<div class="row${polished ? ' polished' : ''}">
          <img class="oreimg" src="${img}" alt="${name}">
          <span class="nm">${name}${state}</span>
          <span class="num" style="color:${win ? '#7ee08a' : '#ff8a7a'}">×${x.it.mult.toFixed(2)}</span>
          <span class="val">${x.it.value.toLocaleString('en-US')} 元</span>
          <span class="actions">
            ${polished ? '' : `<button class="polishbtn" data-polish="${x.t.key}" data-idx="${x.i}" ${canPolish}>打磨 $${x.t.polishCost}</button>`}
            <button class="sellbtn" data-sell="${x.t.key}" data-idx="${x.i}">賣出</button>
          </span>
        </div>`;
      }).join('')
      + (items.length > MAX_ROWS ? `<div class="hintline">…還有 ${items.length - MAX_ROWS} 顆</div>` : '')
      + `<div class="hintline">總值　<b style="color:#ffd44d">$${total.toLocaleString('en-US')}</b></div>`
    : '<div class="hintline">背包是空的</div>';


}

shopEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'closeshop') return closeShop();
  if (b.id === 'sellall') {
    const sourceRect = b.getBoundingClientRect();
    const visualStart = displayedWalletValue();
    let got = 0;
    let soldCount = 0;
    let paid = 0, bestValue = -1, bestType = ORE_TYPES[0];
    ORE_TYPES.forEach(t => {
      P.bag[t.key].forEach(it => {
        got += it.value; paid += it.bet || 0; soldCount++;
        if (it.value > bestValue) { bestValue = it.value; bestType = t; }
      });
      P.bag[t.key] = [];
    });
    if (got) { P.money += got; showToast('+$' + got.toLocaleString('en-US'), '#ffd44d'); }
    refreshHUD(); renderShop();
    if (got) animateMoneyToWallet(sourceRect, visualStart, P.money, 5 + Math.min(7, soldCount));
    // 這一批整體賺兩倍以上才值得放煙火
    const batchMult = paid > 0 ? got / paid : 0;
    if (got && batchMult >= 2) showWinReward(batchMult, got, bestType, soldCount, '賣出');
    return;
  }
  if (b.dataset.sell) {
    const t = ORE_TYPES.find(x => x.key === b.dataset.sell);
    const it = P.bag[t.key][+b.dataset.idx];
    if (it) {
      const sourceEl = b.closest('.row')?.querySelector('.oreimg') || b;
      const sourceRect = sourceEl.getBoundingClientRect();
      const visualStart = displayedWalletValue();
      P.money += it.value;
      P.bag[t.key].splice(+b.dataset.idx, 1);
      showToast('+$' + it.value.toLocaleString('en-US'), it.mult >= 1 ? '#ffd44d' : '#ff8a7a');
      refreshHUD(); renderShop();
      animateMoneyToWallet(sourceRect, visualStart, P.money, 5);
      // 打磨過的礦價值會變，所以用「實拿 ÷ 當初下注」算真正的倍率
      const realMult = it.bet > 0 ? it.value / it.bet : it.mult;
      if (realMult >= 2) showWinReward(realMult, it.value, t, 1, '賣出');
      return;
    }
    refreshHUD(); renderShop(); return;
  }
  if (b.dataset.polish) {
    const t = ORE_TYPES.find(x => x.key === b.dataset.polish);
    const it = t && P.bag[t.key][+b.dataset.idx];
    openPolishDecision(t, it);
    return;
  }
});

document.getElementById('polishCancel').onclick = closePolishStage;
document.getElementById('polishCollect').onclick = closePolishStage;
document.getElementById('polishConfirm').onclick = startPolishing;

function openShop()  {
  P.shopOpen = true; shopEl.style.display = 'flex';
  document.getElementById('stage')?.classList.add('shopOpen');
  renderShop(); G.keys = {};
}
function closeShop() {
  if (P.polishing) return;
  closePolishStage();
  P.shopOpen = false; shopEl.style.display = 'none';
  document.getElementById('stage')?.classList.remove('shopOpen');
  G.keys = {};
}
window.MINING.refreshHUD = refreshHUD;
window.MINING.openShop = openShop;
window.MINING.refreshOres = refreshOres;
window.MINING.toast = showToast;
// 給 info.js（玩法介紹）讀取的設定數值：說明會自動跟著數值變
window.MINING.CONFIG = { START_MONEY, PAYOUT_RTP, ORD_CEIL, JACK_SHARE, JACK_RATE, JACK_SPAN, MULT_FLOOR, SUBSIDY,
  SWING_SEC, EXTRA_HITS_PER_TIER, ACTIVE_ORES, RESPAWN_SEC };
// 開關 TURBO（按鈕在 mobile.js）
window.MINING.setTurbo = on => {
  P.turbo = !!on;
  try { localStorage.setItem('mole-mine-turbo', P.turbo ? '1' : '0'); } catch (_) {}
  showToast(P.turbo ? '⚡ TURBO 開：當場賣掉' : 'TURBO 關：放進背包',
            P.turbo ? '#ffd44d' : '#c9c2b2');
  return P.turbo;
};
window.MINING.CAMP = CAMP;
window.MINING.closeShop = closeShop;

/* 商店開著的時候，鍵盤不要傳給遊戲（不然角色會在背景亂跑） */
addEventListener('keydown', e => {
  if (!P.shopOpen && !P.brokeOpen && !P.sleeping) return;
  if (P.brokeOpen || P.sleeping) { e.stopPropagation(); G.keys = {}; return; }
  if (e.code === 'Escape' || e.code === 'KeyE') { closeShop(); }
  e.stopPropagation(); G.keys = {};
}, true);

/* ============================================================
   6. 每一格：判斷靠近誰、有沒有在挖
   ============================================================ */
let last = performance.now();

// 玩家想「動作」了嗎？—— 鍵盤按住 E，或是 mobile.js 點擊後自動觸發
/* --- 更新畫面下方那顆「開採」大按鈕 ---
   mode：off=灰的按不下　ready=亮起來可以按　busy=開採中　shop=變成進入商店   */
let _btn, _btnTxt, _btnFill, _btnPick, _lastSig = '';
function setAction(mode, label, progress) {
  if (_btn === undefined) _btn = null;
  if (!_btn) {
    _btn = document.getElementById('mineBtn');
    if (!_btn) return;                       // mobile.js 還沒把按鈕建出來
    _btnTxt  = _btn.querySelector('.txt');
    _btnFill = _btn.querySelector('.fill');
    _btnPick = _btn.querySelector('.minePick');
  }
  const sig = mode + '|' + label + '|' + P.pick;
  if (sig !== _lastSig) {
    _btn.className = 'act ' + mode;
    _btnTxt.textContent = mode === 'busy' ? '' : label;
    if (_btnPick) {
      _btnPick.src = PICKS[P.pick].img;
      _btnPick.alt = mode === 'busy' ? PICKS[P.pick].name + '開採中' : '';
    }
    _btn.style.setProperty('--mine-swing', Math.max(.25, SWING_SEC / PICKS[P.pick].speed).toFixed(2) + 's');
    _lastSig = sig;
  }
  _btnFill.style.width = mode === 'busy' ? '0' : ((progress || 0) * 100) + '%';
}

// 按下「開採」大按鈕（或在商店旁按它 → 進商店）
window.MINING.tapMine = () => {
  if (P.shopOpen || P.brokeOpen || P.sleeping) return;
  if (P.nearShop) { openShop(); return; }
  if (P.nearTent && window.CAMP) { window.CAMP.sleep(); return; }
  P.mineRequested = !P.mineRequested;        // 再按一次可以中斷
};

// 換十字鎬（＝換下注金額）
window.MINING.equipPick = i => {
  if (!unlocked(i)) return false;                    // 還沒解鎖的十字鎬不能選
  P.pick = i; P.mineRequested = false;
  refreshHUD(); renderPickList();
  return true;
};
window.MINING.renderPickList = renderPickList;
function renderPickList() {
  const el = document.getElementById('pickList');
  if (!el) return;
  el.innerHTML = PICKS.map((pk, i) => {
    const on = unlocked(i), eq = P.pick === i;
    const left = on ? '' : (pk.unlockAt - P.mined) + ' 顆';
    return `<div class="prow${eq ? ' eq' : ''}${on ? '' : ' lock'}"${on ? ` data-pick="${i}"` : ''}>
      <img src="${pk.img}" alt="">
      <span class="pn">${pk.name}${on ? '' : `　<span style="color:#ff8a7a;font-size:11px">還差 ${left}</span>`}</span>
      <span class="pv">$${pk.price.toLocaleString('en-US')}</span>
      <span class="ps">${eq ? '使用中' : (on ? '' : '未解鎖')}</span>
    </div>`;
  }).join('');
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;

  updateShopMole(now);
  updateWorkerMoles(now);
  updateMiningFx(dt);

  // 礦石長大動畫 + 緩慢呼吸發光（晶簇本身固定不旋轉）
  const t = now * 0.001;
  ores.forEach((o, i) => {
    if (o.grow < 1) { o.grow = Math.min(1, o.grow + dt * 2.2); o.mesh.scale.setScalar(o.grow); }
    o.hitPulse = Math.max(0, (o.hitPulse || 0) - dt * 6.8);
    const hitWave = Math.sin((1 - Math.min(1, o.hitPulse)) * Math.PI * 3.2) * o.hitPulse;
    const sx = o.grow * (1 + hitWave * .045);
    const sy = o.grow * (1 - hitWave * .035);
    o.mesh.scale.set(sx, sy, sx);
    if (o.hitPulse > 0) {
      o.mesh.position.x = o.x + (Math.random() - .5) * .055 * o.hitPulse;
      o.mesh.position.z = o.z + (Math.random() - .5) * .055 * o.hitPulse;
    } else {
      o.mesh.position.x = o.x;
      o.mesh.position.z = o.z;
    }
    const u = o.mesh.userData;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.08 + u.pulsePhase);
    const targetGlow = o === highlightedOre ? 1 : 0;
    // 礦石自己的發光調高：晶體尖端會超過 Bloom 門檻，光暈就只長在礦脈上，
    // 岩壁和地面完全不受影響。
    u.mat.emissiveIntensity = 0.82 + pulse * 0.62 + targetGlow * .80;
    u.tipMat.emissiveIntensity = 1.06 + pulse * 0.66 + targetGlow * .92;
    u.coreMat.opacity = 0.40 + pulse * 0.24 + targetGlow * .20;
    if (u.seamMat) u.seamMat.opacity = 0.42 + pulse * 0.34 + targetGlow * .16;
    if (u.extraCrystalMats) u.extraCrystalMats.forEach(m => { m.emissiveIntensity = 1.02 + pulse * 0.64 + targetGlow * .84; });
    u.halo.material.opacity = 0.17 + pulse * 0.23 + targetGlow * .40;
    const haloScale = u.haloSize * (0.95 + pulse * 0.10);
    u.halo.scale.setScalar(haloScale * (targetGlow ? 1.18 : 1));
    u.aura.material.opacity = 0.078 + pulse * 0.112 + targetGlow * .28;
    const auraScale = u.auraSize * (0.96 + pulse * 0.08);
    u.aura.scale.set(auraScale * (targetGlow ? 1.14 : 1), auraScale * (targetGlow ? 1.14 : 1), 1);
  });

  checkBroke();
  if (P.shopOpen || P.brokeOpen || P.sleeping) { prompt.style.display = 'none'; setTargetOre(null); return; }

  const px = G.player.position.x, pz = G.player.position.z;

  P.nearTent = Math.hypot(px - CAMP.x, pz - CAMP.z) < CAMP.range;

  /* --- 靠近商店？按鈕就變成「進入商店」 --- */
  const dShop = Math.hypot(px - SHOP.x, pz - SHOP.z);
  P.nearShop = dShop < SHOP_RANGE;
  if (P.nearShop) {
    P.mining = null; P.progress = 0; P.mineRequested = false;
    prompt.style.display = 'none';
    setTargetOre(null);
    setAction('shop', '商　店', 0);
    if (G.keys['KeyE'] || P.autoAct) { G.keys['KeyE'] = false; P.autoAct = false; openShop(); }
    return;
  }

  /* --- 靠近營地？按鈕就變成「睡覺」 --- */
  if (P.nearTent) {
    P.mining = null; P.progress = 0; P.mineRequested = false;
    setTargetOre(null);
    prompt.style.display = 'block';
    document.getElementById('ptext').innerHTML =
      '<span style="color:#c6d1ff">營地</span>　' +
      '<span style="color:#9a9384">睡一覺，礦坑會重新長出一批礦石</span>';
    setAction('sleep', '睡　覺', 0);
    return;
  }

  /* --- 找最近的礦石 --- */
  let near = null, best = MINE_RANGE;
  for (const o of ores) {
    const d = Math.hypot(px - o.x, pz - o.z);
    if (d < best) { best = d; near = o; }
  }

  if (!near) {
    prompt.style.display = 'none';
    setTargetOre(null);
    P.mining = null; P.progress = 0; P.mineRequested = false;
    setAction('off', '開　採', 0);
    return;
  }

  const pick = PICKS[P.pick];
  setTargetOre(near);

  /* --- 這把鎬子要敲幾下（鎬子階級不夠就多敲，不再擋住） --- */
  const needHits = hitsNeeded(near.type, P.pick);

  /* --- 錢不夠付場地費 --- */
  if (P.money < pick.price) {
    prompt.style.display = 'block';
    ptext.innerHTML = `<b style="color:#ff9a7a">錢不夠</b>` +
      `<br><span style="color:#7f7a6c">開採一次要 $${pick.price.toLocaleString('en-US')}，` +
      `回商店賣礦石，或換便宜一點的十字鎬</span>`;
    P.mining = null; P.progress = 0; P.mineRequested = false;
    setAction('off', '錢不夠', 0);
    return;
  }

  const miningNow = !!(G.keys['KeyE'] || P.mineRequested);
  /* 靠近礦石時不再顯示下方說明框，改由礦石光暈與頭頂名稱提示。 */
  prompt.style.display = 'none';

  /* --- 開採中 --- */
  if (miningNow) {
    if (P.mining !== near) {
      P.mining = near; P.progress = 0; P.swingPhase = 0; P.miningHitCount = 0;
    }
    // 停下開採後仍要正面朝向礦物，尖端的前後揮擊方向才會對準目標。
    const targetYaw = Math.atan2(near.x - px, near.z - pz);
    let turn = targetYaw - G.player.rotation.y;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    G.player.rotation.y += turn * Math.min(1, dt * 12);
    // 每揮一下花 SWING_SEC ÷ 速度 秒；進度 = 已敲下數 ÷ 總下數
    P.progress += dt * pick.speed / (SWING_SEC * needHits);
    const hitProgress = Math.min(needHits, P.progress * needHits);
    P.swingPhase = hitProgress % 1;
    const completedHits = Math.floor(hitProgress + 0.00001);
    while (P.miningHitCount < completedHits) {
      P.miningHitCount++;
      triggerMiningImpact(near, P.miningHitCount >= needHits);
    }

    if (P.progress >= 1) {
      // 結算：用掉一把十字鎬（它的價格就是下注金額），替這顆礦石抽一個倍率
      const bet = pick.price;
      const mult = rollMult(near.type, P.pick);
      const value = Math.max(1, Math.round(bet * mult));
      const yieldCount = rollOreQuantity();
      P.money -= bet;          // 十字鎬不消耗，改成每次開採付一筆場地費（＝下注金額）
      P.mined++;
      checkUnlock();           // 挖到門檻就自動解鎖下一階


      // 挖到礦時播「礦脈」演出；WIN 留到賣出的時候才播。
      // TURBO 等於當場賣掉，所以 TURBO 開著時直接播 WIN。
      let collectRewardToken = 0;
      if (P.turbo && mult >= 2) showWinReward(mult, value, near.type, yieldCount, '賣出');
      else collectRewardToken = showOreReward(near.type, yieldCount, mult);

      if (P.turbo) {
        // TURBO：不進背包，用跟商店一樣的價格當場賣掉
        P.money += value;
        P.turboSold++;
        showToast('⚡ ×' + mult.toFixed(2) + '　+$' + value.toLocaleString('en-US'),
                  mult >= 1 ? '#ffd44d' : '#ff8a7a');
      } else {
        const eachBase = Math.floor(value / yieldCount);
        const remainder = value % yieldCount;
        for (let i = 0; i < yieldCount; i++) {
          const pieceValue = eachBase + (i < remainder ? 1 : 0);
          P.bag[near.type.key].push({
            mult, bet:bet / yieldCount, value:pieceValue, baseValue:pieceValue,
            polished:false, polishGain:1
          });
        }
        if (collectRewardToken) {
          queueOreToHud(near.type, collectRewardToken, yieldCount, oreReward._flyDelay);
        }
        showToast('×' + mult.toFixed(2) + '　$' + value.toLocaleString('en-US'),
                  mult >= 1 ? '#7ee08a' : '#ff8a7a');
      }
      removeOre(near);
      setTargetOre(null);
      P.mining = null; P.progress = 0; P.swingPhase = 0; P.miningHitCount = 0;
      P.mineRequested = false; P.autoAct = false;
      refreshHUD();
      prompt.style.display = 'none';
      setAction('off', '開　採', 0);
      return;
    }
    setAction('busy', '', P.progress);
  } else {
    P.mining = null; P.progress = 0; P.swingPhase = 0; P.miningHitCount = 0;
    near.mesh.position.set(near.x, near.mesh.position.y, near.z);
    setAction('ready', '開　採', 0);
  }
}

refreshHUD();
requestAnimationFrame(loop);

/* ============================================================
   7. 小地圖上也畫出礦石與商店
   做法：把 index.html 原本的 drawMinimap 包起來 ——
   先讓它畫原本的坑道，再由我們補上礦石亮點。
   ============================================================ */
if (typeof window.drawMinimap === 'function') {
  const drawBase = window.drawMinimap;
  const mmCtx = document.getElementById('minimap').getContext('2d');
  window.drawMinimap = function () {
    drawBase();
    const R = 17, S = 150 / (R * 2 + 1);
    const gx = G.player.position.x, gz = G.player.position.z;

    ores.forEach(o => {
      const dx = (o.x - gx) / G.cell, dz = (o.z - gz) / G.cell;
      if (Math.abs(dx) > R || Math.abs(dz) > R) return;
      mmCtx.fillStyle = '#' + o.type.color.toString(16).padStart(6, '0');
      mmCtx.fillRect((dx + R) * S - 1.8, (dz + R) * S - 1.8, 4, 4);
    });

    const sx = (SHOP.x - gx) / G.cell, sz = (SHOP.z - gz) / G.cell;
    if (Math.abs(sx) <= R && Math.abs(sz) <= R) {
      mmCtx.fillStyle = '#ffd79a';
      mmCtx.fillRect((sx + R) * S - 3, (sz + R) * S - 3, 6, 6);
    }
  };
}

})();
