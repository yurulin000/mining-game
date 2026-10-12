/* ============================================================
   礦坑原型 · 手機版（9:16 直式 + 純滑鼠／觸控操作）
   ------------------------------------------------------------
   這個檔案做三件事：
     1. 把畫面裁成 9:16 直式，所有介面都塞進這個框裡
     2. 點哪裡就走到哪裡（會自動繞過岩壁）
     3. 點礦石＝走過去自動開採，點商店＝走過去自動開門
   鍵盤（WASD）還是能用，方便你在電腦上測試。
   ============================================================ */
(function () {

/* ============================================================
   1. 9:16 直式舞台
   ============================================================ */
const stage = document.createElement('div');
stage.id = 'stage';
document.body.appendChild(stage);

const style = document.createElement('style');
style.textContent = `
  body { display:flex; align-items:center; justify-content:center;
         background:#050609; }
  #stage { position:relative; overflow:hidden; background:#0d0e16;
           box-shadow:0 0 60px rgba(0,0,0,.8); }
  #stage canvas { display:block; touch-action:none; cursor:pointer; }

  /* 原本貼著整個瀏覽器視窗的介面，改成貼著 9:16 的框 */
  #stage #title, #stage #info, #stage #hud, #stage #panel,
  #stage #mapbox, #stage #hint, #stage #prompt, #stage #toast { position:absolute; }
  #stage #shop, #stage #loading, #stage #broke, #stage #polishStage { position:absolute; inset:0; }
  /* 商店和補助金面板一定要蓋在所有按鈕上面（look.js 會把 shop 的圖層設成 10，這裡強制拉高） */
  #stage #shop, #stage #broke { z-index:60 !important; }
  #stage #polishStage { z-index:68 !important; }
  /* 商店開啟時保留下方錢包列；商店與打磨遮罩只蓋到錢包列上緣。 */
  #stage.shopOpen #shop, #stage.shopOpen #polishStage { bottom:47px; }
  #stage.shopOpen #betbar { z-index:72;box-shadow:0 -5px 18px rgba(0,0,0,.55); }

  /* 直式畫面比較窄，介面重新排過，避免互相壓到 */
  #stage #title { display:none; }                       /* 開發用標題，玩的時候不需要 */
  /* 上方背包列放大約 1.5 倍；壓縮橫向空隙，直式手機仍能完整顯示。 */
  #stage #hud { top:8px; gap:2px; font-size:18px; }
  #stage #hud .box { padding:8px 5px; border-radius:10px; }
  #stage #hud .coin { font-size:21px; }
  #stage #hud .hore { margin-right:1px; }
  #stage #hud .hore img { width:31px; height:31px; margin-right:0; }
  #stage #hud .hpk { margin-right:1px; }
  #stage #hud .hpk img { width:28px; height:28px; vertical-align:-7px; }
  #stage #hud .hsep { height:21px; margin:0 3px; }
  #stage #info { font-size:10px; line-height:1.5; top:46px; right:10px; opacity:.45; }
  #stage #info { display:none; }      /* 座標／FPS／礦石數量：開發用資訊，玩的時候不顯示 */
  #stage #mapbox { left:10px; top:46px; bottom:auto; padding:4px; }
  #stage #mapbox { display:none; }    /* 小地圖：先從畫面上拿掉（想加回來刪掉這行即可） */
  #stage #minimap { width:92px; height:92px; }
  /* ===== 底部數值列（錢包 / BET）—— 配置參考「打殭屍」 ===== */
  #stage #betbar { position:absolute; left:0; right:0; bottom:0; z-index:12;
                   display:flex; justify-content:space-between; align-items:center;
                   padding:10px 14px; background:#0a0e14;
                   border-top:1px solid rgba(255,210,77,.22);
                   color:#ffd24d; font-weight:bold; font-size:15px;
                   pointer-events:none; }
  #stage #betbar .label { color:#c98b2e; font-size:.68em; margin-right:5px; letter-spacing:1px; }
  #stage #betbar .v  { color:#fff; text-shadow:0 1px 2px #000; }
  #stage #betbar .pk { color:#ffd24d; font-size:.78em; margin-right:6px; }
  #stage #betbar img { height:26px; width:26px; object-fit:contain; vertical-align:middle;
                       margin-right:4px; filter:drop-shadow(0 1px 2px rgba(0,0,0,.7)); }

  /* 其他底部介面全部往上挪，讓出橫條的位置 */
  #stage #hint { display:none; }          /* 靜態說明列拿掉，改用常駐按鈕 */
  #stage #prompt { bottom:120px; font-size:12px; padding:7px 14px; min-width:170px; }

  /* ===== 常駐操作列：開採大按鈕 ＋ 換十字鎬小按鈕 ===== */
  #stage #actbar { position:absolute; left:0; right:0; bottom:54px; z-index:14;
                   display:flex; justify-content:center; align-items:center;
                   gap:10px; pointer-events:none; }

  #stage #mineBtn { position:relative; overflow:hidden; pointer-events:auto;
                    width:158px; height:54px; border-radius:27px; cursor:pointer;
                    display:flex; align-items:center; justify-content:center;
                    font-size:17px; font-weight:700; letter-spacing:3px;
                    font-family:inherit; user-select:none;
                    transition:transform .08s, box-shadow .25s, background .25s; }
  #stage #mineBtn .fill { position:absolute; left:0; top:0; bottom:0; width:0;
                          background:rgba(255,255,255,.30); transition:width .06s linear; }
  #stage #mineBtn .txt  { position:relative; z-index:1; }
  #stage #mineBtn .minePick { display:none; position:relative; z-index:2;width:45px;height:45px;
                              object-fit:contain;transform-origin:72% 78%;
                              filter:drop-shadow(0 3px 3px rgba(0,0,0,.72)) drop-shadow(0 0 5px rgba(255,210,100,.32)); }
  #stage #mineBtn.busy .txt, #stage #mineBtn.busy .fill { display:none; }
  #stage #mineBtn.busy .minePick { display:block;animation:mineButtonPickSwing var(--mine-swing,.55s) ease-in-out infinite; }
  #stage #mineBtn.busy::after { content:'';position:absolute;left:64%;top:57%;z-index:3;width:5px;height:5px;
    border-radius:50%;background:#fff3b0;box-shadow:0 0 7px #ffd45e,-7px -5px 0 -1px #ffcb50,
    7px -8px 0 -1px #fff0a0,9px 2px 0 -2px #ff9f31;
    animation:mineButtonImpact var(--mine-swing,.55s) ease-out infinite; }
  @keyframes mineButtonPickSwing {
    0%,100% { transform:translate(-5px,4px) rotate(-34deg) scale(.94); }
    46% { transform:translate(5px,-3px) rotate(24deg) scale(1.04); }
    58% { transform:translate(2px,0) rotate(13deg) scale(1); }
  }
  @keyframes mineButtonImpact {
    0%,39%,100% { opacity:0;transform:scale(.2); }
    46% { opacity:1;transform:scale(1.35); }
    62% { opacity:0;transform:scale(2); }
  }

  #stage #mineBtn.off   { background:#1a2030; color:#59606f; border:1px solid #2b3344;
                          box-shadow:none; cursor:default; }
  #stage #mineBtn.ready { background:linear-gradient(#ffd24d,#e89b1c); color:#3d2600;
                          border:1px solid #ffe9a8; box-shadow:0 0 20px rgba(255,200,70,.5); }
  #stage #mineBtn.busy  { background:linear-gradient(#c98b2e,#8f5f16); color:#fff3d6;
                          border:1px solid #ffd79a; }
  #stage #mineBtn.shop  { background:linear-gradient(#7ee08a,#2f9e48); color:#0d2a14;
                          border:1px solid #b9f3c2; box-shadow:0 0 20px rgba(120,230,140,.4); }
  #stage #mineBtn.ready:active, #stage #mineBtn.shop:active,
  #stage #mineBtn.busy:active { transform:scale(.95); }

  #stage #pickBtn { pointer-events:auto; width:54px; height:54px; border-radius:50%;
                    background:rgba(12,16,24,.85); border:1px solid rgba(255,210,77,.42);
                    cursor:pointer; display:flex; align-items:center; justify-content:center;
                    transition:transform .08s; }
  #stage #pickBtn img { width:36px; height:36px; object-fit:contain;
                        filter:drop-shadow(0 1px 3px rgba(0,0,0,.8)); }
  #stage #pickBtn:active { transform:scale(.94); }
  #stage #pickBtn.open { border-color:#ffd24d; box-shadow:0 0 14px rgba(255,210,77,.45); }

  /* ===== TURBO 開關（開採鈕右邊）：開啟後挖到的礦當場賣掉 ===== */
  #stage #turboBtn { pointer-events:auto; width:54px; height:54px; border-radius:50%; cursor:pointer;
                     display:flex; flex-direction:column; align-items:center; justify-content:center;
                     background:rgba(12,16,24,.85); border:1px solid rgba(160,170,190,.35);
                     color:#6f7686; user-select:none;
                     transition:transform .08s, background .25s, border-color .25s; }
  #stage #turboBtn .bolt { font-size:18px; line-height:1; filter:grayscale(1) brightness(.75); }
  #stage #turboBtn .lbl  { font-size:9px; font-weight:700; letter-spacing:1px; margin-top:2px; }
  #stage #turboBtn:active { transform:scale(.94); }
  #stage #turboBtn.on { background:linear-gradient(#ffb23a,#e0621c); color:#3a1500; border-color:#ffe2a8;
                        animation:turboPulse 1.4s ease-in-out infinite; }
  #stage #turboBtn.on .bolt { filter:none; }
  @keyframes turboPulse { 0%,100% { box-shadow:0 0 10px rgba(255,150,40,.45); }
                          50%     { box-shadow:0 0 24px rgba(255,170,60,.85); } }

  /* 畫面比較窄（手機）時縮小按鈕，避免跟最左邊的齒輪、最右邊的商店鈕重疊 */
  #stage.narrow #actbar { gap:7px; }
  #stage.narrow #mineBtn { width:118px; }
  #stage.narrow #turboBtn, #stage.narrow #pickBtn { width:48px; height:48px; }
  #stage.narrow #pickBtn img { width:32px; height:32px; }
  #stage.tiny #actbar { gap:5px; }
  #stage.tiny #mineBtn { width:100px; letter-spacing:1px; }

  /* ===== 商店按鈕（最右邊）：不用走回去，點了直接開商店 ===== */
  #stage #shopBtn { position:absolute; right:10px; bottom:54px; z-index:30;
                    width:54px; height:54px; border-radius:50%; cursor:pointer;
                    background:rgba(12,16,24,.85); border:1px solid rgba(126,224,138,.55);
                    color:#9ff0aa; font-size:13px; font-weight:700; letter-spacing:1px;
                    display:flex; align-items:center; justify-content:center;
                    user-select:none; transition:transform .08s; }
  #stage #shopBtn:hover { background:rgba(30,48,36,.9); }
  #stage #shopBtn:active { transform:scale(.94); }

  /* ===== 換十字鎬的小面板 ===== */
  #stage #pickPanel { position:absolute; left:50%; transform:translateX(-50%);
                      bottom:120px; z-index:22; width:min(286px,88%); display:none;
                      background:rgba(12,16,24,.95); border:1px solid rgba(255,210,77,.32);
                      border-radius:12px; padding:10px; backdrop-filter:blur(6px);
                      box-shadow:0 12px 40px rgba(0,0,0,.6); }
  #stage #pickPanel.open { display:block; }
  #stage #pickPanel .ptitle { font-size:11px; color:#c98b2e; letter-spacing:1px;
                              text-align:center; margin-bottom:8px; }
  #stage .prow { display:flex; align-items:center; gap:8px; padding:6px 8px;
                 border-radius:8px; cursor:pointer; font-size:13px; }
  #stage .prow:hover { background:rgba(255,255,255,.07); }
  #stage .prow img { width:32px; height:32px; object-fit:contain; flex:none; }
  #stage .prow .pn { flex:1; color:#e8e2d6; }
  #stage .prow .pv { color:#ffd44d; font-size:12px; }
  #stage .prow .ps { font-size:10px; color:#7f7a6c; width:36px; text-align:right; }
  #stage .prow.eq { background:rgba(255,210,77,.15); }
  #stage .prow.eq .pn { color:#ffd24d; }
  #stage .prow.lock { opacity:.35; cursor:not-allowed; }
  /* 全螢幕商店：內容可以捲動，但下方中央的關閉鍵永遠留在原位。 */
  #stage #shop { align-items:stretch; justify-content:stretch; background:transparent; }
  #stage #shopwin { width:100%; height:100%; max-height:none; padding:10px 10px 82px;
                    position:relative; border:0; border-radius:0; }
  #stage #shopwin h2 { font-size:17px; }
  #stage #shopwin .sub { font-size:10px; margin-bottom:6px; }
  #stage #shopwin h3 { margin:7px 0 5px; padding-bottom:4px; font-size:11px; }
  #stage #sellList, #stage #buyList { grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; }
  #stage #sellList .row { grid-template-columns:32px minmax(0,1fr); grid-template-areas:
    "ore name" "ore mult" "actions actions"; min-height:82px; padding:5px; column-gap:6px; }
  #stage #sellList .oreimg { width:32px; height:32px; }
  #stage #sellList .val { grid-area:name; justify-self:end; align-self:start; font-size:10px; }
  #stage #sellList .nm { padding-right:42px; font-size:11px; }
  #stage #sellList .num { font-size:10px; }
  #stage #sellList .actions { width:100%; justify-content:stretch; }
  #stage #sellList .actions button { flex:1; padding:4px 3px; font-size:10px; }
  #stage .row .orestate { font-size:8px; white-space:nowrap; }
  #stage #buyList .pickrow { min-height:86px; padding:6px; gap:5px; }
  #stage #buyList .pickimg { width:34px; height:34px; }
  #stage #buyList .pname { font-size:11px; }
  #stage #buyList .pprice, #stage #buyList .pstock { font-size:9px; }
  #stage #buyList .pdesc { display:none; }
  #stage #buyList .pbot { margin-top:2px; }
  #stage #buyList .pbtns { width:100%; display:grid; grid-template-columns:repeat(3,1fr); gap:3px; }
  #stage #buyList .pbtns button { min-width:0; padding:4px 1px; font-size:9px; }
  #stage #shopwin > .hintline { display:none; }
  #stage #shopwin .foot { margin-top:7px; }
  #stage #shopwin .foot #sellall { padding:6px 18px; }
  #stage #shopclose { position:absolute; left:50%; bottom:14px; transform:translateX(-50%);
                      width:54px; height:54px; border-radius:50%;
                      background:linear-gradient(#4a5872,#252f45); border:2px solid #d8b86f;
                      box-shadow:0 5px 16px rgba(0,0,0,.62),0 0 14px rgba(255,210,110,.22);
                      color:#fff0bf; font-size:23px; line-height:50px; text-align:center;
                      cursor:pointer; z-index:8; }
  #stage #shopclose:hover { filter:brightness(1.12); }
  #stage #shopclose:active { transform:translateX(-50%) scale(.94); }
  #stage #toast { bottom:120px; font-size:14px; }

  /* 控制面板：平常收起來，按右下角的齒輪才打開，才不會擋畫面 */
  #stage #gear { position:absolute; left:10px; bottom:54px; z-index:30;
                 width:54px; height:54px; border-radius:50%; cursor:pointer;
                 background:rgba(12,16,24,.85); border:1px solid rgba(255,210,77,.42);
                 display:flex; flex-direction:column; align-items:center; justify-content:center;
                 gap:4px; user-select:none; transition:transform .08s; }
  /* 三條線的漢堡圖示 */
  #stage #gear i { display:block; width:20px; height:2.5px; border-radius:2px; background:#ffd79a; }
  #stage #gear:active { transform:scale(.94); }
  #stage #gear.open { border-color:#ffd24d; box-shadow:0 0 14px rgba(255,210,77,.45); }
  #stage.narrow #gear { width:48px; height:48px; gap:3.5px; }
  /* 手機尺寸：商店鈕也跟著縮成 48，兩顆邊邊的按鈕往上 3px，四顆的中心才會對齊 */
  #stage.narrow #shopBtn { width:48px; height:48px; font-size:12px; }
  #stage.narrow #gear, #stage.narrow #shopBtn { bottom:57px; }
  #stage.narrow #gear i { width:18px; }
  #stage #panel { left:10px; right:auto; bottom:118px; display:none; flex-direction:column;
                  gap:5px; padding:8px; align-items:stretch; width:176px; z-index:30; }
  #stage #panel.open { display:flex; }
  #stage #panel .btnrow { display:flex; gap:5px; }
  #stage #panel button { flex:1; background:#24354d; color:#ffe0ad; border:1px solid #65738a;
                  border-radius:5px; padding:5px 0; cursor:pointer; font-size:12px;
                  font-family:inherit; min-width:30px; }
  #stage #panel > button { font-size:10px; padding:4px 0; opacity:.65; }
  #stage #panel button:hover { background:#3b4d6b; }
  #stage #panel label { font-size:10px; display:block; }
  #stage #panel input { width:100%; margin:4px 0 0 0; }
  #stage #panel .win-test-title { margin-top:3px; padding-top:6px; border-top:1px solid rgba(255,255,255,.12);
                                  color:#ffd76b; font-size:9px; text-align:center; letter-spacing:1px; }
  #stage #panel .win-test-row button { padding:5px 2px; font-size:9px; font-weight:800; }
  #stage #panel #testWin { color:#ffe29a; border-color:#9b793a; }
  #stage #panel #testBigWin { color:#ffc068; border-color:#b86136; }
  #stage #panel #testSuperWin { color:#9bf6ff; border-color:#7663be; }

  /* ===== 新圖片式按鈕外觀 =====
     四顆圓形按鈕共用 button.png；中央動作鈕使用 button_spin.png。 */
  #stage #gear, #stage #turboBtn, #stage #pickBtn, #stage #shopBtn {
    background-color:transparent;
    background-image:url('images/button.png');
    background-position:center !important;
    background-repeat:no-repeat !important;
    background-size:100% 100% !important;
    border:0;
    box-shadow:none;
  }
  #stage #gear.open, #stage #pickBtn.open {
    border:0;
    box-shadow:0 0 14px rgba(255,203,92,.52);
  }
  #stage #turboBtn.on {
    background-color:transparent;
    background-image:url('images/button.png');
    border:0;
    color:#ffd56a;
    filter:brightness(1.18) saturate(1.25);
    background-position:center !important;
    background-repeat:no-repeat !important;
    background-size:100% 100% !important;
  }
  #stage #shopBtn:hover {
    background-color:transparent;
    background-image:url('images/button.png');
    filter:brightness(1.12);
    background-position:center !important;
    background-repeat:no-repeat !important;
    background-size:100% 100% !important;
  }

  #stage #mineBtn,
  #stage #mineBtn.off, #stage #mineBtn.ready,
  #stage #mineBtn.busy, #stage #mineBtn.shop, #stage #mineBtn.sleep {
    width:144px;
    height:65px;
    border:0;
    border-radius:0;
    background-color:transparent !important;
    background-image:url('images/button_spin.png') !important;
    background-position:center;
    background-repeat:no-repeat;
    background-size:100% 100%;
    box-shadow:none;
    color:#f6e8c4;
    text-shadow:0 2px 3px rgba(0,0,0,.72);
  }
  #stage #mineBtn.off { filter:grayscale(.38) brightness(.62); color:#9ca3b1; }
  #stage #mineBtn.ready { filter:brightness(1.08); }
  #stage #mineBtn.busy { filter:brightness(.92) saturate(1.2); }
  #stage #mineBtn.shop { filter:hue-rotate(48deg) brightness(1.02); }
  /* 睡覺不是開採：改用乾淨的月夜按鈕，不再顯示被拉伸的水晶 spin 圖。 */
  #stage #mineBtn.sleep {
    width:140px;
    height:58px;
    border:2px solid #e5c47a;
    border-radius:29px;
    background-image:none !important;
    background:linear-gradient(180deg,#32466d 0%,#1a2948 54%,#101b33 100%) !important;
    color:#fff0bf;
    filter:none;
    box-shadow:0 0 0 2px rgba(74,50,25,.72),0 5px 12px rgba(0,0,0,.46),
      inset 0 1px 0 rgba(255,255,255,.20),0 0 16px rgba(255,210,110,.24);
    text-shadow:0 2px 3px rgba(0,0,0,.82);
  }
  #stage #mineBtn.sleep::before {
    content:'☾';
    margin-right:9px;
    color:#ffd978;
    font-size:22px;
    line-height:1;
    text-shadow:0 0 9px rgba(255,211,112,.62);
  }
  #stage #mineBtn.sleep .fill { display:none; }
  #stage #mineBtn.sleep .txt { transform:none; }
  #stage #mineBtn.sleep:active { transform:scale(.96); }
  #stage #mineBtn .fill {
    left:7%; top:19%; bottom:19%;
    transform:scaleX(.86); transform-origin:left center;
    background:rgba(121,213,255,.34);
    border-radius:22px;
  }
  #stage #mineBtn .txt { transform:translateY(-1px); }

  #stage.narrow #mineBtn { width:132px; height:60px; }
  #stage.narrow #mineBtn.sleep { width:132px; height:56px; }
  #stage.tiny #mineBtn { width:120px; height:55px; letter-spacing:1px; }
  #stage.tiny #mineBtn.sleep { width:120px; height:52px; }
`;
document.head.appendChild(style);

// 把畫面和所有介面搬進 9:16 的框裡
stage.appendChild(renderer.domElement);
['#title', '#info', '#hud', '#panel', '#mapbox', '#hint', '#prompt', '#toast', '#shop', '#broke', '#polishStage', '#loading']
  .forEach(sel => { const el = document.querySelector(sel); if (el) stage.appendChild(el); });

const ASPECT = 9 / 16;
function fitStage() {
  let w, h;
  if (innerWidth / innerHeight > ASPECT) { h = innerHeight; w = h * ASPECT; }
  else                                   { w = innerWidth;  h = w / ASPECT; }
  w = Math.floor(w); h = Math.floor(h);
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  renderer.setSize(w, h);          // ← 一定要讓 three.js 連畫布的行內尺寸一起改，
                                   //   否則畫布會停在全螢幕大小，被 9:16 的框裁掉
  camera.aspect = ASPECT;
  camera.updateProjectionMatrix();
}
// 這個 listener 比 index.html 的晚註冊，所以會後蓋過它 —— 尺寸以我們為準
addEventListener('resize', fitStage);
fitStage();

// 直式畫面較窄，鏡頭拉近一點角色才不會太小
G.camDist = 0.92;

/* ============================================================
   2. 走得到哪裡：把礦坑整理成一張「可走格子表」
   直接借用 index.html 的 blocked()，所以判斷跟實際碰撞完全一致。
   ============================================================ */
const STEP = CAVERN.step;
const key = (cx, cz) => cx + ',' + cz;
const DIRS8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const walkable = new Set();
{
  const candidates = new Set(CAVERN.cells.map(c => key(c[0], c[1])));
  // 木橋那塊在 CAVERN.cells 裡沒有，要另外補進來
  const B = CAVERN.bridge;
  for (let cx = Math.floor(B[0] / STEP); cx <= Math.ceil(B[1] / STEP); cx++)
    for (let cz = Math.floor(B[2] / STEP); cz <= Math.ceil(B[3] / STEP); cz++)
      candidates.add(key(cx, cz));

  candidates.forEach(k => {
    const [cx, cz] = k.split(',').map(Number);
    if (!blocked(cx * STEP, cz * STEP)) walkable.add(k);   // 站得住才收
  });
}
// 只保留「從出生點真的走得到」的那一片區域。
// 礦坑角落偶爾會出現與外界隔絕的小口袋，先剔除，
// 點下去才不會出現「找不到路」的紅圈。
{
  const start = (() => {
    const bx = Math.round(CAVERN.spawn[0] / STEP), bz = Math.round(CAVERN.spawn[1] / STEP);
    return key(bx, bz);
  })();
  const reach = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const [cx, cz] = queue.pop().split(',').map(Number);
    for (const [dx, dz] of DIRS8) {
      const nk = key(cx + dx, cz + dz);
      if (reach.has(nk) || !walkable.has(nk)) continue;
      if (dx && dz && (!walkable.has(key(cx + dx, cz)) || !walkable.has(key(cx, cz + dz)))) continue;
      reach.add(nk); queue.push(nk);
    }
  }
  walkable.forEach(k => { if (!reach.has(k)) walkable.delete(k); });
}
console.log('可行走格子：' + walkable.size + ' 格');

// 找出離某個世界座標最近、而且站得住的格子
function nearestWalkable(wx, wz) {
  const bx = Math.round(wx / STEP), bz = Math.round(wz / STEP);
  if (walkable.has(key(bx, bz))) return [bx, bz];
  for (let r = 1; r <= 14; r++) {
    let best = null, bestD = Infinity;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;   // 只看這一圈
        const k = key(bx + dx, bz + dz);
        if (!walkable.has(k)) continue;
        const d = Math.hypot(dx, dz);
        if (d < bestD) { bestD = d; best = [bx + dx, bz + dz]; }
      }
    if (best) return best;
  }
  return null;
}

