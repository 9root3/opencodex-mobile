import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {copySource,managedFiles,agentPlist} from './install.mjs';
test('Runtime update preserves secrets and sessions, excludes source private data',async()=>{
 const source=await mkdtemp(join(tmpdir(),'ocx-install-src-')),target=await mkdtemp(join(tmpdir(),'ocx-install-dst-'));
 for(const file of managedFiles){if(file==='public'){await mkdir(join(source,file));await writeFile(join(source,file,'index.html'),'new UI');}else await writeFile(join(source,file),'updated');}
 for(const root of [source,target])await mkdir(join(root,'.data'));
 await writeFile(join(source,'.data/state.json'),'source secret');await writeFile(join(target,'.data/state.json'),'existing keys');await writeFile(join(target,'.data/sessions.json'),'existing sessions');
 await copySource(source,target);
 assert.equal(await readFile(join(target,'.data/state.json'),'utf8'),'existing keys');assert.equal(await readFile(join(target,'.data/sessions.json'),'utf8'),'existing sessions');assert.equal(await readFile(join(target,'server.mjs'),'utf8'),'updated');
 const plist=agentPlist('example',['/path with spaces/node','a&b'],'/tmp/runtime',{VAPID_SUBJECT:'https://example.com'});assert.ok(plist.includes('a&amp;b'));assert.ok(plist.includes('<key>KeepAlive</key><true/>'));
});
