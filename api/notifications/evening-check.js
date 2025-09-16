export default async function handler(req, res) {
  try {
    // Verify this is a cron request
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('Starting evening check notifications...');

    // Get all users - FIXED AUTHENTICATION
    const usersResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users?key=${process.env.FIREBASE_API_KEY}`
    );

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users');
    }

    const usersData = await usersResponse.json();
    const users = usersData.documents || [];

    // Get user notification tokens - FIXED AUTHENTICATION
    const tokensResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/userNotifications?key=${process.env.FIREBASE_API_KEY}`
    );

    const tokensData = await tokensResponse.json();
    const userTokens = {};
    
    if (tokensData.documents) {
      tokensData.documents.forEach(doc => {
        const userId = doc.name.split('/').pop();
        const data = doc.fields;
        
        if (data.fcmToken && data.fcmToken.stringValue && 
            data.notificationPermission && data.notificationPermission.stringValue === 'granted') {
          userTokens[userId] = data.fcmToken.stringValue;
        }
      });
    }

    const notifications = [];
    const today = new Date().toISOString().split('T')[0];

    // Process each user
    for (const userDoc of users) {
      const userId = userDoc.name.split('/').pop();
      const fields = userDoc.fields || {};
      
      // Skip admin users
      if (fields.role && fields.role.stringValue === 'admin') continue;
      
      const fcmToken = userTokens[userId];
      if (!fcmToken) continue;

      // Check if user already completed today - FIXED AUTHENTICATION
      const completionResponse = await fetch(
        `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/dailyCompletions/${userId}_${today}?key=${process.env.FIREBASE_API_KEY}`
      );

      if (completionResponse.ok) {
        const completionData = await completionResponse.json();
        if (completionData.fields && completionData.fields.allTasksCompleted && 
            completionData.fields.allTasksCompleted.booleanValue) {
          continue; // Skip if already completed
        }
      }

      // Get user data
      const userName = fields.name ? fields.name.stringValue : 'Champion';
      const currentDay = fields.currentDay ? fields.currentDay.integerValue : '1';

      // Create FCM message using HTTP v1 format
      const message = {
        message: {
          token: fcmToken,
          notification: {
            title: 'Training Reminder',
            body: `${userName}, 2 hours left to complete Day ${currentDay}. Keep your streak alive!`
          },
          data: {
            type: 'evening_check',
            url: '/',
            userId: userId
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'spocademy_notifications'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          }
        }
      };

      notifications.push(message);

      // Track notification analytics - FIXED AUTHENTICATION
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/notificationAnalytics?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              userId: { stringValue: userId },
              type: { stringValue: 'evening_check' },
              status: { stringValue: 'sent' },
              timestamp: { timestampValue: new Date().toISOString() },
              date: { stringValue: today }
            }
          })
        }
      );
    }

    // Send notifications using FCM HTTP v1 API
    let successCount = 0;
    let failureCount = 0;

    for (const message of notifications) {
      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.FIREBASE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });

        if (response.ok) {
          successCount++;
        } else {
          failureCount++;
          const errorText = await response.text();
          console.error('FCM send failed:', errorText);
        }
      } catch (error) {
        failureCount++;
        console.error('Notification send error:', error);
      }
    }

    console.log(`Evening check sent: ${successCount} success, ${failureCount} failures`);

    res.status(200).json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: notifications.length
    });

  } catch (error) {
    console.error('Evening check error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}