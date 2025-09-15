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
      streakCount: 0
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

// ===== DAILY TASK RESOLUTION WITH FALLBACK =====

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

// Get daily tasks with fallback hierarchy
export const getDailyTasksForUser = async (level, currentDay) => {
  try {
    const weekNumber = calculateWeekNumber(currentDay);
    const currentDayName = getIndiaDayName(); // Always use current calendar day
    
    console.log(`Getting tasks for ${currentDayName}, week ${weekNumber}, level ${level}`);
    
    // Try current week first
    let dailyPlan = await getDailyPlan(currentDayName, weekNumber, level);
    
    // Fallback hierarchy if current week not found
    if (!dailyPlan) {
      console.log(`No plan for week ${weekNumber}, trying previous weeks...`);
      
      // Try previous weeks
      for (let fallbackWeek = weekNumber - 1; fallbackWeek >= 1; fallbackWeek--) {
        dailyPlan = await getDailyPlan(currentDayName, fallbackWeek, level);
        if (dailyPlan) {
          console.log(`Found fallback plan in week ${fallbackWeek}`);
          break;
        }
      }
    }
    
    // If still no plan found, return empty with flag for WhatsApp support
    if (!dailyPlan || !dailyPlan.tasks) {
      console.log(`No plans found for ${currentDayName} ${level}`);
      return { tasks: [], showWhatsAppSupport: true };
    }
    
    console.log('Found plan:', dailyPlan);
    
    // Get full task details
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

// ===== DAILY COMPLETION TRACKING =====

// Get today's completion tracking document
export const getTodayCompletion = async (userId) => {
  try {
    const indiaDate = getIndiaDate();
    const dateStr = indiaDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const completionId = `${userId}_${dateStr}`;
    
    const completionDoc = await getDoc(doc(db, 'dailyCompletions', completionId));
    if (completionDoc.exists()) {
      return { id: completionDoc.id, ...completionDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting today completion:', error);
    throw error;
  }
};

// Save task completion for today
export const saveTaskCompletion = async (userId, taskId, currentDay) => {
  try {
    const indiaDate = getIndiaDate();
    const dateStr = indiaDate.toISOString().split('T')[0];
    const completionId = `${userId}_${dateStr}`;
    
    // Get existing completion or create new
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
    
    // Mark task as completed
    completionData.completedTasks[taskId] = {
      completed: true,
      completedAt: serverTimestamp()
    };
    
    // Save updated completion
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

// Check if all tasks completed for today and update user progress
export const checkAndUpdateDayCompletion = async (userId, currentDay, totalTasks) => {
  try {
    const todayCompletion = await getTodayCompletion(userId);
    
    if (!todayCompletion) return false;
    
    const completedTaskCount = Object.keys(todayCompletion.completedTasks).length;
    const allCompleted = completedTaskCount >= totalTasks;
    
    if (allCompleted && !todayCompletion.allTasksCompleted) {
      // Mark day as fully completed
      const indiaDate = getIndiaDate();
      const dateStr = indiaDate.toISOString().split('T')[0];
      const completionId = `${userId}_${dateStr}`;
      
      await updateDoc(doc(db, 'dailyCompletions', completionId), {
        allTasksCompleted: true,
        dayCompletedAt: serverTimestamp()
      });
      
      // Update user progress
      await updateUserDayCompletion(userId, currentDay);
      
      return true;
    }
    
    return allCompleted;
  } catch (error) {
    console.error('Error checking day completion:', error);
    throw error;
  }
};

// Update user's day completion, points, and streak
const updateUserDayCompletion = async (userId, completedDay) => {
  try {
    const userData = await getUserData(userId);
    if (!userData) return;
    
    // Calculate new streak
    let newStreak = 1;
    
    // Check if this completion continues a streak
    if (userData.lastCompletedDay && userData.lastCompletedDay === completedDay - 1) {
      newStreak = (userData.streakCount || 0) + 1;
    }
    
    // Update user data
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

// Check if user can access training today (prevent multiple day completion)
export const canUserTrainToday = async (userId) => {
  try {
    const userData = await getUserData(userId);
    if (!userData) return false;
    
    // Check if user already completed a day today
    const todayCompletion = await getTodayCompletion(userId);
    
    if (todayCompletion && todayCompletion.allTasksCompleted) {
      return false; // Already completed a day today
    }
    
    return true;
  } catch (error) {
    console.error('Error checking if user can train today:', error);
    return false;
  }
};

// Reset incomplete days (to be called by Cloud Function at midnight)
export const resetIncompleteDays = async () => {
  try {
    // Get yesterday's incomplete completions
    const yesterday = new Date(getIndiaDate().getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const completionsSnapshot = await getDocs(
      query(
        collection(db, 'dailyCompletions'),
        where('date', '==', yesterdayStr),
        where('allTasksCompleted', '==', false)
      )
    );
    
    // Reset streaks for users with incomplete days
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