/* ============================================================
   3. 自動找路（A* 演算法）
   簡單說：從腳下的格子一格一格往外找，每次都優先展開
   「已走距離 + 直線估計距離」最小的那一格，直到碰到目的地。
   找到的路一定是最短的，而且絕對不會穿牆。
   ============================================================ */
const DIRS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],
              [1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];

function findPath(fromX, fromZ, toX, toZ) {
  const start = nearestWalkable(fromX, fromZ);
  const goal  = nearestWalkable(toX, toZ);
  if (!start || !goal) return null;

  const sk = key(start[0], start[1]), gk = key(goal[0], goal[1]);
  if (sk === gk) return [{ x: goal[0] * STEP, z: goal[1] * STEP }];

  const h = (cx, cz) => Math.hypot(cx - goal[0], cz - goal[1]);
  const g = new Map([[sk, 0]]);
  const prev = new Map();
  const open = [{ k: sk, cx: start[0], cz: start[1], f: h(start[0], start[1]) }];
  const closed = new Set();
  let guard = 0;

  while (open.length && guard++ < 20000) {
    // 挑出 f 最小的那一格
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.k === gk) break;
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);

    for (const [dx, dz, cost] of DIRS) {
      const nx = cur.cx + dx, nz = cur.cz + dz, nk = key(nx, nz);
      if (!walkable.has(nk) || closed.has(nk)) continue;
      // 斜走時，兩側的直角方向也要通，才不會從牆角縫鑽過去
      if (dx && dz && (!walkable.has(key(cur.cx + dx, cur.cz)) ||
                       !walkable.has(key(cur.cx, cur.cz + dz)))) continue;
      const ng = g.get(cur.k) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        prev.set(nk, cur.k);
        open.push({ k: nk, cx: nx, cz: nz, f: ng + h(nx, nz) });
      }
    }
  }

  if (!prev.has(gk) && sk !== gk) return null;      // 走不到（例如點到岩壁深處）

  const path = [];
  let k = gk;
  while (k && k !== sk) {
    const [cx, cz] = k.split(',').map(Number);
    path.unshift({ x: cx * STEP, z: cz * STEP });
    k = prev.get(k);
  }
  return path.length ? path : null;
}

