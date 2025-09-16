// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC_Fm-hxEyAZigpydCWH1n7Y8IUrNe9qxM",
  authDomain: "spocademy-mvp1.firebaseapp.com",
  projectId: "spocademy-mvp1",
  storageBucket: "spocademy-mvp1.firebasestorage.app",
  messagingSenderId: "910046288653",
  appId: "1:910046288653:web:2e836eb413309925d26e44"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received: ', payload);
  
  const notificationTitle = payload.notification?.title || 'Spocademy Training';
  const notificationOptions = {
    body: payload.notification?.body || 'Time for your training!',
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});