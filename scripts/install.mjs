#!/usr/bin/env node
import {cp,mkdir,readFile,writeFile,access,chmod} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const managedFiles=['server.mjs','public','package.json','package-lock.json','README.md','README.ko.md','LICENSE'];
export async function copySource(source,target){
 await mkdir(target,{recursive:true,mode:0o700});
 for(const file of managedFiles)await cp(join(source,file),join(target,file),{recursive:true});
}
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function agentPlist(label,args,root,env){return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${xml(label)}</string><key>ProgramArguments</key><array>${args.map(a=>'<string>'+xml(a)+'</string>').join('')}</array><key>WorkingDirectory</key><string>${xml(root)}</string><key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k,v])=>'<key>'+xml(k)+'</key><string>'+xml(v)+'</string>').join('')}</dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>${xml(join(root,'.data',label+'.log'))}</string><key>StandardErrorPath</key><string>${xml(join(root,'.data',label+'.error.log'))}</string></dict></plist>`;}
async function main(){
 if(process.platform!=='darwin')throw Error('This installer currently supports macOS only.');
 if(Number(process.versions.node.split('.')[0])<20)throw Error('Node.js 20+ is required.');
 const source=dirname(dirname(fileURLToPath(import.meta.url))),root=join(homedir(),'Library/Application Support/OpenCodexMobile');
 const mode=process.argv[2]||'setup',domain=`gui/${process.getuid()}`,labels=['org.opencodex.mobile.web','org.opencodex.mobile.tunnel'];
 const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'});
 if(mode==='status'){for(const label of labels)spawnSync('launchctl',['print',`${domain}/${label}`],{stdio:'inherit'});return;}
 if(mode==='stop'){for(const label of labels)spawnSync('launchctl',['bootout',`${domain}/${label}`],{stdio:'inherit'});console.log('Services stopped. All saved data is preserved.');return;}
 if(!['setup','update'].includes(mode))throw Error('Expected setup, update, status or stop.');
 const cli=execFileSync('/bin/zsh',['-lc','command -v opencodex'],{encoding:'utf8'}).trim();
 if(!cli)throw Error('Install OpenCodex first.');
 const config=JSON.parse(await readFile(join(homedir(),'.opencodex/config.json'),'utf8'));
 const health=await fetch(`http://127.0.0.1:${config.port||10100}/healthz`,{signal:AbortSignal.timeout(5000)});
 if(!health.ok)throw Error('Start OpenCodex before setup.');
 let settings={};try{settings=JSON.parse(await readFile(join(root,'.data/installation.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let url=process.argv.find(x=>x.startsWith('--url='))?.slice(6)||settings.publicURL;
 if(!url){try{const tunnels=await(await fetch('http://127.0.0.1:4040/api/tunnels',{signal:AbortSignal.timeout(2000)})).json();url=tunnels.tunnels?.find(t=>t.public_url?.startsWith('https://'))?.public_url;}catch{}}
 if(url){const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw Error('Use a plain HTTPS origin for --url.');url=parsed.origin;}
 await copySource(source,root);await mkdir(join(root,'.data'),{recursive:true,mode:0o700});await mkdir(join(root,'.tools'),{recursive:true,mode:0o700});
 // Migration is initial-only. Never overwrite runtime sessions, VAPID keys or subscriptions.
 if(!await exists(join(root,'.data/state.json'))&&await exists(join(source,'.data/state.json')))await cp(join(source,'.data'),join(root,'.data'),{recursive:true,force:false,errorOnExist:false});
 const ngrok=join(root,'.tools/ngrok');
 if(!await exists(ngrok)){
  if(await exists(join(source,'.tools/ngrok')))await cp(join(source,'.tools/ngrok'),ngrok);
  else{if(!['arm64','x64'].includes(process.arch))throw Error('Unsupported architecture');const archive=join(root,'.tools/ngrok.zip');run('curl',['-fL',`https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-${process.arch==='arm64'?'arm64':'amd64'}.zip`,'-o',archive]);run('unzip',['-o',archive,'-d',join(root,'.tools')]);}
  await chmod(ngrok,0o700);
 }
 const tokenFile=join(root,'.data/ngrok.yml');
 if(!await exists(tokenFile)){
  if(!process.stdin.isTTY)throw Error('Run setup in an interactive Mac terminal to enter the ngrok token.');
  // getpass keeps the token out of command arguments, logs and terminal echo.
  run('python3',['-c',`from getpass import getpass\nfrom pathlib import Path\nimport json,os\np=Path(${JSON.stringify(tokenFile)})\nt=getpass('ngrok authtoken (hidden): ').strip()\nif not t or any(c.isspace() for c in t): raise SystemExit('Invalid token')\nfd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)\nwith os.fdopen(fd,'w') as f: f.write('version: "3"\\nagent:\\n  authtoken: '+json.dumps(t)+'\\n')`]);
 }
 await chmod(tokenFile,0o600);run(ngrok,['config','check','--config',tokenFile]);
 if(!url)throw Error('Set your ngrok assigned domain: npm run setup -- --url=https://YOUR-DOMAIN. Credentials are saved; setup can be resumed.');
 const npm=process.env.npm_execpath;if(!npm)throw Error('Run this script through npm run setup/update.');
 execFileSync(process.execPath,[npm,'ci','--omit=dev','--prefix',root,'--cache',join(root,'.tools/npm-cache')],{stdio:'inherit'});
 const env={HOME:homedir(),PATH:[dirname(process.execPath),dirname(cli),'/usr/bin','/bin','/usr/sbin','/sbin'].join(':'),PUBLIC_HTTPS:'1',VAPID_SUBJECT:url,OPENCODEX_CLI:cli};
 const agents=join(homedir(),'Library/LaunchAgents');await mkdir(agents,{recursive:true});
 const args=[[process.execPath,join(root,'server.mjs')],[ngrok,'http','http://127.0.0.1:10300','--url',url,'--config',tokenFile,'--inspect=false']];
 for(let i=0;i<labels.length;i++){
  const file=join(agents,labels[i]+'.plist');
  if(await exists(file)){
   const existing=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',file],{encoding:'utf8'}));
   if(!existing.ProgramArguments?.some(a=>a.startsWith(root+'/')||a.startsWith(source+'/')))throw Error('Existing service belongs to a different installation: '+labels[i]);
  }
  await writeFile(file,agentPlist(labels[i],args[i],root,env),{mode:0o600});
  spawnSync('launchctl',['bootout',`${domain}/${labels[i]}`],{stdio:'ignore'});
  for(let attempt=0;attempt<20;attempt++){if(spawnSync('launchctl',['print',`${domain}/${labels[i]}`],{stdio:'ignore'}).status!==0)break;await new Promise(r=>setTimeout(r,250));}
  let started=false;for(let attempt=0;attempt<10;attempt++){const result=spawnSync('launchctl',['bootstrap',domain,file],{stdio:'pipe'});if(result.status===0){started=true;break;}await new Promise(r=>setTimeout(r,500));}
  if(!started)throw Error('Could not register service: '+labels[i]+'; inspect with npm run service:status.');
 }
 await writeFile(join(root,'.data/installation.json'),JSON.stringify({publicURL:url,sourcePath:source,installedAt:new Date().toISOString()}),{mode:0o600});
 let ready=false;for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,500));try{const r=await fetch('http://127.0.0.1:10300/',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}}
 if(!ready)throw Error('Installed, but the web service did not become ready. Run npm run service:status and inspect runtime .data logs.');
 console.log(`Ready: ${url}\nRuntime: ${root}\nPairing code is stored in ${join(root,'.data/pairing-code')}\nSaved credentials and sessions were preserved.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
