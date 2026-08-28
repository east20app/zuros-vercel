self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", () => {});
self.addEventListener("push", (event) => {
  let data = { title: "ZUROS", body: "Você tem uma nova atualização.", url: "/dashboard/account/notifications" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/brand-logo.png", badge: "/brand-logo.png", data: { url: data.url }, tag: data.tag || "zuros-update" }));
});
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => { const target = event.notification.data?.url || "/dashboard"; for (const client of windows) { if ("focus" in client) { client.navigate(target); return client.focus(); } } return clients.openWindow(target); })); });
