self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || 'Neta Randevu', {
    body: payload.body || 'Yeni bir randevu bildiriminiz var.',
    icon: '/neta-logo.png',
    badge: '/neta-logo.png',
    tag: payload.id || 'neta-notification',
    data: { url: '/panel' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(window => new URL(window.url).origin === self.location.origin);
    if (existing) return existing.focus();
    return clients.openWindow('/panel');
  }));
});
