import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('../src/core.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/background.js',import.meta.url),'utf8');
const event=()=>{const listeners=[];return {addListener:fn=>listeners.push(fn),listeners};};
function setup(initial={}) {
  const store=structuredClone(initial), scripts=[], injections=[];
  const chrome={
    runtime:{id:'extension-id',getURL:p=>'chrome-extension://extension-id/'+p,onMessage:event(),onInstalled:event(),onStartup:event(),openOptionsPage:async()=>{}},
    storage:{local:{get:async keys=>{await new Promise(r=>setTimeout(r,1));return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,store[k]]));},set:async data=>Object.assign(store,structuredClone(data)),remove:async key=>{delete store[key];}}},
    tabs:{query:async()=>[{id:5,url:'https://example.com/read'},{id:6,url:'http://other.test/article'}]},
    scripting:{getRegisteredContentScripts:async()=>structuredClone(scripts),unregisterContentScripts:async()=>{scripts.length=0;},executeScript:async data=>{injections.push(data);return [];},insertCSS:async()=>{},removeCSS:async()=>{}},
    contextMenus:{removeAll:fn=>fn(),create:()=>{},onClicked:event()}
  };
  const context=vm.createContext({chrome,console,URL,TextEncoder,importScripts:()=>{}});vm.runInContext(core,context);vm.runInContext(worker,context);
  const send=(message,sender={id:'extension-id',url:'chrome-extension://extension-id/options.html'})=>new Promise(resolve=>{
    const result=chrome.runtime.onMessage.listeners[0](message,sender,resolve);if(result!==true)resolve(undefined);
  });
  return {store,scripts,injections,chrome,send,context};
}
test('concurrent personal-word writes preserve all words and preferences',async()=>{
  const s=setup();await Promise.all([s.send({type:'add-term',term:'工作记忆'}),s.send({type:'add-term',term:'认知负荷'}),s.send({type:'settings',patch:{style:'underline'}})]);
  assert.deepEqual(s.store.settings.personal,['工作记忆','认知负荷']);assert.equal(s.store.settings.style,'underline');
});
test('content scripts and unrelated extensions cannot write preferences',async()=>{
  const s=setup();for(const sender of [{id:'extension-id',url:'https://example.com/'},{id:'other',url:'chrome-extension://extension-id/options.html'}])
    assert.equal(await s.send({type:'settings',patch:{enabled:false}},sender),undefined);
  assert.deepEqual(s.store,{});
});
test('content script receives only top-page pattern for iframe pause propagation',async()=>{
  const s=setup();const data=await s.send({type:'page-context'},{id:'extension-id',url:'https://frame.test/read',tab:{url:'https://example.com/private/path'}});
  assert.equal(data.topPattern,'https://example.com/*');assert.deepEqual(Object.keys(data),['topPattern']);
});
test('fresh installation enables global automatic mode and injects already open tabs',async()=>{
  const s=setup();s.chrome.runtime.onInstalled.listeners[0]();await vm.runInContext('queue',s.context);
  assert.equal(s.store.settings.enabled,true);assert.equal(s.store.settings.maxGroups,0);assert.equal(s.store.settings.categories.length,9);
  assert.deepEqual(s.store.excludedSites,[]);assert.deepEqual(s.injections.map(x=>x.target.tabId),[5,6]);assert.ok(s.injections.every(x=>x.target.allFrames));
});
test('v0.1 whitelist migrates to global defaults while retaining personal data and style',async()=>{
  const s=setup({sites:['https://old.test/*'],settings:{style:'underline',maxGroups:2,categories:['restriction','condition'],personal:['自定义词语'],ignored:['然而']}});
  await vm.runInContext('migrateStorage()',s.context);
  assert.equal(s.store.sites,undefined);assert.equal(s.store.settings.maxGroups,0);assert.equal(s.store.settings.style,'underline');
  assert.deepEqual(s.store.settings.personal,['自定义词语']);assert.deepEqual(s.store.settings.ignored,['然而']);assert.ok(s.store.settings.categories.includes('quantity'));
  assert.ok(!s.store.settings.categories.includes('contrast'));assert.equal(s.store.storageVersion,4);
});
test('migration preserves explicit global pause and is idempotent',async()=>{
  const s=setup({settings:{enabled:false,maxGroups:1}});await vm.runInContext('migrateStorage()',s.context);const before=structuredClone(s.store);
  await vm.runInContext('migrateStorage()',s.context);assert.deepEqual(s.store,before);assert.equal(s.store.settings.enabled,false);assert.equal(s.store.settings.maxGroups,1);
});
test('v0.2 upgrades to word boundaries while retaining terms, style, pause and exclusions',async()=>{
  const s=setup({storageVersion:2,settings:{enabled:false,style:'underline',maxGroups:2,categories:['quantity'],personal:['海洋生态系统'],ignored:['然而']},excludedSites:['https://paused.test/*']});
  await vm.runInContext('migrateStorage()',s.context);
  assert.equal(s.store.storageVersion,4);assert.equal(s.store.settings.mode,'chunks');assert.equal(s.store.settings.enabled,false);assert.equal(s.store.settings.maxGroups,2);
  assert.deepEqual(s.store.settings.categories,['quantity']);assert.deepEqual(s.store.settings.personal,['海洋生态系统']);assert.deepEqual(s.store.excludedSites,['https://paused.test/*']);
  await s.send({type:'settings',patch:{lightColor:'#aabbcc',darkColor:'#102030',intensity:75,wordStep:3,mode:'personal'}});
  assert.equal(s.store.settings.lightColor,'#aabbcc');assert.equal(s.store.settings.intensity,75);assert.equal(s.store.settings.wordStep,3);assert.equal(s.store.settings.mode,'personal');
});
test('legacy dynamic registration is removed during migration',async()=>{
  const s=setup();s.scripts.push({id:'reading-cues-sites'});await vm.runInContext('cleanupLegacyScripts()',s.context);assert.equal(s.scripts.length,0);
});
test('site pause writes an exclusion, resume removes it without permission prompts',async()=>{
  const s=setup();assert.equal((await s.send({type:'site',url:'https://example.com/read',enabled:false})).ok,true);assert.deepEqual(s.store.excludedSites,['https://example.com/*']);
  await s.send({type:'site',url:'https://example.com/other',enabled:false});assert.equal(s.store.excludedSites.length,1);
  await s.send({type:'site',url:'https://example.com/read',enabled:true});assert.deepEqual(s.store.excludedSites,[]);
});
test('invalid import is atomic and duplicate imports are idempotent',async()=>{
  const s=setup();await s.send({type:'add-term',term:'工作记忆'});const before=structuredClone(s.store);
  assert.equal((await s.send({type:'import',text:JSON.stringify({schemaVersion:1,personal:['正常','<bad>'],ignored:[]})})).ok,false);assert.deepEqual(s.store,before);
  await s.send({type:'import',text:JSON.stringify({schemaVersion:1,personal:['工作记忆','认知负荷'],ignored:['然而']})});assert.deepEqual(s.store.settings.personal,['工作记忆','认知负荷']);
});
