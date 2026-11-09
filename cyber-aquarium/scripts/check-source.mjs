import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { smooth, random } from '../src/core/math.js';

function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(`${dir}/${d.name}`):[`${dir}/${d.name}`]);}
for(const file of files('src').filter(f=>f.endsWith('.js'))){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0){process.stderr.write(result.stderr);process.exit(1);}
}
// Meaningful contracts: interpolation is reversible/bounded; seed mapping is stable.
assert.equal(smooth(0,1,-1),0);assert.equal(smooth(0,1,2),1);assert.equal(smooth(0,1,.5),.5);
const a=random(41),b=random(41);for(let i=0;i<100;i++)assert.equal(a(),b());
const source=files('src').filter(f=>f.endsWith('.js')).map(f=>readFileSync(f,'utf8')).join('\n');
assert.ok(!/https?:\/\/(unpkg|cdn\.jsdelivr)/.test(source),'Runtime libraries must be bundled.');
console.log('JavaScript syntax, deterministic interpolation, seeded correspondence and local dependency checks passed.');
