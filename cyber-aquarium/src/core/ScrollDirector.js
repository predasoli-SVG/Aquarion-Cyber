import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { clamp01, smooth, lerp } from './math.js';

gsap.registerPlugin(ScrollTrigger);

/** One clock, one scroll coordinate, deterministic forward AND reverse playback. */
export class ScrollDirector {
  constructor(onFrame){
    this.onFrame=onFrame;this.sections=[...document.querySelectorAll('main>section')];
    this.media=matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced=this.media.matches;this.userReduced=null;this.lastY=-1;this.velocity=0;
    this.state={progress:0,explode:0,dissolve:0,scatter:0,manifest:0,darkness:0,particlePresence:0,rotation:0,fishX:2.5,fishY:0,fishScale:1,focus:13,velocity:0,reduced:this.reduced,chapter:0,depth:0};
    this.measure=()=>{this.tops=this.sections.map(s=>s.getBoundingClientRect().top+window.scrollY);this.max=Math.max(1,document.documentElement.scrollHeight-innerHeight);};
    this.onMedia=()=>{if(this.userReduced===null)this.setReduced(this.media.matches);};
    this.media.addEventListener('change',this.onMedia);
    this.ticker=time=>{
      this.lenis?.raf(time*1000);
      if(document.hidden)return;
      this.update(time);
    };
    this.configure();
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(this.ticker);
    ScrollTrigger.addEventListener('refresh',this.measure);
  }
  configure(){
    this.triggers?.forEach(t=>t.kill());this.triggers=[];this.lenis?.destroy();this.lenis=null;
    document.body.classList.toggle('reduced-motion',this.reduced);
    document.querySelector('#reduce-motion').checked=this.reduced;
    if(!this.reduced){
      this.lenis=new Lenis({lerp:.085,smoothWheel:true,syncTouch:false,autoRaf:false});
      this.lenis.on('scroll',ScrollTrigger.update);
      for(const section of this.sections.slice(1)){
        this.triggers.push(ScrollTrigger.create({trigger:section,start:'top top',end:()=>`+=${Math.max(1,section.offsetHeight-innerHeight)}`,pin:section.querySelector('.chapter-panel'),pinSpacing:false,anticipatePin:1,invalidateOnRefresh:true}));
      }
    }
    this.measure();ScrollTrigger.refresh();this.lastY=-1;
  }
  setReduced(value){this.userReduced=value;this.reduced=value;this.configure();if(document.querySelector('dialog[open]'))this.lenis?.stop();}
  scrollTo(element){
    if(this.lenis)this.lenis.scrollTo(element,{duration:1.8,offset:0});
    else if(typeof element==='number')window.scrollTo({top:element,behavior:'instant'});
    else element.scrollIntoView({behavior:'instant'});
  }
  update(time){
    const y=window.scrollY,h=innerHeight,mobile=innerWidth<641;
    const [surface,matter,invisible,impact]=this.tops;
    const state=this.state;
    const v=this.lenis?this.lenis.velocity:(this.lastY<0?0:y-this.lastY);
    this.velocity=lerp(this.velocity,Math.max(-3,Math.min(3,v*.035)),.08);
    let chapter=0;
    for(let i=1;i<this.tops.length;i++)if(y>=this.tops[i]-h*.3)chapter=i;
    Object.assign(state,{
      progress:clamp01(y/this.max),
      explode:smooth(matter+h*.08,invisible-h*.27,y),
      dissolve:smooth(invisible-h*.38,invisible+h*.48,y),
      scatter:smooth(invisible-h*.15,impact-h*.18,y),
      manifest:smooth(impact-h*.1,impact+h*.37,y),
      darkness:smooth(0,matter+h*.35,y),
      particlePresence:smooth(invisible-h*.45,invisible+h*.38,y),
      rotation:smooth(matter-h*.45,invisible,y)*.73,
      fishX:lerp(mobile?.15:2.4,mobile?.65:2.1,smooth(0,matter,y)),
      fishY:lerp(mobile?-1.4:-.14,mobile?-1.9:-.7,smooth(0,matter,y)),
      fishScale:lerp(mobile?.75:1.12,mobile?.5:.8,smooth(matter-h*.5,invisible,y)),
      cameraY:lerp(1.0,-.5,smooth(0,matter+h*.2,y)),
      cameraZ:lerp(mobile?13.8:12.6,12.4,smooth(0,matter,y)),
      targetY:lerp(0,-.8,smooth(0,matter+h*.2,y)),
      focus:lerp(12.6,12.4,smooth(0,matter,y)),
      velocity:this.velocity,reduced:this.reduced,chapter,depth:Math.round(clamp01(y/this.max)*1080)
    });
    if(this.reduced){
      state.explode=chapter>=1?.55:0;state.dissolve=chapter>=2?1:0;
      state.particlePresence=chapter>=2?1:0;state.scatter=chapter>=2?.7:0;state.manifest=chapter===3?1:0;
      state.rotation=0;state.velocity=0;
      if(y===this.lastY)return;
    }
    this.lastY=y;this.onFrame(this.reduced?0:time,state);
  }
  invalidate(){this.lastY=-1;}
  dispose(){
    gsap.ticker.remove(this.ticker);this.lenis?.destroy();this.triggers.forEach(t=>t.kill());
    ScrollTrigger.removeEventListener('refresh',this.measure);this.media.removeEventListener('change',this.onMedia);
  }
}
