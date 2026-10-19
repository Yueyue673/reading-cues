import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const core = readFileSync(new URL('../src/core.js',import.meta.url),'utf8');
const worker = readFileSync(new URL('../src/background.js',import.meta.url),'utf8');
const event = () => {const listeners=[];return {addListener:fn=>listeners.push(fn),listeners};};
function setup() {
  const store={}, grants=new Set(), scripts=[];
  const chrome={
    runtime:{id:'extension-id',getURL:p=>'chrome-extension://extension-id/'+p,onMessage:event(),onInstalled:event(),onStartup:event(),openOptionsPage:async()=>{}},
    storage:{local:{get:async keys=>{await new Promise(r=>setTimeout(r,1));return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,store[k]]));},set:async data=>{Object.assign(store,structuredClone(data));}}},
    permissions:{contains:async({origins})=>origins.every(x=>grants.has(x)),onRemoved:event()},
    scripting:{getRegisteredContentScripts:async()=>structuredClone(scripts),registerContentScripts:async data=>scripts.push(...structuredClone(data)),updateContentScripts:async data=>{scripts.splice(0,scripts.length,...structuredClone(data));},unregisterContentScripts:async()=>{scripts.length=0;},executeScript:async()=>[],insertCSS:async()=>{},removeCSS:async()=>{}},
    contextMenus:{removeAll:fn=>fn(),create:()=>{},onClicked:event()}
  };
  const context=vm.createContext({chrome,console,URL,TextEncoder,importScripts:()=>{}});vm.runInContext(core,context);vm.runInContext(worker,context);
  const send=(message,sender={id:'extension-id',url:'chrome-extension://extension-id/options.html'})=>new Promise(resolve=>{
    const result=chrome.runtime.onMessage.listeners[0](message,sender,resolve);if(result!==true)resolve(undefined);
  });
  return {store,grants,scripts,chrome,send,context};
}
test('worker serializes concurrent writes so no personal word is lost',async()=>{
  const s=setup();const result=await Promise.all([s.send({type:'add-term',term:'工作记忆'}),s.send({type:'add-term',term:'认知负荷'}),s.send({type:'settings',patch:{style:'underline'}})]);
  assert.ok(result.every(x=>x.ok));assert.deepEqual(s.store.settings.personal,['工作记忆','认知负荷']);assert.equal(s.store.settings.style,'underline');
});
test('untrusted content-script senders cannot write settings',async()=>{
  const s=setup();assert.equal(await s.send({type:'settings',patch:{enabled:false}},{id:'extension-id',url:'https://example.com/'}),undefined);assert.deepEqual(s.store,{});
});
test('missing site permission prevents registration',async()=>{
  const s=setup();const result=await s.send({type:'site',url:'https://example.com/read',enabled:true});assert.equal(result.ok,false);assert.equal(s.scripts.length,0);
});
test('site enable registers, pause unregisters, permission revoke prunes',async()=>{
  const s=setup();s.grants.add('https://example.com/*');
  assert.equal((await s.send({type:'site',url:'https://example.com/read',enabled:true,tabId:1})).ok,true);
  assert.deepEqual(s.scripts[0].matches,['https://example.com/*']);
  await s.send({type:'site',url:'https://example.com/read',enabled:false});assert.equal(s.scripts.length,0);
  await s.send({type:'site',url:'https://example.com/read',enabled:true});s.grants.clear();await vm.runInContext('syncSites()',s.context);
  assert.deepEqual(s.store.sites,[]);assert.equal(s.scripts.length,0);
});
test('import failure leaves existing data intact',async()=>{
  const s=setup();await s.send({type:'add-term',term:'工作记忆'});const before=structuredClone(s.store);
  assert.equal((await s.send({type:'import',text:JSON.stringify({schemaVersion:1,personal:['正常','<bad>'],ignored:[]})})).ok,false);assert.deepEqual(s.store,before);
});
test('registration failure rolls back the stored site list',async()=>{
  const s=setup();s.grants.add('https://example.com/*');s.chrome.scripting.registerContentScripts=async()=>{throw new Error('registration failed');};
  const result=await s.send({type:'site',url:'https://example.com/read',enabled:true});assert.equal(result.ok,false);assert.deepEqual(s.store.sites,[]);
});
test('duplicate words and imports are idempotent, ignore overrides are retained',async()=>{
  const s=setup();await s.send({type:'add-term',term:'工作记忆'});await s.send({type:'add-term',term:'工作记忆'});await s.send({type:'import',text:JSON.stringify({schemaVersion:1,personal:['工作记忆','认知负荷'],ignored:['然而']})});
  assert.deepEqual(s.store.settings.personal,['工作记忆','认知负荷']);assert.deepEqual(s.store.settings.ignored,['然而']);
});
