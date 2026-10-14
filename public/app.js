const $=s=>document.querySelector(s);let current=null;
const text=(tag,value,className)=>{const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;};
const message=value=>$('#message').textContent=value;
async function api(path,body){const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},signal:AbortSignal.timeout((path==='refresh'||path.startsWith('reset-credits'))?65000:20000),body:body===undefined?undefined:JSON.stringify(body)});const result=await r.json();if(!r.ok){if(r.status===401){$('#login').hidden=false;$('#dashboard').hidden=true;}throw Error(result.error||'요청 실패');}return result;}
const date=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value*1000):'미확인';
const percentage=value=>typeof value==='number'?`${value}%`:'—';
async function perform(fn){const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message('처리 중입니다…');try{await fn();if($('#message').textContent==='처리 중입니다…')message('');}catch(e){message(e.message);}finally{buttons.forEach(b=>b.disabled=false);}}
function render(state){current=state;$('#login').hidden=true;$('#dashboard').hidden=false;$('#connection').textContent='서버 연결됨';$('#time').textContent=state.observedAt?`최근 조회 ${date(state.observedAt/1000)} KST`:'최신 조회를 눌러 사용량을 확인하세요.';$('#notice').textContent=state.notice;$('#notifications').checked=state.notificationsEnabled;$('#push-status').textContent=state.subscriptionCount?`${state.subscriptionCount}개 기기 등록`:'등록 안 됨';
 $('#metrics').replaceChildren();const values=[['등록 계정',state.accounts.length],['5시간 소진',state.accounts.filter(a=>a.quota.shortPercent>=100).length],['일시 중지',state.accounts.filter(a=>a.paused).length]];values.forEach(([label,v])=>{const e=text('div','','metric');e.append(text('span',label),text('b',v));$('#metrics').append(e);});$('#accounts').replaceChildren();
 for(const a of state.accounts){const card=text('article','','account'+(a.active?' active':''));const head=text('div','','head');head.append(text('h3',a.label),text('span',a.paused?'중지':a.active?'선택됨':'풀 계정','pill'));card.append(head,text('div',`${a.plan||'플랜 미확인'}${a.needsReauth?' · 재로그인 필요':''}`,'plan'));
  for(const [label,key,reset] of [['5시간','shortPercent','shortResetAt'],['주간','weeklyPercent','weeklyResetAt']]){const v=a.quota[key];const line=text('div','','usage-label');line.append(text('span',label),text('b',percentage(v)));const track=text('div','','track'),fill=text('div','','fill'+(v>=100?' spent':v>=80?' warn':''));fill.style.width=`${Math.max(0,Math.min(100,v||0))}%`;track.append(fill);card.append(line,track,text('div',`리셋 ${date(a.quota[reset])}`,'reset'));}
  card.append(text('p',a.refreshStatus==='ok'?'갱신 성공':'개별 갱신 미확인','muted'));const actions=text('div','','actions');
  for(const [label,action] of [['이 계정 선택','use'],[a.paused?'재개':'일시 중지',a.paused?'resume':'pause'],['우선순위','priority']]){const b=text('button',label,'secondary');b.onclick=()=>perform(async()=>{let value;if(action==='priority'){const entered=prompt('우선순위 (-100~100). 변경 시 수동 선택이 해제됩니다.',String(a.priority||0));if(entered===null)return;value=Number(entered);if(!Number.isInteger(value)||value< -100||value>100)throw Error('정수를 -100~100 범위로 입력하세요.');}else if(!confirm(`${a.label}: ${label}하시겠습니까?`))return;render(await api('action',{action,id:a.id,value}));});actions.append(b);}card.append(actions);
  const resetBox=text('div','','reset-box');
  const resetStatus=text('p','Banked reset · 조회 전','muted');
  const inspect=text('button','Reset 조회','secondary');
  const consume=text('button','Reset 1개 사용','secondary');consume.hidden=true;
  const pendingKey='ocx-reset-operation:'+a.id;
  inspect.onclick=()=>perform(async()=>{
    consume.hidden=true;
    const result=await api('reset-credits?id='+encodeURIComponent(a.id));
    resetStatus.textContent=result.availableCount===null?'Banked reset · 잔여 개수 미확인':`Banked reset · ${result.availableCount}개 남음`;
    consume.hidden=!(result.availableCount>0||sessionStorage.getItem(pendingKey));
    consume.textContent=sessionStorage.getItem(pendingKey)?'이전 Reset 요청 결과 확인':'Reset 1개 사용';
  });
  consume.onclick=()=>perform(async()=>{
    let operationId=sessionStorage.getItem(pendingKey);
    const promptText=operationId?`${a.label}: 이전 Reset 요청을 같은 ID로 확인합니다. 새로운 요청 ID로 재시도하지 않습니다. 진행할까요?`:`${a.label}: banked reset 1개를 사용합니다. 사용 후 되돌릴 수 없습니다. 진행할까요?`;
    if(!confirm(promptText))return;
    if(!operationId){operationId=crypto.randomUUID();sessionStorage.setItem(pendingKey,operationId);}
    try{
      const result=await api('reset-credits/consume',{id:a.id,operationId,confirmed:true});
      const terminal=['reset','already_redeemed','nothing_to_reset','no_credit'];
      if(terminal.includes(result.code))sessionStorage.removeItem(pendingKey);
      const labels={reset:'Reset 사용 완료',already_redeemed:'이전 Reset 사용 확인',nothing_to_reset:'초기화할 사용량 없음',no_credit:'사용 가능한 reset 없음'};
      resetStatus.textContent=(labels[result.code]||`요청 결과: ${result.code||'미확인'}`)+(result.remaining===null?'':` · ${result.remaining}개 남음`);
      consume.hidden=terminal.includes(result.code);
      if(!terminal.includes(result.code))consume.textContent='이전 Reset 요청 결과 확인';
      message(resetStatus.textContent+' · 필요하면 최신 조회로 한도를 확인하세요.');
    }catch(e){consume.textContent='이전 Reset 요청 결과 확인';throw Error(e.message+' · 소비 여부가 불확실합니다. 같은 요청 ID로 결과를 확인하세요.');}
  });
  resetBox.append(resetStatus,inspect,consume);card.append(resetBox);
$('#accounts').append(card);
 }
}
$('#login-form').onsubmit=e=>{e.preventDefault();perform(async()=>{await api('login',{code:$('#code').value});$('#code').value='';await load();});};
async function load(){render(await api('state'));try{const p=await api('policy');const find=x=>{if(!x||typeof x!=='object')return null;if(typeof x.strategy==='string')return x.strategy;for(const v of Object.values(x)){const r=find(v);if(r)return r;}return null;};const s=find(p);if(s)$('#strategy').value=s;}catch(e){message(e.message);}}
$('#refresh').onclick=()=>perform(async()=>render(await api('refresh',{})));
$('#strategy-save').onclick=()=>perform(async()=>{if(confirm('새 작업의 계정 배정 전략을 변경할까요?'))render(await api('action',{action:'strategy',value:$('#strategy').value}));});
$('#clear').onclick=()=>perform(async()=>render(await api('action',{action:'clear'})));
$('#subscribe').onclick=()=>perform(async()=>{if(!window.isSecureContext)throw Error('푸시 등록에는 HTTPS 주소가 필요합니다.');if(!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('이 브라우저에서는 푸시를 지원하지 않습니다. iPhone은 Safari에서 홈 화면에 추가 후 앱을 열고, Android는 최신 Chrome을 사용하세요.');if(await Notification.requestPermission()!=='granted')throw Error('알림 권한을 허용해주세요.');const reg=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;const raw=atob(current.publicKey.replace(/-/g,'+').replace(/_/g,'/'));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));const s=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});await api('push/subscribe',{subscription:s.toJSON()});render(await api('state'));message('등록됐습니다. 테스트 알림을 눌러 이 기기에서 수신을 확인하세요.');});
$('#test').onclick=()=>perform(async()=>{const r=await api('push/test',{});message(`푸시 서비스 접수 ${r.accepted}건 · 실패 ${r.failed}건. 실제 휴대폰 표시를 확인하세요.`);});
$('#notifications').onchange=()=>perform(async()=>{try{render(await api('push/settings',{enabled:$('#notifications').checked}));}catch(e){$('#notifications').checked=current.notificationsEnabled;throw e;}});
load().catch(e=>message(e.message));

