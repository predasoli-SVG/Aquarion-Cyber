import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createFishMaterials, attachFishShader } from './materials.js';
import { random } from '../core/math.js';

export class Fish {
  constructor(resources, config) {
    this.resources = resources;
    this.config = config;
    this.root = new THREE.Group();
    this.root.name = 'Pisces electronica';
    this.uniforms = { uProgress: { value: 0 }, uTime: { value: 0 }, uDissolve: { value: 0 } };
    const { materials, maps } = createFishMaterials(resources, this.uniforms);
    this.materials = materials;
    this.maps = maps;
    this.rng = random(207);
    this.partCount = 0;
    this.banks = new Map();
    this.buildProcedural();
    this.merge();
  }

  /** Bake rigid transforms once. There is no JS part loop in the render loop. */
  add(geometry, key, position = [0,0,0], scale = [1,1,1], rotation = [0,0,0], pivot = null) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    geometry.applyMatrix4(m);
    if (geometry.index) { const original = geometry; geometry = geometry.toNonIndexed(); original.dispose(); }
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    const center = new THREE.Vector3(...(pivot ?? position));
    const dir = center.clone().add(new THREE.Vector3((this.rng()-.5)*.6, (this.rng()-.5)*.8, (this.rng()-.5)*.8)).normalize();
    if (dir.lengthSq() < .1) dir.set(0,1,0);
    const axis = new THREE.Vector3(this.rng()-.5,this.rng()-.5,this.rng()-.5).normalize();
    const phase = this.rng(), n = geometry.attributes.position.count;
    for (const [name, vec] of [['aPivot',center],['aDirection',dir],['aAxis',axis]]) {
      const data = new Float32Array(n * 3);
      for (let i=0;i<n;i++) vec.toArray(data,i*3);
      geometry.setAttribute(name,new THREE.BufferAttribute(data,3));
    }
    geometry.setAttribute('aPhase',new THREE.BufferAttribute(new Float32Array(n).fill(phase),1));
    if (!this.banks.has(key)) this.banks.set(key,[]);
    this.banks.get(key).push(geometry);
    this.partCount++;
  }

  box(key, p, s, r, pivot) { this.add(new THREE.BoxGeometry(1,1,1),key,p,s,r,pivot); }
  sphere(key, p, s, pivot) { this.add(new THREE.SphereGeometry(1,24,16),key,p,s,[0,0,0],pivot); }
  tube(key, points, radius = .018, pivot = null) {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    this.add(new THREE.TubeGeometry(curve,24,radius,5,false),key,[0,0,0],[1,1,1],[0,0,0],pivot ?? points[0]);
  }
  ring(key,p,radius,tube=.025,rotation=[0,Math.PI/2,0],pivot=null) {
    this.add(new THREE.TorusGeometry(radius,tube,6,40),key,p,[1,1,1],rotation,pivot);
  }
  fin(points,key,depth=.045) {
    const shape = new THREE.Shape(); shape.moveTo(...points[0]); for (const p of points.slice(1)) shape.lineTo(...p); shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:1,steps:1});
    const c = points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
    this.add(geom,key,[0,0,0],[1,1,1],[0,0,0],[c[0],c[1],0]);
  }

  buildProcedural() {
    // Mechanical skeleton and a dark torpedo body.
    this.sphere('dark',[.05,0,0],[2.02,.82,.62]);
    this.add(new THREE.CylinderGeometry(.14,.14,4.4,12),'copper',[0,0,0],[1,1,1],[0,0,Math.PI/2]);
    for(let j=0;j<7;j++) {
      const x=-1.55+j*.49, profile=Math.sqrt(1-Math.pow((x-.1)/2.35,2));
      this.ring('copper',[x,0,0],.74*profile,.035);
      // Individual overlapping, curved metal scales form a plausible fish silhouette.
      for(let k=0;k<10;k++) {
        const angle=k*Math.PI*2/10;
        const radius=.73*profile;
        const y=Math.sin(angle)*radius,z=Math.cos(angle)*radius*.82;
        this.box((j+k)%5===0?'copper':'armor',[x,y,z],[.45,.32,.06],[angle,0,(j%2-.5)*.08],[x,y,z]);
        if(k===0||k===1||k===9) {
          this.sphere('chrome',[x+.13,y+.035,z+.045],[.022,.022,.018]);
          this.box('dark',[x,y-.08,z+.04],[.26,.018,.014],[angle,0,0]);
        }
      }
    }
    // Armored snout, gills, both optical sensors.
    this.sphere('armor',[1.62,.03,0],[.68,.62,.5]);
    this.sphere('dark',[2.08,-.12,.02],[.3,.26,.37]);
    this.box('chrome',[2.12,-.2,.2],[.25,.035,.32],[0,0,.13]);
    for(const side of [-1,1]) {
      const eye=[1.63,.23,side*.464];
      this.ring('dark',eye,.19,.055,[0,0,0],eye);
      this.ring('copper',[eye[0],eye[1],side*.49],.155,.023,[0,0,0],eye);
      this.sphere('glow',[eye[0],eye[1],side*.51],[.122,.122,.045],eye);
      this.sphere('dark',[eye[0]+.025,eye[1],side*.552],[.045,.063,.009],eye);
      for(let g=0;g<4;g++) this.box('dark',[1.1-g*.13,-.03,side*.59],[.045,.55,.03],[0,side*.25,-.22]);
      // Exposed PCB with gold traces and miniature chips on the flank.
      this.box('circuit',[-.25,.02,side*.657],[1.15,.56,.043],[0,0,-.05]);
      for(let i=0;i<10;i++) {
        const x=-.74+i*.1, y=-.2+(i%4)*.1;
        this.box('copper',[x,y,side*.689],[.009,.22,.006]);
        this.box('chrome',[x+.035,y+.11,side*.694],[.08,.008,.009]);
      }
      this.box('dark',[-.25,.035,side*.71],[.24,.23,.035],[0,0,-.05]);
      for(let j=0;j<5;j++) for(const s of [-1,1]) this.box('chrome',[-.36+j*.05,s*.16,side*.713],[.02,.09,.015]);
      for(let j=0;j<4;j++) this.sphere('glow',[-.68+j*.18,.3,side*.63],[.024,.017,.017]);
      this.tube('copper',[[-1.3,.15,side*.48],[-1.0,.5,side*.72],[-.4,.56,side*.73],[.4,.4,side*.65],[.9,.2,side*.56]],.027);
      this.tube('chrome',[[-1.5,-.15,side*.4],[-.7,-.48,side*.67],[.1,-.52,side*.68],[.8,-.22,side*.58]],.013);
      // Pectoral fins with filament ribs, angled toward the viewer.
      for(let i=0;i<8;i++) this.tube('copper',[[.65,-.25,side*.45],[.2-i*.06,-.65-i*.055,side*(.7+i*.04)],[-.3-i*.045,-.8-i*.055,side*(.9+i*.05)]],.018);
    }
    // Dorsal and ventral translucent glass / copper spines.
    this.fin([[-1.3,.55],[-.6,1.55],[.9,.69]],'glass');
    for(let i=0;i<12;i++) {
      const x=-1.2+i*.145, top=1.43-Math.abs(x+.45)*.65;
      this.tube(i%3?'copper':'chrome',[[x,.58,0],[x-.16,top*.84,.01],[x-.3,top,0]],.02);
    }
    this.fin([[-1.3,-.5],[-1.05,-1.05],[.7,-.65]],'copper');
    // Narrow articulated caudal peduncle and fan-shaped tail.
    for(let i=0;i<4;i++) {
      this.ring(i%2?'chrome':'copper',[-1.95-i*.18,0,0],.28-i*.045,.04);
      this.sphere('dark',[-2.1-i*.12,0,0],[.16,.23-i*.03,.19-i*.025]);
    }
    this.fin([[-2.4,0],[-3.6,1.08],[-3.25,.05],[-3.65,-1.05]],'glass');
    for(let i=0;i<16;i++) {
      const a=(i/15-.5)*2.15;
      this.tube(i%4===0?'glow':'copper',[[-2.34,0,.03],[-2.8,Math.sin(a)*.4,.04],[-3.43,Math.sin(a)*1.13,.03]],i%4===0?.012:.023);
    }
    for(let i=0;i<7;i++) this.ring('copper',[-.9+i*.3,-.05,.015],.61,.012);
  }

  merge() {
    for(const [key,geometries] of this.banks) {
      // All sources are indexed. Stable attribute layout permits one draw per material.
      const geometry = this.resources.own(mergeGeometries(geometries,false));
      const mesh=new THREE.Mesh(geometry,this.materials[key]);
      mesh.frustumCulled=false; // Shader motion exceeds the original CPU bounds.
      mesh.name=`fish-${key}`;
      this.root.add(mesh);
      geometries.forEach(g=>g.dispose());
    }
    this.banks.clear();
  }

  async loadProduction(signal) {
    if(!this.config.assets.fish) return false;
    const loader=new GLTFLoader();
    let draco;
    if(this.config.assets.dracoDecoderPath) {
      draco=new DRACOLoader().setDecoderPath(this.config.assets.dracoDecoderPath); loader.setDRACOLoader(draco);
    }
    try {
      const gltf=await loader.loadAsync(this.config.assets.fish);
      const tree=gltf.scene; tree.updateMatrixWorld(true);
      if(signal.aborted) { this.resources.ownTree(tree); return false; }
      // Rigid mesh contract: each glTF mesh is one detachable object. Skins must be baked first.
      const replacement=new THREE.Group();
      const box=new THREE.Box3().setFromObject(tree), center=box.getCenter(new THREE.Vector3());
      const scale=5.8/box.getSize(new THREE.Vector3()).x;
      tree.traverse(o=>{
        if(!o.isMesh) return;
        if(o.isSkinnedMesh) throw new Error('Bake skinned parts before using the rigid GPU explosion.');
        const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
        g.translate(-center.x,-center.y,-center.z); g.scale(scale,scale,scale);
        const pivot=new THREE.Box3().setFromBufferAttribute(g.attributes.position).getCenter(new THREE.Vector3());
        const n=g.attributes.position.count, phase=this.rng();
        const direction=pivot.clone().normalize();
        const axis=new THREE.Vector3(this.rng(),this.rng(),this.rng()).normalize();
        for(const [name,v] of [['aPivot',pivot],['aDirection',direction],['aAxis',axis]]) {
          const a=new Float32Array(n*3);for(let i=0;i<n;i++) v.toArray(a,i*3);g.setAttribute(name,new THREE.BufferAttribute(a,3));
        }
        g.setAttribute('aPhase',new THREE.BufferAttribute(new Float32Array(n).fill(phase),1));
        const clone=m=>this.resources.own(attachFishShader(m.clone(),this.uniforms));
        const material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
        const mesh=new THREE.Mesh(this.resources.own(g),material);mesh.frustumCulled=false;replacement.add(mesh);
      });
      this.resources.ownTree(tree);
      this.root.clear();this.root.add(replacement);
      return true;
    } finally { draco?.dispose(); }
  }

  update(time, state) {
    this.uniforms.uTime.value=time;
    this.uniforms.uProgress.value=state.explode;
    this.uniforms.uDissolve.value=state.dissolve;
    this.root.visible=state.dissolve<.999;
    this.root.position.set(state.fishX,Math.sin(time*.7)*.08*(1-state.explode)+state.fishY,0);
    this.root.rotation.set(.03,-.24+state.rotation,.035+Math.sin(time*.6)*.015);
    this.root.scale.setScalar(state.fishScale);
  }
}
