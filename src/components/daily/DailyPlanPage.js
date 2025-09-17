// src/components/daily/DailyPlanPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  getDailyTasksForUser, 
  getTodayCompletion,
  saveTaskCompletion,
  checkAndUpdateDayCompletion,
  canUserTrainToday
} from '../../services/firebaseService';
import './DailyPlanPage.css';
import EnhancedCamera from './EnhancedCamera';

const DailyPlanPage = ({ day, onBack }) => {
  const [currentLanguage, setCurrentLanguage] = useState('mr');
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [currentExercise, setCurrentExercise] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showWhatsAppSupport, setShowWhatsAppSupport] = useState(false);
  const [canTrainToday, setCanTrainToday] = useState(true);
  const [alreadyCompletedToday, setAlreadyCompletedToday] = useState(false);
  const { currentUser, userData, refreshUserData } = useAuth();

  // Check if user can train today
  useEffect(() => {
    const checkTrainingAccess = async () => {
      if (!currentUser) return;
      
      try {
        const canTrain = await canUserTrainToday(currentUser.uid);
        setCanTrainToday(canTrain);
        
        if (!canTrain) {
          setAlreadyCompletedToday(true);
        }
      } catch (error) {
        console.error('Error checking training access:', error);
      }
    };
    
    checkTrainingAccess();
  }, [currentUser]);

  // Load tasks and existing completion state
  useEffect(() => {
    const loadDailyTasks = async () => {
      if (!userData?.level) return;
      
      try {
        setLoadingTasks(true);
        
        const tasksResponse = await getDailyTasksForUser(userData.level, userData.currentDay || 1);
        
        if (tasksResponse.showWhatsAppSupport) {
          setShowWhatsAppSupport(true);
          setTasks([]);
        } else {
          // Keep tasks in the exact order set by admin - NO SORTING
          setTasks(tasksResponse.tasks || []);
          setShowWhatsAppSupport(false);
          
          // Load today's completion state
          if (currentUser) {
            const todayCompletion = await getTodayCompletion(currentUser.uid);
            if (todayCompletion && todayCompletion.completedTasks) {
              const completedTaskIds = Object.keys(todayCompletion.completedTasks);
              setCompletedTasks(new Set(completedTaskIds));
            }
          }
        }
      } catch (error) {
        console.error('Error loading daily tasks:', error);
        setTasks([]);
        setShowWhatsAppSupport(true);
      } finally {
        setLoadingTasks(false);
      }
    };

    loadDailyTasks();
  }, [userData?.level, userData?.currentDay, currentUser]);

  // Initialize audio context
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

  // Check for day completion
  useEffect(() => {
    const checkCompletion = async () => {
      if (completedTasks.size === tasks.length && completedTasks.size > 0 && currentUser) {
        try {
          const dayCompleted = await checkAndUpdateDayCompletion(
            currentUser.uid, 
            userData.currentDay || 1, 
            tasks.length
          );
          
          if (dayCompleted) {
            setTimeout(() => {
              setShowCelebration(true);
              playCelebrationSound();
            }, 1000);
          }
        } catch (error) {
          console.error('Error checking day completion:', error);
        }
      }
    };
    
    checkCompletion();
  }, [completedTasks.size, tasks.length, currentUser, userData?.currentDay]);

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
      trainingDay: `Day ${userData?.currentDay || 1}`,
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
      noTasksFound: "No tasks planned for today",
      contactAdmin: "Contact admin to add tasks for your level and today's schedule",
      loadingTasks: "Loading your training plan...",
      dayComplete: "Day completed! You earned 1 point!",
      alreadyCompleted: "You have already completed training today",
      comeBackTomorrow: "Come back tomorrow for your next training session",
      whatsappSupport: "Contact Support"
    },
    mr: {
      userName: `नमस्कार, ${userData?.name || 'वापरकर्ता'}`,
      trainingDay: `दिवस ${userData?.currentDay || 1}`,
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
      noTasksFound: "आजसाठी कोणती कामे नियोजित नाहीत",
      contactAdmin: "तुमच्या स्तरासाठी आणि आजच्या वेळापत्रकासाठी कामे जोडण्यासाठी प्रशासकाशी संपर्क साधा",
      loadingTasks: "तुमची प्रशिक्षण योजना लोड करत आहे...",
      dayComplete: "दिवस पूर्ण झाला! तुम्हाला 1 गुण मिळाला!",
      alreadyCompleted: "तुम्ही आज आधीच प्रशिक्षण पूर्ण केले आहे",
      comeBackTomorrow: "तुमच्या पुढील प्रशिक्षण सत्रासाठी उद्या परत या",
      whatsappSupport: "सहाय्यता संपर्क"
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

  const handleTaskAction = async (taskId) => {
    if (!canTrainToday || alreadyCompletedToday) return;
    
    playSound('click');
    triggerHapticFeedback('light');
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Check if this is a strength exercise with camera detection
    const hasCamera = task.type === 'strength' && 
                     task.exerciseType && 
                     (task.exerciseType === 'squats' || task.exerciseType === 'jumpingJacks');
    
    if (hasCamera) {
      const exerciseObject = {
        ...task,
        repsPerSet: task.reps,
        sets: task.sets,
        restTime: task.restTime,
        exerciseType: task.exerciseType
      };
      setCurrentExercise(exerciseObject);
    } else {
      await completeTask(taskId);
    }
  };

  const completeTask = async (taskId) => {
    if (completedTasks.has(taskId) || !currentUser) return;
    
    try {
      playSound('success');
      triggerHapticFeedback('medium');
      
      // Save task completion to database
      await saveTaskCompletion(currentUser.uid, taskId, userData.currentDay || 1);
      
      // Update local state
      setCompletedTasks(new Set([...completedTasks, taskId]));
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const completeCurrentExercise = async () => {
    if (currentExercise) {
      await completeTask(currentExercise.id);
      setCurrentExercise(null);
    }
  };

  const handleCelebrationClose = async () => {
    setShowCelebration(false);
    
    if (refreshUserData) {
      await refreshUserData();
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
      
      // Build detailed description
      let description = taskName;
      
      if (task.reps && task.sets) {
        const setsText = currentLanguage === 'mr' ? 'सेट' : 'sets';
        const repsText = currentLanguage === 'mr' ? 'रेप्स' : 'reps';
        const restText = currentLanguage === 'mr' ? 'सेकंद विश्रांती' : 'seconds rest';
        
        description += `. ${task.sets} ${setsText}, ${task.reps} ${repsText}`;
        
        if (task.restTime) {
          description += `, ${task.restTime} ${restText}`;
        }
      }
      
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(description);
      utterance.lang = currentLanguage === 'mr' ? 'hi-IN' : 'en-US';
      utterance.rate = 0.8; // Slightly slower for detailed info
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

  const handleWhatsAppSupport = () => {
    const message = currentLanguage === 'en' 
      ? `Hi, I need tasks assigned for ${userData?.level || 'my level'} for today's training. My current day is ${userData?.currentDay || 1}.`
      : `नमस्कार, मला आजच्या प्रशिक्षणासाठी ${userData?.level || 'माझ्या स्तरासाठी'} कामे नियुक्त करण्याची गरज आहे. माझा सध्याचा दिवस ${userData?.currentDay || 1} आहे.`;
    
    const whatsappUrl = `https://wa.me/919359246193?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const renderTaskCard = (task, index) => {
    const isCompleted = completedTasks.has(task.id);
    const t = translations[currentLanguage];
    
    // Determine if this task should use camera
    const hasCamera = task.type === 'strength' && 
                     task.exerciseType && 
                     (task.exerciseType === 'squats' || task.exerciseType === 'jumpingJacks');
    
    const buttonText = hasCamera ? t.startCamera : t.markComplete;
    
    const taskName = task.name?.[currentLanguage] || task.name?.en || 'Unknown Task';
    const taskDesc = task.reps ? `${task.sets} sets of ${task.reps} reps` : 'Complete this task';
    
    return (
      <div key={task.id} className={`task-card ${isCompleted ? 'completed' : ''}`}>
        <div className="task-header">
          <div className="task-icon">{task.icon}</div>
          <div className="task-info">
            <div className="task-name">{index + 1}. {taskName}</div>
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
            <button 
              className="start-btn" 
              onClick={() => handleTaskAction(task.id)}
              disabled={!canTrainToday || alreadyCompletedToday}
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>
    );
  };

  const t = translations[currentLanguage];

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
        {alreadyCompletedToday ? (
          <div className="day-locked-message">
            <div className="lock-icon">✅</div>
            <div className="lock-title">{t.alreadyCompleted}</div>
            <div className="lock-message">{t.comeBackTomorrow}</div>
          </div>
        ) : loadingTasks ? (
          <div className="day-locked-message">
            <div className="lock-icon">⏳</div>
            <div className="lock-title">{t.loadingTasks}</div>
          </div>
        ) : showWhatsAppSupport ? (
          <div className="day-locked-message">
            <div className="lock-icon">📋</div>
            <div className="lock-title">{t.noTasksFound}</div>
            <div className="lock-message">{t.contactAdmin}</div>
            <button 
              className="whatsapp-support-btn"
              onClick={handleWhatsAppSupport}
              style={{
                background: '#25d366',
                color: 'white',
                border: 'none',
                padding: '15px 25px',
                borderRadius: '25px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '20px',
                transition: 'all 0.2s'
              }}
            >
              📞 {t.whatsappSupport}
            </button>
          </div>
        ) : (
          // Display all tasks in admin-set order (no grouping by category)
          <div className="task-group">
            {tasks.map((task, index) => renderTaskCard(task, index))}
          </div>
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
          autoStart={true}
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