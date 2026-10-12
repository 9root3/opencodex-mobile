// Temporary credential intake. Never log request bodies or tokens.
import http from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {mkdir,open} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
await mkdir(join(root,'.data'),{recursive:true,mode:0o700});
const code=randomBytes(18).toString('base64url');
const hash=s=>createHash('sha256').update(s).digest();
let consumed=false,attempts=0;const expires=Date.now()+20*60*1000;
const page=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ngrok 연결</title><body><h1>고정 주소 연결</h1><p>토큰은 연구실 Mac에 저장됩니다. 저장 후 입력 기능은 닫힙니다.</p><form id="form"><p><label>임시 연결 코드<br><input id="code" type="password" autocomplete="off" required></label></p><p><label>ngrok Authtoken<br><input id="token" type="password" autocomplete="off" required></label></p><button>Mac에 저장</button></form><p id="status" role="status"></p><script src="/setup.js"></script></body></html>`;
const js=`document.querySelector('#form').onsubmit=async e=>{e.preventDefault();const button=document.querySelector('button');button.disabled=true;try{const r=await fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.querySelector('#code').value,token:document.querySelector('#token').value})});document.querySelector('#token').value='';const d=await r.json();document.querySelector('#status').textContent=d.message;if(r.ok){document.querySelector('#form').remove();}else{button.disabled=false;}}catch{document.querySelector('#token').value='';document.querySelector('#status').textContent='접속 실패. 다시 확인해주세요.';button.disabled=false;}};`;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'");
 const reply=(status,message)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({message}));};
 if(consumed||Date.now()>expires)return reply(410,'입력 기능이 닫혔습니다.');
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(page);}
 if(req.method==='GET'&&req.url==='/setup.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(js);}
 if(req.method!=='POST'||req.url!=='/save')return reply(404,'없는 경로입니다.');
 let origin;try{origin=new URL(req.headers.origin);}catch{return reply(403,'페이지에서 입력해주세요.');}
 if(origin.host!==req.headers.host||origin.protocol!=='https:')return reply(403,'HTTPS 페이지에서 입력해주세요.');
 if(++attempts>10)return reply(429,'입력 시도 제한입니다.');
 let body='';try{
  for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)return reply(413,'입력 크기 제한입니다.');}
  const data=JSON.parse(body);body='';
  if(typeof data.code!=='string'||!timingSafeEqual(hash(data.code.trim()),hash(code)))return reply(401,'임시 연결 코드가 맞지 않습니다.');
  if(typeof data.token!=='string'||! /^[A-Za-z0-9_-]{20,256}$/.test(data.token.trim()))return reply(400,'Authtoken 형식을 확인해주세요.');
  // Exclusive creation prevents overwriting a previously configured credential.
  consumed=true;
  const file=await open(join(root,'.data','ngrok.yml'),'wx',0o600);
  try{await file.writeFile('version: "3"\nagent:\n  authtoken: '+JSON.stringify(data.token.trim())+'\n');}finally{await file.close();data.token='';}
  reply(200,'Mac에 저장했습니다. 채팅에 저장 완료라고 알려주세요.');
 }catch{reply(500,'저장하지 못했습니다. 기존 설정 또는 서버 상태를 확인하세요.');}
});
server.listen(10301,'127.0.0.1',()=>console.log('Temporary setup on 10301\nSetup code: '+code));
setTimeout(()=>server.close(),20*60*1000).unref();
