var C="dash-v81",F=["./","index.html","manifest.webmanifest","icon-192.png","tracker.html"];
self.addEventListener("install",function(e){self.skipWaiting();e.waitUntil(caches.open(C).then(function(c){return c.addAll(F.map(function(u){return new Request(u,{cache:"reload"})}))}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
/* app shell: cache first (opens instantly even on a weak network), refreshed in the background.
   A new version is picked up through the new sw.js (cache name changes) which reloads the page once. */
self.addEventListener("fetch",function(e){
  var r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  e.respondWith(caches.open(C).then(function(c){
    return c.match(r,{ignoreSearch:true}).then(function(hit){
      var net=fetch(r,{cache:"no-cache"}).then(function(res){if(res&&res.ok)c.put(r,res.clone());return res}).catch(function(){return null});
      if(hit){e.waitUntil(net);return hit}
      return net.then(function(res){return res||new Response("offline",{status:503})});
    });
  }));
});
