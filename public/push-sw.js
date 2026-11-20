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
  const receipt = String(payload.data?.receipt || "");
  // Prova separada de que o Chrome ativou o service worker e de que
  // showNotification foi executado. O provedor aceitar a mensagem não basta.
  const acknowledge = (stage) => {
    if (!/^[0-9a-f]{48}$/.test(receipt)) return Promise.resolve();
    return fetch("/api/notifications/receipt", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: receipt, stage }),
    }).catch(() => {});
  };
  const shown = self.registration
    .showNotification(title, {
      body,
      tag,
      renotify: false,
      badge: "/logo_v2.png",
      icon: "/logo_v2.png",
      data: { url: safeUrl, receipt },
      requireInteraction: false,
    })
    .then(
      () => acknowledge("displayed"),
      () => acknowledge("failed"),
    );
  event.waitUntil(Promise.allSettled([acknowledge("received"), shown]));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = String(event.notification.data?.url || "/?section=calendar");
  const target = new URL(path, self.location.origin).href;
  const receipt = String(event.notification.data?.receipt || "");
  const recorded = /^[0-9a-f]{48}$/.test(receipt)
    ? fetch("/api/notifications/receipt", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: receipt, stage: "clicked" }),
      }).catch(() => {})
    : Promise.resolve();
  event.waitUntil(
    Promise.allSettled([
      recorded,
      (async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const found = windows.find((client) => new URL(client.url).origin === self.location.origin);
        if (found) {
          if ("navigate" in found) await found.navigate(target);
          return found.focus();
        }
        return self.clients.openWindow(target);
      })(),
    ]),
  );
});