/* 兩點之間有沒有障礙物（用來把路徑拉直，走起來才不會鋸齒狀） */
function lineClear(ax, az, bx, bz) {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(dist / 0.18);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}
function smooth(path, fromX, fromZ) {
  const out = [];
  let cx = fromX, cz = fromZ, i = 0;
  while (i < path.length) {
    let far = i;
    for (let j = path.length - 1; j > i; j--) {
      if (lineClear(cx, cz, path[j].x, path[j].z)) { far = j; break; }
    }
    out.push(path[far]);
    cx = path[far].x; cz = path[far].z;
    i = far + 1;
  }
  return out;
}

/* ============================================================
   4. 點擊的目標標記（地上的光圈）
   ============================================================ */
const markGeo = new THREE.RingGeometry(0.30, 0.42, 26);
const markMat = new THREE.MeshBasicMaterial({
  color: 0xffd79a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
});
const marker = new THREE.Mesh(markGeo, markMat);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.05;
scene.add(marker);
let markTime = 0;

/* ============================================================
   5. 點擊 → 走過去
   ============================================================ */
let path = [];              // 還沒走完的路徑點
let goalOre = null;         // 這次是不是要去挖某顆礦
let goalShop = false;

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

function cancelGoal() { path = []; goalOre = null; goalShop = false; G.moveDir = null;
                        P.mineRequested = false; }   // 一移動就停止開採

