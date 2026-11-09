import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Resources } from './Resources.js';
import { Pipeline } from './Pipeline.js';
import { ScrollDirector } from './ScrollDirector.js';
import { Fish } from '../scene/Fish.js';
import { Ocean } from '../scene/Ocean.js';
import { Particles } from '../scene/Particles.js';
import { TitleWave } from '../ui/TitleWave.js';
import { Annotations } from '../ui/Annotations.js';

export class Aquarium {
  constructor(ui){
    this.ui=ui;this.resources=new Resources();this.abort=new AbortController();this.lost=false;this.disposed=false;
  }
  start(){
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance',stencil:false,depth:true});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
      document.body.dataset.shaderError='true';
      console.error('Aquarium shader compile error',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));
    };
    document.querySelector('#webgl').append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,85);
    this.camera.position.set(0,1,12.6);this.target=new THREE.Vector3();this.focusTarget=new THREE.Vector3();
    this.ocean=new Ocean(this.scene,this.renderer,this.resources,CONFIG);
    this.fish=new Fish(this.resources,CONFIG);this.scene.add(this.fish.root);
    this.particles=new Particles(this.resources,CONFIG.maxParticles);this.scene.add(this.particles.mesh);this.particles.sampleFish(this.fish);
    this.annotations=new Annotations(this.fish);this.resources.defer(()=>this.annotations.dispose());
    this.pipeline=new Pipeline(this.renderer,this.scene,this.camera,this.resources);
    this.title=new TitleWave(this.renderer,this.resources);
    this.resources.defer(()=>this.title.dispose());
    this.qualityKey=innerWidth<641?'low':'balanced';this.setQuality(this.qualityKey);
    this.onResize=()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>{if(!this.disposed){this.resize();this.director?.measure();this.director?.invalidate();}},120);};
    window.addEventListener('resize',this.onResize,{signal:this.abort.signal});
    this.renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.lost=true;this.director?.dispose();this.ui.director=null;this.ui.fallback();
    },{signal:this.abort.signal});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload(),{signal:this.abort.signal});
    this.frames=0;this.averageFrame=16.7;this.previousFrame=performance.now();
    this.director=new ScrollDirector((time,state)=>this.render(time,state));
    this.ui.connect(this.director,key=>this.setQuality(key));
    this.loadOptionalAssets();
  }
  async loadOptionalAssets(){
    // Loading failures retain the complete procedural edition.
    const work=[this.fish.loadProduction(this.abort.signal).then(loaded=>{if(loaded&&!this.abort.signal.aborted){this.particles.sampleFish(this.fish);this.annotations.bind(this.fish);}}),this.ocean.loadProduction(this.abort.signal)];
    if(CONFIG.assets.normal){
      work.push(new THREE.TextureLoader().loadAsync(CONFIG.assets.normal).then(texture=>{
        this.resources.own(texture);if(this.abort.signal.aborted){texture.dispose();return;}
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        // Normal maps must stay in NoColorSpace, unlike base-color maps.
        texture.colorSpace=THREE.NoColorSpace;
        for(const material of Object.values(this.fish.materials)){material.normalMap=texture;material.needsUpdate=true;}
      }));
    }
    const results=await Promise.allSettled(work);
    for(const result of results)if(result.status==='rejected')console.warn('Optional production asset unavailable; procedural edition retained.',result.reason);
  }
  setQuality(key){
    this.qualityKey=key;const q=CONFIG.quality[key];this.particles.setQuality(q);this.pipeline.setQuality(q);
    this.resize();this.director?.invalidate();
  }
  resize(){
    this.dpr=Math.min(devicePixelRatio,CONFIG.quality[this.qualityKey].dpr);
    this.renderer.setPixelRatio(this.dpr);this.renderer.setSize(innerWidth,innerHeight);
    this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
    this.pipeline.resize(innerWidth,innerHeight,this.dpr);this.title.resize();
    this.ocean.dustUniform.uPixelRatio.value=this.dpr;
  }
  render(time,state){
    if(this.lost||this.disposed)return;
    this.camera.position.set(0,state.cameraY,state.cameraZ);
    this.target.set(0,state.targetY,0);this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
    this.fish.update(time,state);this.ocean.update(time,state);
    this.focusTarget.set(state.fishX,state.fishY,.2+state.explode*2.5);
    this.camera.worldToLocal(this.focusTarget);state.focus=Math.max(1,-this.focusTarget.z);
    this.particles.update(time,state,this.fish,this.camera);
    this.pipeline.render(time,state);
    if(document.body.dataset.shaderError==='true'){this.lost=true;this.director?.dispose();this.ui.director=null;this.ui.fallback();return;}
    this.title.render(time,state);this.annotations.update(time,state,this.camera,this.fish);this.ui.update(state);
    // A rolling CPU frame interval can conservatively lower auto quality.
    // This is not a GPU benchmark or a claim of a fixed frame rate.
    const now=performance.now(),dt=now-this.previousFrame;this.previousFrame=now;
    if(dt<100)this.averageFrame=this.averageFrame*.98+dt*.02;
    this.frames++;
    if(this.frames>240&&this.frames%180===0&&this.ui.qualityMode===0&&this.qualityKey!=='low'&&this.averageFrame>33)this.setQuality('low');
    if(this.frames===1){
      document.body.dataset.particles=String(this.particles.mesh.count);
      document.body.dataset.fishParts=String(this.fish.partCount);
      this.ui.ready();
      if(location.hash)queueMicrotask(()=>{const target=document.getElementById(location.hash.slice(1));if(target)this.director?.scrollTo(target);});
    }
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.abort.abort();clearTimeout(this.resizeTimer);
    this.director?.dispose();this.resources.dispose();this.scene?.clear();
    this.renderer?.renderLists.dispose();this.renderer?.dispose();this.renderer?.forceContextLoss();this.renderer?.domElement.remove();
  }
}
