/* ============================================================
   礦坑原型 · 美術層（打光 + 後製）
   ------------------------------------------------------------
   目標：做出參考圖那種「暖橘光池 × 冷藍岩石」的高對比感。
   三個關鍵：
     1. 冷暖分離 —— 環境光是冷藍的，只有燈籠是暖橘的
     2. Bloom 光暈 —— 燈籠和發光礦石會往外暈開（最像手繪的關鍵）
     3. 岩縫藍光 —— 深淵透出的藍光，讓畫面有層次
   想調整就改下面的設定區。
   ============================================================ */
(function () {

/* ============================================================
   ★ 設定區
   ============================================================ */
const BLOOM        = true;   // 光暈總開關（手機會吃效能，卡的話改成 false）
const BLOOM_POWER  = 0.445;  // 光暈強度（可在選單的「光暈」滑桿即時微調）
const BLOOM_SPREAD = 0.76;   // 保留柔暖光暈，也維持輪廓
const BLOOM_LIMIT  = 1.00;   // 讓燈芯、礦脈裂縫和晶體尖端發出彩色柔光
                             //  太低 → 連砂地都發光，整片糊成牛奶色
                             //  太高 → 完全看不到光暈
const EXPOSURE     = 0.645;  // 兩個版本的中間曝光值

const COOL_SKY   = 0x6385c4; // 介於深藍與柔藍之間
const COOL_FILL  = 0x1e335c; // 陰影可讀，但不會泛白
const WARM_BOUNCE= 0x6e4934; // 有暖度但不把整片地面染紅
const LANTERN    = 0xffa13a; // 路燈改為接近營火的暖金黃色

/* ============================================================
   1. 重新打光
   ============================================================ */
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EXPOSURE;
renderer.domElement.style.filter = 'saturate(1.25) contrast(1.04)';

// 環境光壓低、染成藍的 —— 陰影才會是藍的，不是灰的
ambient.color.set(COOL_FILL);
ambient.intensity = 0.102;

// 半球光：上面冷、下面暖。
// 這一盞是整張圖「冷暖分離」的主力 —— 岩石頂面偏藍，
// 靠近砂地的部分會被地面反彈的暖光照到。
// 注意：半球光的「天空色」是照在朝上的面 —— 也就是地板。
// 所以天空色不能太藍，否則砂地會被染成灰藍的（跟參考圖相反）。
const hemi = new THREE.HemisphereLight(COOL_SKY, WARM_BOUNCE, 0.195);
hemi.position.set(0, 30, 0);
scene.add(hemi);

// 主光：從上方偏側面下來，負責岩石的立體感和影子
sky.color.set(0x8aaeff);
sky.intensity = 0.34;
sky.position.set(-16, 30, 12);

// 角色頭燈原本是畫面上最銳利的圓形光斑；改成寬、淡、全柔邊的補光。
lamp.color.set(0xffb45b);
lamp.intensity = 0.42;
lamp.distance = 24;
lamp.angle = Math.PI / 2.7;
lamp.penumbra = 1.0;
lamp.decay = 1.45;
lamp.castShadow = false;
glow.color.set(0xff9b3d);
glow.intensity = 0.46;
glow.distance = 7;
glow.decay = 2;

// 霧：顏色跟深淵的藍一致，遠處才會自然融進去
scene.fog.color.set(0x0a2344);
scene.fog.density = 0.00795;
scene.background.set(0x061326);

/* --- 燈籠：參考圖裡最搶眼的元素，光池要大、要暖 --- */
const lanternLights = [];
CAVERN.lamps.forEach(([x, z]) => {
  // 把 index.html 原本那盞比較弱的點光源換掉
  const old = scene.children.find(c => c.isPointLight && Math.abs(c.position.x - x) < 0.01 &&
                                       Math.abs(c.position.z - z) < 0.01);
  if (old) scene.remove(old);

  // 亮度降低、範圍放大、衰減放慢，做出參考圖的大面積柔暖光池。
  const light = new THREE.PointLight(LANTERN, 4.8, 15, 1.82);
  light.position.set(x, 2.3, z);
  scene.add(light);
  lanternLights.push(light);

  // 一顆會發光的小球放在燈心，讓 Bloom 有東西可以暈開
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd266 })
  );
  bulb.position.set(x, 2.35, z);
  scene.add(bulb);
});

/* --- 岩縫的藍光：深處維持暗藍，只在局部透出亮光 --- */
{
  const depthPlane = scene.children.find(c => c.isMesh && c.material &&
      c.material.type === 'MeshBasicMaterial' && c.geometry.type === 'PlaneGeometry' &&
      c.position.y < -5);
  if (depthPlane) depthPlane.material.color.set(0x06275f);
}

