// Decommissioned service worker. This file previously served an
// ad-network push/pop zone that was removed from the site on
// 2026-09-05. The stub unregisters itself from any browser that still
// holds it, so the old worker stops receiving updates and dies out.
self.addEventListener('install', function () {
  self.registration.unregister();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    self.registration.unregister().then(function () {
      return self.clients.matchAll({ type: 'window' }).then(function (clients) {
        clients.forEach(function (client) {
          if (client.url && client.url.startsWith(self.location.origin)) {
            client.navigate(client.url);
          }
        });
      });
    }),
  );
});
