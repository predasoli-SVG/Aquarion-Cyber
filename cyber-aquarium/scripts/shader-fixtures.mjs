/** Assemble actual Three.js shader programs without pretending to run a browser. */
import { writeFileSync,readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WebGLProgram } from 'three/src/renderers/webgl/WebGLProgram.js';
import { Fish } from '../src/scene/Fish.js';
import { Ocean } from '../src/scene/Ocean.js';
import { Resources } from '../src/core/Resources.js';
import { CONFIG } from '../src/config.js';
import { waterVertex,waterFragment,filmFragment } from '../src/shaders/water.js';
import { particleVertex,particleFragment } from '../src/shaders/particles.js';
const fixtures=[];
function build(name,vertexShader,fragmentShader,options={}){
  const shaders=[];
  const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createProgram:()=>({}),createShader:type=>{const s={type};shaders.push(s);return s;},shaderSource:(s,source)=>s.source=source,compileShader:()=>{},attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
  const parameters={precision:'highp',shaderType:'ShaderMaterial',shaderName:name,defines:{},vertexShader,fragmentShader,toneMapping:THREE.NoToneMapping,outputColorSpace:THREE.LinearSRGBColorSpace,envMapCubeUVHeight:null,numDirLights:0,numSpotLights:0,numSpotLightMaps:0,numSpotLightShadows:0,numSpotLightShadowsWithMaps:0,numRectAreaLights:0,numPointLights:0,numHemiLights:0,numDirLightShadows:0,numPointLightShadows:0,numClippingPlanes:0,numClipIntersection:0,numLightProbes:0,rendererExtensionParallelShaderCompile:false,...options};
  new WebGLProgram({getContext:()=>gl},name,parameters,{});
  fixtures.push({name,vertex:shaders[0].source,fragment:shaders[1].source});
}
const resources=new Resources(),fish=new Fish(resources,CONFIG);
assert.equal(fish.root.children.length,7);
for(const mesh of fish.root.children){
  for(const attribute of Object.values(mesh.geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value));
  assert.equal(mesh.geometry.attributes.aPhase.count,mesh.geometry.attributes.position.count);
}
const physical={defines:{STANDARD:'',PHYSICAL:''},shaderType:'MeshPhysicalMaterial',useFog:true,fog:true,fogExp2:true,normalMap:true,normalMapTangentSpace:true,normalMapUv:'uv',roughnessMap:true,roughnessMapUv:'uv',clearcoat:true,iridescence:true,envMap:true,envMapMode:THREE.CubeUVReflectionMapping,envMapCubeUVHeight:256,opaque:true,numDirLights:1,numPointLights:2,numHemiLights:1};
const pbr={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
fish.materials.armor.onBeforeCompile(pbr);build('fish-rigid-PBR',pbr.vertexShader,pbr.fragmentShader,physical);
build('instanced-curl-particles',particleVertex,particleFragment,{instancing:true});
build('underwater-depth-DOF-volumetrics',waterVertex,waterFragment);
build('film-aberration',waterVertex,filmFragment);
const ocean={resources,scene:new THREE.Scene()};
Ocean.prototype.makeFloor.call(ocean);Ocean.prototype.makeDust.call(ocean);
const floor=ocean.scene.children[0].material;
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
floor.onBeforeCompile(shader);build('procedural-caustics',shader.vertexShader,shader.fragmentShader,{...physical,defines:{STANDARD:''},normalMap:false,normalMapTangentSpace:false,roughnessMap:false,clearcoat:false,iridescence:false});
const dust=ocean.dust.material;build('marine-dust',dust.vertexShader,dust.fragmentShader);
const title=readFileSync('src/ui/TitleWave.js','utf8').match(/vertexShader:`([^`]+)`,fragmentShader:`([^`]+)`/);
assert.ok(title);build('title-hydrodynamics',title[1],title[2]);
writeFileSync(process.argv[2]??'/tmp/aquarium-shaders.json',JSON.stringify(fixtures));
resources.dispose();
console.log(`Assembled ${fixtures.length} real Three.js programs. Validated ${fish.partCount} rigid parts and every geometry attribute.`);