renderer.domElement.addEventListener('pointerdown', e => {
  if (P.shopOpen || P.brokeOpen || P.sleeping) return;
  e.preventDefault();

  const r = renderer.domElement.getBoundingClientRect();
  ndc.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
  ndc.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);

  const p = G.player.position;
  let targetX, targetZ;
  cancelGoal();

  /* --- 先看有沒有點到礦石 --- */
  const oreHits = ray.intersectObjects(MINING.ores.map(o => o.mesh), true);
  if (oreHits.length) {
    let node = oreHits[0].object;
    const ore = MINING.ores.find(o => {
      let n = node; while (n) { if (n === o.mesh) return true; n = n.parent; } return false;
    });
    if (ore) {
      goalOre = ore;
      // 停在礦石前面一點點，不要卡進岩壁裡
      const dx = p.x - ore.x, dz = p.z - ore.z, d = Math.hypot(dx, dz) || 1;
      targetX = ore.x + dx / d * 1.15;
      targetZ = ore.z + dz / d * 1.15;
    }
  }

  /* --- 沒點到礦石就看地面 --- */
  if (targetX === undefined) {
    if (!ray.ray.intersectPlane(groundPlane, hitPoint)) return;
    targetX = hitPoint.x; targetZ = hitPoint.z;
    // 點在商店附近就當作要去買賣
    if (Math.hypot(targetX - MINING.SHOP.x, targetZ - MINING.SHOP.z) < 2.6) {
      goalShop = true;
      targetX = MINING.SHOP.x; targetZ = MINING.SHOP.z + 1.6;
    }
  }

  const raw = findPath(p.x, p.z, targetX, targetZ);
  if (!raw) { flashMarker(targetX, targetZ, 0xff7a6a); cancelGoal(); return; }

  path = smooth(raw, p.x, p.z);
  flashMarker(path[path.length - 1].x, path[path.length - 1].z,
              goalOre ? goalOre.type.color : (goalShop ? 0xffd44d : 0xffd79a));
}, { passive: false });