const chasmLights = [
  [-1.2, -3.1, -1.0, 3.2],
  [ 7.4, -3.6, -6.0, 2.1],
  [-8.0, -3.8,  8.0, 1.8]
].map(([x, y, z, intensity]) => {
  const light = new THREE.PointLight(0x176dff, intensity*.95, 16, 1.60);
  light.position.set(x, y, z);
  scene.add(light);
  return light;
});

/* ============================================================
   2. 材質微調
   把岩壁染得更藍、砂地染得更暖，冷暖對比才拉得開。
   ============================================================ */
window.applyConceptLightingMaterials = function (cave) {
  const seen = new Set();
  if (cave) cave.traverse(o => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (seen.has(m.uuid)) return;
      seen.add(m.uuid);
      if (!m.color || m.userData.conceptLightingApplied) return;

      if (/^Slate_/.test(m.name)) {          // 岩壁：保留較亮、較柔和的冷藍中間調
        m.color.lerp(new THREE.Color(0x263f70), 0.40);
        m.color.multiplyScalar(0.87);
        m.roughness = 1.0;
      } else if (/^Stone_/.test(m.name)) {   // 地面：提亮暖灰，降低光池內外的斷層感
        m.color.lerp(new THREE.Color(0x7c5d4f), 0.54);
        m.color.multiplyScalar(0.75);
        m.roughness = 1.0;
      } else if (/lantern/i.test(m.name)) {  // 燈籠玻璃：自體發光，才會被 Bloom 抓到
        m.color.set(0xffbd45);
        m.emissive = new THREE.Color(0xff861c);
        m.emissiveIntensity = 1.70;
      } else if (/timber/i.test(m.name)) {
        m.color.multiplyScalar(0.92);
      }
      m.metalness = 0;
      m.userData.conceptLightingApplied = true;
      m.needsUpdate = true;
    });
  });
};

window.applyConceptLightingMaterials(scene.getObjectByName('固定礦坑地圖'));

/* ============================================================
   3. Bloom 光暈（後製）
   原理：把畫面上「夠亮」的部分挑出來、模糊、再疊回去。
   燈籠、發光礦石、岩縫藍光都會往外暈開，
   這是讓 3D 畫面看起來像手繪插圖最有效的一步。
   ============================================================ */
if (BLOOM && typeof THREE.EffectComposer === 'function') {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));

  const bloom = new THREE.UnrealBloomPass(
    new THREE.Vector2(size.x, size.y), BLOOM_POWER, BLOOM_SPREAD, BLOOM_LIMIT);
  composer.addPass(bloom);

  // index.html 每一格都會呼叫 renderer.render()，
  // 我們把它接管過來改走後製流程。
  // （RenderPass 內部也會呼叫 renderer.render，用 busy 旗標避免無限迴圈）
  const rawRender = renderer.render.bind(renderer);
  let busy = false;
  renderer.render = function (sc, cam) {
    if (busy) return rawRender(sc, cam);
    busy = true;
    try { composer.render(); } finally { busy = false; }
  };

  // 視窗大小改變時，後製的畫布也要跟著改
  addEventListener('resize', () => {
    const s = renderer.getSize(new THREE.Vector2());
    composer.setSize(s.x, s.y);
    bloom.setSize(s.x, s.y);
  });

  window.BLOOMPASS = bloom;      // 方便你在主控台即時試數值
}

/* ============================================================
   4. 亮度滑桿：改成連動這一版的燈光
   ============================================================ */
{
  const slider = document.getElementById('bright');
  if (slider) {
    const fresh = slider.cloneNode(true);        // 清掉前面檔案綁的舊行為
    slider.parentNode.replaceChild(fresh, slider);
    fresh.addEventListener('input', e => {
      const k = e.target.value / 100;
      ambient.intensity = 0.102 * k;
      hemi.intensity    = 0.195 * k;
      sky.intensity     = 0.34 * k;
      lamp.intensity    = 0.42 * k;
      glow.intensity    = 0.46 * k;
      lanternLights.forEach(l => l.intensity = 4.8 * k);
      chasmLights.forEach((l, i) => l.intensity = [3.04, 2.00, 1.71][i] * k);
      renderer.toneMappingExposure = EXPOSURE * (0.92 + 0.08 * k);
    });
  }
}

