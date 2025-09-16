export default async function handler(req, res) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { 
      title, 
      message, 
      villages = [], 
      levels = [], 
      activityStatus = ['all'],
      scheduleType = 'now',
      scheduledDateTime = null,
      adminUserId 
    } = req.body;

    // Basic validation
    if (!title || !message || !adminUserId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // If scheduled for later, store in database
    if (scheduleType === 'scheduled' && scheduledDateTime) {
      const scheduledNotification = {
        fields: {
          title: { stringValue: title },
          message: { stringValue: message },
          villages: { arrayValue: { values: villages.map(v => ({ stringValue: v })) } },
          levels: { arrayValue: { values: levels.map(l => ({ stringValue: l })) } },
          activityStatus: { arrayValue: { values: activityStatus.map(s => ({ stringValue: s })) } },
          scheduledDateTime: { timestampValue: scheduledDateTime },
          adminUserId: { stringValue: adminUserId },
          status: { stringValue: 'scheduled' },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };

      // Store scheduled notification - FIXED AUTHENTICATION
      const scheduleResponse = await fetch(
        `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/scheduledNotifications?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(scheduledNotification)
        }
      );

      if (!scheduleResponse.ok) {
        throw new Error('Failed to schedule notification');
      }

      return res.status(200).json({
        success: true,
        scheduled: true,
        message: 'Notification scheduled successfully'
      });
    }

    // Send immediately
    console.log('Sending manual notification:', { title, message, villages, levels, activityStatus });

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

    if (!tokensResponse.ok) {
      throw new Error('Failed to fetch user tokens');
    }

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

    console.log('Found tokens for users:', Object.keys(userTokens).length);

    const notifications = [];
    const today = new Date().toISOString().split('T')[0];
    let targetedUsers = [];

    // Process each user - SIMPLIFIED TARGETING LOGIC
    for (const userDoc of users) {
      const userId = userDoc.name.split('/').pop();
      const fields = userDoc.fields || {};
      
      // Skip admin users
      if (fields.role && fields.role.stringValue === 'admin') continue;
      
      const fcmToken = userTokens[userId];
      if (!fcmToken) continue;

      let shouldInclude = false;
      
      // SIMPLIFIED: If "all" is selected, include everyone with tokens
      if (activityStatus.includes('all')) {
        shouldInclude = true;
      } else {
        // Village filtering
        if (villages.length > 0) {
          const userVillage = fields.village ? fields.village.stringValue : '';
          shouldInclude = villages.some(village => 
            userVillage.toLowerCase().includes(village.toLowerCase())
          );
        }
        
        // Level filtering
        if (levels.length > 0) {
          const userLevel = fields.level ? fields.level.stringValue : '';
          if (shouldInclude || villages.length === 0) {
            shouldInclude = levels.includes(userLevel);
          }
        }
        
        // If no specific targeting, include everyone
        if (villages.length === 0 && levels.length === 0) {
          shouldInclude = true;
        }
      }
      
      if (!shouldInclude) continue;

      const userName = fields.name ? fields.name.stringValue : 'User';
      
      targetedUsers.push({
        userId,
        name: userName,
        village: fields.village ? fields.village.stringValue : '',
        level: fields.level ? fields.level.stringValue : ''
      });

      // Create FCM message using HTTP v1 format
      const fcmMessage = {
        message: {
          token: fcmToken,
          notification: {
            title: title,
            body: message
          },
          data: {
            type: 'manual_notification',
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

      notifications.push(fcmMessage);
    }

    console.log('Targeted users:', targetedUsers.length);
    console.log('Notifications to send:', notifications.length);

    // Send notifications using FCM HTTP v1 API
    let successCount = 0;
    let failureCount = 0;
    let deliveryResults = [];

    for (let i = 0; i < notifications.length; i++) {
      const message = notifications[i];
      const user = targetedUsers[i];
      
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
          const result = await response.json();
          successCount++;
          deliveryResults.push({
            userId: user.userId,
            name: user.name,
            status: 'sent',
            messageId: result.name
          });
        } else {
          failureCount++;
          const errorText = await response.text();
          deliveryResults.push({
            userId: user.userId,
            name: user.name,
            status: 'failed',
            error: errorText.substring(0, 100)
          });
          console.error('FCM send failed for user:', user.name, errorText);
        }

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
                userId: { stringValue: user.userId },
                type: { stringValue: 'manual_notification' },
                status: { stringValue: response.ok ? 'sent' : 'failed' },
                timestamp: { timestampValue: new Date().toISOString() },
                date: { stringValue: today },
                adminId: { stringValue: adminUserId },
                title: { stringValue: title },
                message: { stringValue: message }
              }
            })
          }
        );

      } catch (error) {
        failureCount++;
        deliveryResults.push({
          userId: user.userId,
          name: user.name,
          status: 'error',
          error: error.message
        });
        console.error('Notification send error for user:', user.name, error);
      }
    }

    console.log(`Manual notifications sent: ${successCount} success, ${failureCount} failures`);

    res.status(200).json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: notifications.length,
      targetedUsers: targetedUsers.length,
      deliveryResults: deliveryResults
    });

  } catch (error) {
    console.error('Manual notification error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}