import * as THREE from 'three';
import { random } from '../core/math.js';
import { particleVertex, particleFragment } from '../shaders/particles.js';

function textTargets() {
  const canvas=document.createElement('canvas'); canvas.width=1400;canvas.height=600;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='900 176px Arial';ctx.fillText('O FUTURO',700,208);
  ctx.font='900 169px Arial';ctx.fillText('NÃO É LIXO.',700,392);
  const image=ctx.getImageData(0,0,canvas.width,canvas.height).data, targets=[];
  for(let y=90;y<510;y+=3) for(let x=90;x<1310;x+=3) if(image[(y*1400+x)*4+3]>150) targets.push([(x/1400-.5),(.5-y/600)*600/1400]);
  return targets;
}

export class Particles {
  constructor(resources, count=50000) {
    const rng=random(601),targets=textTargets();
    const geometry=resources.own(new THREE.PlaneGeometry(1,1));
    const home=new Float32Array(count*3), target=new Float32Array(count*3), seeds=new Float32Array(count*4);
    for(let i=0;i<count;i++) {
      const x=(rng()-.5)*4.3,a=rng()*Math.PI*2;
      const radius=Math.sqrt(Math.max(.03,1-(x/2.4)**2));
      home.set([x,Math.sin(a)*.78*radius,Math.cos(a)*.63*radius],i*3);
      const dest=targets[Math.floor(rng()*targets.length)];
      target.set([dest[0]+(rng()-.5)*.0018,dest[1]+(rng()-.5)*.0018,rng()],i*3);
      seeds.set([rng(),rng(),rng(),rng()],i*4);
    }
    geometry.setAttribute('aHome',new THREE.InstancedBufferAttribute(home,3));
    geometry.setAttribute('aTarget',new THREE.InstancedBufferAttribute(target,3));
    geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,4));
    this.uniforms={uTime:{value:0},uExplode:{value:0},uScatter:{value:0},uManifest:{value:0},uVelocity:{value:0},uTextScale:{value:9},uPresence:{value:0},uFishMatrix:{value:new THREE.Matrix4()}};
    const material=resources.own(new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    this.mesh=resources.own(new THREE.InstancedMesh(geometry,material,count));
    this.mesh.name='50000-GPU-microparticles';this.mesh.frustumCulled=false;
    const identity=new THREE.Matrix4();
    for(let i=0;i<count;i++) this.mesh.setMatrixAt(i,identity);
    this.mesh.instanceMatrix.needsUpdate=true;
    this.mesh.visible=false;
  }
  /** Sample triangle area once, including each rigid part's GPU deformation data. */
  sampleFish(fish){
    const triangles=[],cdf=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let total=0;
    fish.root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const g=mesh.geometry,p=g.attributes.position,n=g.index?g.index.count:p.count;
      for(let i=0;i<n;i+=3){
        const ids=g.index?[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)]:[i,i+1,i+2];
        a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
        const area=b.sub(a).cross(c.sub(a)).length()*.5;
        if(area<1e-9)continue;
        total+=area;cdf.push(total);triangles.push({g,ids});
      }
    });
    const geometry=this.mesh.geometry,count=geometry.attributes.aHome.count,rng=random(908);
    const attrs={aHome:new Float32Array(count*3),aHomePivot:new Float32Array(count*3),aHomeDirection:new Float32Array(count*3),aHomeAxis:new Float32Array(count*3),aHomePhase:new Float32Array(count)};
    for(let i=0;i<count;i++){
      const pick=rng()*total;let low=0,high=cdf.length-1;
      while(low<high){const mid=(low+high)>>1;if(cdf[mid]<pick)low=mid+1;else high=mid;}
      const {g,ids}=triangles[low];let u=rng(),v=rng();if(u+v>1){u=1-u;v=1-v;}
      const p=g.attributes.position;
      a.fromBufferAttribute(p,ids[0]).multiplyScalar(1-u-v);b.fromBufferAttribute(p,ids[1]).multiplyScalar(u);c.fromBufferAttribute(p,ids[2]).multiplyScalar(v);a.add(b).add(c).toArray(attrs.aHome,i*3);
      for(const [dest,source] of [['aHomePivot','aPivot'],['aHomeDirection','aDirection'],['aHomeAxis','aAxis']]){
        a.fromBufferAttribute(g.attributes[source],ids[0]).toArray(attrs[dest],i*3);
      }
      attrs.aHomePhase[i]=g.attributes.aPhase.getX(ids[0]);
    }
    for(const [name,data] of Object.entries(attrs))geometry.setAttribute(name,new THREE.InstancedBufferAttribute(data,name==='aHomePhase'?1:3));
  }
  setQuality(quality){this.mesh.count=quality.count;}
  update(time,state,fish,camera){
    this.mesh.visible=state.particlePresence>.001;
    if(!this.mesh.visible)return;
    const u=this.uniforms;
    u.uTime.value=time;u.uExplode.value=state.explode;u.uScatter.value=state.scatter;u.uManifest.value=state.manifest;
    u.uVelocity.value=state.velocity;u.uPresence.value=state.particlePresence;
    fish.root.updateMatrixWorld(true);u.uFishMatrix.value.copy(fish.root.matrixWorld);
    const width=2*7.5*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect;
    u.uTextScale.value=Math.min(10.3,width*.98);
  }
}
