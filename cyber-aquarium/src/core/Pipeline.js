import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { waterVertex, waterFragment, filmFragment } from '../shaders/water.js';

class UnderwaterPass extends ShaderPass {
  render(renderer,writeBuffer,readBuffer,delta,mask){
    this.uniforms.tDepth.value=readBuffer.depthTexture;
    super.render(renderer,writeBuffer,readBuffer,delta,mask);
  }
}

export class Pipeline {
  constructor(renderer,scene,camera,resources){
    this.camera=camera;this.renderer=renderer;
    const target=new THREE.WebGLRenderTarget(1,1,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false});
    target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    // Composer owns both ping-pong targets, including their depth textures.
    this.composer=new EffectComposer(renderer,target);
    this.composer.addPass(new RenderPass(scene,camera));
    this.water=new UnderwaterPass({uniforms:{tDiffuse:{value:null},tDepth:{value:null},uResolution:{value:new THREE.Vector2(1,1)},uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uTime:{value:0},uFocus:{value:10},uAperture:{value:5},uDarkness:{value:0},uNear:{value:camera.near},uFar:{value:camera.far},uSteps:{value:10}},vertexShader:waterVertex,fragmentShader:waterFragment});
    this.composer.addPass(this.water);
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.32,.65,1.15);
    this.composer.addPass(this.bloom);
    this.output=new OutputPass();this.composer.addPass(this.output);
    this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);
    this.film=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uAberration:{value:.0035},uGrain:{value:.016},uResolution:{value:new THREE.Vector2(1,1)}},vertexShader:waterVertex,fragmentShader:filmFragment});
    this.composer.addPass(this.film);
    resources.defer(()=>{for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();});
  }
  setQuality(q){this.quality=q;this.water.uniforms.uSteps.value=q.raySteps;this.bloom.enabled=q.bloom;}
  resize(width,height,dpr){
    this.composer.setPixelRatio(dpr);this.composer.setSize(width,height);
    this.water.uniforms.uResolution.value.set(width*dpr,height*dpr);
    this.film.uniforms.uResolution.value.set(width*dpr,height*dpr);
    this.fxaa.uniforms.resolution.value.set(1/(width*dpr),1/(height*dpr));
  }
  render(time,state){
    const u=this.water.uniforms;
    u.uTime.value=time;u.uFocus.value=state.focus;u.uDarkness.value=state.darkness;
    u.uAperture.value=(state.reduced?0:5)*this.quality.dof;
    u.uInverseProjection.value.copy(this.camera.projectionMatrixInverse);
    u.uCameraWorld.value.copy(this.camera.matrixWorld);
    this.film.uniforms.uTime.value=time;
    this.film.uniforms.uGrain.value=state.reduced?0:.014;
    this.film.uniforms.uAberration.value=state.reduced?0:.0035;
    this.composer.render();
  }
}
