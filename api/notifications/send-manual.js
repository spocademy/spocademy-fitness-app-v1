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

    // Get all users
    const usersResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users?key=${process.env.FIREBASE_API_KEY}`
    );

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users');
    }

    const usersData = await usersResponse.json();
    const users = usersData.documents || [];

    // Get user notification tokens
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

    // Process each user
    for (const userDoc of users) {
      const userId = userDoc.name.split('/').pop();
      const fields = userDoc.fields || {};
      
      // Skip admin users
      if (fields.role && fields.role.stringValue === 'admin') continue;
      
      const fcmToken = userTokens[userId];
      if (!fcmToken) continue;

      let shouldInclude = false;
      
      // If "all" is selected, include everyone with tokens
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

      // Create FCM message using LEGACY format
      const fcmMessage = {
        to: fcmToken,
        notification: {
          title: title,
          body: message,
          icon: '/logo192.png',
          click_action: 'https://fitness.spocademy.com/'
        },
        data: {
          type: 'manual_notification',
          url: '/',
          userId: userId
        }
      };

      notifications.push(fcmMessage);
    }

    console.log('Targeted users:', targetedUsers.length);
    console.log('Notifications to send:', notifications.length);

    // Send notifications using FCM LEGACY API with corrected authentication
    let successCount = 0;
    let failureCount = 0;
    let deliveryResults = [];

    for (let i = 0; i < notifications.length; i++) {
      const message = notifications[i];
      const user = targetedUsers[i];
      
      try {
        // Use the FCM_SERVER_KEY environment variable
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${process.env.FCM_SERVER_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });

        const result = await response.json();
        
        console.log('FCM Response for user', user.name, ':', {
          status: response.status,
          success: result.success,
          failure: result.failure,
          results: result.results
        });

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
          const errorMsg = result.results?.[0]?.error || result.error || 'Unknown error';
          deliveryResults.push({
            userId: user.userId,
            name: user.name,
            status: 'failed',
            error: errorMsg
          });
          console.error('FCM send failed for user:', user.name, {
            error: errorMsg,
            fullResponse: result
          });
        }

        // Track notification analytics
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
                status: { stringValue: response.ok && result.success === 1 ? 'sent' : 'failed' },
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
      deliveryResults: deliveryResults,
      debug: {
        totalUsersInDb: users.length,
        usersWithTokens: Object.keys(userTokens).length,
        environmentCheck: {
          hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasFirebaseApiKey: !!process.env.FIREBASE_API_KEY,
          hasFcmServerKey: !!process.env.FCM_SERVER_KEY
        }
      }
    });

  } catch (error) {
    console.error('Manual notification error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}