function flashMarker(x, z, color) {
  marker.position.set(x, 0.05, z);
  markMat.color.setHex(color);
  markMat.opacity = 0.95;
  markTime = 1;
}

/* ============================================================
   6. 每一格：沿著路徑走
   ============================================================ */
const ARRIVE = 0.22;

function step() {
  requestAnimationFrame(step);

  // 目標光圈慢慢淡掉、慢慢轉
  if (markTime > 0) {
    markTime -= 0.016;
    markMat.opacity = Math.max(0, markTime) * (path.length ? 0.85 : 0.5);
    marker.rotation.z += 0.03;
    marker.scale.setScalar(1 + (1 - markTime) * 0.35);
  } else if (markMat.opacity) markMat.opacity = 0;

  if (P.shopOpen || P.brokeOpen || P.sleeping) { G.moveDir = null; goalShop = false; P.autoAct = false; return; }

  const p = G.player.position;

  /* --- 鍵盤優先：只要按了 WASD 就取消自動走路 --- */
  if (G.keys['KeyW'] || G.keys['KeyS'] || G.keys['KeyA'] || G.keys['KeyD'] ||
      G.keys['ArrowUp'] || G.keys['ArrowDown'] || G.keys['ArrowLeft'] || G.keys['ArrowRight']) {
    if (path.length) cancelGoal();
    return;
  }

  if (!path.length) {
    G.moveDir = null; G.moveRun = false;
    // 已經走到礦石／商店前面時，要保留「開始動作」的旗標，
    // 讓 mining.js 有機會接手，不能在這裡清掉。
    if (!goalOre && !goalShop) P.autoAct = false;
    return;
  }

  /* --- 抄近路：能直線看到後面的點就跳過中間的 --- */
  while (path.length > 1 && lineClear(p.x, p.z, path[1].x, path[1].z)) path.shift();

  const wp = path[0];
  const dx = wp.x - p.x, dz = wp.z - p.z;
  const dist = Math.hypot(dx, dz);

  if (dist < ARRIVE) {
    path.shift();
    if (!path.length) return arrive();
    return;
  }

  G.moveDir = { x: dx / dist, z: dz / dist };
  // 路還很長就用跑的
  G.moveRun = (dist + (path.length - 1) * 1.2) > 4;
}

