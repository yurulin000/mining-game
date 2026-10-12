/* ============================================================
   礦坑原型 · 玩法介紹（漢堡選單裡的 Info）
   ------------------------------------------------------------
   說明裡的數字全部從 mining.js 的設定讀出來，
   改了價格或倍率，這一頁會自動跟著變。
   ============================================================ */
(function () {

const M = MINING, C = M.CONFIG, ORES = M.ORE_TYPES, PICKS = M.PICKS;
const money = n => '$' + n.toLocaleString('en-US');
const hex = c => '#' + c.toString(16).padStart(6, '0');
const hitsNeeded = (ore, pi) =>
  Math.ceil(ore.hits * (1 + Math.max(0, ore.needPick - pi) * C.EXTRA_HITS_PER_TIER));

/* ---------- 樣式 ---------- */
const css = document.createElement('style');
css.textContent = `
#infoOverlay { position:absolute; inset:0; z-index:65; display:none; align-items:center; justify-content:center;
  background:rgba(4,6,12,.72); backdrop-filter:blur(6px); }
#infoOverlay.open { display:flex; }
#infoWin { position:relative; width:92%; max-height:84%; overflow:auto; background:#161a24;
  border:1px solid rgba(255,220,160,.28); border-radius:14px; padding:20px 18px 18px;
  box-shadow:0 24px 70px rgba(0,0,0,.7); color:#d9d2c3; font-size:12.5px; line-height:1.75; }
#infoWin h2 { font-size:18px; letter-spacing:3px; color:#ffd79a; margin-bottom:2px; }
#infoWin .sub { font-size:11px; color:#7f7a6c; margin-bottom:10px; }
#infoWin h3 { font-size:13px; color:#9fb4d8; letter-spacing:1px; margin:16px 0 6px;
  border-bottom:1px solid rgba(255,255,255,.09); padding-bottom:5px; }
#infoWin ol, #infoWin ul { padding-left:18px; }
#infoWin li { margin:2px 0; }
#infoWin b { color:#ffd79a; font-weight:600; }
#infoWin table { width:100%; border-collapse:collapse; margin:4px 0 2px; font-size:11.5px; }
#infoWin th, #infoWin td { padding:4px 3px; text-align:center; border-bottom:1px solid rgba(255,255,255,.06); }
#infoWin th { color:#9a9384; font-weight:normal; }
#infoWin td:first-child, #infoWin th:first-child { text-align:left; }
#infoWin .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; vertical-align:0; }
#infoWin .easy { color:#7ee08a; }
#infoWin .note { font-size:11px; color:#8f8a7c; }
#infoClose { position:absolute; right:10px; top:10px; width:30px; height:30px; border-radius:50%;
  background:#2c3a52; border:1px solid #66738a; color:#ffe0ad; font-size:16px; line-height:28px;
  text-align:center; cursor:pointer; }
#infoClose:hover { background:#3b4d6b; }
#infoBtn { font-size:12px !important; opacity:1 !important; background:#35465f !important;
  border-color:#ffd24d !important; color:#ffd79a !important; }
`;
document.head.appendChild(css);

/* ---------- 內容 ---------- */
const oreRows = ORES.map(o => `<tr>
  <td><span class="dot" style="background:${hex(o.color)}"></span>${o.name}</td>
  <td>×${o.varMax}</td>
  <td>${PICKS[o.needPick].name}</td>
  <td>${o.hits} 下</td></tr>`).join('');

const pickRows = PICKS.map((pk, i) => `<tr>
  <td>${pk.name}</td><td>${money(pk.price)}</td><td>${pk.speed} 倍</td>
  ${ORES.map(o => {
    const n = hitsNeeded(o, i);
    return `<td class="${n === o.hits ? 'easy' : ''}">${n}</td>`;
  }).join('')}</tr>`).join('');

const jackRows = PICKS.map((pk, i) => `<tr>
  <td>${pk.name}</td>
  <td>${(C.JACK_RATE[i] * 100).toFixed(1)}%</td>
  <td>×${C.JACK_SPAN[i]}</td>
  <td>${Math.round((1 - C.JACK_SHARE[i]) * 100)}%</td></tr>`).join('');

const unlockList = PICKS.map(pk => pk.unlockAt
  ? `<li><b>${pk.name}</b>：累積挖到 <b>${pk.unlockAt}</b> 顆礦自動解鎖</li>`
  : `<li><b>${pk.name}</b>：一開始就有</li>`).join('');

const html = `
<div id="infoClose">✕</div>
<h2>玩 法 介 紹</h2>
<div class="sub">帶著十字鎬下礦坑，把礦石換成錢。</div>

<h3>一、怎麼玩</h3>
<ol>
  <li>點地面走過去，靠近礦石後按<b>開採</b>。</li>
  <li>挖到的礦進背包，到<b>商店</b>賣掉。</li>
  <li>挖得越多，十字鎬自動升級。</li>
</ol>

<h3>二、十字鎬＝下注</h3>
<ul>
  <li>十字鎬不用買也不會壞，但<b>每挖一次要付場地費</b>，金額就是它的價格。</li>
  <li>開局 <b>${money(C.START_MONEY)}</b> 加一把木十字鎬。按開採旁的圓鈕換鎬：貴的賭大，便宜的穩。</li>
  ${unlockList}
</ul>

<h3>三、礦石與倍率</h3>
<table>
  <tr><th>礦石</th><th>大獎天花板</th><th>順手的鎬</th><th>順手敲幾下</th></tr>
  ${oreRows}
</table>
<ul>
  <li><b>賣價＝十字鎬價格 × 倍率</b>。×1 以上是賺，最低 ×${C.MULT_FLOOR}。</li>
  <li>多數時候抽到平常收成（最高 ×${C.ORD_CEIL}），少數時候抽到大獎。</li>
  <li class="note">長期平均拿回下注的 ${Math.round(C.PAYOUT_RTP * 100)}%，四把鎬都一樣。</li>
</ul>

<h3>四、十字鎬等級</h3>
<ul>
  <li>任何鎬都能挖任何礦，低一階多敲 ${Math.round(C.EXTRA_HITS_PER_TIER * 100)}%。</li>
  <li><b>越高階越大起大落</b>：大獎更大更常中，平常收成更差。</li>
</ul>
<table>
  <tr><th>十字鎬</th><th>中大獎</th><th>天花板</th><th>平常收成</th></tr>
  ${jackRows}
</table>
<table>
  <tr><th>十字鎬</th><th>價格</th><th>揮速</th>${ORES.map(o => `<th>${o.name.slice(0, 1)}</th>`).join('')}</tr>
  ${pickRows}
</table>
<div class="note">右邊四欄是挖那種礦要敲幾下，<span class="easy">綠色</span>代表順手。</div>

<h3>五、商店與 TURBO</h3>
<ul>
  <li>走到商店旁，或直接點右下角的<b>商店</b>鈕。可單顆賣，也可全部賣出。</li>
  <li>開採鈕左邊的 <b>⚡TURBO</b> 打開後，挖到的礦當場賣掉，不進背包。</li>
</ul>

<h3>六、重生與營地</h3>
<ul>
  <li>地圖上同時有 <b>${C.ACTIVE_ORES}</b> 顆礦，挖掉一顆 ${C.RESPAWN_SEC} 秒後在別處重生。</li>
  <li>商店下方有帳篷，按<b>睡覺</b>可讓全地圖礦石重抽一批。</li>
</ul>

<h3>七、破產</h3>
<ul>
  <li>錢不夠、背包也空了時，<b>礦工工會</b>會發 <b>${money(C.SUBSIDY)}</b> 讓你繼續。</li>
</ul>
`;

/* ---------- 視窗 ---------- */
const stage = document.getElementById('stage') || document.body;
const overlay = document.createElement('div');
overlay.id = 'infoOverlay';
overlay.innerHTML = `<div id="infoWin">${html}</div>`;
stage.appendChild(overlay);
if (stage === document.body) overlay.style.position = 'fixed';

function closeMenu() {
  const panel = document.getElementById('panel');
  const gear = document.getElementById('gear');
  if (panel) panel.classList.remove('open');
  if (gear) gear.classList.remove('open');
}
function openInfo() {
  closeMenu();
  G.keys = {};
  document.getElementById('infoWin').scrollTop = 0;
  overlay.classList.add('open');
}
function closeInfo() { overlay.classList.remove('open'); }

document.getElementById('infoClose').addEventListener('click', closeInfo);
overlay.addEventListener('pointerdown', e => { if (e.target === overlay) closeInfo(); });
overlay.addEventListener('pointerdown', e => e.stopPropagation());   // 別讓點擊穿到遊戲畫面
addEventListener('keydown', e => { if (e.code === 'Escape' && overlay.classList.contains('open')) closeInfo(); });

/* ---------- 漢堡選單最上面的 Info 按鈕 ---------- */
const panel = document.getElementById('panel');
if (panel) {
  const btn = document.createElement('button');
  btn.id = 'infoBtn';
  btn.type = 'button';
  btn.textContent = 'Info　玩法介紹';
  btn.addEventListener('click', e => { e.stopPropagation(); openInfo(); });
  panel.prepend(btn);
}

window.GAME_INFO = { open: openInfo, close: closeInfo };

})();
