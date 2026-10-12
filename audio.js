/* 礦坑背景音樂：瀏覽器會在玩家第一次操作後開始播放。 */
(() => {
  const STORAGE_KEY = 'mole-mine-bgm-muted';
  const music = document.createElement('audio');
  music.id = 'bgmAudio';
  music.src = 'music/tatamusic-fantasy-dreamy-adventure-music-440918.mp3';
  music.hidden = true;
  music.loop = true;
  music.preload = 'auto';
  music.volume = 0.22;

  let muted = localStorage.getItem(STORAGE_KEY) === '1';
  let started = false;
  music.muted = muted;
  document.body.appendChild(music);

  const button = document.createElement('button');
  button.id = 'bgmToggle';
  button.type = 'button';
  button.setAttribute('aria-label', '背景音樂開關');
  button.style.cssText = 'background:#24354d;color:#ffe0ad;border:1px solid #65738a;border-radius:6px;padding:6px 10px;cursor:pointer;white-space:nowrap';

  function updateButton() {
    button.textContent = muted ? '音樂：關' : '音樂：開';
    button.setAttribute('aria-pressed', String(!muted));
  }

  async function startMusic() {
    if (started || muted) return;
    try {
      await music.play();
      started = true;
    } catch (_) {
      // 等待下一次玩家互動；手機瀏覽器通常要求這麼做。
    }
  }

  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    muted = !muted;
    music.muted = muted;
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    updateButton();
    if (!muted) await startMusic();
  });

  const panel = document.getElementById('panel');
  if (panel) panel.insertBefore(button, panel.firstChild);
  updateButton();

  const unlock = () => startMusic();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.pause();
    else if (!muted) {
      started = false;
      startMusic();
    }
  });

  window.GAME_BGM = { music, start: startMusic };

  /* ---------- 遊戲音效 ---------- */
  const SFX_KEY = 'mole-mine-sfx-muted';
  let sfxMuted = localStorage.getItem(SFX_KEY) === '1';
  let sfxUnlocked = false;

  const footsteps = new Audio('sfx/footsteps-stone.mp3');
  const mining = new Audio('sfx/pickaxe-rock.mp3');
  const pickup = new Audio('sfx/ore-pickup.mp3');
  const uiClick = new Audio('sfx/ui-click.mp3');
  const interaction = new Audio('sfx/互動.mp3');
  const polish = new Audio('sfx/打磨.mp3');
  const crystal = new Audio('sfx/得到水晶.mp3');
  const menuOpen = new Audio('sfx/開選單.mp3');
  const sleep = new Audio('sfx/睡覺.mp3');
  const bonus = new Audio('sfx/bonus.mp3');
  const coin = new Audio('sfx/coin.mp3');
  const getCoin = new Audio('sfx/get-coin.mp3');
  const jackpot = new Audio('sfx/jackpot.mp3');
  const pop = new Audio('sfx/pop.mp3');
  const reward = new Audio('sfx/reward.wav');
  const allSfx = [footsteps, mining, pickup, uiClick, interaction, polish, crystal,
    menuOpen, sleep, bonus, coin, getCoin, jackpot, pop, reward];
  allSfx.forEach(a => { a.preload = 'auto'; a.muted = sfxMuted; });
  footsteps.loop = true;
  footsteps.volume = 0.32;   // 原本 0.10，比敲礦聲（0.28）小將近三倍，幾乎聽不到
  mining.loop = true;
  mining.volume = 0.28;
  pickup.volume = 0.28;
  uiClick.volume = 0.13;

  const sfxButton = document.createElement('button');
  sfxButton.id = 'sfxToggle';
  sfxButton.type = 'button';
  sfxButton.setAttribute('aria-label', '遊戲音效開關');
  sfxButton.style.cssText = button.style.cssText;
  function updateSfxButton() {
    sfxButton.textContent = sfxMuted ? '音效：關' : '音效：開';
    sfxButton.setAttribute('aria-pressed', String(!sfxMuted));
  }
  if (panel) panel.insertBefore(sfxButton, button.nextSibling);
  updateSfxButton();

  function unlockSfx() {
    if (sfxUnlocked) return;       // 只需要解鎖一次
    sfxUnlocked = true;
    // 注意：這裡不能呼叫 load()。load() 會把正在播的聲音直接清掉，
    // 而點擊移動每點一次地面就會觸發一次，腳步聲會一直被打斷、完全聽不到。
  }
  function playOnce(source, volume, rate = 1) {
    if (sfxMuted || !sfxUnlocked) return null;
    const a = source.cloneNode();
    a.volume = volume;
    a.playbackRate = rate;
    a.preservesPitch = false;
    a.play().catch(() => {});
    return a;
  }
  let activeMiningImpact = null;
  let miningImpactStopTimer = 0;
  function stopMiningImpact() {
    clearTimeout(miningImpactStopTimer);
    miningImpactStopTimer = 0;
    if (!activeMiningImpact) return;
    activeMiningImpact.pause();
    activeMiningImpact.currentTime = 0;
    activeMiningImpact = null;
  }
  function stopLoop(a) {
    if (!a.paused) a.pause();
    a.currentTime = 0;
  }

  sfxButton.addEventListener('click', event => {
    event.stopPropagation();
    sfxMuted = !sfxMuted;
    localStorage.setItem(SFX_KEY, sfxMuted ? '1' : '0');
    allSfx.forEach(a => { a.muted = sfxMuted; });
    if (sfxMuted) { stopLoop(footsteps); stopLoop(mining); stopMiningImpact(); stopCoworkerImpacts(); }
    else unlockSfx();
    updateSfxButton();
  });

  // 依操作類型分流；特效按鈕不再和通用點擊聲重疊。
  let lastSellSoundAt = -1e9;
  document.addEventListener('pointerdown', event => {
    unlockSfx();
    const target = event.target && event.target.closest ? event.target : null;
    if (!target || target.closest('#sfxToggle')) return;

    const sellBtn = target.closest('[data-sell],#sellall');
    if (sellBtn) {
      const hasOre = Object.values(window.P?.bag || {}).some(items => items.length);
      if (hasOre && performance.now() - lastSellSoundAt > 650) {
        lastSellSoundAt = performance.now();
        playOnce(coin, 0.20, 0.96 + Math.random() * 0.08);
      }
      return;
    }

    const mineBtn = target.closest('#mineBtn');
    if (mineBtn && window.P?.nearTent) {
      playOnce(sleep, 0.24, 1);
      return;
    }

    const opener = target.closest('#shopBtn,#gear,#pickBtn');
    if (opener) {
      const opening = opener.id === 'shopBtn' || !opener.classList.contains('open');
      playOnce(opening ? menuOpen : interaction, opening ? 0.18 : 0.14, 0.98 + Math.random() * 0.04);
      return;
    }

    if (target.closest('#shopclose,#closeshop,#mineBtn,#turboBtn,.prow[data-pick]')) {
      playOnce(interaction, 0.14, 0.97 + Math.random() * 0.06);
      return;
    }

    if (target.closest('button')) playOnce(uiClick, 0.12, 0.97 + Math.random() * 0.06);
  }, { passive: true });
  window.addEventListener('keydown', unlockSfx);

  window.addEventListener('polish-start', () => {
    playOnce(polish, 0.31, 0.98 + Math.random() * 0.04);
  });
  window.addEventListener('polish-reveal', event => {
    const tier = event.detail?.tier;
    playOnce(crystal, tier === 'perfect' ? .38 : (tier === 'success' ? .30 : .21),
      tier === 'perfect' ? 1.10 : (0.98 + Math.random() * .05));
    if (tier === 'perfect') setTimeout(() => playOnce(reward, .22, 1.05), 90);
  });

  // 每一下鎬尖真正碰到礦石時才播放撞擊聲；不再用一段循環音猜畫面節奏。
  window.addEventListener('mine-impact', event => {
    const detail = event.detail || {};
    const pick = Number(detail.pick) || 0;
    const finalHit = !!detail.finalHit;
    const heavy = !!detail.heavy;
    const volume = finalHit ? .43 : (heavy ? .35 : [.22,.25,.28,.31][pick]);
    const rateBase = [.90,.97,1.04,1.10][pick] || 1;
    // pickaxe-rock 是一段較長的錄音；每一下只取短促的撞擊頭，且先停掉上一下。
    // 這樣快速揮鎬也不會同時堆出數個持續播放的聲音。
    stopMiningImpact();
    activeMiningImpact = playOnce(mining, volume, rateBase + (Math.random() - .5) * .075);
    if (activeMiningImpact) {
      const thisImpact = activeMiningImpact;
      miningImpactStopTimer = setTimeout(() => {
        if (activeMiningImpact !== thisImpact) return;
        stopMiningImpact();
      }, finalHit ? 430 : 285);
    }
    if (finalHit && (Number(detail.rank) || 0) >= 2) {
      setTimeout(() => playOnce(crystal, .16 + Math.min(4, detail.rank) * .025, 1.02 + Math.random() * .08), 45);
    }
  });

  // 同事鼴鼠的敲礦聲：離得越近越大聲。
  // 事件由 mining.js 在牠們的鎬尖碰到岩石那一幀發出，所以聲音和畫面上的火花同步。
  const coworkerImpacts = new Map();
  window.addEventListener('coworker-impact', event => {
    const d = event.detail || {};
    const range = Number(d.range) || 9;
    const dist = Math.min(range, Math.max(0, Number(d.distance) || 0));
    const fade = Math.pow(1 - dist / range, 1.6);   // 越遠衰減越快
    if (fade <= .02) return;
    const key = d.index ?? 0;
    const prev = coworkerImpacts.get(key);
    if (prev) { clearTimeout(prev.timer); prev.audio.pause(); }
    // 三位同事用不同音高，站在一起時聽得出來是不同人。
    const rate = [.93, 1.00, 1.07][key % 3] * (.98 + Math.random() * .04);
    const a = playOnce(mining, .17 * fade, rate);
    if (!a) return;
    const timer = setTimeout(() => {
      const cur = coworkerImpacts.get(key);
      if (cur && cur.audio === a) { a.pause(); coworkerImpacts.delete(key); }
    }, 300);
    coworkerImpacts.set(key, { audio:a, timer });
  });
  function stopCoworkerImpacts() {
    coworkerImpacts.forEach(({ audio, timer }) => { clearTimeout(timer); audio.pause(); });
    coworkerImpacts.clear();
  }

  // 礦石展示、三階大獎與對話泡泡都有自己的聲音。
  const oreReward = document.getElementById('oreReward');
  if (oreReward) {
    let shown = oreReward.classList.contains('show');
    new MutationObserver(() => {
      const next = oreReward.classList.contains('show');
      if (next && !shown) {
        // 加強版「礦脈」演出等級越高，聲音疊得越多；
        // jackpot 留給賣出時的 SUPER WIN，兩種演出才不會聽起來一樣。
        const grade = ['g1','g2','g3','g4'].findIndex(c => oreReward.classList.contains(c));
        playOnce(crystal, 0.27 + Math.max(0, grade) * 0.025, grade >= 2 ? 1.06 : 0.98 + Math.random() * 0.04);
        if (grade === 0) setTimeout(() => playOnce(reward, 0.22, 1.04), 90);
        else if (grade === 1) setTimeout(() => playOnce(bonus, 0.26, 1.00), 80);
        else if (grade >= 2) {
          setTimeout(() => playOnce(bonus, 0.30, 0.96), 70);
          setTimeout(() => playOnce(reward, 0.24, 1.08), 270);
        }
      }
      shown = next;
    }).observe(oreReward, { attributes:true, attributeFilter:['class'] });
  }

  const winReward = document.getElementById('winReward');
  if (winReward) {
    let shown = winReward.classList.contains('show');
    new MutationObserver(() => {
      const next = winReward.classList.contains('show');
      if (next && !shown) {
        if (winReward.classList.contains('super')) playOnce(jackpot, 0.34, 1);
        else if (winReward.classList.contains('big')) playOnce(bonus, 0.32, 1);
        else playOnce(reward, 0.30, 1);
        setTimeout(() => playOnce(coin, winReward.classList.contains('super') ? 0.22 : 0.16, 1), 180);
      }
      shown = next;
    }).observe(winReward, { attributes:true, attributeFilter:['class'] });
  }

  document.querySelectorAll('#shopMoleTalk,.workerMoleTalk').forEach(bubble => {
    let lastLine = bubble.textContent.trim();
    new MutationObserver(() => {
      const line = bubble.textContent.trim();
      if (line && line !== lastLine && bubble.classList.contains('show')) {
        playOnce(pop, 0.075, 0.96 + Math.random() * 0.08);
      }
      lastLine = line;
    }).observe(bubble, { childList:true, characterData:true, subtree:true });
  });

  const hudBag = document.getElementById('hudBag');
  if (hudBag) {
    let lastPickupAt = -1e9;
    new MutationObserver(mutations => {
      if (!mutations.some(m => m.target.classList?.contains('oreCollected'))) return;
      const now = performance.now();
      if (now - lastPickupAt < 75) return;
      lastPickupAt = now;
      playOnce(pickup, 0.22, 0.98 + Math.random() * 0.08);
    }).observe(hudBag, { attributes:true, attributeFilter:['class'], subtree:true });
  }

  let wasWalking = false;
  let lastSold = 0;
  let lastFootTry = -1e9;   // 上次嘗試播放的時間（避免每幀狂叫 play）
  function sfxLoop(now) {
    requestAnimationFrame(sfxLoop);
    if (typeof G === 'undefined' || !G.player || !window.P) return;

    const speed = Math.hypot(G.vel?.x || 0, G.vel?.z || 0);
    const walking = speed > 0.018 && !P.shopOpen && !P.brokeOpen && !P.sleeping;
    const canPlay = !sfxMuted && sfxUnlocked;

    // 每一幀都檢查：只要正在走、聲音卻停著，就重新播放。
    // （舊寫法只在「剛開始走」的那一瞬間播一次，中途被打斷就整段路都不會再響）
    if (walking && canPlay) {
      footsteps.playbackRate = speed > 0.085 ? 1.16 : 0.92;
      if (footsteps.paused && now - lastFootTry > 300) {
        lastFootTry = now;
        if (!wasWalking) footsteps.currentTime = 0;
        footsteps.play().catch(() => {});
      }
    } else if (!footsteps.paused) stopLoop(footsteps);
    wasWalking = walking;

    // 敲礦改由 mine-impact 逐下觸發；確保舊版循環聲不會殘留。
    if (!mining.paused) stopLoop(mining);

    const sold = P.turboSold || 0;
    // TURBO 沒有飛入背包的動畫，直接用收款聲提示已自動賣出。
    if (sold > lastSold) playOnce(getCoin, 0.20, 0.99 + Math.random() * 0.04);
    lastSold = sold;
  }
  requestAnimationFrame(sfxLoop);

  window.GAME_SFX = { footsteps, mining, pickup, uiClick, interaction, polish, crystal,
    menuOpen, sleep, bonus, coin, getCoin, jackpot, pop, reward, playOnce };
})();
