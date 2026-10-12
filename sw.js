var C="dash-v1",F=["./","index.html","manifest.webmanifest","icon-192.png"];
self.addEventListener("install",function(e){self.skipWaiting();e.waitUntil(caches.open(C).then(function(c){return c.addAll(F)}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
  var r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  e.respondWith(caches.open(C).then(function(c){return c.match(r,{ignoreSearch:true}).then(function(hit){
    var net=fetch(r).then(function(res){
      if(res&&res.ok){
        var cp=res.clone();
        if(hit&&r.mode==="navigate"){hit.clone().text().then(function(a){cp.clone().text().then(function(b){if(a!==b)self.clients.matchAll().then(function(cl){cl.forEach(function(x){x.postMessage("updated")})})})})}
        c.put(r,cp);
      }
      return res;
    }).catch(function(){return hit});
    return hit||net;
  })}));
});
