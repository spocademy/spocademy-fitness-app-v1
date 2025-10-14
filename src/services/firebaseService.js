// src/services/firebaseService.js
import { db } from './firebase/config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// India timezone offset (UTC+5:30)
const INDIA_TIMEZONE_OFFSET = 5.5 * 60 * 60 * 1000;

// Get current India date
const getIndiaDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const indiaTime = new Date(utc + INDIA_TIMEZONE_OFFSET);
  return indiaTime;
};

// FIXED: Get India date string in YYYY-MM-DD format (using local India time, not UTC)
const getIndiaDateString = (date = null) => {
  const indiaDate = date || getIndiaDate();
  const year = indiaDate.getFullYear();
  const month = String(indiaDate.getMonth() + 1).padStart(2, '0');
  const day = String(indiaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get India day name
const getIndiaDayName = () => {
  const indiaDate = getIndiaDate();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[indiaDate.getDay()];
};

// Check if same calendar day in India timezone
const isSameIndiaDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  
  const d1 = date1.toDate ? date1.toDate() : new Date(date1);
  const d2 = date2.toDate ? date2.toDate() : new Date(date2);
  
  const utc1 = d1.getTime() + (d1.getTimezoneOffset() * 60000);
  const utc2 = d2.getTime() + (d2.getTimezoneOffset() * 60000);
  
  const india1 = new Date(utc1 + INDIA_TIMEZONE_OFFSET);
  const india2 = new Date(utc2 + INDIA_TIMEZONE_OFFSET);
  
  return india1.toDateString() === india2.toDateString();
};

// ===== NOTIFICATION FUNCTIONS =====

export const scheduleDailyNotifications = async (userId, userData) => {
  try {
    const today = getIndiaDate();
    const dateStr = getIndiaDateString(today); // FIXED: Use proper India date string
    
    const userNotificationDoc = await getDoc(doc(db, 'userNotifications', userId));
    if (!userNotificationDoc.exists() || !userNotificationDoc.data().fcmToken) {
      console.log('No FCM token found for user:', userId);
      return;
    }
    
    const fcmToken = userNotificationDoc.data().fcmToken;
    const currentDay = userData.currentDay || 1;
    
    const notificationSchedule = {
      userId,
      date: dateStr,
      currentDay,
      fcmToken,
      notifications: {
        morningReminder: {
          scheduled: true,
          time: '05:30',
          type: 'daily_reminder',
          sent: false
        },
        eveningCheck: {
          scheduled: true,
          time: '16:00',
          type: 'evening_check',
          sent: false
        },
        finalReminder: {
          scheduled: true,
          time: '20:00',
          type: 'streak_protection',
          sent: false
        },
        hydrationReminder: {
          scheduled: false,
          time: '14:00',
          type: 'hydration',
          sent: false
        }
      },
      createdAt: serverTimestamp()
    };
    
    if (today.getDay() === 0) {
      notificationSchedule.notifications.weeklyProgress = {
        scheduled: true,
        time: '11:00',
        type: 'weekly_progress',
        sent: false
      };
    }
    
    const scheduleId = `${userId}_${dateStr}`;
    await setDoc(doc(db, 'notificationSchedules', scheduleId), notificationSchedule);
    
    console.log('Daily notifications scheduled for user:', userId);
    
  } catch (error) {
    console.error('Error scheduling daily notifications:', error);
  }
};

export const enableHydrationReminder = async (userId) => {
  try {
    const today = getIndiaDate();
    const dateStr = getIndiaDateString(today); // FIXED: Use proper India date string
    const scheduleId = `${userId}_${dateStr}`;
    
    await updateDoc(doc(db, 'notificationSchedules', scheduleId), {
      'notifications.hydrationReminder.scheduled': true,
      'notifications.hydrationReminder.enabledAt': serverTimestamp()
    });
    
    console.log('Hydration reminder enabled for user:', userId);
    
  } catch (error) {
    console.error('Error enabling hydration reminder:', error);
  }
};

export const markNotificationSent = async (userId, notificationType) => {
  try {
    const today = getIndiaDate();
    const dateStr = getIndiaDateString(today); // FIXED: Use proper India date string
    const scheduleId = `${userId}_${dateStr}`;
    
    await updateDoc(doc(db, 'notificationSchedules', scheduleId), {
      [`notifications.${notificationType}.sent`]: true,
      [`notifications.${notificationType}.sentAt`]: serverTimestamp()
    });
    
  } catch (error) {
    console.error('Error marking notification as sent:', error);
  }
};

export const getPendingNotifications = async () => {
  try {
    const now = getIndiaDate();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = getIndiaDateString(now); // FIXED: Use proper India date string
    
    const schedulesSnapshot = await getDocs(
      query(
        collection(db, 'notificationSchedules'),
        where('date', '==', dateStr)
      )
    );
    
    const pendingNotifications = [];
    
    for (const scheduleDoc of schedulesSnapshot.docs) {
      const schedule = scheduleDoc.data();
      const { notifications, userId, fcmToken, currentDay } = schedule;
      
      for (const [type, notification] of Object.entries(notifications)) {
        if (notification.scheduled && !notification.sent && notification.time === currentTime) {
          
          if (type === 'eveningCheck' || type === 'finalReminder') {
            const hasCompleted = await checkIfUserCompletedToday(userId);
            if (hasCompleted) {
              await markNotificationSent(userId, type);
              continue;
            }
          }
          
          pendingNotifications.push({
            userId,
            fcmToken,
            type,
            currentDay,
            scheduleId: scheduleDoc.id
          });
        }
      }
    }
    
    return pendingNotifications;
    
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    return [];
  }
};

const checkIfUserCompletedToday = async (userId) => {
  try {
    const todayCompletion = await getTodayCompletion(userId);
    return todayCompletion && todayCompletion.allTasksCompleted;
  } catch (error) {
    console.error('Error checking user completion:', error);
    return false;
  }
};

export const getUsersForReengagement = async () => {
  try {
    const twoDaysAgo = new Date(getIndiaDate().getTime() - 2 * 24 * 60 * 60 * 1000);
    const twoDaysAgoTimestamp = Timestamp.fromDate(twoDaysAgo);
    
    const usersSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('lastCompletedAt', '<=', twoDaysAgoTimestamp),
        where('role', '!=', 'admin')
      )
    );
    
    const inactiveUsers = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      const userNotificationDoc = await getDoc(doc(db, 'userNotifications', userId));
      if (userNotificationDoc.exists() && userNotificationDoc.data().fcmToken) {
        inactiveUsers.push({
          userId,
          userData,
          fcmToken: userNotificationDoc.data().fcmToken
        });
      }
    }
    
    return inactiveUsers;
    
  } catch (error) {
    console.error('Error getting users for re-engagement:', error);
    return [];
  }
};

