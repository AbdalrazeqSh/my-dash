var C="dash-v55",F=["./","index.html","manifest.webmanifest","icon-192.png","tracker.html"];
self.addEventListener("install",function(e){self.skipWaiting();e.waitUntil(caches.open(C).then(function(c){return c.addAll(F.map(function(u){return new Request(u,{cache:"reload"})}))}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
  var r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  /* network-first (bypasses HTTP cache) so a new version always shows; cache only for offline */
  e.respondWith(fetch(r,{cache:"no-cache"}).then(function(res){
    if(res&&res.ok){var cp=res.clone();caches.open(C).then(function(c){c.put(r,cp)})}
    return res;
  }).catch(function(){return caches.open(C).then(function(c){return c.match(r,{ignoreSearch:true})})}));
});
