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
  orderBy 
} from 'firebase/firestore';

// ===== USER FUNCTIONS =====

// Get user data by their ID
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

// Create or update user data
export const createUser = async (userId, userData) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      ...userData,
      createdAt: new Date(),
      lastActive: new Date()
    });
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Update user progress (points, streak, current day)
export const updateUserProgress = async (userId, progressData) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...progressData,
      lastActive: new Date()
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    throw error;
  }
};

// ===== TASK FUNCTIONS =====

// Get all basic tasks
export const getAllTasks = async () => {
  try {
    const tasksSnapshot = await getDocs(collection(db, 'tasks'));
    return tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw error;
  }
};

// Get specific task by ID
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

// Create new basic task
export const createTask = async (taskData) => {
  try {
    const taskRef = doc(collection(db, 'tasks'));
    await setDoc(taskRef, {
      ...taskData,
      createdAt: new Date()
    });
    return taskRef.id;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

// ===== WEEKLY SCHEDULE FUNCTIONS =====

// Get weekly schedule
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

// Create or update weekly schedule
export const createWeeklySchedule = async (scheduleData, scheduleId = 'default_schedule') => {
  try {
    await setDoc(doc(db, 'weeklySchedules', scheduleId), {
      ...scheduleData,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Error creating weekly schedule:', error);
    throw error;
  }
};

// ===== CONSOLIDATED PLAN FUNCTIONS =====

// Helper function to create readable plan ID
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

// Create consolidated daily plan
export const createDailyPlan = async (day, week, level, tasksData) => {
  try {
    const planId = createPlanId(day, week, level);
    
    const planData = {
      day,
      week: parseInt(week),
      level,
      tasks: tasksData,
      totalPoints: tasksData.length,
      createdAt: new Date()
    };
    
    await setDoc(doc(db, 'dailyPlans', planId), planData);
    console.log(`Created consolidated plan: ${planId}`, planData);
    
    return planId;
  } catch (error) {
    console.error('Error creating daily plan:', error);
    throw error;
  }
};

// Get consolidated daily plan
export const getDailyPlan = async (day, week, level) => {
  try {
    const planId = createPlanId(day, week, level);
    const planDoc = await getDoc(doc(db, 'dailyPlans', planId));
    
    if (planDoc.exists()) {
      return { id: planDoc.id, ...planDoc.data() };
    }
    
    console.log(`No plan found for ${planId}`);
    return null;
  } catch (error) {
    console.error('Error getting daily plan:', error);
    throw error;
  }
};

// Get all consolidated plans (for admin)
export const getAllPlans = async () => {
  try {
    const plansSnapshot = await getDocs(collection(db, 'dailyPlans'));
    return plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all plans:', error);
    throw error;
  }
};

// ===== DAILY TASK RESOLUTION =====

// Calculate which week the user is in based on current day
const calculateWeekNumber = (currentDay) => {
  return Math.ceil(currentDay / 7);
};

// Get day of week (0 = Monday, 6 = Sunday)
const getDayOfWeek = (currentDay) => {
  return (currentDay - 1) % 7;
};

// Convert day number to day name
const getDayName = (dayOfWeek) => {
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return dayNames[dayOfWeek];
};

// Helper function to get task icon
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

// Get daily tasks for user with execution details (NEW CONSOLIDATED VERSION)
export const getDailyTasksForUser = async (level, currentDay) => {
  try {
    const weekNumber = calculateWeekNumber(currentDay);
    
    // Get actual calendar day (0=Sunday, 1=Monday, etc.)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    console.log(`Getting tasks for ${dayName}, week ${weekNumber}, level ${level}`);
    
    // Get consolidated daily plan
    const dailyPlan = await getDailyPlan(dayName, weekNumber, level);
    
    if (!dailyPlan || !dailyPlan.tasks) {
      console.log(`No consolidated plan found for ${dayName} week ${weekNumber} level ${level}`);
      return [];
    }
    
    console.log('Found consolidated plan:', dailyPlan);
    
    // Get full task details for each task in the plan
    const dailyTasks = [];
    
    for (const taskPlan of dailyPlan.tasks) {
      try {
        // Get basic task info
        const task = await getTask(taskPlan.taskId);
        if (!task) {
          console.log(`Task ${taskPlan.taskId} not found`);
          continue;
        }
        
        // Combine task and plan data
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
    
    console.log('Final daily tasks:', dailyTasks);
    return dailyTasks;
    
  } catch (error) {
    console.error('Error getting daily tasks for user:', error);
    throw error;
  }
};

// ===== LEGACY COMPATIBILITY FUNCTIONS =====

// Legacy function - now redirects to consolidated system
export const createTaskPlan = async (taskId, level, week, planData) => {
  console.warn('createTaskPlan is deprecated. Use createDailyPlan instead.');
  return null;
};

// Legacy function - now redirects to consolidated system  
export const getPlan = async (taskId, level, week) => {
  console.warn('getPlan is deprecated. Use getDailyPlan instead.');
  return null;
};

// ===== PROGRESS TRACKING (UNCHANGED) =====

// Save user's daily progress
export const saveUserProgress = async (userId, day, progressData) => {
  try {
    const progressId = `${userId}_day${day}`;
    await setDoc(doc(db, 'userProgress', progressId), {
      userId,
      day,
      ...progressData,
      completedAt: new Date()
    });
  } catch (error) {
    console.error('Error saving progress:', error);
    throw error;
  }
};

// Get user's progress for specific day
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

// ===== VILLAGE RANKINGS (UNCHANGED) =====

// Get village rankings (top villages by total points)
export const getVillageRankings = async () => {
  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Group users by village and calculate total points
    const villagePoints = {};
    
    users.forEach(user => {
      if (user.village && user.points) {
        if (!villagePoints[user.village]) {
          villagePoints[user.village] = 0;
        }
        villagePoints[user.village] += user.points;
      }
    });
    
    // Convert to array and sort by points
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

// ===== ADMIN FUNCTIONS (UNCHANGED) =====

// Get all users (for admin dashboard)
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

// Get user statistics (for admin dashboard)
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