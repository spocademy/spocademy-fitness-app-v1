// public/sw.js
// Enhanced service worker for PWA with FCM support

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC_Fm-hxEyAZigpydCWH1n7Y8IUrNe9qxM",
  authDomain: "spocademy-mvp1.firebaseapp.com",
  projectId: "spocademy-mvp1",
  storageBucket: "spocademy-mvp1.firebasestorage.app",
  messagingSenderId: "910046288653",
  appId: "1:910046288653:web:2e836eb413309925d26e44"
};

// Initialize Firebase in service worker
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle background messages
onBackgroundMessage(messaging, (payload) => {
  console.log('Received background message: ', payload);
  
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
        title: 'Later',
        icon: '/logo192.png'
      }
    ],
    data: {
      url: payload.data?.url || '/',
      timestamp: Date.now(),
      type: payload.data?.type || 'training_reminder'
    }
  };

  // Track notification delivery
  trackNotificationDelivery(payload.data?.type || 'unknown');

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Track notification delivery to Firebase
async function trackNotificationDelivery(notificationType) {
  try {
    // Store delivery tracking data
    const deliveryData = {
      type: notificationType,
      deliveredAt: new Date().toISOString(),
      status: 'delivered'
    };
    
    // Send to analytics endpoint (you'll implement this)
    fetch('/api/track-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deliveryData)
    }).catch(console.error);
  } catch (error) {
    console.error('Failed to track notification delivery:', error);
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  // Track click
  trackNotificationClick(event.notification.data?.type || 'unknown');
  
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

// Track notification clicks
async function trackNotificationClick(notificationType) {
  try {
    const clickData = {
      type: notificationType,
      clickedAt: new Date().toISOString(),
      status: 'clicked'
    };
    
    fetch('/api/track-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clickData)
    }).catch(console.error);
  } catch (error) {
    console.error('Failed to track notification click:', error);
  }
}

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Track dismissal
  trackNotificationDismissal(event.notification.data?.type || 'unknown');
});

// Track notification dismissals
async function trackNotificationDismissal(notificationType) {
  try {
    const dismissalData = {
      type: notificationType,
      dismissedAt: new Date().toISOString(),
      status: 'dismissed'
    };
    
    fetch('/api/track-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dismissalData)
    }).catch(console.error);
  } catch (error) {
    console.error('Failed to track notification dismissal:', error);
  }
}

// Basic PWA functionality
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  event.waitUntil(self.clients.claim());
});

// Basic fetch handler - just pass through to network
self.addEventListener('fetch', (event) => {
  return;
});