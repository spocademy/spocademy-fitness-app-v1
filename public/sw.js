// Basic service worker for PWA installability
// No offline caching - just enables installation

self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Basic fetch handler - just pass through to network
self.addEventListener('fetch', (event) => {
  // Don't intercept - just let requests pass through normally
  return;
});