/* ============================================================
   4-2. 光暈滑桿：直接調 Bloom，拉完馬上看得到
   ============================================================ */
{
  const slider = document.getElementById('bloomAmt');
  const bloom = window.BLOOMPASS;
  if (slider && bloom) {
    const baseStrength = bloom.strength;
    const baseThreshold = bloom.threshold;
    const apply = k => {
      bloom.strength = baseStrength * k;
      // 拉越大，門檻同時降一點，光才會真的往外暈開而不只是變亮
      bloom.threshold = Math.max(.55, baseThreshold - (k - 1) * .18);
    };
    slider.addEventListener('input', e => apply(e.target.value / 100));
    apply(slider.value / 100);
  } else if (slider) {
    slider.disabled = true;      // 光暈總開關關掉時，滑桿就沒有作用
  }
}

/* ============================================================
   5. 畫面暗角：集中視線，但不蓋住 HUD
   ============================================================ */
{
  const stage = document.getElementById('stage');
  if (stage) {
    let vignette = document.getElementById('concept-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'concept-vignette';
      stage.appendChild(vignette);
    }
    Object.assign(vignette.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '2',
      background: 'radial-gradient(ellipse at 50% 47%, transparent 52%, rgba(7,16,32,.07) 78%, rgba(3,9,20,.22) 100%), linear-gradient(180deg, rgba(20,42,72,.06), transparent 30%, transparent 76%, rgba(5,12,25,.08))'
    });
    ['hud','title','info','mapbox','hint','shop','gear'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.zIndex = '10';
    });
  }
}

})();

