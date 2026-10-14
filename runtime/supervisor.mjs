import {spawn} from 'node:child_process';
import {readFile,writeFile,unlink,access} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const exists=async path=>{try{await access(path);return true;}catch{return false;}};
export async function supervise({root,commands,env={},restartMs=10000,pollMs=500}) {
 const stopFile=join(root,'.data/stop'),statusFile=join(root,'.data/supervisor.json');
 const children=new Set(),timers=new Set();let stopping=false;
 const start=command=>{
  if(stopping)return;
  const fd=openSync(join(root,'.data',command.name+'.log'),'a',0o600);
  const child=spawn(command.file,command.args,{cwd:root,env:{...process.env,...env},stdio:['ignore',fd,fd],windowsHide:true});closeSync(fd);children.add(child);
  child.on('error',()=>{}); // The close event handles both startup failures and process exits.
  child.on('close',()=>{children.delete(child);if(!stopping){const timer=setTimeout(()=>{timers.delete(timer);start(command);},restartMs);timers.add(timer);}});
 };
 await writeFile(statusFile,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}),{mode:0o600});
 for(const command of commands)start(command);
 await new Promise(resolveDone=>{
  let checking=false;
  const check=async()=>{
   if(checking)return;checking=true;
   try{if(await exists(stopFile)){
    stopping=true;clearInterval(interval);for(const timer of timers)clearTimeout(timer);
    await Promise.all([...children].map(child=>new Promise(done=>{child.once('close',done);child.kill();})));
    resolveDone();
   }}finally{checking=false;}
  };
  const interval=setInterval(()=>check().catch(()=>{stopping=true;clearInterval(interval);for(const child of children)child.kill();resolveDone();}),pollMs);
 });
 await unlink(statusFile).catch(e=>{if(e.code!=='ENOENT')throw e;});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(process.argv[2]);
 const settings=JSON.parse(await readFile(join(root,'.data/installation.json'),'utf8'));
 await supervise({root,commands:settings.commands,env:settings.env});
}
