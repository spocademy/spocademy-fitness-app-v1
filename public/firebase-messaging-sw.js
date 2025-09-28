// Web Push Service Worker for Spocademy
// Handles background notifications and PWA functionality

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  event.waitUntil(self.clients.claim());
});

// Handle Web Push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let notificationData = {
    title: 'Spocademy Training',
    body: 'Time for your training!',
    icon: '/JustS.png',
    badge: '/JustS.png',
    tag: 'spocademy-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      url: 'https://fitness.spocademy.com/',
      timestamp: Date.now()
    }
  };

  // Parse notification data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('Push payload received:', payload);
      
      notificationData = {
        ...notificationData,
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        requireInteraction: payload.requireInteraction !== undefined ? payload.requireInteraction : notificationData.requireInteraction,
        actions: payload.actions || notificationData.actions,
        data: {
          ...notificationData.data,
          ...payload.data
        }
      };
    } catch (error) {
      console.error('Error parsing push payload:', error);
    }
  }

  // Track notification delivery
  trackNotificationDelivery(notificationData.data?.type || 'unknown');

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      silent: false
    })
  );
});

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
      const url = event.notification.data?.url || 'https://fitness.spocademy.com/';
      
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('fitness.spocademy.com') && 'focus' in client) {
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
  
  // Track dismissal
  trackNotificationDismissal(event.notification.data?.type || 'unknown');
});

// Track notification delivery
async function trackNotificationDelivery(notificationType) {
  try {
    const deliveryData = {
      type: notificationType,
      deliveredAt: new Date().toISOString(),
      status: 'delivered'
    };
    
    console.log('Tracking notification delivery:', deliveryData);
    
    // Store locally for tracking
    const existingData = JSON.parse(localStorage.getItem('notificationTracking') || '[]');
    existingData.push(deliveryData);
    localStorage.setItem('notificationTracking', JSON.stringify(existingData));
  } catch (error) {
    console.error('Failed to track notification delivery:', error);
  }
}

// Track notification clicks
async function trackNotificationClick(notificationType) {
  try {
    const clickData = {
      type: notificationType,
      clickedAt: new Date().toISOString(),
      status: 'clicked'
    };
    
    console.log('Tracking notification click:', clickData);
    
    const existingData = JSON.parse(localStorage.getItem('notificationTracking') || '[]');
    existingData.push(clickData);
    localStorage.setItem('notificationTracking', JSON.stringify(existingData));
  } catch (error) {
    console.error('Failed to track notification click:', error);
  }
}

// Track notification dismissals
async function trackNotificationDismissal(notificationType) {
  try {
    const dismissalData = {
      type: notificationType,
      dismissedAt: new Date().toISOString(),
      status: 'dismissed'
    };
    
    console.log('Tracking notification dismissal:', dismissalData);
    
    const existingData = JSON.parse(localStorage.getItem('notificationTracking') || '[]');
    existingData.push(dismissalData);
    localStorage.setItem('notificationTracking', JSON.stringify(existingData));
  } catch (error) {
    console.error('Failed to track notification dismissal:', error);
  }
}

// Basic fetch handler - just pass through to network
self.addEventListener('fetch', (event) => {
  return;
});