import * as THREE from 'three';
import { random } from '../core/math.js';

export function makeSurfaceMaps(resources) {
  const size = 256, rng = random(41);
  const heights = new Float32Array(size * size);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const scratch = Math.pow(Math.max(0, Math.sin(y * .77 + x * .024)), 50) * .3;
    heights[y * size + x] = rng() * .18 + scratch + .045 * Math.sin(x * .15) * Math.cos(y * .2);
  }
  const get = (x, y) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const n = new THREE.Vector3((get(x - 1, y) - get(x + 1, y)) * 2, (get(x, y - 1) - get(x, y + 1)) * 2, 1).normalize();
    normalData.set([(n.x * .5 + .5) * 255, (n.y * .5 + .5) * 255, (n.z * .5 + .5) * 255, 255], i);
    const r = 100 + get(x, y) * 200;
    roughData.set([r, r, r, 255], i);
  }
  const make = data => { const t = resources.own(new THREE.DataTexture(data, size, size)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  return { normal: make(normalData), roughness: make(roughData) };
}

export const transformGLSL = /* glsl */`
  uniform float uProgress;
  uniform float uTime;
  uniform float uDissolve;
  attribute vec3 aPivot;
  attribute vec3 aDirection;
  attribute vec3 aAxis;
  attribute float aPhase;
  varying vec3 vAquaWorld;
  mat3 rotatePart(vec3 a, float angle) {
    float s = sin(angle), c = cos(angle), oc = 1.0 - c;
    return mat3(oc*a.x*a.x+c, oc*a.x*a.y+a.z*s, oc*a.z*a.x-a.y*s,
      oc*a.x*a.y-a.z*s, oc*a.y*a.y+c, oc*a.y*a.z+a.x*s,
      oc*a.z*a.x+a.y*s, oc*a.y*a.z-a.x*s, oc*a.z*a.z+c);
  }
`;

/** All rigid parts share uniforms, while per-vertex attributes identify their rigid body. */
export function attachFishShader(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = transformGLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      float partProgress = smoothstep(aPhase * 0.18, 1.0, uProgress);
      mat3 partRotation = rotatePart(aAxis, partProgress * (0.5 + aPhase));
      objectNormal = partRotation * objectNormal;
      #ifdef USE_TANGENT
        objectTangent = partRotation * objectTangent;
      #endif
    `).replace('#include <begin_vertex>', `
      vec3 transformed = aPivot + partRotation * (position - aPivot);
      transformed += aDirection * partProgress * (2.8 + aPhase * 1.4);
      float tailWeight = (1.0 - smoothstep(-3.4, 1.2, position.x));
      transformed.z += sin(position.x * 1.3 - uTime * 1.5) * 0.12 * tailWeight * (1.0 - partProgress);
      transformed.y += sin(uTime * 0.65 + aPhase * 6.28) * 0.07 * partProgress;
    `).replace('#include <project_vertex>', `
      #include <project_vertex>
      vAquaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = `uniform float uTime; uniform float uDissolve; varying vec3 vAquaWorld;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
      #include <clipping_planes_fragment>
      float dither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898,78.233))) * 43758.5453);
      if (dither < uDissolve) discard;
    `).replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      vec2 water = vAquaWorld.xz * 3.1 + vec2(uTime * 0.19, -uTime * 0.14);
      float caustic = pow(max(0.0, sin(water.x + sin(water.y * 1.4)) * sin(water.y + cos(water.x * 1.3))), 12.0);
      totalEmissiveRadiance += vec3(0.12, 0.37, 0.27) * caustic * 0.4;
    `);
  };
  material.customProgramCacheKey = () => 'aquarium-rigid-pbr-v1';
  return material;
}

export function createFishMaterials(resources, uniforms) {
  const maps = makeSurfaceMaps(resources);
  const physical = opts => resources.own(attachFishShader(new THREE.MeshPhysicalMaterial({
    normalMap: maps.normal, roughnessMap: maps.roughness, normalScale: new THREE.Vector2(.35, .35),
    metalness: .92, roughness: .4, clearcoat: .35, clearcoatRoughness: .22, envMapIntensity: 1.4, ...opts
  }), uniforms));
  const materials = {
    armor: physical({ color: '#7e9990', roughness: .35 }),
    dark: physical({ color: '#142e2b', roughness: .65 }),
    copper: physical({ color: '#bc7d4d', roughness: .4, clearcoat: .55 }),
    circuit: physical({ color: '#174939', metalness: .5, roughness: .68 }),
    chrome: physical({ color: '#d1dacb', roughness: .19 }),
    glow: physical({ color: '#9ff7d4', emissive: '#69ffd3', emissiveIntensity: 3, roughness: .18, metalness: .2 }),
    glass: physical({ color: '#4c9b8b', metalness: .25, roughness: .12, clearcoat: 1, iridescence: .8, iridescenceIOR: 1.4 })
  };
  return { materials, maps };
}
