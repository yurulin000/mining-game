/* 第一階段美術提升：地面細節、接觸陰影、水晶閃光與柔和輪廓光。 */
(() => {
  let seed = 260916;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  const rim = new THREE.DirectionalLight(0x6caaff, 0.19);
  rim.position.set(18, 13, -20);
  scene.add(rim);

  const floorCells = CAVERN.cells.filter(([cx, cz], index) => {
    if (index % 7 !== 0 || random() < 0.25) return false;
    const x = cx * CAVERN.step, z = cz * CAVERN.step;
    return !CAVERN.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + 0.7);
  }).slice(0, 190);
  const patchGeo = new THREE.CircleGeometry(1, 7);
  patchGeo.rotateX(-Math.PI / 2);
  const patchMat = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.085,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const patches = new THREE.InstancedMesh(patchGeo, patchMat, floorCells.length);
  patches.name = '地面柔和色斑';
  const dummy = new THREE.Object3D();
  floorCells.forEach(([cx, cz], i) => {
    const s = .13 + random() * .34;
    dummy.position.set(cx*CAVERN.step+(random()-.5)*.28,.027,cz*CAVERN.step+(random()-.5)*.28);
    dummy.scale.set(s*(.7+random()*.8),1,s); dummy.rotation.y=random()*Math.PI; dummy.updateMatrix();
    patches.setMatrixAt(i,dummy.matrix);
    patches.setColorAt(i,new THREE.Color(random()<.62?0xb99070:0x526c8c).multiplyScalar(.75+random()*.35));
  });
  patches.instanceMatrix.needsUpdate=true; scene.add(patches);

  const pebbleCells=CAVERN.cells.filter((cell,index)=>index%14===3&&random()>.30).slice(0,105);
  const pebbleGeo=new THREE.DodecahedronGeometry(1,0);
  const pebbleMat=new THREE.MeshStandardMaterial({color:0x526079,roughness:1,metalness:0,flatShading:true});
  const pebbles=new THREE.InstancedMesh(pebbleGeo,pebbleMat,pebbleCells.length);
  pebbles.name='地面零散碎石';
  pebbleCells.forEach(([cx,cz],i)=>{
    const size=.055+random()*.10;
    dummy.position.set(cx*CAVERN.step+(random()-.5)*.48,size*.44,cz*CAVERN.step+(random()-.5)*.48);
    dummy.scale.set(size*(.75+random()),size*(.38+random()*.32),size*(.7+random()));
    dummy.rotation.set(random()*.35,random()*Math.PI,random()*.28);dummy.updateMatrix();
    pebbles.setMatrixAt(i,dummy.matrix);
    pebbles.setColorAt(i,new THREE.Color().setHSL(.58+random()*.04,.15+random()*.10,.30+random()*.15));
  });
  pebbles.instanceMatrix.needsUpdate=true;pebbles.receiveShadow=true;scene.add(pebbles);

  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=96;
  const shadowCtx=shadowCanvas.getContext('2d');
  const shadowGrad=shadowCtx.createRadialGradient(48,48,2,48,48,46);
  shadowGrad.addColorStop(0,'rgba(4,7,14,.60)');shadowGrad.addColorStop(.42,'rgba(4,7,14,.30)');shadowGrad.addColorStop(1,'rgba(4,7,14,0)');
  shadowCtx.fillStyle=shadowGrad;shadowCtx.fillRect(0,0,96,96);
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1.75,1.15),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,opacity:.55}));
  contactShadow.rotation.x=-Math.PI/2;contactShadow.renderOrder=3;scene.add(contactShadow);

  const sparkleCanvas=document.createElement('canvas');sparkleCanvas.width=sparkleCanvas.height=48;
  const sparkleCtx=sparkleCanvas.getContext('2d');
  const sparkleGrad=sparkleCtx.createRadialGradient(24,24,0,24,24,23);
  sparkleGrad.addColorStop(0,'rgba(255,255,255,1)');sparkleGrad.addColorStop(.16,'rgba(255,255,255,.9)');sparkleGrad.addColorStop(.48,'rgba(160,220,255,.22)');sparkleGrad.addColorStop(1,'rgba(120,190,255,0)');
  sparkleCtx.fillStyle=sparkleGrad;sparkleCtx.fillRect(0,0,48,48);
  const sparkleTex=new THREE.CanvasTexture(sparkleCanvas);
  function addOreSparkles(ore,oreIndex){
    if(ore.mesh.userData.qualitySparkles)return;
    const list=[];
    for(let i=0;i<2;i++){
      const mat=new THREE.SpriteMaterial({map:sparkleTex,color:ore.type.color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
      const sprite=new THREE.Sprite(mat);
      sprite.position.set((random()-.5)*ore.type.size*1.3,.55+random()*ore.type.size*1.8,(random()-.5)*ore.type.size*.8);
      sprite.userData.phase=oreIndex*1.37+i*2.1+random()*3;ore.mesh.add(sprite);list.push(sprite);
    }
    ore.mesh.userData.qualitySparkles=list;
  }
  function animateQuality(now){
    requestAnimationFrame(animateQuality);const t=now*.001;
    contactShadow.position.set(G.player.position.x,.032,G.player.position.z);
    contactShadow.material.opacity=.46+Math.sin(t*2.2)*.025;
    if(window.MINING?.ores)MINING.ores.forEach((ore,index)=>{
      addOreSparkles(ore,index);
      ore.mesh.userData.qualitySparkles.forEach(sprite=>{
        const pulse=Math.max(0,Math.sin(t*1.45+sprite.userData.phase));
        sprite.material.opacity=pulse*pulse*.46;const scale=(.78+pulse*.45)*.22;sprite.scale.set(scale,scale,1);
      });
    });
  }
  requestAnimationFrame(animateQuality);
  window.QUALITY_PASS={rim,patches,pebbles,contactShadow};
})();
