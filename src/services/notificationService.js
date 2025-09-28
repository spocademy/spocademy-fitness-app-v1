import { db } from './firebase/config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// VAPID public key from environment variable
const VAPID_PUBLIC_KEY = 'BM4-b_OpkBfT9lsCF-hkKZNkrqYNBbD7mM-GOdKSrewExm3Xvt6QB-fFct-ect7kH3WA6G9kcGaRPcFvruA-064';

// Convert VAPID key to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Request notification permission and register Web Push subscription
export const requestNotificationPermission = async (userId) => {
  try {
    console.log('🔔 Starting Web Push notification permission request for user:', userId);
    
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.error('❌ Browser does not support notifications');
      await saveUserSubscription(userId, null, 'unsupported');
      return null;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.error('❌ Service Workers not supported');
      await saveUserSubscription(userId, null, 'unsupported');
      return null;
    }

    console.log('🔐 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('📋 Permission result:', permission);
    
    if (permission === 'granted') {
      console.log('✅ Permission granted, registering service worker...');
      
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('✅ Service worker registered');

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('✅ Service worker ready');

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        console.log('🎯 Web Push subscription created:', subscription);
        
        if (subscription) {
          console.log('💾 Saving subscription to Firestore...');
          await saveUserSubscription(userId, subscription, permission);
          console.log('✅ Subscription saved successfully');
          return subscription;
        } else {
          console.error('❌ Subscription creation returned null');
          await saveUserSubscription(userId, null, permission);
        }
      } catch (subscriptionError) {
        console.error('❌ Error creating Web Push subscription:', subscriptionError);
        console.error('Subscription error details:', {
          name: subscriptionError.name,
          message: subscriptionError.message
        });
        await saveUserSubscription(userId, null, permission);
      }
    } else {
      console.log('❌ Notification permission denied or dismissed:', permission);
      await saveUserSubscription(userId, null, permission);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Web Push permission request error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    try {
      await saveUserSubscription(userId, null, 'error');
    } catch (saveError) {
      console.error('❌ Failed to save error state:', saveError);
    }
    
    return null;
  }
};

// Save user's Web Push subscription and permission status
const saveUserSubscription = async (userId, subscription, permission) => {
  try {
    console.log('💾 Saving user subscription data:', { 
      userId, 
      hasSubscription: !!subscription, 
      permission
    });
    
    const userSubscriptionData = {
      subscription: subscription ? JSON.stringify(subscription) : null,
      notificationPermission: permission,
      lastSubscriptionUpdate: serverTimestamp(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },
      debugInfo: {
        notificationSupported: 'Notification' in window,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        pushManagerSupported: 'PushManager' in window,
        timestamp: new Date().toISOString()
      }
    };

    await setDoc(doc(db, 'webPushSubscriptions', userId), userSubscriptionData, { merge: true });
    console.log('✅ User subscription data saved successfully');
  } catch (error) {
    console.error('❌ Error saving user subscription:', error);
  }
};

// Track notification analytics
export const trackNotificationReceived = async (type) => {
  try {
    const trackingData = {
      type,
      receivedAt: new Date().toISOString(),
      status: 'received'
    };
    
    // Store in localStorage for now
    const existingData = JSON.parse(localStorage.getItem('notificationTracking') || '[]');
    existingData.push(trackingData);
    localStorage.setItem('notificationTracking', JSON.stringify(existingData));
  } catch (error) {
    console.error('Error tracking notification:', error);
  }
};

// Check if user has notification permission
export const hasNotificationPermission = () => {
  const hasSupport = 'Notification' in window;
  const hasPermission = hasSupport && Notification.permission === 'granted';
  console.log('🔍 Permission check:', { hasSupport, permission: Notification.permission, hasPermission });
  return hasPermission;
};

// Get user's current notification settings
export const getUserNotificationSettings = async (userId) => {
  try {
    const docRef = doc(db, 'webPushSubscriptions', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('📄 Retrieved notification settings:', {
        hasSubscription: !!data.subscription,
        permission: data.notificationPermission,
        lastUpdate: data.lastSubscriptionUpdate
      });
      return data;
    }
    
    console.log('📄 No notification settings found for user');
    return null;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return null;
  }
};

// Manual notification for testing (admin use)
export const sendTestNotification = (title, body) => {
  if (hasNotificationPermission()) {
    console.log('🧪 Sending test notification:', { title, body });
    new Notification(title, {
      body,
      icon: '/JustS.png',
      tag: 'test-notification'
    });
  } else {
    console.warn('⚠️ Cannot send test notification - no permission');
  }
};

// Check if user has an active Web Push subscription
export const hasActiveSubscription = async (userId) => {
  try {
    const settings = await getUserNotificationSettings(userId);
    return settings && settings.subscription && settings.notificationPermission === 'granted';
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
};

// Listen for foreground messages (Web Push doesn't need this but keeping for compatibility)
export const onForegroundMessage = (callback) => {
  console.log('👂 Setting up foreground message listener for Web Push');
  
  // Web Push handles notifications through service worker
  // This function exists for compatibility with existing code
  if (callback) {
    console.log('Foreground message callback registered');
  }
  
  return () => {
    console.log('Foreground message listener cleanup');
  };
};

// Unsubscribe from notifications
export const unsubscribeFromNotifications = async (userId) => {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          console.log('✅ Unsubscribed from Web Push');
        }
      }
    }
    
    // Remove from database
    await saveUserSubscription(userId, null, 'denied');
    console.log('✅ Subscription removed from database');
    
  } catch (error) {
    console.error('❌ Error unsubscribing:', error);
  }
};