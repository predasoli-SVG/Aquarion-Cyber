/** Opt-in procedural underwater soundscape. No autoplay and no external audio. */
export class Audio {
  constructor(){this.context=null;this.active=false;this.nodes=[];}
  async toggle(){
    if(!this.context){
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return false;
      this.context=new Context();
      const c=this.context,buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);
      let last=0;
      for(let i=0;i<data.length;i++){last=(last+(.02*(Math.random()*2-1)))/1.02;data[i]=last*3.5;}
      const source=c.createBufferSource();source.buffer=buffer;source.loop=true;
      this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=320;
      this.gain=c.createGain();this.gain.gain.value=0;
      source.connect(this.filter).connect(this.gain).connect(c.destination);source.start();
      this.nodes.push(source,this.filter,this.gain);
      const oscillator=c.createOscillator();oscillator.frequency.value=51;
      const drone=c.createGain();drone.gain.value=.015;oscillator.connect(drone).connect(this.gain);oscillator.start();
      this.nodes.push(oscillator,drone);
    }
    await this.context.resume();this.active=!this.active;
    this.gain.gain.setTargetAtTime(this.active ? .22 : 0,this.context.currentTime,.5);
    return this.active;
  }
  update(depth){if(this.context&&this.active)this.filter.frequency.setTargetAtTime(320-depth*.17,this.context.currentTime,1);}
  suspend(){this.context?.suspend();}
  resume(){if(this.active)this.context?.resume();}
  dispose(){this.nodes.forEach(n=>{n.stop?.();n.disconnect();});this.nodes=[];this.context?.close();}
}
