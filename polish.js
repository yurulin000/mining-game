/* Scene art pass: subtle light halos, depth haze and soft directional shadows. */
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.82;
ambient.intensity=.11;
ambient.color.set(0x55769f);
sky.intensity=.38;
sky.color.set(0x8fb7e6);
sky.position.set(-15,28,14);
sky.castShadow=true;
Object.assign(sky.shadow.camera,{left:-22,right:22,top:32,bottom:-32,near:1,far:85});
sky.shadow.mapSize.set(2048,2048);
sky.shadow.bias=-.0004;sky.shadow.normalBias=.045;sky.shadow.radius=3;
lamp.castShadow=false;lamp.intensity=.7;glow.intensity=.38;
scene.fog=new THREE.FogExp2(0x0c1b33,.009);
scene.background.set(0x071324);
depth.material.color.set(0x030b1c);
depth.scale.set(8,8,8);

// The seven environment lamps become the main warm light sources.
const environmentLights=scene.children.filter(o=>o.isPointLight);
environmentLights.forEach(light=>{
 light.color.set(0xffa23c);light.intensity=7.2;light.distance=8.5;light.decay=2;
});

// Cold light from below gives the chasm the saturated blue depth seen in the concept.
const chasmLight=new THREE.PointLight(0x187cff,4.2,12,2);
chasmLight.position.set(0,-2.8,-1);scene.add(chasmLight);

function softDisc(){
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba(255,255,255,.5)');g.addColorStop(.5,'rgba(255,255,255,.13)');g.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
const haloTexture=softDisc();
function surfaceTexture(wood){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
 ctx.fillStyle='#a0a0a0';ctx.fillRect(0,0,256,256);let seed=187;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<(wood?220:7000);i++){
  const shade=Math.floor(110+rand()*90);ctx.fillStyle=`rgb(${shade},${shade},${shade})`;
  const x=rand()*256,y=rand()*256;ctx.fillRect(x,y,wood?1:1+rand()*2,wood?15+rand()*90:1+rand()*2);
 }
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(wood?1:3,wood?1:3);return t;
}
const woodSurface=surfaceTexture(true),stoneSurface=surfaceTexture(false);
function applyCavernMaterials(root){
 root.traverse(o=>{if(!o.isMesh)return;
 for(const m of (Array.isArray(o.material)?o.material:[o.material])){
  if(/timber/i.test(m.name)){m.bumpMap=woodSurface;m.bumpScale=.035;m.roughness=.88;m.needsUpdate=true;}
  if(/Stone_/.test(m.name)){m.color.multiply(new THREE.Color(0xa8b4c7));m.bumpMap=stoneSurface;m.bumpScale=.018;m.roughness=.95;m.needsUpdate=true;}
  if(/Slate_/.test(m.name)){m.color.multiply(new THREE.Color(0x7896c3));m.bumpMap=stoneSurface;m.bumpScale=.022;m.roughness=.96;m.needsUpdate=true;}
 }
 });
}
const loadedCave=scene.getObjectByName('固定礦坑地圖');if(loadedCave)applyCavernMaterials(loadedCave);
CAVERN.lamps.forEach(([x,z])=>{
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture,color:0xffa83d,transparent:true,opacity:.34,blending:THREE.AdditiveBlending,depthWrite:false}));
 s.position.set(x,2.55,z);s.scale.set(3.5,3.5,1);scene.add(s);
 const pool=new THREE.Mesh(new THREE.PlaneGeometry(7.5,7.5),new THREE.MeshBasicMaterial({map:haloTexture,color:0xff9b32,transparent:true,opacity:.17,blending:THREE.AdditiveBlending,depthWrite:false}));
 pool.rotation.x=-Math.PI/2;pool.position.set(x,.038,z);scene.add(pool);
 const contact=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:haloTexture,color:0x000000,transparent:true,opacity:.35,depthWrite:false}));
 contact.rotation.x=-Math.PI/2;contact.position.set(x-.75,.032,z);scene.add(contact);
});

// Haze lies below the floor so it never covers walkable surfaces or the bridge.
const hazeUniforms={time:{value:0}};
const haze=new THREE.Mesh(new THREE.PlaneGeometry(70,95),new THREE.ShaderMaterial({
 transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 uniforms:hazeUniforms,
 vertexShader:'varying vec2 uv0; void main(){uv0=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 uv0;uniform float time;
 void main(){vec2 p=uv0*vec2(12.,15.);float n=sin(p.x*1.6+sin(p.y*2.1)+time*.10)*sin(p.y*1.9-p.x*.8-time*.07);
 float fade=smoothstep(0.,.25,uv0.x)*smoothstep(0.,.25,1.-uv0.x)*smoothstep(0.,.22,uv0.y)*smoothstep(0.,.22,1.-uv0.y);
 gl_FragColor=vec4(.035,.24,.65,fade*(.16+.08*n));}`
}));
haze.rotation.x=-Math.PI/2;haze.position.y=-4.2;scene.add(haze);
haze.onBeforeRender=()=>{hazeUniforms.time.value=performance.now()/1000;};
document.getElementById('bright').addEventListener('input',e=>{
 const k=e.target.value/100;ambient.intensity=.11*k;sky.intensity=.38*k;lamp.intensity=.7*k;glow.intensity=.38*k;
 environmentLights.forEach(light=>light.intensity=7.2*k);chasmLight.intensity=4.2*k;scene.fog.density=.009;
});

// A restrained vignette focuses the mobile screen on the playable area.
// 暗角改由最後載入的 look.js 管理，避免兩層暗角疊加。
const atmosphere=document.createElement('div');
atmosphere.id='legacy-atmosphere';
atmosphere.style.display='none';
document.body.appendChild(atmosphere);
for(const id of ['title','info','mapbox','panel','hint'])document.getElementById(id).style.zIndex=3;

const bridgeButton=document.createElement('button');bridgeButton.textContent='木橋特寫';
bridgeButton.style.cssText='background:#24354d;color:#ffe0ad;border:1px solid #65738a;border-radius:6px;padding:6px 10px;cursor:pointer;margin-right:6px';
document.getElementById('panel').prepend(bridgeButton);
bridgeButton.onclick=()=>{player.position.set(-7,0,1);G.focus.x=-7;G.focus.z=1;G.vel.x=G.vel.z=0;G.overview=false;G.camDist=1.05;};
