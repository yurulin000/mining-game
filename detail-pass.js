/* 第二階段美術提升：岩壁/地面微紋理、水晶通透感與洞窟微塵。 */
(() => {
  const makeTexture = (base, accents, count, size = 256) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    let seed = count * 7919 + size;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < count; i++) {
      const x = rand() * size, y = rand() * size;
      const rx = 3 + rand() * 17, ry = 2 + rand() * 11;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rand() * Math.PI);
      ctx.fillStyle = accents[Math.floor(rand() * accents.length)];
      ctx.beginPath();
      for (let p = 0; p < 7; p++) {
        const a = p / 7 * Math.PI * 2;
        const r = .72 + rand() * .28;
        const px = Math.cos(a) * rx * r, py = Math.sin(a) * ry * r;
        p ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7, 7);
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const floorTexture = makeTexture('#887062', ['#9f8370', '#725d57', '#b09378', '#65545a'], 150);
  const rockTexture = makeTexture('#66758b', ['#77879e', '#4b5b74', '#8590a2', '#394963'], 95);
  rockTexture.repeat.set(4.5, 5.5);

  const mapRoot = scene.getObjectByName('固定礦坑地圖');
  const processed = new Set();
  mapRoot?.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.uv) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => {
      if (!material || processed.has(material.uuid)) return;
      if (/^Stone_/.test(material.name)) {
        material.map = floorTexture;
        material.roughness = .96;
        material.envMapIntensity = .28;
        material.userData.detailPass = 'floor';
      } else if (/^Slate_/.test(material.name)) {
        material.map = rockTexture;
        material.roughness = .90;
        material.envMapIntensity = .38;
        material.userData.detailPass = 'rock';
      } else return;
      material.needsUpdate = true;
      processed.add(material.uuid);
    });
  });

  // 為每顆礦石補上玻璃感、亮邊與內部發光；不增加大量新網格。
  function refineOre(ore) {
    const u = ore.mesh.userData;
    if (u.detailRefined) return;
    // 圖片式原礦已經包含完整美術與透明邊緣，不可套用實體玻璃材質參數。
    // SpriteMaterial 若被加入 transmission/clearcoat 會產生不相容的 shader define。
    if (u.imageAsset) {
      u.mat.opacity = 1;
      u.mat.transparent = true;
      u.mat.depthWrite = false;
      u.mat.needsUpdate = true;
      u.detailRefined = true;
      return;
    }
    const body = u.mat, tip = u.tipMat, core = u.coreMat;
    [body, tip].forEach((material, index) => {
      material.transparent = true;
      material.opacity = index ? .91 : .84;
      material.roughness = index ? .045 : .075;
      material.clearcoat = 1;
      material.clearcoatRoughness = .025;
      material.ior = 1.38;
      material.transmission = index ? .055 : .045;
      material.thickness = .42;
      material.attenuationDistance = 1.8;
      material.attenuationColor = new THREE.Color(ore.type.color).lerp(new THREE.Color(0xffffff), .025);
      material.depthWrite = false;
      material.needsUpdate = true;
    });
    core.color.copy(new THREE.Color(ore.type.color));
    core.opacity = .50;
    core.blending = THREE.AdditiveBlending;
    core.depthWrite = false;
    u.halo.material.opacity *= .82;
    u.aura.material.opacity *= .75;
    ore.mesh.traverse(obj => {
      if (obj.isLineSegments) {
        obj.material.opacity = .38;
        obj.material.color.copy(new THREE.Color(ore.type.color).lerp(new THREE.Color(0xffffff), .10));
      }
    });
    u.detailRefined = true;
  }

  // 非常輕量的洞窟微塵，讓遠近空間有層次。
  let dustSeed = 91626;
  const dustRandom = () => { dustSeed = (Math.imul(dustSeed, 1103515245) + 12345) >>> 0; return dustSeed / 4294967296; };
  const dustPositions = new Float32Array(78 * 3);
  for (let i = 0; i < 78; i++) {
    dustPositions[i * 3] = (dustRandom() - .5) * 24;
    dustPositions[i * 3 + 1] = .45 + dustRandom() * 4.2;
    dustPositions[i * 3 + 2] = -46 + dustRandom() * 98;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xffd5a0, size: .055, transparent: true, opacity: .24,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.name = '洞窟暖色微塵'; scene.add(dust);

  function animateDetail(now) {
    requestAnimationFrame(animateDetail);
    if (window.MINING?.ores) MINING.ores.forEach(refineOre);
    const t = now * .0001;
    dust.position.y = Math.sin(t * 1.7) * .12;
    dust.material.opacity = .20 + Math.sin(t * 2.3) * .035;
  }
  requestAnimationFrame(animateDetail);
  window.DETAIL_PASS = { floorTexture, rockTexture, dust };
})();
