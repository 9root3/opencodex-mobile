import express from 'express';
import {homedir} from 'node:os';
import webpush from 'web-push';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
import {readFile, writeFile, mkdir, rename, chmod} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const run = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const equal = (a,b) => { const x=Buffer.from(hash(a)),y=Buffer.from(hash(b));return timingSafeEqual(x,y); };
const safeAccount = a => ({id:a.id,label:a.id==='__main__'?'메인 계정':a.label||'풀 계정',plan:a.plan,active:!!a.active,paused:!!a.paused,needsReauth:!!a.needsReauth,health:a.health,priority:a.priority,quota:a.quota||{},refreshStatus:a.quotaRefresh?.status||null});

export async function createApp({dataDir=join(root,'.data'),cli=process.env.OPENCODEX_CLI||'opencodex',execute=run,quotaDir=join(homedir(),'.opencodex'),refreshAccounts,resetRequest}={}) {
 await mkdir(dataDir,{recursive:true,mode:0o700});
 const statePath=join(dataDir,'state.json'),codePath=join(dataDir,'pairing-code');
 let state;
 try {state=JSON.parse(await readFile(statePath,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;state={vapid:webpush.generateVAPIDKeys(),subscriptions:[],notificationsEnabled:false,lastSlot:null};}
 const save=async()=>{await writeFile(statePath+'.tmp',JSON.stringify(state),{mode:0o600});await rename(statePath+'.tmp',statePath);};
 let pairingCode;
 try{pairingCode=(await readFile(codePath,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;pairingCode=randomBytes(18).toString('base64url');await writeFile(codePath,pairingCode,{mode:0o600});}
 await chmod(codePath,0o600);await save();
 webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://example.com',state.vapid.publicKey,state.vapid.privateKey);
 const sessionsPath=join(dataDir,'sessions.json');
 let storedSessions={};try{storedSessions=JSON.parse(await readFile(sessionsPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const sessions=new Map(Object.entries(storedSessions)),attempts=new Map();
 const persistSessions=async()=>{await writeFile(sessionsPath+'.tmp',JSON.stringify(Object.fromEntries(sessions)),{mode:0o600});await rename(sessionsPath+'.tmp',sessionsPath);};
 const sessionCookie=(token,secure)=>`ocx_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000${secure?'; Secure':''}`;
 const widgetKeyPath=join(dataDir,'widget-key');
 let widgetKey;
 try{widgetKey=(await readFile(widgetKeyPath,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;widgetKey=randomBytes(32).toString('base64url');await writeFile(widgetKeyPath,widgetKey,{mode:0o600});}
 let roster=[],observedAt=null,busy=false,notice='';
 const localState=async()=>{
  const config=JSON.parse(await readFile(join(quotaDir,'config.json'),'utf8'));
  let cache={};try{cache=JSON.parse(await readFile(join(quotaDir,'codex-quota-cache.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const accounts=[{id:'__main__',label:'메인 계정'},...(config.codexAccounts||[]).filter(a=>a.id!=='__main__').map(a=>({...a,label:a.alias||a.logLabel||'풀 계정'}))];
  return {config,accounts:accounts.map(a=>({...a,active:config.activeCodexAccountId===a.id,paused:config.pausedCodexAccountIds?.includes(a.id),quota:cache.quotas?.[a.id]||{},refreshStatus:null}))};
 };
 const command=async args=>{try{const {stdout}=await execute(process.env.OPENCODEX_CLI_NODE==='1'?process.execPath:cli,[...(process.env.OPENCODEX_CLI_NODE==='1'?[cli]:[]),'account',...args,'--json'],{timeout:60000,maxBuffer:2*1024*1024});return JSON.parse(stdout);}catch{throw new Error('OpenCodex 요청에 실패했습니다. 서버 컴퓨터에서 프록시와 로그인 상태를 확인하세요.');}};
 const snapshot=()=>({accounts:roster.map(safeAccount),observedAt,notice,notificationsEnabled:state.notificationsEnabled,subscriptionCount:state.subscriptions.length,schedule:{weekdays:'09:00–10:30 · 20:00–23:30 / 30분',weekends:'12:00–20:00 / 1시간'},publicKey:state.vapid.publicKey});
 const upstreamRefresh=refreshAccounts||(async()=>{
  const config=JSON.parse(await readFile(join(quotaDir,'config.json'),'utf8'));
  const port=config.port||10100;
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('OpenCodex 포트 설정을 확인하세요.');
  let admin=process.env.OPENCODEX_ADMIN_AUTH_TOKEN?.trim();
  if(!admin)admin=(await readFile(join(quotaDir,'admin-api-token'),'utf8')).trim();
  const response=await fetch(`http://127.0.0.1:${port}/api/codex-auth/accounts/refresh`,{method:'POST',headers:{'Content-Type':'application/json','X-OpenCodex-API-Key':admin},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error(`OpenCodex 사용량 API 오류 (${response.status})`);
  const data=await response.json();
  if(!Array.isArray(data.accounts))throw new Error('OpenCodex 사용량 응답 형식이 올바르지 않습니다.');
  return {accounts:data.accounts.map(a=>({...a,label:a.id==='__main__'?'메인 계정':a.alias||a.label||'풀 계정',active:config.activeCodexAccountId===a.id}))};
 });
 const refresh=async()=>{if(busy)throw new Error('조회 또는 관리 작업이 진행 중입니다.');busy=true;try{const result=await upstreamRefresh();roster=result.accounts||[];observedAt=Date.now();notice='개별 갱신 상태가 없는 계정은 최신 값인지 확인되지 않았습니다.';return snapshot();}catch(e){if(e.name==='TimeoutError')throw new Error('OpenCodex 최신 조회가 25초 내 완료되지 않았습니다. 저장된 사용량을 확인해주세요.');throw e;}finally{busy=false;}};
 const summary=()=>roster.map(a=>`${a.id==='__main__'?'메인':a.label}: ${a.quota?.shortPercent??'?'}% / 주간 ${a.quota?.weeklyPercent??'?'}%`).join('\n')+'\n5시간 / 주간 사용률 · 일부 갱신 미확인';
 const notify=async(title,body)=>{
  const outcomes=await Promise.all(state.subscriptions.map(async subscription=>{try{await webpush.sendNotification(subscription,JSON.stringify({title,body}),{TTL:1800,timeout:15000});return true;}catch(e){if([404,410].includes(e.statusCode)){state.subscriptions=state.subscriptions.filter(s=>s.endpoint!==subscription.endpoint);}console.error('Web push rejected',JSON.stringify({status:e.statusCode||null,reason:e.body?.slice(0,150)||e.code||'transport_error'}));return false;}}));
  await save();return {accepted:outcomes.filter(Boolean).length,failed:outcomes.filter(x=>!x).length};
 };
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
 app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");next();});
 app.use('/api',(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if((req.path==='/widget'&&req.method==='GET')||(req.path==='/widget/refresh'&&req.method==='POST')){
   const bearer=req.get('authorization')||'';
   if(!equal(bearer,`Bearer ${widgetKey}`))return res.status(401).json({error:'위젯 연결 키가 맞지 않습니다.'});
   return next();
  }
  if(!['GET','HEAD'].includes(req.method)){
   const origin=req.get('origin');let host;
   try{host=origin?new URL(origin).host:null;}catch{return res.status(403).json({error:'요청 출처가 올바르지 않습니다.'});}
   if(host!==req.get('host'))return res.status(403).json({error:'앱 화면에서 요청하세요.'});
  }
  if(req.path==='/login')return next();
  const raw=req.get('authorization')?.replace(/^Bearer /,'')||(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ocx_session='))?.slice(12);
  if(!raw||!sessions.has(hash(raw)))return res.status(401).json({error:'서버 연결 코드로 로그인하세요.'});
  res.set('Set-Cookie',sessionCookie(raw,process.env.PUBLIC_HTTPS==='1'||req.secure));
  req.sessionHash=hash(raw);next();
 });
 app.post('/api/login',async(req,res,next)=>{try{
  const key=req.socket.remoteAddress;const record=attempts.get(key)||{count:0,start:Date.now()};
  if(Date.now()-record.start>600000){record.count=0;record.start=Date.now();}
  record.count++;attempts.set(key,record);
  if(record.count>10)return res.status(429).json({error:'잠시 후 다시 시도하세요.'});
  if(typeof req.body.code!=='string'||!equal(req.body.code.trim(),pairingCode))return res.status(401).json({error:'연결 코드가 맞지 않습니다.'});
  attempts.delete(key);const token=randomBytes(32).toString('base64url');sessions.set(hash(token),{createdAt:Date.now()});await persistSessions();
  const secure=process.env.PUBLIC_HTTPS==='1'||req.secure;
  res.set('Set-Cookie',sessionCookie(token,secure));res.json({ok:true,...(req.get('x-opencodex-client')==='ios'?{sessionToken:token}:{})});
 }catch(e){next(e);}});
 app.post('/api/logout',async(req,res,next)=>{try{sessions.delete(req.sessionHash);await persistSessions();res.set('Set-Cookie','ocx_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});}catch(e){next(e);}});
 app.get('/api/widget',async(req,res,next)=>{try{
  // Widget credentials cannot manage accounts.
  const local=await localState();
  res.json({accounts:local.accounts.map(safeAccount),observedAt:null,notice:'위젯은 저장된 사용량입니다.'});
 }catch(e){next(e);}});
 let lastWidgetRefresh=0;
 app.post('/api/widget/refresh',async(req,res,next)=>{try{
  if(Date.now()-lastWidgetRefresh<60000)return res.status(429).json({error:'최신 조회는 1분에 한 번 가능합니다.'});
  lastWidgetRefresh=Date.now();res.json(await refresh());
 }catch(e){next(e);}});
 app.get('/api/widget-key',(req,res)=>res.json({key:widgetKey}));
 app.get('/api/state',async(req,res,next)=>{try{
  const local=await localState();roster=local.accounts;notice='저장된 사용량입니다. 최신 조회는 별도로 실행합니다.';
  res.json(snapshot());
 }catch(e){next(e);}});
 app.post('/api/refresh',async(req,res,next)=>{try{res.json(await refresh());}catch(e){next(e);}});
 const callReset=resetRequest||(async(path,method,body)=>{
  const {config}=await localState();const port=config.port||10100;
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('OpenCodex 포트 설정을 확인하세요.');
  const admin=process.env.OPENCODEX_ADMIN_AUTH_TOKEN?.trim()||(await readFile(join(quotaDir,'admin-api-token'),'utf8')).trim();
  const response=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'Content-Type':'application/json','X-OpenCodex-API-Key':admin},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok)throw new Error(`Reset API 오류 (${response.status}): ${typeof data.code==='string'?data.code:'요청 실패'}`);
  return data;
 });
 app.get('/api/reset-credits',async(req,res,next)=>{try{
  const id=req.query.id;const {accounts}=await localState();
  if(typeof id!=='string'||!accounts.some(a=>a.id===id))return res.status(400).json({error:'현재 풀에 없는 계정입니다.'});
  const data=await callReset('/api/codex-auth/reset-credits?accountId='+encodeURIComponent(id),'GET');
  res.json({availableCount:Number.isFinite(data.available_count)?data.available_count:null,credits:Array.isArray(data.credits)?data.credits.map(c=>({expiresAt:c.expires_at})):[]});
 }catch(e){next(e);}});
 app.post('/api/reset-credits/consume',async(req,res,next)=>{try{
  const {id,operationId,confirmed}=req.body;const {accounts}=await localState();
  if(typeof id!=='string'||!accounts.some(a=>a.id===id))return res.status(400).json({error:'현재 풀에 없는 계정입니다.'});
  if(confirmed!==true||typeof operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId))return res.status(400).json({error:'사용 확인과 유효한 요청 ID가 필요합니다.'});
  if(busy)return res.status(409).json({error:'다른 작업이 진행 중입니다. 잠시 후 같은 요청으로 확인하세요.'});
  busy=true;
  try{const data=await callReset('/api/codex-auth/reset-credits/consume','POST',{accountId:id,operationId});res.json({code:data.code,remaining:Number.isFinite(data.remaining)?data.remaining:null,replayed:!!data.replayed});}finally{busy=false;}
 }catch(e){next(e);}});

 app.post('/api/action',async(req,res,next)=>{try{
  if(busy)return res.status(409).json({error:'작업이 진행 중입니다.'});
  const {action,id,value}=req.body;let args;
  if(['use','pause','resume','priority'].includes(action)){
   const live=await command(['list','openai']);
   if(!live.accounts?.some(a=>a.id===id))return res.status(400).json({error:'현재 풀에 없는 계정입니다.'});
   args=[action,'openai',id];
   if(action==='priority'){if(!Number.isInteger(value)||value< -100||value>100)return res.status(400).json({error:'우선순위 범위는 -100~100입니다.'});args.push(String(value));}
  }else if(action==='clear')args=['clear','openai'];
  else if(action==='strategy'){
   if(!['quota','round-robin','fill-first','reset-first'].includes(value))return res.status(400).json({error:'지원하지 않는 전략입니다.'});args=['strategy','openai',value];
  }else return res.status(400).json({error:'지원하지 않는 작업입니다.'});
  busy=true;try{await command(args);const live=await command(['list','openai']);roster=(live.accounts||[]).map(a=>({...a,quota:roster.find(old=>old.id===a.id)?.quota}));res.json(snapshot());}finally{busy=false;}
 }catch(e){next(e);}});
 app.get('/api/policy',async(req,res,next)=>{try{const {config}=await localState();res.json({strategy:config.accountPoolStrategy||'quota'});}catch(e){next(e);}});
 app.post('/api/push/subscribe',async(req,res,next)=>{try{
  const s=req.body.subscription;let endpoint;
  try{endpoint=new URL(s?.endpoint);}catch{return res.status(400).json({error:'푸시 구독 주소가 올바르지 않습니다.'});}
  const allowed=endpoint.hostname==='web.push.apple.com'||endpoint.hostname.endsWith('.push.apple.com')||endpoint.hostname==='fcm.googleapis.com'||endpoint.hostname.endsWith('.push.services.mozilla.com');
  if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||!allowed||!s.keys?.p256dh||!s.keys?.auth)return res.status(400).json({error:'지원하는 브라우저 푸시 구독이 아닙니다.'});
  if(state.subscriptions.length>=10&&!state.subscriptions.some(x=>x.endpoint===s.endpoint))return res.status(400).json({error:'기기 등록 한도를 초과했습니다.'});
  state.subscriptions=state.subscriptions.filter(x=>x.endpoint!==s.endpoint);state.subscriptions.push(s);await save();res.json({ok:true});
 }catch(e){next(e);}});
 app.post('/api/push/keep-device',async(req,res,next)=>{try{
  const endpoint=req.body.endpoint;
  if(typeof endpoint!=='string'||!state.subscriptions.some(s=>s.endpoint===endpoint))return res.status(400).json({error:'등록된 기기만 유지할 수 있습니다.'});
  const removed=state.subscriptions.length-1;
  state.subscriptions=state.subscriptions.filter(s=>s.endpoint===endpoint);await save();res.json({removed,remaining:state.subscriptions.length});
 }catch(e){next(e);}});
 app.post('/api/push/settings',async(req,res,next)=>{try{if(typeof req.body.enabled!=='boolean')return res.status(400).json({error:'알림 설정이 올바르지 않습니다.'});state.notificationsEnabled=req.body.enabled;await save();res.json(snapshot());}catch(e){next(e);}});
 app.post('/api/push/test',async(req,res,next)=>{try{res.json(await notify('OpenCodex 연결 테스트','이 알림이 휴대폰에 표시되면 푸시 연결이 완료됐습니다.'));}catch(e){next(e);}});
 app.use(express.static(join(root,'public')));
 app.use((error,req,res,next)=>{res.status(500).json({error:error.message||'요청에 실패했습니다.'});});
 const tick=async()=>{
  if(!state.notificationsEnabled||!state.subscriptions.length||busy)return;
  const now=new Date();const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  const hour=Number(parts.hour),minute=Number(parts.minute),weekend=['Sat','Sun'].includes(parts.weekday);
  const due=weekend?hour>=12&&hour<=20&&minute===0:((hour>=9&&hour<11)||(hour>=20&&hour<24))&&minute%30===0;
  const slot=`${parts.year}-${parts.month}-${parts.day}-${hour}-${minute}`;
  if(!due||state.lastSlot===slot)return;
  state.lastSlot=slot;await save();
  try{await refresh();await notify(`OpenCodex ${parts.hour}:${parts.minute}`,summary());}catch(e){await notify('OpenCodex 조회 실패',e.message);}
 };
 return {app,codePath,tick};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {app,codePath,tick}=await createApp();const port=Number(process.env.PORT||10300),host=process.env.HOST||'127.0.0.1';
 app.listen(port,host,()=>console.log(`OpenCodex Mobile: http://${host}:${port}\nConnection code file: ${codePath}`));
 const timer=setInterval(()=>tick().catch(()=>console.error('Scheduled report failed')),15000);timer.unref();
}
