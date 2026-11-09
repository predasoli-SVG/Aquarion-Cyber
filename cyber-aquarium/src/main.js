import { Aquarium } from './core/Aquarium.js';
import { Interface } from './ui/Interface.js';

const ui=new Interface();
let aquarium;
try{aquarium=new Aquarium(ui);aquarium.start();}catch(error){
  console.error('WebGL edition could not start.',error);
  aquarium?.dispose();ui.fallback();
}
window.addEventListener('pagehide',event=>{
  // bfcache keeps the live instance. A real navigation releases all GPU/audio resources.
  if(!event.persisted){aquarium?.dispose();ui.dispose();}
});
if(import.meta.hot)import.meta.hot.dispose(()=>{aquarium?.dispose();ui.dispose();});