$("#widget-key").onclick=()=>perform(async()=>{const r=await api("widget-key");$("#widget-key-value").textContent=r.key;});

// Start clipboard access during the click gesture: required by iPhone Safari.
$("#copy-widget").onclick=async()=>{
 const button=$("#copy-widget"),status=$("#copy-widget-status");
 button.disabled=true;status.textContent="코드를 복사하는 중입니다…";
 try{
  const source=fetch('/OpenCodex.js',{headers:{'ngrok-skip-browser-warning':'1'},cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async response=>{
   if(!response.ok)throw Error('위젯 코드를 불러오지 못했습니다.');
   return response.text();
  });
  // Observe fetch failures even if the browser rejects clipboard access first.
  source.catch(()=>{});
  if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
   const blob=source.then(code=>new Blob([code],{type:'text/plain'}));
   blob.catch(()=>{});
   await navigator.clipboard.write([new ClipboardItem({'text/plain':blob})]);
  }else{
   throw Error('자동 복사를 지원하지 않습니다. 코드 보기를 눌러 전체 복사해주세요.');
  }
  status.textContent="전체 코드가 복사됐습니다. Scriptable → + → 붙여넣기 → ▶ 실행하세요.";
 }catch(error){status.textContent=error.name==='NotAllowedError'?'복사 권한이 거부됐습니다. Safari에서 다시 누르거나 코드 보기에서 전체 복사해주세요.':error.message;}
 finally{button.disabled=false;}
};

$('#logout').onclick=()=>perform(async()=>{await api('logout',{});location.reload();});

// Prepare credentials before the click so Chrome sees a direct user gesture.
let androidWidgetKey=null;
const androidButton=$('#android-connect');
androidButton.disabled=true;
async function prepareAndroidConnection(){
 if(!current)return;
 try{androidWidgetKey=(await api('widget-key')).key;androidButton.disabled=false;}catch{androidWidgetKey=null;}
}
androidButton.onclick=()=>{
 if(!androidWidgetKey){$('#android-connect-status').textContent='로그인 후 다시 시도하세요.';return;}
 const params=new URLSearchParams({url:location.origin,key:androidWidgetKey});
 const link=`intent://connect?${params}#Intent;scheme=opencodexquota;package=me.opencodex.quota;end`;
 $('#android-connect-status').textContent='앱에서 서버 주소를 확인하고 연결을 허용하세요. 앱이 없으면 먼저 QA 앱을 설치하세요.';
 location.href=link;
};
setInterval(()=>{if(current&&!androidWidgetKey)prepareAndroidConnection();},2000);
