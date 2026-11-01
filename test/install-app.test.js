const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync('public/install.js','utf8');
function setup(t, ios = false, installed = false) {
  const dom = new JSDOM('<body></body>', {url:'https://game.test', runScripts:'outside-only'});
  const w = dom.window;
  w.matchMedia = () => ({matches:installed});
  if (ios) Object.defineProperty(w.navigator,'userAgent',{value:'iPhone'});
  w.HTMLDialogElement.prototype.showModal = function(){ this.open=true; };
  w.HTMLDialogElement.prototype.close = function(){ this.open=false; };
  w.eval(script); t.after(() => w.close()); return w;
}
test('iOS install instructions explain Share and Add to Home Screen',t=>{
  const w=setup(t,true);
  w.document.querySelector('#installApp').click();
  assert.ok(w.document.querySelector('#installDialog').open);
  assert.match(w.document.querySelector('#installInstructions').textContent,/Safari.*แชร์.*หน้าจอโฮม/);
});
test('Android uses one browser install prompt and handles acceptance',async t=>{
  const w=setup(t); let calls=0;
  const ev=new w.Event('beforeinstallprompt',{cancelable:true});
  ev.prompt=async()=>{calls++;};ev.userChoice=Promise.resolve({outcome:'accepted'});
  w.dispatchEvent(ev); assert.ok(ev.defaultPrevented);
  w.document.querySelector('#installApp').click();
  await new Promise(r=>setImmediate(r));
  assert.equal(calls,1); assert.ok(w.document.querySelector('#installApp').hidden);
});
test('installed apps hide install button and fallback instructions remain available',t=>{
  const w=setup(t,false,true);
  assert.ok(w.document.querySelector('#installApp').hidden);
  const w2=setup(t); w2.document.querySelector('#installApp').click();
  assert.match(w2.document.querySelector('#installInstructions').textContent,/Chrome/);
  w2.dispatchEvent(new w2.Event('appinstalled'));
  assert.equal(w2.document.querySelector('#installDialog').open,false);
  assert.ok(w2.document.querySelector('#installApp').hidden);
});
test('manifest icons have correct PNG sizes and home screen launch does not join a room',()=>{
  const m=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
  assert.equal(m.display,'standalone'); assert.equal(m.scope,'/');
  assert.equal(new URL(m.start_url,'https://game.test').searchParams.get('room'),null);
  for(const icon of m.icons) {
    const buf=fs.readFileSync('public'+icon.src);
    assert.equal(buf.readUInt32BE(16)+'x'+buf.readUInt32BE(20),icon.sizes);
  }
});
test('service worker leaves APIs, POSTs and sockets untouched, and provides offline navigation',async()=>{
  const handlers={}; let requested=0;
  const context={
    self:{location:{origin:'https://game.test'},addEventListener:(k,f)=>handlers[k]=f},
    URL,fetch:async()=>{requested++;throw Error('offline');},
    caches:{match:async key=>'cached:'+key}
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
  for(const [url,method,mode] of [
    ['/api/me','GET','cors'],['/api/login','POST','cors'],['/socket.io/?transport=polling','GET','cors'],
    ['https://other.test/','GET','navigate']
  ]) handlers.fetch({request:{url:new URL(url,'https://game.test').href,method,mode},respondWith:()=>assert.fail('must not intercept')});
  let response;
  handlers.fetch({request:{url:'https://game.test/?room=abc',method:'GET',mode:'navigate'},respondWith:p=>response=p});
  assert.equal(await response,'cached:/offline.html'); assert.equal(requested,1);
});