export const createNotificationContent = (type, userData = {}, extra = {}) => {
  const { name = 'Champion', currentDay = 1, streakCount = 0, village = 'Your Village' } = userData;
  
  const notifications = {
    daily_reminder: {
      title: 'Time for Training!',
      body: `Good morning ${name}! Day ${currentDay} awaits. Let's build strength!`,
      data: { type: 'daily_reminder', url: '/' }
    },
    
    evening_check: {
      title: 'Training Reminder',
      body: `${name}, 2 hours left to complete Day ${currentDay}. Keep your streak alive!`,
      data: { type: 'evening_check', url: '/' }
    },
    
    streak_protection: {
      title: 'Don\'t Break Your Streak!',
      body: `${name}, your ${streakCount}-day streak is at risk! Complete Day ${currentDay} now.`,
      data: { type: 'streak_protection', url: '/' }
    },
    
    hydration: {
      title: 'Stay Hydrated!',
      body: `Great job completing your morning training ${name}! Time to hydrate and fuel up.`,
      data: { type: 'hydration', url: '/' }
    },
    
    weekly_progress: {
      title: 'Weekly Progress Report',
      body: `${name}, you've completed ${extra.weeklyDays || 0}/7 days this week. Ready for a fresh start?`,
      data: { type: 'weekly_progress', url: '/' }
    },
    
    reengagement: {
      title: `Missing You, ${name}!`,
      body: `${village} needs you back! Your training journey is waiting.`,
      data: { type: 'reengagement', url: '/' }
    }
  };
  
  return notifications[type] || notifications.daily_reminder;
};

export const trackNotificationAnalytics = async (userId, type, status, extra = {}) => {
  try {
    const analyticsData = {
      userId,
      type,
      status,
      timestamp: serverTimestamp(),
      date: getIndiaDateString(), // FIXED: Use proper India date string
      ...extra
    };
    
    const analyticsRef = doc(collection(db, 'notificationAnalytics'));
    await setDoc(analyticsRef, analyticsData);
    
  } catch (error) {
    console.error('Error tracking notification analytics:', error);
  }
};

export const getNotificationAnalytics = async (days = 7) => {
  try {
    const startDate = new Date(getIndiaDate().getTime() - days * 24 * 60 * 60 * 1000);
    const startDateStr = getIndiaDateString(startDate); // FIXED: Use proper India date string
    
    const analyticsSnapshot = await getDocs(
      query(
        collection(db, 'notificationAnalytics'),
        where('date', '>=', startDateStr),
        orderBy('date', 'desc')
      )
    );
    
    const analytics = analyticsSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    const summary = {
      totalSent: analytics.filter(a => a.status === 'sent').length,
      totalDelivered: analytics.filter(a => a.status === 'delivered').length,
      totalClicked: analytics.filter(a => a.status === 'clicked').length,
      totalDismissed: analytics.filter(a => a.status === 'dismissed').length,
      clickRate: 0,
      deliveryRate: 0
    };
    
    if (summary.totalSent > 0) {
      summary.deliveryRate = ((summary.totalDelivered / summary.totalSent) * 100).toFixed(1);
    }
    
    if (summary.totalDelivered > 0) {
      summary.clickRate = ((summary.totalClicked / summary.totalDelivered) * 100).toFixed(1);
    }
    
    return { analytics, summary };
    
  } catch (error) {
    console.error('Error getting notification analytics:', error);
    return { analytics: [], summary: {} };
  }
};

// ===== USER FUNCTIONS =====

export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

export const createUser = async (userId, userData) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      ...userData,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      currentDay: 1,
      points: 0,
      streakCount: 0,
      currentCampUnlocked: null,
      attendedCamps: []
    });
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUserProgress = async (userId, progressData) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...progressData,
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    throw error;
  }
};

// ===== STREAK VALIDATION FUNCTIONS =====

export const getTodayCompletion = async (userId, dateStr = null) => {
  try {
    const targetDate = dateStr || getIndiaDateString(); // FIXED: Use proper India date string
    const completionId = `${userId}_${targetDate}`;
    
    const completionDoc = await getDoc(doc(db, 'dailyCompletions', completionId));
    if (completionDoc.exists()) {
      return { id: completionDoc.id, ...completionDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting completion:', error);
    return null;
  }
};

export const validateUserStreak = async (userId) => {
  try {
    const userData = await getUserData(userId);
    if (!userData) return 0;
    
    const todayCompletion = await getTodayCompletion(userId);
    if (todayCompletion && todayCompletion.allTasksCompleted) {
      return userData.streakCount;
    }
    
    const yesterday = new Date(getIndiaDate().getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getIndiaDateString(yesterday); // FIXED: Use proper India date string
    const yesterdayCompletion = await getTodayCompletion(userId, yesterdayStr);
    
    if (userData.streakCount > 0 && (!yesterdayCompletion || !yesterdayCompletion.allTasksCompleted)) {
      await updateUserProgress(userId, {
        streakCount: 0,
        streakBrokenAt: serverTimestamp()
      });
      
      console.log(`Reset streak for user ${userId} - missed ${yesterdayStr}`);
      return 0;
    }
    
    return userData.streakCount;
    
  } catch (error) {
    console.error('Error validating user streak:', error);
    return 0;
  }
};

// ===== TASK FUNCTIONS =====

export const getAllTasks = async () => {
  try {
    const tasksSnapshot = await getDocs(collection(db, 'tasks'));
    return tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw error;
  }
};

export const getTask = async (taskId) => {
  try {
    const taskDoc = await getDoc(doc(db, 'tasks', taskId));
    if (taskDoc.exists()) {
      return { id: taskDoc.id, ...taskDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting task:', error);
    throw error;
  }
};

export const createTask = async (taskData) => {
  try {
    const taskRef = doc(collection(db, 'tasks'));
    await setDoc(taskRef, {
      ...taskData,
      createdAt: serverTimestamp()
    });
    return taskRef.id;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

// ===== WEEKLY SCHEDULE FUNCTIONS =====

export const getWeeklySchedule = async (scheduleId = 'default_schedule') => {
  try {
    const scheduleDoc = await getDoc(doc(db, 'weeklySchedules', scheduleId));
    if (scheduleDoc.exists()) {
      return { id: scheduleDoc.id, ...scheduleDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting weekly schedule:', error);
    throw error;
  }
};

export const createWeeklySchedule = async (scheduleData, scheduleId = 'default_schedule') => {
  try {
    await setDoc(doc(db, 'weeklySchedules', scheduleId), {
      ...scheduleData,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating weekly schedule:', error);
    throw error;
  }
};

// ===== CONSOLIDATED PLAN FUNCTIONS =====

const createPlanId = (day, week, level) => {
  const dayMap = {
    monday: 'Mon',
    tuesday: 'Tue', 
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun'
  };
  
  const levelMap = {
    beginnerBoys: 'BB',
    beginnerGirls: 'BG',
    advancedBoys: 'AB',
    advancedGirls: 'AG',
    specialBatch: 'SB'
  };
  
  const dayCode = dayMap[day] || day.slice(0, 3);
  const levelCode = levelMap[level] || level.slice(0, 2);
  
  return `${dayCode}W${week}${levelCode}`;
};

export const createDailyPlan = async (day, week, level, tasksData) => {
  try {
    const planId = createPlanId(day, week, level);
    
    const planData = {
      day,
      week: parseInt(week),
      level,
      tasks: tasksData,
      totalPoints: tasksData.length,
      createdAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'dailyPlans', planId), planData);
    console.log(`Created consolidated plan: ${planId}`, planData);
    
    return planId;
  } catch (error) {
    console.error('Error creating daily plan:', error);
    throw error;
  }
};

export const getDailyPlan = async (day, week, level) => {
  try {
    const planId = createPlanId(day, week, level);
    const planDoc = await getDoc(doc(db, 'dailyPlans', planId));
    
    if (planDoc.exists()) {
      return { id: planDoc.id, ...planDoc.data() };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting daily plan:', error);
    throw error;
  }
};

export const getAllPlans = async () => {
  try {
    const plansSnapshot = await getDocs(collection(db, 'dailyPlans'));
    return plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all plans:', error);
    throw error;
  }
};

const calculateWeekNumber = (currentDay) => {
  return Math.ceil(currentDay / 7);
};

const getTaskIcon = (taskType) => {
  switch (taskType) {
    case 'strength':
      return '💪';
    case 'athletics':
      return '🏃‍♂️';
    case 'nutrition':
      return '🥗';
    default:
      return '🎯';
  }
};

export const getDailyTasksForUser = async (level, currentDay) => {
  try {
    const weekNumber = calculateWeekNumber(currentDay);
    const currentDayName = getIndiaDayName();
    
    console.log(`Getting tasks for ${currentDayName}, week ${weekNumber}, level ${level}`);
    
    let dailyPlan = await getDailyPlan(currentDayName, weekNumber, level);
    
    if (!dailyPlan) {
      console.log(`No plan for week ${weekNumber}, trying previous weeks...`);
      
      for (let fallbackWeek = weekNumber - 1; fallbackWeek >= 1; fallbackWeek--) {
        dailyPlan = await getDailyPlan(currentDayName, fallbackWeek, level);
        if (dailyPlan) {
          console.log(`Found fallback plan in week ${fallbackWeek}`);
          break;
        }
      }
    }
    
    if (!dailyPlan || !dailyPlan.tasks) {
      console.log(`No plans found for ${currentDayName} ${level}`);
      return { tasks: [], showWhatsAppSupport: true };
    }
    
    console.log('Found plan:', dailyPlan);
    
    const dailyTasks = [];
    
    for (const taskPlan of dailyPlan.tasks) {
      try {
        const task = await getTask(taskPlan.taskId);
        if (!task) {
          console.log(`Task ${taskPlan.taskId} not found`);
          continue;
        }
        
        const dailyTask = {
          id: task.id,
          name: task.name,
          type: task.type,
          exerciseType: task.exerciseType || null,
          reps: taskPlan.reps || null,
          sets: taskPlan.sets || null,
          restTime: taskPlan.restTime || null,
          icon: getTaskIcon(task.type)
        };
        
        dailyTasks.push(dailyTask);
      } catch (error) {
        console.error(`Error processing task ${taskPlan.taskId}:`, error);
      }
    }
    
    return { tasks: dailyTasks, showWhatsAppSupport: false };
    
  } catch (error) {
    console.error('Error getting daily tasks for user:', error);
    throw error;
  }
};

// ===== CAMP PLAN FUNCTIONS =====

export const getCampPlan = async (campNumber) => {
  try {
    const campId = `camp${campNumber}`;
    const campDoc = await getDoc(doc(db, 'campPlans', campId));
    
    if (campDoc.exists()) {
      const campData = campDoc.data();
      const campTasks = [];
      
      for (const taskPlan of campData.tasks || []) {
        try {
          const task = await getTask(taskPlan.taskId);
          if (!task) continue;
          
          const campTask = {
            id: task.id,
            name: task.name,
            type: task.type,
            exerciseType: task.exerciseType || null,
            reps: taskPlan.reps || null,
            sets: taskPlan.sets || null,
            restTime: taskPlan.restTime || null,
            icon: getTaskIcon(task.type)
          };
          
          campTasks.push(campTask);
        } catch (error) {
          console.error(`Error processing camp task ${taskPlan.taskId}:`, error);
        }
      }
      
      return { 
        id: campDoc.id, 
        campNumber,
        tasks: campTasks 
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting camp plan:', error);
    throw error;
  }
};

export const createCampPlan = async (campNumber, tasksData) => {
  try {
    const campId = `camp${campNumber}`;
    
    const campData = {
      campNumber,
      tasks: tasksData,
      createdAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'campPlans', campId), campData);
    console.log(`Created camp plan: ${campId}`, campData);
    
    return campId;
  } catch (error) {
    console.error('Error creating camp plan:', error);
    throw error;
  }
};

export const getAllCampPlans = async () => {
  try {
    const campsSnapshot = await getDocs(collection(db, 'campPlans'));
    return campsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all camp plans:', error);
    throw error;
  }
};

export const unlockCampForUser = async (userId, campNumber) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      currentCampUnlocked: campNumber,
      lastActive: serverTimestamp()
    });
    console.log(`Unlocked Camp ${campNumber} for user ${userId}`);
  } catch (error) {
    console.error('Error unlocking camp:', error);
    throw error;
  }
};

export const bulkUnlockCamp = async (userIds, campNumber) => {
  try {
    const promises = userIds.map(userId => 
      updateDoc(doc(db, 'users', userId), {
        currentCampUnlocked: campNumber,
        lastActive: serverTimestamp()
      })
    );
    
    await Promise.all(promises);
    console.log(`Bulk unlocked Camp ${campNumber} for ${userIds.length} users`);
  } catch (error) {
    console.error('Error bulk unlocking camp:', error);
    throw error;
  }
};

export const getTodayCampCompletion = async (userId, campNumber) => {
  try {
    const today = getIndiaDate();
    const dateStr = getIndiaDateString(today); // FIXED: Use proper India date string
    const completionId = `${userId}_camp${campNumber}_${dateStr}`;
    
    const completionDoc = await getDoc(doc(db, 'campCompletions', completionId));
    if (completionDoc.exists()) {
      return { id: completionDoc.id, ...completionDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting camp completion:', error);
    return null;
  }
};

export const saveCampTaskCompletion = async (userId, campNumber, taskId) => {
  try {
    const indiaDate = getIndiaDate();
    const dateStr = getIndiaDateString(indiaDate); // FIXED: Use proper India date string
    const completionId = `${userId}_camp${campNumber}_${dateStr}`;
    
    let completionData = await getTodayCampCompletion(userId, campNumber);
    
    if (!completionData) {
      completionData = {
        userId,
        campNumber,
        date: dateStr,
        completedTasks: {},
        allTasksCompleted: false,
        createdAt: serverTimestamp()
      };
    }
    
    completionData.completedTasks[taskId] = {
      completed: true,
      completedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'campCompletions', completionId), {
      ...completionData,
      updatedAt: serverTimestamp()
    });
    
    return completionData;
  } catch (error) {
    console.error('Error saving camp task completion:', error);
    throw error;
  }
};

export const checkAndUpdateCampCompletion = async (userId, campNumber, totalTasks) => {
  try {
    const todayCompletion = await getTodayCampCompletion(userId, campNumber);
    
    if (!todayCompletion) return false;
    
    const completedTaskCount = Object.keys(todayCompletion.completedTasks).length;
    const allCompleted = completedTaskCount >= totalTasks;
    
    if (allCompleted && !todayCompletion.allTasksCompleted) {
      const indiaDate = getIndiaDate();
      const dateStr = getIndiaDateString(indiaDate); // FIXED: Use proper India date string
      const completionId = `${userId}_camp${campNumber}_${dateStr}`;
      
      await updateDoc(doc(db, 'campCompletions', completionId), {
        allTasksCompleted: true,
        campCompletedAt: serverTimestamp()
      });
      
      const userData = await getUserData(userId);
      const attendedCamps = userData.attendedCamps || [];
      
      if (!attendedCamps.includes(campNumber)) {
        await updateDoc(doc(db, 'users', userId), {
          attendedCamps: [...attendedCamps, campNumber],
          currentCampUnlocked: null,
          lastActive: serverTimestamp()
        });
      }
      
      console.log(`User ${userId} completed Camp ${campNumber}`);
      return true;
    }
    
    return allCompleted;
  } catch (error) {
    console.error('Error checking camp completion:', error);
    throw error;
  }
};

export const getCampCompletionSummary = async () => {
  try {
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '!=', 'admin'))
    );
    
    const summary = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      if (userData.currentCampUnlocked !== null || (userData.attendedCamps && userData.attendedCamps.length > 0)) {
        const userSummary = {
          userId,
          name: userData.name,
          village: userData.village,
          currentCampUnlocked: userData.currentCampUnlocked,
          camp1: userData.attendedCamps?.includes(1) ? 'Yes' : 'No',
          camp2: userData.attendedCamps?.includes(2) ? 'Yes' : 'No',
          camp3: userData.attendedCamps?.includes(3) ? 'Yes' : 'No',
          camp4: userData.attendedCamps?.includes(4) ? 'Yes' : 'No',
          camp5: userData.attendedCamps?.includes(5) ? 'Yes' : 'No'
        };
        
        summary.push(userSummary);
      }
    }
    
    return summary;
    
  } catch (error) {
    console.error('Error getting camp completion summary:', error);
    throw error;
  }
};

// ===== DAILY COMPLETION TRACKING =====

export const saveTaskCompletion = async (userId, taskId, currentDay) => {
  try {
    const indiaDate = getIndiaDate();
    const dateStr = getIndiaDateString(indiaDate); // FIXED: Use proper India date string
    const completionId = `${userId}_${dateStr}`;
    
    let completionData = await getTodayCompletion(userId);
    
    if (!completionData) {
      completionData = {
        userId,
        date: dateStr,
        currentDay,
        completedTasks: {},
        allTasksCompleted: false,
        createdAt: serverTimestamp()
      };
    }
    
    completionData.completedTasks[taskId] = {
      completed: true,
      completedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'dailyCompletions', completionId), {
      ...completionData,
      updatedAt: serverTimestamp()
    });
    
    return completionData;
  } catch (error) {
    console.error('Error saving task completion:', error);
    throw error;
  }
};

export const checkAndUpdateDayCompletion = async (userId, currentDay, totalTasks) => {
  try {
    const todayCompletion = await getTodayCompletion(userId);
    
    if (!todayCompletion) return false;
    
    const completedTaskCount = Object.keys(todayCompletion.completedTasks).length;
    const allCompleted = completedTaskCount >= totalTasks;
    
    if (allCompleted && !todayCompletion.allTasksCompleted) {
      const indiaDate = getIndiaDate();
      const dateStr = getIndiaDateString(indiaDate); // FIXED: Use proper India date string
      const completionId = `${userId}_${dateStr}`;
      
      await updateDoc(doc(db, 'dailyCompletions', completionId), {
        allTasksCompleted: true,
        dayCompletedAt: serverTimestamp()
      });
      
      if (indiaDate.getHours() < 10) {
        await enableHydrationReminder(userId);
      }
      
      await updateUserDayCompletion(userId, currentDay);
      
      return true;
    }
    
    return allCompleted;
  } catch (error) {
    console.error('Error checking day completion:', error);
    throw error;
  }
};

const updateUserDayCompletion = async (userId, completedDay) => {
  try {
    const userData = await getUserData(userId);
    if (!userData) return;
    
    const newStreak = (userData.streakCount || 0) + 1;
    
    await updateUserProgress(userId, {
      currentDay: completedDay + 1,
      points: (userData.points || 0) + 1,
      streakCount: newStreak,
      lastCompletedDay: completedDay,
      lastCompletedAt: serverTimestamp()
    });
    
    console.log(`User ${userId} completed day ${completedDay}. New streak: ${newStreak}`);
  } catch (error) {
    console.error('Error updating user day completion:', error);
    throw error;
  }
};

export const canUserTrainToday = async (userId) => {
  try {
    const userData = await getUserData(userId);
    if (!userData) return false;
    
    const todayCompletion = await getTodayCompletion(userId);
    
    if (todayCompletion && todayCompletion.allTasksCompleted) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking if user can train today:', error);
    return false;
  }
};

export const resetIncompleteDays = async () => {
  try {
    const yesterday = new Date(getIndiaDate().getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getIndiaDateString(yesterday); // FIXED: Use proper India date string
    
    const completionsSnapshot = await getDocs(
      query(
        collection(db, 'dailyCompletions'),
        where('date', '==', yesterdayStr),
        where('allTasksCompleted', '==', false)
      )
    );
    
    for (const completionDoc of completionsSnapshot.docs) {
      const completionData = completionDoc.data();
      const userId = completionData.userId;
      
      const userData = await getUserData(userId);
      if (userData) {
        await updateUserProgress(userId, {
          streakCount: 0,
          lastIncompleteDate: yesterdayStr
        });
        
        console.log(`Reset streak for user ${userId} due to incomplete day ${yesterdayStr}`);
      }
    }
    
    console.log(`Processed ${completionsSnapshot.docs.length} incomplete days for ${yesterdayStr}`);
  } catch (error) {
    console.error('Error resetting incomplete days:', error);
    throw error;
  }
};

// ===== PROGRESS TRACKING =====

export const saveUserProgress = async (userId, day, progressData) => {
  try {
    const progressId = `${userId}_day${day}`;
    await setDoc(doc(db, 'userProgress', progressId), {
      userId,
      day,
      ...progressData,
      completedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving progress:', error);
    throw error;
  }
};

export const getUserProgress = async (userId, day) => {
  try {
    const progressId = `${userId}_day${day}`;
    const progressDoc = await getDoc(doc(db, 'userProgress', progressId));
    
    if (progressDoc.exists()) {
      return { id: progressDoc.id, ...progressDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting progress:', error);
    throw error;
  }
};

// ===== VILLAGE RANKINGS =====

export const getVillageRankings = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const villagePoints = {};
    
    users.forEach(user => {
      if (user.village && user.points) {
        if (!villagePoints[user.village]) {
          villagePoints[user.village] = 0;
        }
        villagePoints[user.village] += user.points;
      }
    });
    
    const rankings = Object.entries(villagePoints)
      .map(([village, points]) => ({ village, points }))
      .sort((a, b) => b.points - a.points)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    
    return rankings;
  } catch (error) {
    console.error('Error getting village rankings:', error);
    throw error;
  }
};

// ===== ADMIN FUNCTIONS =====

export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '!=', 'admin'))
    );
    return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

export const getUserStats = async () => {
  try {
    const users = await getAllUsers();
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(user => user.streakCount > 0).length,
      completionRate: users.length > 0 ? 
        Math.round((users.filter(user => user.currentDay > 1).length / users.length) * 100) : 0,
      villages: new Set(users.map(user => user.village)).size
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
};