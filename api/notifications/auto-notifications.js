import webpush from 'web-push';

export default async function handler(req, res) {
  try {
    // Verify this is a cron request
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      'mailto:admin@fitness.spocademy.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Get current India time (UTC+5:30)
    const INDIA_OFFSET = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const indiaTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + INDIA_OFFSET);
    const currentHour = indiaTime.getHours();
    const today = indiaTime.toISOString().split('T')[0];

    console.log('Auto-notifications triggered at India time:', indiaTime.toISOString(), 'Hour:', currentHour);

    // Determine notification type based on time
    // Times: 5:30 AM IST, 4:30 PM IST, 8:30 PM IST
    // Checking hour only (minutes will be 30 due to IST +5:30 offset)
    let notificationType = null;
    let notificationTime = '';

    if (currentHour === 5 || currentHour === 6) {
      notificationType = 'morning_motivation';
      notificationTime = '5:30 AM';
    } else if (currentHour === 16 || currentHour === 17) {
      notificationType = 'evening_reminder';
      notificationTime = '4:30 PM';
    } else if (currentHour === 20 || currentHour === 21) {
      notificationType = 'final_warning';
      notificationTime = '8:30 PM';
    } else {
      console.log('Not a scheduled notification time. Current hour:', currentHour);
      return res.status(200).json({
        success: true,
        message: 'Not a scheduled notification time',
        currentHour
      });
    }

    console.log(`Processing ${notificationType} notifications at ${notificationTime}`);

    // Get all users
    const usersUrl = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users?key=${process.env.FIREBASE_API_KEY}`;
    const usersResponse = await fetch(usersUrl);

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      console.error('Users fetch error:', usersResponse.status, errorText);
      throw new Error(`Failed to fetch users: ${usersResponse.status}`);
    }

    const usersData = await usersResponse.json();
    const users = usersData.documents || [];

    // Get Web Push subscriptions
    const subscriptionsUrl = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/webPushSubscriptions?key=${process.env.FIREBASE_API_KEY}`;
    const subscriptionsResponse = await fetch(subscriptionsUrl);

    if (!subscriptionsResponse.ok) {
      console.log('No subscriptions collection found');
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
            console.error('Invalid subscription format for user:', userId);
          }
        }
      });
    }

    console.log('Found subscriptions for users:', Object.keys(userSubscriptions).length);

    const notifications = [];
    let skippedCompletedUsers = 0;

    // Process each user
    for (const userDoc of users) {
      const userId = userDoc.name.split('/').pop();
      const fields = userDoc.fields || {};

      // Skip admin users
      if (fields.role && fields.role.stringValue === 'admin') continue;

      const subscription = userSubscriptions[userId];
      if (!subscription) continue;

      // Check if user already completed today's training
      const completionUrl = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/dailyCompletions/${userId}_${today}?key=${process.env.FIREBASE_API_KEY}`;
      const completionResponse = await fetch(completionUrl);

      if (completionResponse.ok) {
        const completionData = await completionResponse.json();
        if (completionData.fields && completionData.fields.allTasksCompleted && 
            completionData.fields.allTasksCompleted.booleanValue) {
          skippedCompletedUsers++;
          console.log('User already completed training:', userId);
          continue; // Skip if already completed
        }
      }

      // Get user data
      const userName = fields.name ? fields.name.stringValue : 'Champion';
      const currentDay = fields.currentDay ? fields.currentDay.integerValue : '1';

      // Create notification message based on type
      let notificationTitle = '';
      let notificationBody = '';

      switch (notificationType) {
        case 'morning_motivation':
          notificationTitle = 'सुप्रभात 😊';
          notificationBody = `सुप्रभात ${userName}! भरतीचं स्वप्न पूर्ण करायचं असेल तर मेहनत आणि त्याग आवश्यक आहे. Let's go!`;
          break;
        case 'evening_reminder':
          notificationTitle = 'प्रशिक्षण आठवण 👋';
          notificationBody = `नमस्कार ${userName}, दिवस ${currentDay} चे कॅलेंडर अजून पूर्ण करायचे बाकी आहे. व्यायाम सुरु करूया?`;
          break;
        case 'final_warning':
          notificationTitle = 'शेवटची आठवण ❗';
          notificationBody = `शेवटची आठवण ${userName} - दिवस ${currentDay} पूर्ण करा आणि तुमची स्ट्रीक चालू ठेवा!`;
          break;
      }

      // Create Web Push notification payload
      const payload = JSON.stringify({
        title: notificationTitle,
        body: notificationBody,
        icon: '/JustS.png',
        badge: '/JustS.png',
        tag: `spocademy-${notificationType}`,
        requireInteraction: true,
        actions: [
          {
            action: 'open',
            title: 'प्रशिक्षण सुरू करा'
          },
          {
            action: 'dismiss',
            title: 'नंतर'
          }
        ],
        data: {
          type: notificationType,
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

    console.log(`Total notifications to send: ${notifications.length}`);
    console.log(`Skipped users who completed training: ${skippedCompletedUsers}`);

    // Send Web Push notifications
    let successCount = 0;
    let failureCount = 0;
    let deliveryResults = [];

    for (let i = 0; i < notifications.length; i++) {
      const { subscription, payload, user } = notifications[i];

      try {
        await webpush.sendNotification(subscription, payload, {
          TTL: 86400,
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
                type: { stringValue: notificationType },
                status: { stringValue: successCount > failureCount ? 'sent' : 'failed' },
                timestamp: { timestampValue: new Date().toISOString() },
                date: { stringValue: today },
                notificationTime: { stringValue: notificationTime }
              }
            })
          }
        );
      } catch (analyticsError) {
        console.error('Analytics tracking failed:', analyticsError);
      }
    }

    console.log(`${notificationType} sent: ${successCount} success, ${failureCount} failures`);

    res.status(200).json({
      success: true,
      notificationType,
      notificationTime,
      sent: successCount,
      failed: failureCount,
      total: notifications.length,
      skippedCompleted: skippedCompletedUsers,
      deliveryResults: deliveryResults.slice(0, 10), // Limit response size
      indiaTime: indiaTime.toISOString()
    });

  } catch (error) {
    console.error('Auto-notification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}