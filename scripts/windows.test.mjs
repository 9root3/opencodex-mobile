import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {supervise} from '../runtime/supervisor.mjs';
import {registrationScript,psArgs} from './install-windows.mjs';

const waitFor=async check=>{for(let n=0;n<100;n++){if(await check())return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out waiting for process state');};
test('Supervisor restarts exited children and stops without respawning them',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocx-supervisor-'));await mkdir(join(root,'.data'));
 const count=join(root,'starts');
 const done=supervise({root,commands:[{name:'web',file:process.execPath,args:['-e',`require('node:fs').appendFileSync(${JSON.stringify(count)},'started\\n');setTimeout(()=>process.exit(1),80)`]}],restartMs:30,pollMs:20});
 try{await waitFor(async()=>{try{return (await readFile(count,'utf8')).trim().split('\n').length>=2;}catch{return false;}});}
 finally{await writeFile(join(root,'.data/stop'),'stop');await done;}
 const before=await readFile(count,'utf8');await new Promise(r=>setTimeout(r,150));assert.equal(await readFile(count,'utf8'),before);
 await assert.rejects(access(join(root,'.data/supervisor.json')),{code:'ENOENT'});
});
test('Supervisor retries a missing executable and honors stop',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocx-supervisor-failure-'));await mkdir(join(root,'.data'));
 const done=supervise({root,commands:[{name:'tunnel',file:join(root,'missing'),args:[]}],restartMs:20,pollMs:20});
 await new Promise(r=>setTimeout(r,100));await writeFile(join(root,'.data/stop'),'stop');await done;
});
test('Windows task uses a limited login principal and encodes paths without shell interpolation',()=>{
 const script=registrationScript({taskName:'test',root:"C:\\Users\\O'Brien & Lab\\OpenCodexMobile",node:'C:\\Program Files\\nodejs\\node.exe'});
 assert.ok(script.includes('-LogonType Interactive -RunLevel Limited'));
 assert.ok(script.includes('-MultipleInstances IgnoreNew'));
 const encoded=script.match(/-EncodedCommand ([A-Za-z0-9+/=]+)/)[1];
 const runner=Buffer.from(encoded,'base64').toString('utf16le');assert.ok(runner.includes("O''Brien & Lab"));assert.ok(runner.includes("'C:\\Program Files\\nodejs\\node.exe'"));
 assert.equal(Buffer.from(psArgs(script).at(-1),'base64').toString('utf16le'),script);
});
