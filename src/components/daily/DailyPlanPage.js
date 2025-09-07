// src/components/daily/DailyPlanPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { saveUserProgress, updateUserProgress, getDailyTasksForUser, getUserProgress } from '../../services/firebaseService';
import './DailyPlanPage.css';
import EnhancedCamera from './EnhancedCamera';

const DailyPlanPage = ({ day = 15, onBack }) => {
  const [currentLanguage, setCurrentLanguage] = useState('mr');
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [currentExercise, setCurrentExercise] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const { currentUser, userData, refreshUserData } = useAuth();

  // Check if current calendar day matches required day for this training day
  const isCorrectCalendarDay = () => {
    const today = new Date();
    const currentCalendarDay = today.getDay(); // 0=Sunday, 1=Monday, etc.
    const requiredCalendarDay = (day - 1) % 7; // Training day to calendar day
    
    return currentCalendarDay === requiredCalendarDay;
  };

  const getRequiredDayName = () => {
    const requiredCalendarDay = (day - 1) % 7;
    const dayNames = currentLanguage === 'en' 
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    return dayNames[requiredCalendarDay];
  };

  const getCurrentDay = () => {
    return Math.max(day, 1);
  };

  const isDayAccessible = (dayNumber) => {
    return dayNumber <= getCurrentDay();
  };

  // Check for streak reset based on calendar day gaps and validate maximum streak
  const checkAndResetStreak = async () => {
    if (!currentUser || !userData) return;

    const today = new Date();
    const lastActive = userData.lastActive ? new Date(userData.lastActive.seconds * 1000) : null;
    
    let shouldUpdate = false;
    let newStreakCount = userData.streakCount || 0;
    
    // Rule 1: Streak cannot exceed currentDay
    const maxPossibleStreak = userData.currentDay;
    if (newStreakCount > maxPossibleStreak) {
      console.log(`Streak ${newStreakCount} exceeds max possible ${maxPossibleStreak}. Capping streak.`);
      newStreakCount = maxPossibleStreak;
      shouldUpdate = true;
    }
    
    // Rule 2: Check for calendar day gaps
    if (lastActive) {
      const daysDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 1 && newStreakCount > 0) {
        console.log(`Gap detected: ${daysDiff} days. Resetting streak.`);
        newStreakCount = 0;
        shouldUpdate = true;
      }
    }
    
    // Update if needed
    if (shouldUpdate) {
      try {
        await updateUserProgress(currentUser.uid, {
          streakCount: newStreakCount,
          lastActive: new Date()
        });
        
        if (refreshUserData) {
          refreshUserData();
        }
      } catch (error) {
        console.error('Error updating streak:', error);
      }
    }
  };

  useEffect(() => {
    const initAudio = () => {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        setAudioContext(context);
      } catch (error) {
        console.warn('Audio context initialization failed:', error);
      }
    };
    
    const handleFirstInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Check for streak reset on component mount
  useEffect(() => {
    const runStreakCheck = async () => {
      await checkAndResetStreak();
    };
    
    if (userData && currentUser) {
      runStreakCheck();
    }
  }, [currentUser, userData]);

  // Load tasks using new consolidated system
  useEffect(() => {
    const loadDailyTasks = async () => {
      if (!userData?.level) return;
      
      try {
        setLoadingTasks(true);
        
        const tasksData = await getDailyTasksForUser(userData.level, day);
        
        if (tasksData && tasksData.length > 0) {
          const formattedTasks = tasksData.map(task => ({
            id: task.id,
            category: task.type,
            type: task.type === 'athletics' || task.type === 'nutrition' ? 'self-mark' : 'camera',
            icon: task.icon,
            reps: task.reps,
            sets: task.sets,
            restTime: task.restTime,
            name: task.name,
            exerciseType: task.exerciseType
          }));
          
          setTasks(formattedTasks);
        } else {
          setTasks([]);
        }
      } catch (error) {
        console.error('Error loading daily tasks:', error);
        setTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    loadDailyTasks();
  }, [userData?.level, day]);

  useEffect(() => {
    if (completedTasks.size === tasks.length && completedTasks.size > 0) {
      setTimeout(() => {
        setShowCelebration(true);
        playCelebrationSound();
        handleDayCompletion();
      }, 1000);
    }
  }, [completedTasks.size, tasks.length]);

  const handleDayCompletion = async () => {
    if (!currentUser || !userData) return;

    try {
      const pointsEarned = 1;
      
      // Save the progress for this day
      await saveUserProgress(currentUser.uid, day, {
        completed: true,
        tasks: Object.fromEntries(Array.from(completedTasks).map(taskId => [taskId, { completed: true }])),
        pointsEarned,
        completedAt: new Date()
      });

      // Calculate proper streak: count consecutive completed days from day 1
      const calculateConsecutiveStreak = async () => {
        let streak = 0;
        for (let d = 1; d <= day; d++) {
          const progress = await getUserProgress(currentUser.uid, d);
          if (progress && progress.completed) {
            streak++;
          } else {
            // If any day is not completed, reset streak to 0
            streak = 0;
            break;
          }
        }
        return streak;
      };

      // Calculate total points: count all completed days (not consecutive)
      const calculateTotalPoints = async () => {
        let totalCompletedDays = 0;
        for (let d = 1; d <= day; d++) {
          const progress = await getUserProgress(currentUser.uid, d);
          if (progress && progress.completed) {
            totalCompletedDays++;
          }
        }
        return totalCompletedDays;
      };

      const newStreak = await calculateConsecutiveStreak();
      const newTotalPoints = await calculateTotalPoints();

      await updateUserProgress(currentUser.uid, {
        currentDay: Math.max(userData.currentDay, day + 1),
        points: newTotalPoints,
        streakCount: newStreak,
        lastActive: new Date()
      });

      console.log(`Progress saved successfully - Total points: ${newTotalPoints}, Streak: ${newStreak}`);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const playSound = (type = 'click') => {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
      case 'click':
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      case 'success':
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
        break;
      case 'complete':
        const frequencies = [523, 659, 784, 1047];
        frequencies.forEach((freq, index) => {
          setTimeout(() => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.setValueAtTime(freq, audioContext.currentTime);
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.3);
          }, index * 150);
        });
        break;
    }
  };

  const triggerHapticFeedback = (type = 'light') => {
    if (navigator.vibrate) {
      switch(type) {
        case 'light':
          navigator.vibrate(50);
          break;
        case 'medium':
          navigator.vibrate(100);
          break;
        case 'success':
          navigator.vibrate([100, 50, 100, 50, 200]);
          break;
      }
    }
  };

  const playCelebrationSound = () => {
    playSound('complete');
    triggerHapticFeedback('success');
  };

  const translations = {
    en: {
      userName: `Hello, ${userData?.name || 'User'}`,
      trainingDay: "Day " + day,
      athletics: "ATHLETICS",
      strength: "STRENGTH",
      nutrition: "NUTRITION",
      markComplete: "Mark Complete",
      startCamera: "Start Camera",
      completed: "✓ Completed",
      undo: "Undo",
      continue: "Continue",
      navigateBack: "Going back to training pathway...",
      instructions: "Instructions for",
      allTasksCompleted: "All tasks completed for today!",
      greatWork: "Great Work!",
      tomorrowUnlocked: "Tomorrow's training is now unlocked!",
      dayLocked: "This day is not yet available",
      comeBackTomorrow: "Come back on the scheduled date to unlock",
      wrongDay: "Today is not the scheduled day for this training",
      comeBackOn: "Come back on",
      noTasksFound: "No tasks assigned for this day yet",
      loadingTasks: "Loading your training plan...",
      dayComplete: "Day completed! You earned 1 point!"
    },
    mr: {
      userName: `नमस्कार, ${userData?.name || 'वापरकर्ता'}`,
      trainingDay: "दिवस " + day,
      athletics: "खेळ",
      strength: "शक्ती",
      nutrition: "पोषण",
      markComplete: "पूर्ण झाले",
      startCamera: "कॅमेरा सुरू करा",
      completed: "✓ पूर्ण झाले",
      undo: "रद्द करा",
      navigateBack: "प्रशिक्षण मार्गावर परत जात आहे...",
      instructions: "Instructions for",
      allTasksCompleted: "आजची सर्व कामे पूर्ण झाली!",
      greatWork: "छान काम!",
      tomorrowUnlocked: "उद्याचे प्रशिक्षण आता उघडले आहे!",
      dayLocked: "हा दिवस अजून उपलब्ध नाही",
      comeBackTomorrow: "निर्धारित तारखेला परत या आणि अनलॉक करा",
      wrongDay: "आज या प्रशिक्षणाचा निर्धारित दिवस नाही",
      comeBackOn: "परत या",
      noTasksFound: "या दिवसासाठी अजून कामे नियुक्त केलेली नाहीत",
      loadingTasks: "तुमची प्रशिक्षण योजना लोड करत आहे...",
      dayComplete: "दिवस पूर्ण झाला! तुम्हाला 1 गुण मिळाला!"
    }
  };

  const getCurrentDate = () => {
    const now = new Date();
    const days = currentLanguage === 'en' 
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const months = currentLanguage === 'en'
      ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      : ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
    
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();
    
    return `${dayName}, ${monthName} ${date}, ${year}`;
  };

  const toggleLanguage = () => {
    setCurrentLanguage(currentLanguage === 'en' ? 'mr' : 'en');
  };

  const handleTaskAction = (taskId) => {
    playSound('click');
    triggerHapticFeedback('light');
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (task.type === 'camera') {
      const exerciseObject = {
        ...task,
        repsPerSet: task.reps,
        sets: task.sets,
        restTime: task.restTime,
        exerciseType: task.exerciseType
      };
      setCurrentExercise(exerciseObject);
    } else {
      completeTask(taskId);
    }
  };

  const completeTask = (taskId) => {
    if (completedTasks.has(taskId)) return;
    
    playSound('success');
    triggerHapticFeedback('medium');
    
    setCompletedTasks(new Set([...completedTasks, taskId]));
  };

  const uncheckTask = (taskId) => {
    playSound('click');
    triggerHapticFeedback('light');
    
    const newCompletedTasks = new Set(completedTasks);
    newCompletedTasks.delete(taskId);
    setCompletedTasks(newCompletedTasks);
  };

  const completeCurrentExercise = () => {
    if (currentExercise) {
      completeTask(currentExercise.id);
      setCurrentExercise(null);
    }
  };

  const handleCelebrationClose = async () => {
    setShowCelebration(false);
    
    if (refreshUserData) {
      refreshUserData();
    }
    
    if (onBack) {
      setTimeout(() => onBack(), 500);
    }
  };

  const playAudio = (taskId) => {
    playSound('click');
    
    const task = tasks.find(t => t.id === taskId);
    if (task && 'speechSynthesis' in window) {
      const t = translations[currentLanguage];
      const taskName = task.name?.[currentLanguage] || task.name?.en || 'Unknown Task';
      const text = `${t.instructions} ${taskName}`;
      
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = currentLanguage === 'mr' ? 'hi-IN' : 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  const showProgress = () => {
    playSound('click');
    const completedCount = completedTasks.size;
    const totalTasks = tasks.length;
    const percentage = Math.round((completedCount / totalTasks) * 100);
    const progressMessage = currentLanguage === 'en' 
      ? `Progress: ${completedCount}/${totalTasks} tasks (${percentage}%)\n1 point when all tasks completed`
      : `प्रगती: ${completedCount}/${totalTasks} कामे (${percentage}%)\nसर्व कामे पूर्ण झाल्यावर 1 गुण`;
    alert(progressMessage);
  };

  const handleBack = () => {
    playSound('click');
    const t = translations[currentLanguage];
    alert(t.navigateBack);
    if (onBack) onBack();
  };

  const renderTaskCard = (task) => {
    const isCompleted = completedTasks.has(task.id);
    const t = translations[currentLanguage];
    const buttonText = task.type === 'camera' ? t.startCamera : t.markComplete;
    
    const taskName = task.name?.[currentLanguage] || task.name?.en || 'Unknown Task';
    const taskDesc = task.reps ? `${task.sets} sets of ${task.reps} reps` : 'Complete this task';
    
    return (
      <div key={task.id} className={`task-card ${isCompleted ? 'completed' : ''}`}>
        {isCompleted && (
          <button className="undo-btn" onClick={() => uncheckTask(task.id)}>
            {t.undo}
          </button>
        )}
        <div className="task-header">
          <div className="task-icon">{task.icon}</div>
          <div className="task-info">
            <div className="task-name">{taskName}</div>
            <div className="task-description">{taskDesc}</div>
          </div>
        </div>
        <div className="task-controls">
          <button className="audio-btn" onClick={() => playAudio(task.id)}>
            🔊
          </button>
          {isCompleted ? (
            <div className="completed-indicator">{t.completed}</div>
          ) : (
            <button className="start-btn" onClick={() => handleTaskAction(task.id)}>
              {buttonText}
            </button>
          )}
        </div>
      </div>
    );
  };

  const t = translations[currentLanguage];
  const categories = ['athletics', 'strength', 'nutrition'];
  const isCurrentDayAccessible = isDayAccessible(day);

  return (
    <div className="daily-plan-container">
      <div className="header">
        <div className="header-top">
          <button className="back-btn" onClick={handleBack}>
            ← Back
          </button>
          <button className="language-toggle" onClick={toggleLanguage}>
            {currentLanguage === 'en' ? 'EN' : 'मर'}
          </button>
        </div>
        <div className="user-info">
          <div className="user-name">{t.userName}</div>
          <div className="training-day">{t.trainingDay}</div>
        </div>
        <div className="date-info">{getCurrentDate()}</div>
      </div>

      <div className="progress-tracker" onClick={showProgress}>
        <div className="progress-text">
          {completedTasks.size}/{tasks.length}
        </div>
      </div>

      <div className="task-list">
        {!isCurrentDayAccessible ? (
          <div className="day-locked-message">
            <div className="lock-icon">🔒</div>
            <div className="lock-title">{t.dayLocked}</div>
            <div className="lock-message">{t.comeBackTomorrow}</div>
          </div>
        ) : !isCorrectCalendarDay() ? (
          <div className="day-locked-message">
            <div className="lock-icon">📅</div>
            <div className="lock-title">{t.wrongDay}</div>
            <div className="lock-message">{t.comeBackOn} {getRequiredDayName()}</div>
          </div>
        ) : loadingTasks ? (
          <div className="day-locked-message">
            <div className="lock-icon">⏳</div>
            <div className="lock-title">{t.loadingTasks}</div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="day-locked-message">
            <div className="lock-icon">📋</div>
            <div className="lock-title">{t.noTasksFound}</div>
            <div className="lock-message">Contact admin to assign tasks</div>
          </div>
        ) : (
          categories.map(category => {
            const categoryTasks = tasks.filter(task => task.category === category);
            if (categoryTasks.length === 0) return null;
            
            return (
              <div key={category} className="task-group">
                <div className="group-title">{t[category]}</div>
                {categoryTasks.map(task => renderTaskCard(task))}
              </div>
            );
          })
        )}
      </div>

      {currentExercise && (
        <EnhancedCamera
          exercise={currentExercise}
          onComplete={completeCurrentExercise}
          onBack={() => setCurrentExercise(null)}
          isVisible={!!currentExercise}
          translations={t}
          currentLanguage={currentLanguage}
        />
      )}

      {showCelebration && (
        <div className="celebration-overlay">
          <div className="celebration-content">
            <div className="celebration-icon">🎉</div>
            <div className="celebration-title">{t.greatWork}</div>
            <div className="celebration-message">{t.dayComplete}</div>
            <div className="celebration-submessage">{t.tomorrowUnlocked}</div>
            <button className="celebration-btn" onClick={handleCelebrationClose}>
              {t.continue}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyPlanPage;