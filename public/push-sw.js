/* 26fit Central Comercial: Web Push de compromissos da agenda.
   O usuário precisa ativar as notificações explicitamente na Central. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {};
  }
  const title = String(payload.title || "26Fit • Compromisso agora").slice(0, 130);
  const body = String(payload.body || "Uma reunião ou evento da Central está começando.").slice(
    0,
    200,
  );
  const url = String(payload.data?.url || "/?section=calendar");
  const safeUrl = url.startsWith("/?section=calendar") ? url : "/?section=calendar";
  const tag = String(payload.tag || "cc-agenda").slice(0, 180);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: false,
      badge: "/logo_v2.png",
      icon: "/logo_v2.png",
      data: { url: safeUrl },
      requireInteraction: false,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = String(event.notification.data?.url || "/?section=calendar");
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const found = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (found) {
        if ("navigate" in found) await found.navigate(target);
        return found.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
