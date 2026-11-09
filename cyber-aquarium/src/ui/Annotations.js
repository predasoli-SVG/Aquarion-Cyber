import * as THREE from 'three';
import { smooth } from '../core/math.js';

/** Only two label anchors are projected on the CPU. Geometry remains GPU-driven. */
export class Annotations {
  constructor(fish){
    this.labels=[...document.querySelectorAll('.part-callout')];
    this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');this.svg.classList.add('leader-lines');this.svg.setAttribute('aria-hidden','true');
    this.elements=this.labels.map(()=>{
      const line=document.createElementNS(this.svg.namespaceURI,'line'),dot=document.createElementNS(this.svg.namespaceURI,'circle');
      dot.setAttribute('r','3');this.svg.append(line,dot);return {line,dot};
    });
    document.querySelector('.matter .chapter-panel').append(this.svg);
    this.vector=new THREE.Vector3();this.bind(fish);
  }
  bind(fish){
    const meshes=[];fish.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    this.anchors=['copper','circuit'].map((key,index)=>{
      const mesh=meshes.find(m=>m.name.includes(key))??meshes[index%meshes.length];
      const g=mesh.geometry;let chosen=0,best=Infinity;
      const target=new THREE.Vector3(index?-.2:-.5,index?.2:.6,.6);
      for(let i=0;i<g.attributes.aPivot.count;i++){
        this.vector.fromBufferAttribute(g.attributes.aPivot,i);const d=this.vector.distanceToSquared(target);if(d<best){best=d;chosen=i;}
      }
      return {pivot:new THREE.Vector3().fromBufferAttribute(g.attributes.aPivot,chosen),direction:new THREE.Vector3().fromBufferAttribute(g.attributes.aDirection,chosen),phase:g.attributes.aPhase.getX(chosen)};
    });
  }
  update(time,state,camera,fish){
    const opacity=Math.min(1,state.explode*2)*(1-state.dissolve);
    this.svg.style.opacity=String(opacity);if(opacity<.01||innerWidth<1001)return;
    this.svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
    const bounds=this.svg.getBoundingClientRect();fish.root.updateMatrixWorld(true);
    this.anchors.forEach((anchor,i)=>{
      const ep=smooth(anchor.phase*.18,1,state.explode),p=this.vector.copy(anchor.pivot);
      p.addScaledVector(anchor.direction,ep*(2.8+anchor.phase*1.4));
      p.z+=Math.sin(anchor.pivot.x*1.3-time*1.5)*.12*(1-smooth(-3.4,1.2,anchor.pivot.x))*(1-ep);
      p.y+=Math.sin(time*.65+anchor.phase*6.28)*.07*ep;
      p.applyMatrix4(fish.root.matrixWorld).project(camera);
      const x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;
      const rect=this.labels[i].getBoundingClientRect();const {line,dot}=this.elements[i];
      line.setAttribute('x1',String(rect.left-bounds.left));line.setAttribute('y1',String(rect.top-bounds.top+22));
      line.setAttribute('x2',String(x-bounds.left));line.setAttribute('y2',String(y-bounds.top));
      dot.setAttribute('cx',String(x-bounds.left));dot.setAttribute('cy',String(y-bounds.top));
    });
  }
  dispose(){this.svg.remove();}
}
