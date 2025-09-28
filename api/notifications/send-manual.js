import webpush from 'web-push';

export default async function handler(req, res) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      'mailto:admin@fitness.spocademy.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

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

    console.log('Environment check:', {
      hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasFirebaseApiKey: !!process.env.FIREBASE_API_KEY,
      hasVapidPublicKey: !!process.env.VAPID_PUBLIC_KEY,
      hasVapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
      projectId: process.env.FIREBASE_PROJECT_ID
    });

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
        const errorText = await scheduleResponse.text();
        console.error('Schedule response error:', scheduleResponse.status, errorText);
        throw new Error(`Failed to schedule notification: ${scheduleResponse.status}`);
      }

      return res.status(200).json({
        success: true,
        scheduled: true,
        message: 'Notification scheduled successfully'
      });
    }

    // Send immediately
    console.log('Sending manual Web Push notification:', { title, message, villages, levels, activityStatus });

    // Get all users with detailed error handling
    const usersUrl = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users?key=${process.env.FIREBASE_API_KEY}`;
    console.log('Fetching users from:', usersUrl);
    
    const usersResponse = await fetch(usersUrl);
    
    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      console.error('Users fetch error:', usersResponse.status, errorText);
      throw new Error(`Failed to fetch users: ${usersResponse.status} - ${errorText}`);
    }

    const usersData = await usersResponse.json();
    console.log('Users data structure:', {
      hasDocuments: !!usersData.documents,
      documentCount: usersData.documents?.length || 0
    });
    
    const users = usersData.documents || [];

    // Get Web Push subscriptions with detailed error handling
    const subscriptionsUrl = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/webPushSubscriptions?key=${process.env.FIREBASE_API_KEY}`;
    console.log('Fetching subscriptions from:', subscriptionsUrl);
    
    const subscriptionsResponse = await fetch(subscriptionsUrl);

    if (!subscriptionsResponse.ok) {
      const errorText = await subscriptionsResponse.text();
      console.error('Subscriptions fetch error:', subscriptionsResponse.status, errorText);
      // Don't throw error here - collection might not exist yet
      console.log('No subscriptions collection found - this is expected for new Web Push setup');
    }

    const subscriptionsData = subscriptionsResponse.ok ? await subscriptionsResponse.json() : { documents: [] };
    const userSubscriptions = {};
    
    if (subscriptionsData.documents) {
      subscriptionsData.documents.forEach(doc => {
        const userId = doc.name.split('/').pop();
        const data = doc.fields;
        
        if (data.subscription && data.subscription.stringValue) {
          try {
            userSubscriptions[userId] = JSON.parse(data.subscription.stringValue);
          } catch (error) {
            console.error('Invalid subscription format for user:', userId, error);
          }
        }
      });
    }

    console.log('Found subscriptions for users:', Object.keys(userSubscriptions).length);

    const notifications = [];
    const today = new Date().toISOString().split('T')[0];
    let targetedUsers = [];

    // Process each user
    for (const userDoc of users) {
      const userId = userDoc.name.split('/').pop();
      const fields = userDoc.fields || {};
      
      // Skip admin users
      if (fields.role && fields.role.stringValue === 'admin') continue;
      
      const subscription = userSubscriptions[userId];
      if (!subscription) {
        console.log('No subscription found for user:', userId);
        continue;
      }

      let shouldInclude = false;
      
      // If "all" is selected, include everyone with subscriptions
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

      // Create Web Push notification payload
      const payload = JSON.stringify({
        title: title,
        body: message,
        icon: '/JustS.png',
        badge: '/JustS.png',
        tag: 'spocademy-manual',
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
          type: 'manual_notification',
          url: 'https://fitness.spocademy.com/',
          userId: userId,
          timestamp: Date.now()
        }
      });

      notifications.push({
        subscription,
        payload,
        user: { userId, name: userName }
      });
    }

    console.log('Targeted users:', targetedUsers.length);
    console.log('Notifications to send:', notifications.length);

    // Send Web Push notifications
    let successCount = 0;
    let failureCount = 0;
    let deliveryResults = [];

    for (let i = 0; i < notifications.length; i++) {
      const { subscription, payload, user } = notifications[i];
      
      try {
        await webpush.sendNotification(subscription, payload, {
          TTL: 86400, // 24 hours
          urgency: 'normal'
        });

        successCount++;
        deliveryResults.push({
          userId: user.userId,
          name: user.name,
          status: 'sent'
        });

        console.log('Web Push sent successfully to:', user.name);

      } catch (error) {
        failureCount++;
        deliveryResults.push({
          userId: user.userId,
          name: user.name,
          status: 'failed',
          error: error.message
        });
        
        console.error('Web Push send failed for user:', user.name, error.message);

        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('Removing invalid subscription for user:', user.userId);
          try {
            await fetch(
              `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/webPushSubscriptions/${user.userId}?key=${process.env.FIREBASE_API_KEY}`,
              { method: 'DELETE' }
            );
          } catch (deleteError) {
            console.error('Failed to delete invalid subscription:', deleteError);
          }
        }
      }

      // Track notification analytics
      try {
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
                status: { stringValue: successCount > failureCount ? 'sent' : 'failed' },
                timestamp: { timestampValue: new Date().toISOString() },
                date: { stringValue: today },
                adminId: { stringValue: adminUserId },
                title: { stringValue: title },
                message: { stringValue: message }
              }
            })
          }
        );
      } catch (analyticsError) {
        console.error('Analytics tracking failed:', analyticsError);
      }
    }

    console.log(`Manual Web Push notifications sent: ${successCount} success, ${failureCount} failures`);

    res.status(200).json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: notifications.length,
      targetedUsers: targetedUsers.length,
      deliveryResults: deliveryResults,
      debug: {
        totalUsersInDb: users.length,
        usersWithSubscriptions: Object.keys(userSubscriptions).length,
        environmentCheck: {
          hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasFirebaseApiKey: !!process.env.FIREBASE_API_KEY,
          hasVapidPublicKey: !!process.env.VAPID_PUBLIC_KEY,
          hasVapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY
        }
      }
    });

  } catch (error) {
    console.error('Manual Web Push notification error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}