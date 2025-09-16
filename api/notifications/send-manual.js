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
      scheduleType = 'now', // 'now' or 'scheduled'
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

      // Store scheduled notification
      const scheduleResponse = await fetch(
        `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/scheduledNotifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
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

    // Get all users
    const usersResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users`,
      {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      }
    );

    const usersData = await usersResponse.json();
    const users = usersData.documents || [];

    // Get user notification tokens
    const tokensResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/userNotifications`,
      {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      }
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

    // Get inactive user data for activity filtering
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const notifications = [];
    const today = new Date().toISOString().split('T')[0];
    let targetedUsers = [];

    // Filter users based on criteria
    for (const userDoc of users) {
      const userId = userDoc.name.split('/').pop();
      const fields = userDoc.fields || {};
      
      // Skip admin users
      if (fields.role && fields.role.stringValue === 'admin') continue;
      
      const fcmToken = userTokens[userId];
      if (!fcmToken) continue;

      let shouldInclude = false;
      
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
      
      // Activity status filtering
      if (activityStatus.includes('all') || (villages.length === 0 && levels.length === 0)) {
        shouldInclude = true;
      } else if (activityStatus.includes('inactive_2_days') || activityStatus.includes('inactive_7_days')) {
        const lastActive = fields.lastActive ? fields.lastActive.timestampValue : null;
        
        if (activityStatus.includes('inactive_7_days') && (!lastActive || lastActive < sevenDaysAgo)) {
          shouldInclude = true;
        } else if (activityStatus.includes('inactive_2_days') && (!lastActive || lastActive < twoDaysAgo)) {
          shouldInclude = true;
        }
      }
      
      if (!shouldInclude) continue;

      targetedUsers.push({
        userId,
        name: fields.name ? fields.name.stringValue : 'User',
        village: fields.village ? fields.village.stringValue : '',
        level: fields.level ? fields.level.stringValue : ''
      });

      // Create FCM message
      const fcmMessage = {
        to: fcmToken,
        notification: {
          title: title,
          body: message,
          icon: '/logo192.png'
        },
        data: {
          type: 'manual_notification',
          url: '/',
          userId: userId
        }
      };

      notifications.push(fcmMessage);
    }

    // Send notifications using FCM Legacy API
    let successCount = 0;
    let failureCount = 0;
    let deliveryResults = [];

    for (let i = 0; i < notifications.length; i++) {
      const message = notifications[i];
      const user = targetedUsers[i];
      
      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${process.env.FIREBASE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });

        const result = await response.json();
        
        if (response.ok && result.success === 1) {
          successCount++;
          deliveryResults.push({
            userId: user.userId,
            name: user.name,
            status: 'sent',
            messageId: result.results?.[0]?.message_id
          });
        } else {
          failureCount++;
          deliveryResults.push({
            userId: user.userId,
            name: user.name,
            status: 'failed',
            error: result.results?.[0]?.error || 'Unknown error'
          });
        }

        // Track notification analytics
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/notificationAnalytics`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await getAccessToken()}`,
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
        console.error('Notification send error:', error);
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

async function getAccessToken() {
  return process.env.FIREBASE_API_KEY;
}