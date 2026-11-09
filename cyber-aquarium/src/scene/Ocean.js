import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { random } from '../core/math.js';

export class Ocean {
  constructor(scene, renderer, resources, config) {
    this.waterColor=new THREE.Color(config.color.water);this.abyssColor=new THREE.Color(config.color.abyss);
    this.scene=scene;this.resources=resources;this.renderer=renderer;this.config=config;
    scene.background=new THREE.Color(config.color.water);
    scene.fog=new THREE.FogExp2(config.color.water,.032);
    this.hemisphere=new THREE.HemisphereLight('#b7e9c6','#071514',1.5);scene.add(this.hemisphere);
    this.key=new THREE.DirectionalLight('#def4cc',3.5);this.key.position.set(-1,6,4);scene.add(this.key);
    this.rim=new THREE.PointLight('#72f5d2',40,20,2);this.rim.position.set(2,2,-3);scene.add(this.rim);
    const warm=new THREE.PointLight('#e8ac63',16,14,2);warm.position.set(-4,-.2,4);scene.add(warm);
    const env=new RoomEnvironment();
    env.traverse(o=>{if(o.material?.color)o.material.color.lerp(new THREE.Color('#5ba99d'),.35);});
    const pmrem=new THREE.PMREMGenerator(renderer);
    const target=resources.own(pmrem.fromScene(env,.06));
    scene.environment=target.texture;scene.environmentIntensity=.85;
    env.dispose();pmrem.dispose();
    this.makeFloor();this.makeDust();
  }
  makeFloor(){
    const geometry=this.resources.own(new THREE.PlaneGeometry(70,70,90,90));
    geometry.rotateX(-Math.PI/2);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i);p.setY(i,-3.5+Math.sin(x*.3+z*.22)*.27+Math.cos(x*.65-z*.3)*.11);
    }
    geometry.computeVertexNormals();
    const material=this.resources.own(new THREE.MeshStandardMaterial({color:'#183b31',roughness:.95,metalness:.05}));
    this.floorUniform={uTime:{value:0},uDark:{value:0}};
    material.onBeforeCompile=s=>{
      Object.assign(s.uniforms,this.floorUniform);
      s.vertexShader='varying vec3 vFloor;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFloor=position;');
      s.fragmentShader='varying vec3 vFloor;uniform float uTime;uniform float uDark;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec2 p=vFloor.xz*.95+vec2(uTime*.09,-uTime*.11);
        float a=sin(p.x+sin(p.y*1.7))*sin(p.y+cos(p.x*1.3));
        float caustics=pow(max(0.,a),15.)+pow(max(0.,sin(p.x*1.7-p.y)*sin(p.y*1.1+p.x)),22.)*.6;
        totalEmissiveRadiance+=vec3(.2,.5,.3)*caustics*(1.-uDark*.8);
      `);
    };
    const floor=new THREE.Mesh(geometry,material);this.scene.add(floor);
    const rng=random(905),rockGeometry=this.resources.own(new THREE.IcosahedronGeometry(1,1));
    const rocks=this.resources.own(new THREE.InstancedMesh(rockGeometry,material,70));const dummy=new THREE.Object3D();
    for(let i=0;i<70;i++){
      dummy.position.set((rng()-.5)*42,-3.3,(rng()-.5)*40);
      dummy.rotation.set(rng()*3,rng()*3,rng()*3);dummy.scale.set(.2+rng()*1.2,.12+rng()*.4,.2+rng());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
    }
    this.scene.add(rocks);
  }
  makeDust(){
    const rng=random(32),count=1800,positions=new Float32Array(count*3),sizes=new Float32Array(count);
    for(let i=0;i<count;i++){positions.set([(rng()-.5)*34,(rng()-.5)*22,(rng()-.5)*25],i*3);sizes[i]=rng();}
    const geometry=this.resources.own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
    this.dustUniform={uTime:{value:0},uOpacity:{value:1},uPixelRatio:{value:1}};
    const material=this.resources.own(new THREE.ShaderMaterial({uniforms:this.dustUniform,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`attribute float aSize;uniform float uTime;uniform float uPixelRatio;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.07+p.y)*.3;p.y+=sin(uTime*.12+p.x)*.2;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((1.+aSize*2.)*uPixelRatio*10./max(1.,-v.z),.7,5.);vAlpha=.12+aSize*.2;}`,fragmentShader:`uniform float uOpacity;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(.55,.8,.65,(1.-d)*vAlpha*uOpacity);}`}));
    this.dust=new THREE.Points(geometry,material);this.scene.add(this.dust);
  }
  async loadProduction(signal){
    if(!this.config.assets.environment)return;
    const hdr=await new RGBELoader().loadAsync(this.config.assets.environment);
    if(signal.aborted){hdr.dispose();return;}
    const pmrem=new THREE.PMREMGenerator(this.renderer);
    const target=this.resources.own(pmrem.fromEquirectangular(hdr));
    this.scene.environment=target.texture;hdr.dispose();pmrem.dispose();
  }
  update(time,state){
    this.floorUniform.uTime.value=time;this.floorUniform.uDark.value=state.darkness;
    this.dustUniform.uTime.value=time;this.dustUniform.uOpacity.value=1-state.manifest*.85;
    this.scene.background.copy(this.waterColor).lerp(this.abyssColor,state.darkness);
    this.scene.fog.color.copy(this.scene.background);this.scene.fog.density=.032+state.darkness*.025;
    this.hemisphere.intensity=1.5-state.darkness*.65;
    this.key.intensity=3.5-state.darkness*1.5;
  }
}