/* --- 走到目的地之後要做什麼 --- */
function arrive() {
  G.moveDir = null; G.moveRun = false;
  if (goalOre) {
    // 走到了就好 —— 開採交給下面那顆按鈕（它會自己亮起來）
    goalOre = null;
  } else if (goalShop) {
    P.autoAct = true;      // mining.js 看到這個旗標就會開店（開了才清）
  }
}

/* --- 礦挖完了（或礦不見了）就收手 --- */
setInterval(() => {
  if (goalOre && !MINING.ores.includes(goalOre)) { goalOre = null; P.autoAct = false; }
}, 200);

requestAnimationFrame(step);

/* ============================================================
   7. 只用滑鼠也能縮放、轉鏡頭的按鈕
   ============================================================ */
{
  const panel = document.getElementById('panel');
  const row = document.createElement('div');
  row.className = 'btnrow';
  row.innerHTML = `<button id="zin">＋</button><button id="zout">－</button>
                   <button id="rotl">⟲</button><button id="rotr">⟳</button>`;
  panel.prepend(row);
  const clamp = v => Math.max(0.55, Math.min(2.6, v));
  document.getElementById('zin').onclick  = () => { G.camDist = clamp(G.camDist - 0.18); };
  document.getElementById('zout').onclick = () => { G.camDist = clamp(G.camDist + 0.18); };
  document.getElementById('rotl').onclick = () => { G.camAngle += 0.35; };
  document.getElementById('rotr').onclick = () => { G.camAngle -= 0.35; };

  const testTitle = document.createElement('div');
  testTitle.className = 'win-test-title';
  testTitle.textContent = '大獎動畫測試';
  const testRow = document.createElement('div');
  testRow.className = 'btnrow win-test-row';
  testRow.innerHTML = `<button id="testWin">WIN</button><button id="testBigWin">BIG</button>
                       <button id="testSuperWin">SUPER</button>`;
  row.after(testTitle, testRow);
  document.getElementById('testWin').onclick = () => MINING.testWinReward('win');
  document.getElementById('testBigWin').onclick = () => MINING.testWinReward('big');
  document.getElementById('testSuperWin').onclick = () => MINING.testWinReward('super');

  // 挖到好礦的「礦脈」演出（WIN 是賣出時才播的，兩者分開測試）
  const oreTitle = document.createElement('div');
  oreTitle.className = 'win-test-title';
  oreTitle.textContent = '礦脈動畫測試';
  const oreRow = document.createElement('div');
  oreRow.className = 'btnrow win-test-row';
  oreRow.innerHTML = `<button id="testG1">精良</button><button id="testG2">稀有</button>
                      <button id="testG3">史詩</button><button id="testG4">極品</button>`;
  testRow.after(oreTitle, oreRow);
  const grandSamples = [['testG1',3.2,1],['testG2',6.8,2],['testG3',14.5,3],['testG4',32,4]];
  grandSamples.forEach(([id, mult, oreIndex]) => {
    document.getElementById(id).onclick = () => MINING.testOreReward(mult, oreIndex, 2);
  });
}

