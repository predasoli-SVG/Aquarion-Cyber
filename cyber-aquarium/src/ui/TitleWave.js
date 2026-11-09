import * as THREE from 'three';

/** The accessible title stays in the DOM. Only its outlined visual is GPU rendered. */
export class TitleWave {
  constructor(renderer,resources){
    this.renderer=renderer;this.element=document.querySelector('#water-title');
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(0,1,1,0,-10,10);
    this.uniforms={uMap:{value:null},uTime:{value:0},uOpacity:{value:1},uMotion:{value:1},uPointer:{value:new THREE.Vector2(.5,.5)}};
    const geometry=resources.own(new THREE.PlaneGeometry(1,1));
    this.material=resources.own(new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D uMap;uniform float uTime;uniform float uOpacity;uniform float uMotion;uniform vec2 uPointer;varying vec2 vUv;void main(){vec2 uv=vUv;float ripple=sin(uv.y*28.+uTime*.8+sin(uv.x*11.-uTime*.4));float cursor=exp(-length(uv-uPointer)*4.);uv.x+=ripple*.0025*uMotion;uv.y+=sin(uv.x*23.-uTime*.6)*.005*uMotion*(.35+cursor);vec4 ink=texture2D(uMap,uv);gl_FragColor=vec4(ink.rgb,ink.a*uOpacity);}`}));
    this.mesh=new THREE.Mesh(geometry,this.material);this.scene.add(this.mesh);
    this.texture=null;this.resources=resources;
    this.resize();
  }
  resize(){
    const rect=this.element.getBoundingClientRect(),style=getComputedStyle(this.element);
    const canvas=document.createElement('canvas');const dpr=Math.min(devicePixelRatio,2);
    canvas.width=Math.ceil(rect.width*dpr);canvas.height=Math.ceil(rect.height*dpr*1.28);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    ctx.strokeStyle='#d9e9dc';ctx.lineWidth=.9;ctx.textBaseline='middle';
    ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    if('letterSpacing' in ctx)ctx.letterSpacing=style.letterSpacing;
    const measure=ctx.measureText(this.element.textContent).width;
    ctx.save();ctx.scale(rect.width/measure,1);ctx.strokeText(this.element.textContent,0,canvas.height/dpr*.46);ctx.restore();
    this.texture?.dispose();this.texture=new THREE.CanvasTexture(canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.uniforms.uMap.value=this.texture;
    this.camera.left=0;this.camera.right=innerWidth;this.camera.top=0;this.camera.bottom=innerHeight;this.camera.updateProjectionMatrix();
    this.textureHeight=canvas.height/dpr;
    this.element.style.webkitTextStrokeColor='transparent';
  }
  render(time,state){
    if(state.progress>.19||state.reduced){this.element.style.webkitTextStrokeColor='';return;}
    this.element.style.webkitTextStrokeColor='transparent';
    const r=this.element.getBoundingClientRect();
    if(r.bottom<0)return;
    this.mesh.position.set(r.left+r.width/2,r.top+r.height/2,0);
    this.mesh.scale.set(r.width,this.textureHeight,1);
    this.uniforms.uTime.value=time;this.uniforms.uMotion.value=1;
    this.uniforms.uOpacity.value=Math.min(1,Math.max(0,(r.bottom+40)/100));
    // Orthographic projection has a top-down Y axis. Flip the quad's UV orientation.
    this.mesh.scale.y=-this.textureHeight;
    const previous=this.renderer.autoClear;this.renderer.autoClear=false;this.renderer.clearDepth();
    this.renderer.render(this.scene,this.camera);this.renderer.autoClear=previous;
  }
  dispose(){this.texture?.dispose();this.element.style.webkitTextStrokeColor='';}
}
