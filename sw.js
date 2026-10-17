// Offline app shell only. Never cache financial exports or third-party requests.
const CACHE='nabd-merchant-cloud-v4';
const ASSETS=['./','./index.html','./product-ui.css','./product-app.js','./agents.js',
  './transaction-utils.js','./cloud-service.js','./cloud-config.js','./demo-data.js','./manifest.webmanifest','./privacy.html','./terms.html'];
const SHELL_PATHS=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).pathname));

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(name=>name.startsWith('nabd-')&&name!==CACHE).map(name=>caches.delete(name))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin) return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('./index.html')));
    return;
  }
  if(!SHELL_PATHS.has(url.pathname)) return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