/* 角色在昏暗的礦坑裡會整個黑掉，給他一點自體微光，
   讓主角在手機小畫面上永遠看得清楚（之後換成你的美術也適用） */
G.player.traverse(o => {
  if (o.isMesh && o.material && o.material.emissive) {
    o.material.emissive.copy(o.material.color).multiplyScalar(0.28);
    o.material.needsUpdate = true;
  }
});

/* 商店：把關閉鈕放在捲動內容外，固定於全螢幕商店下方中央。 */
{
  const shop = document.getElementById('shop');
  const win = document.getElementById('shopwin');
  const x = document.createElement('button');
  x.id = 'shopclose'; x.textContent = '✕';
  x.type = 'button'; x.setAttribute('aria-label', '關閉商店');
  x.onclick = () => MINING.closeShop();
  shop.appendChild(x);
  shop.addEventListener('pointerdown', e => {
    if (e.target.id === 'shop') MINING.closeShop();     // 點到外面的暗色區域
  });
}

/* 齒輪：收合控制面板 */
{
  const gear = document.createElement('div');
  gear.id = 'gear';
  gear.innerHTML = '<i></i><i></i><i></i>';        // 三條線的漢堡圖示
  gear.setAttribute('aria-label', '設定選單');
  stage.appendChild(gear);
  gear.onclick = () => {
    const open = document.getElementById('panel').classList.toggle('open');
    gear.classList.toggle('open', open);
  };
}

