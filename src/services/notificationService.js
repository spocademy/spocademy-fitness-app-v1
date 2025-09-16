// src/services/notificationService.js
import { messaging } from './firebase/config';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from './firebase/config';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Request notification permission and get FCM token
export const requestNotificationPermission = async (userId) => {
  try {
    if (!messaging) {
      console.warn('FCM not supported on this browser');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: 'BLmnKUZ55vr4tt5zenmzZwSKGm2dV9H-eI-kh2B1y4_M7Q43j5QS1npjGQulN2aBv84vNBOppT_zZ8c8ZvxgCo0' // You'll need to generate this from Firebase Console
      });
      
      if (token) {
        // Save token to user document
        await saveUserToken(userId, token, permission);
        console.log('FCM token generated:', token);
        return token;
      }
    } else {
      console.log('Notification permission denied');
      await saveUserToken(userId, null, permission);
    }
    
    return null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
};

// Save user's FCM token and permission status
const saveUserToken = async (userId, token, permission) => {
  try {
    const userNotificationData = {
      fcmToken: token,
      notificationPermission: permission,
      lastTokenUpdate: serverTimestamp(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };

    await setDoc(doc(db, 'userNotifications', userId), userNotificationData, { merge: true });
  } catch (error) {
    console.error('Error saving user token:', error);
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback) => {
  if (!messaging) return;
  
  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
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
  return 'Notification' in window && Notification.permission === 'granted';
};

// Get user's current notification settings
export const getUserNotificationSettings = async (userId) => {
  try {
    const docRef = doc(db, 'userNotifications', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return null;
  }
};

// Manual notification for testing (admin use)
export const sendTestNotification = (title, body) => {
  if (hasNotificationPermission()) {
    new Notification(title, {
      body,
      icon: '/logo192.png',
      tag: 'test-notification'
    });
  }
};