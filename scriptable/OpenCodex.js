async function main() {
// OpenCodex personal widget. Run once in Scriptable to configure.
const PREFIX = "opencodex-widget-";
const manualRefresh = args.queryParameters?.refresh === "1";
if (!config.runsInWidget && !manualRefresh) {
  const setup = new Alert();
  setup.title = "OpenCodex Widget Setup";
  setup.message = "Enter your HTTPS server URL and widget key.";
  setup.addTextField("https://server-url", Keychain.contains(PREFIX+"url") ? Keychain.get(PREFIX+"url") : "");
  setup.addSecureTextField("Widget key", Keychain.contains(PREFIX+"key") ? Keychain.get(PREFIX+"key") : "");
  setup.addAction("Save & Preview"); setup.addCancelAction("Cancel");
  if (await setup.presentAlert() === -1) { Script.complete(); return; }
  const address = setup.textFieldValue(0).trim().replace(/\/+$/, "");
  const key = setup.textFieldValue(1).trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(address) || !key) throw new Error("Check the HTTPS URL and widget key.");
  Keychain.set(PREFIX+"url", address); Keychain.set(PREFIX+"key", key);
}
const widget = new ListWidget();
widget.backgroundColor = new Color("f2f5ef");
widget.setPadding(14, 16, 14, 16);
widget.refreshAfterDate = new Date(Date.now()+5*60*1000);
const header=widget.addStack();header.centerAlignContent();
const title = header.addText("OpenCodex quota"); title.font = Font.boldSystemFont(12); title.textColor = new Color("173f36");
header.addSpacer();
const updatedLabel=header.addText("Updated —");updatedLabel.font=Font.systemFont(9);updatedLabel.textColor=new Color("73857c");header.addSpacer(7);
if(config.widgetFamily!=="small"){
 const refreshButton=header.addText("↻");refreshButton.font=Font.mediumSystemFont(14);refreshButton.textColor=new Color("173f36");
 refreshButton.url="scriptable:///run/"+encodeURIComponent(Script.name())+"?refresh=1&openEditor=true";
}
widget.addSpacer(6);
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "opencodex-widget-cache.json");
let snapshot, warning = "";
try {
  if (!Keychain.contains(PREFIX+"url") || !Keychain.contains(PREFIX+"key")) throw new Error("Setup required");
  const address = Keychain.get(PREFIX+"url"); widget.url = address;
  if(manualRefresh){
    const update=new Request(address+"/api/widget/refresh");update.method="POST";
    update.headers={"Authorization":"Bearer "+Keychain.get(PREFIX+"key"),"ngrok-skip-browser-warning":"1"};update.timeoutInterval=30;
    const result=await update.loadJSON();
    if(update.response.statusCode!==200)throw new Error(result.error||"Refresh failed");
  }
  const request = new Request(address+"/api/widget");
  request.headers = {"Authorization":"Bearer "+Keychain.get(PREFIX+"key"), "ngrok-skip-browser-warning":"1"};
  request.timeoutInterval = 15;
  snapshot = await request.loadJSON();
  if (request.response.statusCode !== 200 || !Array.isArray(snapshot.accounts)) throw new Error("Request failed");
  fm.writeString(cachePath, JSON.stringify(snapshot));
} catch (error) {
  warning = "Offline · Cached";
  if (fm.fileExists(cachePath)) { try { snapshot = JSON.parse(fm.readString(cachePath)); } catch {} }
}
const formatter = new DateFormatter(); formatter.dateFormat = "MM/dd HH:mm"; formatter.timeZone = "Asia/Seoul";
const stamp = seconds => typeof seconds === "number" ? formatter.string(new Date(seconds*1000)) : "Unknown";
const colors = ["173f36", "55a694", "a7d6c6", "d4e9df", "e1e6e2"];
const clamp = v => Math.min(100, Math.max(0,v));
const recoveryText = gain => "+"+Number(gain.toFixed(1))+"%p";
const duration = seconds => {
  const minutes = Math.max(1, Math.ceil(seconds/60));
  if(minutes>=1440)return Math.floor(minutes/1440)+"d"+(Math.floor(minutes%1440/60)?" "+Math.floor(minutes%1440/60)+"h":"");
  return minutes >= 60 ? Math.floor(minutes/60)+"h"+(minutes%60 ? " "+minutes%60+"m" : "") : minutes+"m";
};
function poolSummary(accounts,now) {
  const count=accounts.length;
  const known = accounts.filter(a=>Number.isFinite(a.quota?.shortPercent));
  const weekly = accounts.filter(a=>Number.isFinite(a.quota?.weeklyPercent));
  const remaining=count && known.length===count ? known.reduce((sum,a)=>sum+100-clamp(a.quota.shortPercent),0)/count : null;
  const week=count && weekly.length===count ? weekly.reduce((sum,a)=>sum+100-clamp(a.quota.weeklyPercent),0)/count : null;
  const groups=new Map();let overdue=false;
  for(const a of known){
    const q=a.quota,used=clamp(q.shortPercent),reset=q.shortResetAt;
    if(!used||!Number.isFinite(reset))continue;
    if(reset<=now){overdue=true;continue;}
    // A spent weekly window cannot be recovered by the five-hour reset alone.
    if(a.paused||a.needsReauth||q.weeklyPercent>=100)continue;
    const minute=Math.ceil(reset/60)*60;
    groups.set(minute,(groups.get(minute)||0)+used/count);
  }
  const weeklyGroups=new Map();
  for(const a of weekly){
    const used=clamp(a.quota.weeklyPercent),at=a.quota.weeklyResetAt;
    if(!used||!Number.isFinite(at))continue;
    if(at<=now){overdue=true;continue;}
    const minute=Math.ceil(at/60)*60;weeklyGroups.set(minute,(weeklyGroups.get(minute)||0)+used/count);
  }
  const weeklyRecoveries=[...weeklyGroups].sort((a,b)=>a[0]-b[0]).map(([at,gain])=>({at,gain}));
  return {remaining,week,overdue,weeklyRecoveries,recoveries:[...groups].sort((a,b)=>a[0]-b[0]).map(([at,gain])=>({at,gain}))};
}
function ring(summary,recoveries,size) {
  const ctx=new DrawContext();ctx.size=new Size(size,size);ctx.respectScreenScale=true;ctx.opaque=false;
  const segments=[{value:summary.remaining||0,color:colors[0]},...recoveries.map((r,i)=>({value:r.gain,color:colors[i+1]}))];
  segments.push({value:Math.max(0,100-segments.reduce((sum,s)=>sum+s.value,0)),color:colors[4]});
  let angle=-Math.PI/2;const center=size/2,outer=size*0.46,inner=size*0.31;
  for(const segment of segments){
    if(segment.value<=0)continue;
    const end=angle+segment.value/100*Math.PI*2;
    const path=new Path();const steps=Math.max(2,Math.ceil(segment.value*2));
    path.move(new Point(center+outer*Math.cos(angle),center+outer*Math.sin(angle)));
    for(let i=1;i<=steps;i++){const t=angle+(end-angle)*i/steps;path.addLine(new Point(center+outer*Math.cos(t),center+outer*Math.sin(t)));}
    for(let i=steps;i>=0;i--){const t=angle+(end-angle)*i/steps;path.addLine(new Point(center+inner*Math.cos(t),center+inner*Math.sin(t)));}
    path.closeSubpath();ctx.addPath(path);ctx.setFillColor(new Color(segment.color));ctx.fillPath();
    if(segment.color!==colors[0]&&segment.color!==colors[4]&&segment.value>=12){
      const mid=(angle+end)/2,r=(outer+inner)/2;
      ctx.setTextAlignedCenter();ctx.setTextColor(new Color(colors[0]));ctx.setFont(Font.boldSystemFont(size*0.095));
      ctx.drawTextInRect("+"+Math.round(segment.value),new Rect(center+r*Math.cos(mid)-size*0.14,center+r*Math.sin(mid)-size*0.06,size*0.28,size*0.14));
    }
    angle=end;
  }
  ctx.setTextAlignedCenter();ctx.setTextColor(new Color(colors[0]));ctx.setFont(Font.boldSystemFont(size*0.21));
  ctx.drawTextInRect(summary.remaining===null ? "—" : Math.round(summary.remaining)+"%",new Rect(0,size*0.34,size,size*0.29));
  ctx.setFont(Font.systemFont(size*0.09));ctx.drawTextInRect("5h",new Rect(0,size*0.61,size,size*0.15));
  return ctx.getImage();
}
if (snapshot && Array.isArray(snapshot.accounts)) {
  const small=config.widgetFamily==="small",now=Date.now()/1000;
  const times=snapshot.accounts.map(a=>a.quota?.updatedAt).filter(Number.isFinite);
  if(times.length){const oldest=new Date(Math.min(...times));const timeFormatter=new DateFormatter();timeFormatter.dateFormat="HH:mm";timeFormatter.timeZone="Asia/Seoul";updatedLabel.text="Updated "+timeFormatter.string(oldest);if(Date.now()-oldest.getTime()>3600000){updatedLabel.text+=" · Stale";updatedLabel.textColor=new Color("b77724");}}
  const summary=poolSummary(snapshot.accounts,now);
  const recoveries=summary.remaining===null ? [] : summary.recoveries.slice(0,3);
  const content=widget.addStack();content.layoutHorizontally();content.topAlignContent();
  const ringSize=small?84:110;
  const image=content.addImage(ring(summary,recoveries,ringSize));image.imageSize=new Size(ringSize,ringSize);
  const weekValue=summary.week===null?"—":Math.round(summary.week)+"%";
  const weekColor=new Color(summary.week!==null&&summary.week<20?"bd5f50":"173f36");
  if(!small){
    content.addSpacer(10);
    // Scriptable reports screen points; use the medium widget width for this device.
    // Optional widget parameter such as "width=338" overrides the width if needed.
    const screenWidth=Math.min(Device.screenSize().width,Device.screenSize().height);
    const widths=[[320,292],[375,329],[390,338],[393,338],[402,344],[414,360],[428,364],[430,364],[440,374]];
    const nearest=widths.reduce((best,item)=>Math.abs(item[0]-screenWidth)<Math.abs(best[0]-screenWidth)?item:best);
    const override=String(args.widgetParameter||"").match(/width=(\d+)/);
    const widgetWidth=override?Math.max(292,Math.min(600,Number(override[1]))):nearest[1];
    const rightWidth=widgetWidth-32-ringSize-10;
    const right=content.addStack();right.layoutVertically();right.size=new Size(rightWidth,ringSize);
    const cards=right.addStack();cards.layoutHorizontally();cards.topAlignContent();cards.size=new Size(rightWidth,53);
    const cardCount=Math.max(1,recoveries.length),gap=4,cardWidth=(rightWidth-gap*(cardCount-1))/cardCount;
    for(let i=0;i<recoveries.length;i++){
      if(i)cards.addSpacer(gap);
      const r=recoveries[i],card=cards.addStack();card.layoutVertically();card.size=new Size(cardWidth,53);card.setPadding(8,1,8,1);card.cornerRadius=10;card.backgroundColor=new Color(colors[i+1]);
      const foreground=new Color(["ffffff","164e63","405529"][i]);
      // Draw centered labels in the full available width; flexible spacers can
      // compress WidgetText before its scale factor is applied by Scriptable.
      const labelWidth=cardWidth-2;
      function centeredLabel(value,maxFont,height){
        const canvas=new DrawContext();canvas.size=new Size(labelWidth,height);canvas.respectScreenScale=true;canvas.opaque=false;
        const units=[...value].reduce((sum,ch)=>sum+(/[0-9.%+]/.test(ch)?0.62:ch===" "?0.3:1),0);
        const fontSize=Math.min(maxFont,(labelWidth-2)/Math.max(1,units));
        canvas.setFont(Font.boldSystemFont(fontSize));canvas.setTextColor(foreground);canvas.setTextAlignedCenter();
        canvas.drawTextInRect(value,new Rect(0,(height-fontSize*1.3)/2,labelWidth,height));
        const label=card.addImage(canvas.getImage());label.imageSize=new Size(labelWidth,height);
      }
      centeredLabel(duration(r.at-now),14,19);
      card.addSpacer(3);
      centeredLabel(recoveryText(r.gain),10,14);

    }
    if(!recoveries.length){const label=cards.addText(summary.remaining===null?"Usage unknown":"No upcoming reset");label.font=Font.systemFont(11);label.textColor=new Color("73857c");}
    right.addSpacer(6);
    const weeklyBlock=right.addStack();weeklyBlock.layoutHorizontally();weeklyBlock.centerAlignContent();weeklyBlock.size=new Size(rightWidth,51);weeklyBlock.setPadding(8,8,8,8);weeklyBlock.cornerRadius=10;weeklyBlock.backgroundColor=new Color("e1e6e2");
    const balance=weeklyBlock.addStack();balance.layoutVertically();balance.size=new Size(44,0);
    const week=balance.addText(weekValue);week.font=Font.boldSystemFont(21);week.textColor=weekColor;week.lineLimit=1;week.minimumScaleFactor=0.7;
    const caption=balance.addText("Weekly");caption.font=Font.systemFont(9);caption.textColor=new Color("73857c");
    weeklyBlock.addSpacer(6);
    const scheduleWidth=rightWidth-16-44-6;
    const schedule=weeklyBlock.addStack();schedule.layoutVertically();schedule.size=new Size(scheduleWidth,0);
    if(summary.week!==null&&summary.weeklyRecoveries.length){
      for(const [index,recovery] of summary.weeklyRecoveries.slice(0,2).entries()){
        if(index)schedule.addSpacer(5);
        const row=schedule.addStack();row.layoutHorizontally();row.centerAlignContent();row.size=new Size(scheduleWidth,0);row.addSpacer();
        const left=row.addText(duration(recovery.at-now));left.font=Font.systemFont(10);left.textColor=new Color("536a60");left.lineLimit=1;left.minimumScaleFactor=0.6;
        row.addSpacer(5);
        const amount=row.addText(recoveryText(recovery.gain));amount.font=Font.mediumSystemFont(10);amount.textColor=new Color("173f36");amount.lineLimit=1;amount.minimumScaleFactor=0.7;
      }
    }else{const label=schedule.addText(summary.week===null?"Reset unknown":"No upcoming reset");label.font=Font.systemFont(9);label.textColor=new Color("73857c");}
  }else{
    widget.addSpacer();const week=widget.addText("Weekly "+weekValue);week.font=Font.mediumSystemFont(10);week.textColor=weekColor;
  }
  if(warning||summary.overdue){const note=widget.addText(warning||"Reset passed · Refresh needed");note.font=Font.systemFont(9);note.textColor=new Color("bd5f50");}
} else {
  const hint = widget.addText("Run once in Scriptable\nto set your URL and key."); hint.font = Font.systemFont(12); hint.textColor = new Color("73857c");
}
Script.setWidget(widget);
if (!config.runsInWidget || manualRefresh) await widget.presentMedium();
Script.complete();

}
await main();