/* 商店按鈕：在地圖任何地方都能直接打開商店 */
{
  const btn = document.createElement('div');
  btn.id = 'shopBtn'; btn.textContent = '商店';
  stage.appendChild(btn);
  btn.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (P.shopOpen || P.brokeOpen || P.sleeping) return;
    const panel = document.getElementById('pickPanel');
    if (panel) panel.classList.remove('open');          // 換鎬面板開著就先收起來
    MINING.openShop();
  });
}

/* 常駐操作列：開採大按鈕 ＋ 換十字鎬（BET）小按鈕 */
{
  const bar = document.createElement('div');
  bar.id = 'actbar';
  bar.innerHTML =
    '<div id="pickBtn"><img id="pickBtnImg" src="images/pickaxe_wood.png" alt=""></div>' +
    '<div id="mineBtn" class="act off"><span class="fill"></span><img class="minePick" src="images/pickaxe_wood.png" alt=""><span class="txt">開　採</span></div>' +
    '<div id="turboBtn"><span class="bolt">⚡</span><span class="lbl">TURBO</span></div>';
  stage.appendChild(bar);

  // TURBO 開關
  const turbo = document.getElementById('turboBtn');
  const syncTurbo = () => turbo.classList.toggle('on', !!P.turbo);
  syncTurbo();                                   // 套用上次記住的設定
  turbo.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (P.shopOpen || P.brokeOpen || P.sleeping) return;
    MINING.setTurbo(!P.turbo);
    syncTurbo();
  });

  // 依 9:16 框的實際寬度切換按鈕大小
  const fitButtons = () => {
    const w = stage.clientWidth;
    stage.classList.toggle('narrow', w < 440);
    stage.classList.toggle('tiny', w < 360);
  };
  addEventListener('resize', fitButtons);
  fitButtons();

  const panel = document.createElement('div');
  panel.id = 'pickPanel';
  panel.innerHTML = '<div class="ptitle">選擇十字鎬　＝　每次開採的下注金額</div><div id="pickList"></div>';
  stage.appendChild(panel);

  const promptEl = document.getElementById('prompt');
  function closePanel() {
    panel.classList.remove('open');
    document.getElementById('pickBtn').classList.remove('open');
    if (promptEl) promptEl.style.visibility = '';
  }
  function openPanel() {
    MINING.renderPickList();
    panel.classList.add('open');
    document.getElementById('pickBtn').classList.add('open');
    if (promptEl) promptEl.style.visibility = 'hidden';   // 面板打開時先讓路
  }

  document.getElementById('mineBtn').addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (e.currentTarget.classList.contains('off')) return;   // 灰的就是按不下去
    closePanel();
    MINING.tapMine();
  });

  document.getElementById('pickBtn').addEventListener('pointerdown', e => {
    e.stopPropagation();
    panel.classList.contains('open') ? closePanel() : openPanel();
  });

  panel.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const row = e.target.closest('[data-pick]');
    if (row && MINING.equipPick(+row.dataset.pick)) closePanel();
  });

  // 點畫面其他地方就把面板收起來
  renderer.domElement.addEventListener('pointerdown', closePanel);
}

/* 底部數值列：左邊錢包、右邊目前的十字鎬（＝這一版的 BET） */
{
  const bar = document.createElement('div');
  bar.id = 'betbar';
  bar.innerHTML =
    '<div><span class="label">錢包</span><span class="v" id="walletVal">0</span></div>' +
    '<div><span class="label">BET</span><img id="betPickImg" src="images/pickaxe_wood.png" alt="">' +
    '<span class="pk" id="betPick">木十字鎬</span><span class="v" id="betVal">$100</span></div>';
  stage.appendChild(bar);
  if (window.MINING && MINING.refreshHUD) MINING.refreshHUD();   // 建好後立刻填入正確數字
}

/* 底下的說明改成滑鼠版 */
const hint = document.getElementById('hint');
if (hint) hint.innerHTML = '<b>點地面</b> 走過去　·　<b>點礦石</b> 自動開採　·　<b>點商店</b> 買賣';

})();
