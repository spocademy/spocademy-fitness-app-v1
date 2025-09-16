// src/services/notificationService.js
import { messaging } from './firebase/config';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from './firebase/config';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Request notification permission and get FCM token
export const requestNotificationPermission = async (userId) => {
  try {
    console.log('🔔 Starting notification permission request for user:', userId);
    
    if (!messaging) {
      console.error('❌ FCM messaging not supported/initialized');
      await saveUserToken(userId, null, 'unsupported');
      return null;
    }

    console.log('📱 Messaging service available, checking browser support...');
    
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.error('❌ Browser does not support notifications');
      await saveUserToken(userId, null, 'unsupported');
      return null;
    }

    console.log('🔐 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('📋 Permission result:', permission);
    
    if (permission === 'granted') {
      console.log('✅ Permission granted, generating FCM token...');
      
      try {
        const token = await getToken(messaging, {
          vapidKey: 'BLmnKUZ55vr4tt5zenmzZwSKGm2dV9H-eI-kh2B1y4_M7Q43j5QS1npjGQulN2aBv84vNBOppT_zZ8c8ZvxgCo0' // Replace with your actual VAPID key
        });
        
        console.log('🎯 FCM token generation result:', token ? '✅ SUCCESS' : '❌ FAILED');
        
        if (token) {
          console.log('💾 Saving token to Firestore...');
          await saveUserToken(userId, token, permission);
          console.log('✅ Token saved successfully');
          return token;
        } else {
          console.error('❌ Token generation returned null - check VAPID key and Firebase config');
          await saveUserToken(userId, null, permission);
        }
      } catch (tokenError) {
        console.error('❌ Error generating FCM token:', tokenError);
        console.error('Token error details:', {
          name: tokenError.name,
          message: tokenError.message,
          code: tokenError.code
        });
        await saveUserToken(userId, null, permission);
      }
    } else {
      console.log('❌ Notification permission denied or dismissed:', permission);
      await saveUserToken(userId, null, permission);
    }
    
    return null;
  } catch (error) {
    console.error('❌ FCM permission request error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    try {
      await saveUserToken(userId, null, 'error');
    } catch (saveError) {
      console.error('❌ Failed to save error state:', saveError);
    }
    
    return null;
  }
};

// Save user's FCM token and permission status
const saveUserToken = async (userId, token, permission) => {
  try {
    console.log('💾 Saving user token data:', { 
      userId, 
      hasToken: !!token, 
      permission,
      tokenLength: token ? token.length : 0
    });
    
    const userNotificationData = {
      fcmToken: token,
      notificationPermission: permission,
      lastTokenUpdate: serverTimestamp(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },
      debugInfo: {
        messagingAvailable: !!messaging,
        notificationSupported: 'Notification' in window,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        timestamp: new Date().toISOString()
      }
    };

    await setDoc(doc(db, 'userNotifications', userId), userNotificationData, { merge: true });
    console.log('✅ User notification data saved successfully');
  } catch (error) {
    console.error('❌ Error saving user token:', error);
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback) => {
  if (!messaging) {
    console.warn('⚠️ Messaging not available for foreground listener');
    return;
  }
  
  console.log('👂 Setting up foreground message listener');
  
  return onMessage(messaging, (payload) => {
    console.log('📨 Foreground message received:', payload);
    
    // Track message received
    trackNotificationReceived(payload.data?.type || 'unknown');
    
    // Show custom notification or handle as needed
    if (callback) callback(payload);
    
    // Show browser notification if app is in background
    if (document.visibilityState === 'hidden') {
      new Notification(payload.notification?.title || 'Spocademy', {
        body: payload.notification?.body,
        icon: '/logo192.png',
        tag: 'spocademy-foreground'
      });
    }
  });
};

// Track notification analytics
export const trackNotificationReceived = async (type) => {
  try {
    const trackingData = {
      type,
      receivedAt: new Date().toISOString(),
      status: 'received'
    };
    
    // Store in localStorage for now (you can enhance this)
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
    const docRef = doc(db, 'userNotifications', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('📄 Retrieved notification settings:', {
        hasToken: !!data.fcmToken,
        permission: data.notificationPermission,
        lastUpdate: data.lastTokenUpdate
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
      icon: '/logo192.png',
      tag: 'test-notification'
    });
  } else {
    console.warn('⚠️ Cannot send test notification - no permission');
  }
};