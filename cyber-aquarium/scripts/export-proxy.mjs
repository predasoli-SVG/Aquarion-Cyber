/** Export the exact procedural meshes for a reproducible offline fallback render. */
import { writeFileSync } from 'node:fs';
import { Vector3, Matrix3 } from 'three';
import { Fish } from '../src/scene/Fish.js';
import { Resources } from '../src/core/Resources.js';
import { CONFIG } from '../src/config.js';
const resources=new Resources(),fish=new Fish(resources,CONFIG);
fish.root.position.set(2.4,-.14,0);fish.root.rotation.set(.03,-.24,.035);fish.root.scale.setScalar(1.12);fish.root.updateMatrixWorld(true);
const meshes=[],v=new Vector3();
fish.root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const a=mesh.geometry.attributes.position,vertices=[],normals=[];const nm=new Matrix3().getNormalMatrix(mesh.matrixWorld);
  for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);vertices.push([v.x,-v.z,v.y].map(x=>+x.toFixed(5)));}
  const n=mesh.geometry.attributes.normal;for(let i=0;i<n.count;i++){v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();normals.push([v.x,-v.z,v.y]);}
  const m=mesh.material;
  meshes.push({name:mesh.name,vertices,normals,color:m.color.toArray(),metalness:m.metalness,roughness:m.roughness,emission:m.emissive.toArray(),emissionStrength:m.emissiveIntensity});
});
writeFileSync(process.argv[2]??'/tmp/cyber-aquarium-proxy.json',JSON.stringify(meshes));
resources.dispose();
console.log(`Exported ${fish.partCount} rigid parts in ${meshes.length} material batches.`);
