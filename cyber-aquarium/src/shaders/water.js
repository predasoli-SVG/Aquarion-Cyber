export const waterVertex = /* glsl */`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
export const waterFragment = /* glsl */`
precision highp float;
#include <packing>
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;
uniform float uTime;
uniform float uFocus;
uniform float uAperture;
uniform float uDarkness;
uniform float uNear;
uniform float uFar;
uniform int uSteps;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 viewPosition(vec2 uv,float depth){vec4 v=uInverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return v.xyz/v.w;}
void main(){
  float depth=texture2D(tDepth,vUv).x;
  float distanceZ=-perspectiveDepthToViewZ(depth,uNear,uFar);
  float coc=clamp(abs(distanceZ-uFocus)/max(distanceZ,1.)*uAperture,0.,4.);
  vec3 color=texture2D(tDiffuse,vUv).rgb;
  // A 12-point golden-angle aperture. Depth is the REAL deformed scene depth,
  // captured in the main PBR render; there is no mismatched override material.
  if(coc>.04){
    vec3 total=color;float weight=1.;
    for(int i=0;i<12;i++){
      float angle=float(i)*2.39996323;
      vec2 offset=vec2(cos(angle),sin(angle))*sqrt((float(i)+.5)/12.)*coc/uResolution;
      float sampleDepth=texture2D(tDepth,vUv+offset).x;
      float z=-perspectiveDepthToViewZ(sampleDepth,uNear,uFar);
      float w=smoothstep(-1.5,1.5,z-distanceZ)+.15;
      total+=texture2D(tDiffuse,vUv+offset).rgb*w;weight+=w;
    }
    color=total/weight;
  }
  // Depth-occluded single-scattering raymarch in world space.
  // Procedural light-cookie shafts approximate refracted surface lighting.
  vec3 v=viewPosition(vUv,depth);
  vec3 worldDirection=normalize((uCameraWorld*vec4(normalize(v),0.)).xyz);
  vec3 eye=uCameraWorld[3].xyz;
  float rayLength=min(length(v),28.);
  float stepLength=rayLength/float(uSteps);
  float jitter=hash(floor(vUv*uResolution));
  float scatter=0.;
  for(int i=0;i<16;i++){
    if(i>=uSteps)break;
    float travel=(float(i)+jitter)*stepLength;
    vec3 p=eye+worldDirection*travel;
    vec2 q=(p.xz-vec2(-4.,-5.))*8./max(1.,8.-p.y);
    float pattern=sin(q.x*.78+uTime*.07+sin(q.y*.45))*.5+.5;
    pattern*=sin(q.x*.31-q.y*.7-uTime*.04)*.5+.5;
    float shaft=pow(pattern,5.);
    float extinction=exp(-travel*.07);
    scatter+=shaft*extinction*stepLength*.015;
  }
  float sun=pow(max(0.,dot(worldDirection,normalize(vec3(-.3,.75,-.5)))),5.);
  color+=vec3(.34,.67,.48)*scatter*(.7+sun)*(1.-uDarkness*.73);
  color*=mix(vec3(.91,1.,.96),vec3(.68,.89,.94),uDarkness*.5);
  gl_FragColor=vec4(color,1.);
}
`;
export const filmFragment = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAberration;
uniform float uGrain;
uniform vec2 uResolution;
varying vec2 vUv;
void main(){
  vec2 fromCenter=vUv-.5;
  vec2 shift=fromCenter*dot(fromCenter,fromCenter)*uAberration;
  vec3 color=vec3(texture2D(tDiffuse,vUv+shift).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-shift).b);
  float grain=fract(sin(dot(vUv*uResolution+fract(uTime)*100.,vec2(12.9898,78.233)))*43758.5453)-.5;
  color+=grain*uGrain;
  float vignette=1.-smoothstep(.25,.82,length(fromCenter));
  color*=.78+.22*vignette;
  gl_FragColor=vec4(max(color,0.),1.);
}
`;
