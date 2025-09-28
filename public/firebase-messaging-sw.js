// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js');

// Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyC_Fm-hxEyAZigpydCWH1n7Y8IUrNe9qxM",
  authDomain: "spocademy-mvp1.firebaseapp.com",
  projectId: "spocademy-mvp1",
  storageBucket: "spocademy-mvp1.firebasestorage.app",
  messagingSenderId: "910046288653",
  appId: "1:910046288653:web:2e836eb413309925d26e44"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Spocademy Training';
  const notificationOptions = {
    body: payload.notification?.body || 'Time for your training!',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'spocademy-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Start Training',
        icon: '/logo192.png'
      },
      {
        action: 'dismiss',
        title: 'Later'
      }
    ],
    data: {
      url: payload.data?.url || '/',
      type: payload.data?.type || 'training_reminder'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || '/';
      
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  event.waitUntil(self.clients.claim());
});