// Fixed underground scenery beneath the playable platforms.
(function buildCavernDepth() {
  const group = new THREE.Group();
  group.name = '地下洞窟遠景';
  scene.add(group);
  let seed = 91527;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // The old flat blue sheet becomes the distant cavern floor.
  depth.position.y = -25;
  depth.scale.set(2, 2, 1);
  depth.material = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 p; void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec3 p;
      void main(){
        float a=sin(p.x*.14+p.z*.085)*sin(p.z*.19-p.x*.09);
        float b=sin(p.x*.43+p.z*.21)*.5+.5;
        float haze=clamp(.42+a*.24+b*.09,0.,1.);
        gl_FragColor=vec4(mix(vec3(.018,.035,.065),vec3(.055,.15,.24),haze),1.);
      }`
  });
  // Shared low-poly geometry: a handful of draw calls for the whole backdrop.
  const geo = new THREE.IcosahedronGeometry(1, 2);
  // Continuous deformation keeps shared corners closed while adding broad rock strata.
  const positions = geo.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const shape=1+.065*Math.sin(y*8+x*3)+.045*Math.cos(z*6-y*3);
    positions.setXYZ(i,x*shape,y,z*shape);
  }
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({color:0x304763, roughness:1,
    flatShading:true, emissive:0x25435f, emissiveIntensity:.65});
  // A small family of fractured silhouettes replaces the repeated upright
  // boulder shape. Vertex displacement is seeded so the cave stays stable on reload.
  const rockShapes=Array.from({length:8},(_,variant)=>{
    const geometry=new THREE.IcosahedronGeometry(1,1);
    const p=geometry.attributes.position;
    const phase=variant*1.73;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const ridge=1+.10*Math.sin(x*7+phase)*Math.cos(z*5-phase)
        +.07*Math.sin(y*8+z*3+phase);
      const leanX=.10*Math.sin(phase+y*3),leanZ=.09*Math.cos(phase+x*4);
      p.setXYZ(i,x*ridge+leanX*y,y*(1+.10*Math.cos(phase+z*5)),z*ridge+leanZ*y);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
  const rockPlacements=Array.from({length:rockShapes.length},()=>[]);
  // Uneven clusters leave occasional open gaps and vary in height and depth,
  // instead of forming three evenly spaced parallel rows.
  for(const side of [-1,1]){
    let z=-64;
    while(z<76){
      z+=4+random()*10;
      if(random()<.13){z+=3+random()*8;continue;}
      const count=1+Math.floor(random()*4);
      for(let j=0;j<count;j++){
        const lane=random()<.72?0:1;
        const x=side*(15.5+random()*5.5+lane*(5+random()*5));
        const rz=z+(random()-.5)*7;
        const tall=random()<.24;
        const sx=tall?3.2+random()*4.2:1.8+random()*4.0;
        const sy=tall?10+random()*16:3.5+random()*8;
        const sz=tall?3+random()*5:1.8+random()*4.5;
        const y=tall?-13+random()*3:-15+random()*3;
        rockPlacements[Math.floor(random()*rockShapes.length)].push([x,y,rz,sx,sy,sz]);
      }
    }
  }
  // Smaller distant spires peek through the chasms and under the bridge.
  for(let i=0;i<82;i++){
    rockPlacements[Math.floor(random()*rockShapes.length)].push([
      (random()-.5)*36,-18+random()*3,-52+random()*110,
      .9+random()*2.6,2.5+random()*6,1+random()*2.8
    ]);
  }
  const transform=new THREE.Object3D();
  function addRockInstances(name,geometry,placements,large=false){
    if(!placements.length)return;
    const rocks=new THREE.InstancedMesh(geometry,material,placements.length);
    rocks.name=name;
    placements.forEach(([x,y,z,sx,sy,sz],i)=>{
      transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);
      const tilt=large ? .30 : .22;
      transform.rotation.set((random()-.5)*tilt,random()*Math.PI*2,(random()-.5)*tilt);
      transform.updateMatrix();rocks.setMatrixAt(i,transform.matrix);
      rocks.setColorAt(i,new THREE.Color().setHSL(.585+random()*.055,.20+random()*.18,.25+random()*.19));
    });
    rocks.instanceMatrix.needsUpdate=true;
    group.add(rocks);
  }
  rockShapes.forEach((shape,i)=>addRockInstances('不規則岩塊_'+i,shape,rockPlacements[i]));
  // Tall fractured masses make an uneven outer ridge; they no longer read as cut cylinders.
  const terraceMat=new THREE.MeshStandardMaterial({color:0x52617a,roughness:1,
    flatShading:true,emissive:0x17273e,emissiveIntensity:.38});
  const terraces=Array.from({length:rockShapes.length},()=>[]);
  const crowns=[];
  for(const side of [-1,1]){
    let centerZ=-62;
    while(centerZ<78){
      centerZ+=6+random()*14;
      if(random()<.10){centerZ+=5+random()*8;continue;}
      const centerX=18+random()*13;
      const ridgeHeight=-5+random()*17;
      const count=3+Math.floor(random()*7);
      for(let j=0;j<count;j++){
        const offsetX=(random()-.5)*17;
        const x=side*Math.max(17.2,centerX+offsetX);
        const z=centerZ+(random()-.5)*17;
        const sx=1.2+random()*5.2,sz=1.1+random()*5.8;
        const near=Math.abs(x)<20;
        const top=near?-7+random()*7:ridgeHeight-7+random()*14;
        const bottom=-25-random()*9;
        const variant=Math.floor(random()*rockShapes.length);
        // Icosahedral masses have rounded fractured crowns, with varied lean and width.
        terraces[variant].push([x,(top+bottom)/2,z,near?Math.min(sx,3.4):sx,(top-bottom)/2,sz]);
        if(random()<.20){
          crowns.push([x+side*sx*.5,top-1,z+sz*.3,.8+random(),1+random()*2,.7+random()]);
        }
      }
    }
  }
  function instanceTerrain(name,geometry,mat,items,rocky=false){
    if(!items.length)return;
    const mesh=new THREE.InstancedMesh(geometry,mat,items.length);mesh.name=name;
    items.forEach(([x,y,z,sx,sy,sz],i)=>{
      transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);
      const tilt=rocky ? .26 : .045;
      transform.rotation.set((random()-.5)*tilt,random()*Math.PI*2,(random()-.5)*tilt);transform.updateMatrix();
      mesh.setMatrixAt(i,transform.matrix);
      mesh.setColorAt(i,new THREE.Color().setHSL(.59+random()*.045,.20+random()*.14,.31+random()*.18));
    });
    mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
  }
  rockShapes.forEach((shape,i)=>instanceTerrain('錯落岩群_'+i,shape,terraceMat,terraces[i],true));
  instanceTerrain('岩台頂部碎岩',geo,terraceMat,crowns);
  // Soft pools of blue mist sit at different depths instead of a solid blue void.
  const fogGeo=new THREE.PlaneGeometry(1,1);
  const fogMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{tint:{value:new THREE.Color(0x387aaa)}},
    vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v; uniform vec3 tint; void main(){float d=length((v-.5)*2.);float a=pow(max(0.,1.-d),2.)*.26;gl_FragColor=vec4(tint,a);}'
  });
  for(let i=0;i<28;i++){
    const fog=new THREE.Mesh(fogGeo,fogMat);
    fog.rotation.x=-Math.PI/2;fog.position.set((random()-.5)*65,-9-random()*4,-48+random()*106);
    fog.scale.set(16+random()*14,15+random()*12,1);group.add(fog);
  }
})();
