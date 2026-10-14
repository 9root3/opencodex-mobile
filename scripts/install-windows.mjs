import {execFileSync} from 'node:child_process';
import {access,readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {copySource} from './install.mjs';

export const psLiteral=value=>"'"+String(value).replaceAll("'","''")+"'";
export const psArgs=script=>['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')];
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function registrationScript({taskName,root,node}){
 const runner=`& ${psLiteral(node)} ${psLiteral(join(root,'runtime/supervisor.mjs'))} ${psLiteral(root)}; exit $LASTEXITCODE`;
 const argument=['-NoProfile','-NonInteractive','-WindowStyle Hidden','-EncodedCommand',Buffer.from(runner,'utf16le').toString('base64')].join(' ');
 return `$ErrorActionPreference='Stop'
$name=${psLiteral(taskName)}
$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$existing=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if($existing -and $existing.Description -ne ${psLiteral('OpenCodex Mobile: '+root)}){throw 'Existing task belongs to a different installation.'}
$action=New-ScheduledTaskAction -Execute (Get-Command powershell.exe).Source -Argument ${psLiteral(argument)} -WorkingDirectory ${psLiteral(root)}
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $name -Description ${psLiteral('OpenCodex Mobile: '+root)} -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name`;
}
export async function installWindows(source){
 const root=join(process.env.LOCALAPPDATA||join(homedir(),'AppData/Local'),'OpenCodexMobile');
 const mode=process.argv[2]||'setup',taskName='OpenCodexMobile-'+homedir().split(/[\\/]/).pop();
 const ps=(script,interactive=false)=>execFileSync('powershell.exe',interactive?psArgs(script).filter(x=>x!=='-NonInteractive'):psArgs(script),{stdio:'inherit'});
 if(mode==='status'){ps(`Get-ScheduledTask -TaskName ${psLiteral(taskName)} | Select-Object TaskName,State; Get-ScheduledTaskInfo -TaskName ${psLiteral(taskName)}`);return;}
 if(!['setup','update','stop'].includes(mode))throw Error('Expected setup, update, status or stop.');
 const stop=async()=>{
  await mkdir(join(root,'.data'),{recursive:true});await writeFile(join(root,'.data/stop'),'stop');
  ps(`$ErrorActionPreference='Stop'; $t=Get-ScheduledTask -TaskName ${psLiteral(taskName)} -ErrorAction SilentlyContinue; if($t){if($t.Description -ne ${psLiteral('OpenCodex Mobile: '+root)}){throw 'Task belongs to a different installation.'}; Disable-ScheduledTask -TaskName $t.TaskName | Out-Null}`);
  for(let n=0;n<40;n++){if(!await exists(join(root,'.data/supervisor.json'))){ps(`$ErrorActionPreference='Stop'; for($i=0;$i -lt 40;$i++){ $t=Get-ScheduledTask -TaskName ${psLiteral(taskName)} -ErrorAction SilentlyContinue; if(!$t -or $t.State -ne 'Running'){exit 0}; Start-Sleep -Milliseconds 500 }; throw 'Task is still running; retry after it exits.'`);return;}await sleep(500);}
  throw Error('Service did not stop safely; inspect service:status before updating.');
 };
 if(mode==='stop'){await stop();console.log('Services stopped and automatic startup disabled. Saved data is preserved.');return;}
 const npm=process.env.npm_execpath;if(!npm)throw Error('Run through npm run setup/update.');
 const npmRoot=execFileSync(process.execPath,[npm,'root','-g'],{encoding:'utf8'}).trim();
 const packageRoot=join(npmRoot,'@bitkyc08/opencodex');
 let pkg;try{pkg=JSON.parse(await readFile(join(packageRoot,'package.json'),'utf8'));}catch{throw Error('Install OpenCodex globally with npm on Windows first.');}
 const bin=typeof pkg.bin==='string'?pkg.bin:pkg.bin?.opencodex;
 if(!bin)throw Error('OpenCodex package has no opencodex entry point.');
 const cli=resolve(packageRoot,bin);if(!await exists(cli))throw Error('OpenCodex entry point is missing.');
 const config=JSON.parse(await readFile(join(homedir(),'.opencodex/config.json'),'utf8'));
 const health=await fetch(`http://127.0.0.1:${config.port||10100}/healthz`,{signal:AbortSignal.timeout(5000)});
 if(!health.ok)throw Error('Start OpenCodex before setup.');
 let saved={};try{saved=JSON.parse(await readFile(join(root,'.data/installation.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const raw=process.argv.find(x=>x.startsWith('--url='))?.slice(6)||saved.publicURL;
 if(!raw)throw Error('Specify --url=https://YOUR-ASSIGNED-DOMAIN.ngrok-free.dev');
 const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use a plain HTTPS origin.');
 // Stop before copying so Windows does not lock files while updating the runtime.
 if(await exists(join(root,'.data/installation.json')))await stop();
 await copySource(source,root);await mkdir(join(root,'.data'),{recursive:true});await mkdir(join(root,'.tools'),{recursive:true});
 ps(`$ErrorActionPreference='Stop'; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; & icacls.exe ${psLiteral(join(root,'.data'))} /inheritance:r /grant:r ($sid+':(OI)(CI)F') | Out-Null; if($LASTEXITCODE -ne 0){throw 'Could not restrict private data permissions.'}`);
 const ngrok=join(root,'.tools/ngrok.exe');
 if(!await exists(ngrok)){
  if(process.arch!=='x64')throw Error('Windows setup currently supports x64 only.');
  ps(`$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile ${psLiteral(join(root,'.tools/ngrok.zip'))}; Expand-Archive -LiteralPath ${psLiteral(join(root,'.tools/ngrok.zip'))} -DestinationPath ${psLiteral(join(root,'.tools'))} -Force`);
 }
 const tokenFile=join(root,'.data/ngrok.yml');
 if(!await exists(tokenFile)){
  if(!process.stdin.isTTY)throw Error('Run setup in an interactive PowerShell terminal.');
  ps(`$ErrorActionPreference='Stop'; $secret=Read-Host 'ngrok Authtoken' -AsSecureString; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret); try{$token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim(); if(!$token -or $token -match '\\s'){throw 'Invalid token'}; $content='version: "3"'+[Environment]::NewLine+'agent:'+[Environment]::NewLine+'  authtoken: '+(ConvertTo-Json -InputObject $token -Compress)+[Environment]::NewLine; [IO.File]::WriteAllText(${psLiteral(tokenFile)},$content,(New-Object Text.UTF8Encoding($false)))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}`,true);
 }
 execFileSync(ngrok,['config','check','--config',tokenFile],{stdio:'inherit'});
 execFileSync(process.execPath,[npm,'ci','--omit=dev','--prefix',root,'--cache',join(root,'.tools/npm-cache')],{stdio:'inherit'});
 const env={PUBLIC_HTTPS:'1',VAPID_SUBJECT:url.origin,OPENCODEX_CLI:cli,OPENCODEX_CLI_NODE:'1'};
 const commands=[{name:'web',file:process.execPath,args:[join(root,'server.mjs')]},{name:'tunnel',file:ngrok,args:['http','http://127.0.0.1:10300','--url',url.origin,'--config',tokenFile,'--inspect=false']}];
 await writeFile(join(root,'.data/installation.json'),JSON.stringify({publicURL:url.origin,sourcePath:source,installedAt:new Date().toISOString(),commands,env}));
 await unlink(join(root,'.data/stop')).catch(e=>{if(e.code!=='ENOENT')throw e;});
 ps(registrationScript({taskName,root,node:process.execPath}));
 let ready=false;for(let n=0;n<40;n++){await sleep(500);try{if((await fetch('http://127.0.0.1:10300/',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}}
 if(!ready)throw Error('Installed, but the web service did not become ready. Inspect service:status and runtime .data logs.');
 console.log(`Ready: ${url.origin}\nRuntime: ${root}\nConnection code file: ${tokenFile.replace(/ngrok\.yml$/,'pairing-code')}\nAutomatic startup registered for your Windows login.`);
}
