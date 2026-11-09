export const particleVertex = /* glsl */`
precision highp float;
attribute vec3 aHome;
attribute vec3 aTarget;
attribute vec3 aHomePivot;
attribute vec3 aHomeDirection;
attribute vec3 aHomeAxis;
attribute float aHomePhase;
attribute vec4 aSeed;
uniform float uTime;
uniform float uScatter;
uniform float uExplode;
uniform float uManifest;
uniform float uVelocity;
uniform float uTextScale;
uniform float uPresence;
uniform mat4 uFishMatrix;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
// Analytic curl of a three-component trigonometric vector potential.
// Divergence-free flow field, evaluated per instance entirely on the GPU.
vec3 curl(vec3 p, float t) {
  return vec3(-sin(p.x+t)*sin(p.y)-cos(p.z+t)*cos(p.x),
    -sin(p.y+t)*sin(p.z)-cos(p.x+t)*cos(p.y),
    -sin(p.z+t)*sin(p.x)-cos(p.y+t)*cos(p.z));
}
mat3 partRotation(vec3 a,float angle){
  float s=sin(angle),c=cos(angle),o=1.-c;
  return mat3(o*a.x*a.x+c,o*a.x*a.y+a.z*s,o*a.z*a.x-a.y*s,
    o*a.x*a.y-a.z*s,o*a.y*a.y+c,o*a.y*a.z+a.x*s,
    o*a.z*a.x+a.y*s,o*a.y*a.z-a.x*s,o*a.z*a.z+c);
}
void main(){
  vUv=uv;
  float t=uTime*.12;
  float ep=smoothstep(aHomePhase*.18,1.,uExplode);
  vec3 rigid=aHomePivot+partRotation(aHomeAxis,ep*(.5+aHomePhase))*(aHome-aHomePivot);
  rigid+=aHomeDirection*ep*(2.8+aHomePhase*1.4);
  rigid.z+=sin(aHome.x*1.3-uTime*1.5)*.12*(1.-smoothstep(-3.4,1.2,aHome.x))*(1.-ep);
  rigid.y+=sin(uTime*.65+aHomePhase*6.28)*.07*ep;
  vec3 origin=(uFishMatrix*vec4(rigid,1.)).xyz;
  vec3 cloud=(aSeed.xyz-.5)*vec3(17.,11.,12.);
  cloud+=curl(cloud*.27,t)*(1.1+abs(uVelocity)*.2);
  cloud+=curl(cloud*.68,-t*.65)*.35;
  cloud.y+=sin(t+aSeed.w*30.)*.6;
  vec3 world=mix(origin,cloud,smoothstep(0.,1.,uScatter));
  vec4 view=modelViewMatrix*vec4(world,1.);
  vec3 textPosition=vec3(aTarget.xy*uTextScale+vec2(0.,.38),-7.5+aTarget.z*.018);
  view.xyz=mix(view.xyz,textPosition,smoothstep(0.,1.,uManifest));
  float size=mix(.009+aSeed.w*.025,.012,uManifest)*uPresence;
  vec2 p=position.xy;
  float a=aSeed.w*6.28+uTime*.15*(1.-uManifest);
  p=mat2(cos(a),-sin(a),sin(a),cos(a))*p;
  view.xy+=p*size;
  gl_Position=projectionMatrix*view;
  vColor=mix(vec3(.23,.65,.56),vec3(.84,.97,.59),step(.58,aSeed.w));
  vColor=mix(vColor,vec3(.77,.47,.23),step(.89,aSeed.w)*(1.-uManifest));
  vAlpha=mix(.4,.9,aSeed.w)*uPresence;
}
`;
export const particleFragment = /* glsl */`
precision highp float;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d=length(vUv-.5)*2.;
  if(d>1.) discard;
  float alpha=(1.-smoothstep(.25,1.,d))*vAlpha;
  gl_FragColor=vec4(vColor*1.35,alpha);
}
`;
