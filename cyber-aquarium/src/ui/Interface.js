import { Audio } from '../core/Audio.js';

export class Interface {
  constructor(){
    this.abort=new AbortController();this.options={signal:this.abort.signal};this.audio=new Audio();
    this.depth=document.querySelector('#depth');this.chapterLabel=document.querySelector('#chapter-label');
    this.rail=[...document.querySelectorAll('.rail-stop')];this.lastChapter=-1;this.lastDepth=-1;
    this.labels=['SUPERFÍCIE','A MATÉRIA','O INVISÍVEL','IMPACTO'];this.director=null;
    document.querySelectorAll('[data-open]').forEach(button=>{
      button.setAttribute('aria-haspopup','dialog');
      button.addEventListener('click',()=>{
        const dialog=document.getElementById(button.dataset.open);
        dialog.showModal();this.director?.lenis?.stop();
        document.documentElement.classList.add('modal-open');
      },this.options);
    });
    document.querySelectorAll('dialog').forEach(dialog=>{
      dialog.setAttribute('data-lenis-prevent','');
      dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close(),this.options);
      dialog.addEventListener('click',event=>{
        if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}
      },this.options);
      dialog.addEventListener('close',()=>{this.director?.lenis?.start();document.documentElement.classList.remove('modal-open');},this.options);
    });
    document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
      const target=document.querySelector(link.getAttribute('href'));if(!target)return;
      event.preventDefault();
      if(this.director)this.director.scrollTo(target);else target.scrollIntoView();
      history.replaceState(null,'',link.getAttribute('href'));
      if(link.classList.contains('skip-link')){target.tabIndex=-1;target.focus({preventScroll:true});}
    },this.options));
    document.querySelector('[data-scroll-top]').addEventListener('click',()=>this.director?.scrollTo(0),this.options);
    document.querySelector('#sound-toggle').addEventListener('click',async()=>{
      const button=document.querySelector('#sound-toggle');
      try{
        const active=await this.audio.toggle();button.setAttribute('aria-pressed',String(active));
        button.setAttribute('aria-label',active?'Desativar som ambiente':'Ativar som ambiente');
        document.querySelector('#sound-label').textContent=active?'SOM ATIVADO':'SOM DESLIGADO';
      }catch{document.querySelector('#sound-label').textContent='SOM INDISPONÍVEL';}
    },this.options);
    document.querySelector('#reduce-motion').addEventListener('change',event=>this.director?.setReduced(event.target.checked),this.options);
    document.addEventListener('visibilitychange',()=>document.hidden?this.audio.suspend():this.audio.resume(),this.options);
  }
  connect(director,onQuality){
    this.director=director;this.qualityMode=0;
    document.querySelector('#quality-toggle').addEventListener('click',()=>{
      this.qualityMode=(this.qualityMode+1)%3;
      const key=['balanced','high','low'][this.qualityMode];onQuality(key);
      const label=['AUTO','ALTA','LEVE'][this.qualityMode],button=document.querySelector('#quality-toggle');
      button.firstChild.textContent=`${label} `;button.setAttribute('aria-label',`Qualidade gráfica: ${label.toLowerCase()}. Clique para alterar.`);
    },this.options);
  }
  update(state){
    if(this.lastDepth!==state.depth){this.depth.textContent=String(state.depth).padStart(3,'0');this.lastDepth=state.depth;}
    if(this.lastChapter!==state.chapter){
      this.chapterLabel.textContent=this.labels[state.chapter];
      this.rail.forEach((el,i)=>{el.classList.toggle('is-active',i===state.chapter);if(i===state.chapter)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
      this.lastChapter=state.chapter;
    }
    const opacity=Math.max(0,1-state.progress*8);
    document.querySelector('.specimen-caption').style.opacity=opacity;
    document.querySelectorAll('.part-callout').forEach(el=>{el.style.opacity=Math.min(1,state.explode*2)*(1-state.dissolve);});
    this.audio.update(state.depth);
  }
  ready(){document.querySelector('#loader').classList.add('is-loaded');document.body.dataset.ready='true';}
  fallback(){
    this.ready();document.body.classList.add('reading-mode');document.querySelector('#fallback-notice').hidden=false;
    document.querySelector('#quality-toggle').disabled=true;
    if(!this.director){
      this.director={scrollTo:target=>typeof target==='number'?window.scrollTo({top:target,behavior:'instant'}):target.scrollIntoView({behavior:'instant'}),setReduced:value=>document.body.classList.toggle('reduced-motion',value)};
      const refresh=()=>{
        const sections=[...document.querySelectorAll('main>section')];let chapter=0;
        sections.forEach((s,i)=>{if(s.getBoundingClientRect().top<innerHeight*.4)chapter=i;});
        const progress=window.scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);
        this.update({chapter,depth:Math.round(progress*1080),progress,explode:0,dissolve:0});
      };
      window.addEventListener('scroll',refresh,this.options);refresh();
    }
  }
  dispose(){this.abort.abort();this.audio.dispose();}
}
