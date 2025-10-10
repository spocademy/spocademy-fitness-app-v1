// src/components/camp/CampPlanPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  getCampPlan,
  saveCampTaskCompletion,
  checkAndUpdateCampCompletion,
  getTodayCampCompletion
} from '../../services/firebaseService';
import './CampPlanPage.css';
import EnhancedCamera from '../daily/EnhancedCamera';

const CampPlanPage = ({ campNumber, onBack }) => {
  const [currentLanguage, setCurrentLanguage] = useState('mr');
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [currentExercise, setCurrentExercise] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const { currentUser, userData, refreshUserData } = useAuth();

  // Load tasks and existing completion state
  useEffect(() => {
    const loadCampTasks = async () => {
      if (!campNumber) return;
      
      try {
        setLoadingTasks(true);
        
        const campPlan = await getCampPlan(campNumber);
        
        if (campPlan && campPlan.tasks) {
          setTasks(campPlan.tasks);
          
          // Load today's completion state
          if (currentUser) {
            const todayCompletion = await getTodayCampCompletion(currentUser.uid, campNumber);
            if (todayCompletion && todayCompletion.completedTasks) {
              const completedTaskIds = Object.keys(todayCompletion.completedTasks);
              setCompletedTasks(new Set(completedTaskIds));
            }
          }
        } else {
          setTasks([]);
        }
      } catch (error) {
        console.error('Error loading camp tasks:', error);
        setTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    loadCampTasks();
  }, [campNumber, currentUser]);

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

  // Check for camp completion
  useEffect(() => {
    const checkCompletion = async () => {
      if (completedTasks.size === tasks.length && completedTasks.size > 0 && currentUser) {
        try {
          const campCompleted = await checkAndUpdateCampCompletion(
            currentUser.uid, 
            campNumber, 
            tasks.length
          );
          
          if (campCompleted) {
            setTimeout(() => {
              setShowCelebration(true);
              playCelebrationSound();
            }, 1000);
          }
        } catch (error) {
          console.error('Error checking camp completion:', error);
        }
      }
    };
    
    checkCompletion();
  }, [completedTasks.size, tasks.length, currentUser, campNumber]);

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
      campTitle: `Camp ${campNumber}`,
      athletics: "ATHLETICS",
      strength: "STRENGTH", 
      nutrition: "NUTRITION",
      markComplete: "Mark Complete",
      startCamera: "Start Camera",
      completed: "✓ Completed",
      undo: "Undo",
      continue: "Continue",
      navigateBack: "Going back to homepage...",
      instructions: "Instructions for",
      allTasksCompleted: "All tasks completed!",
      greatWork: "Great Work!",
      campComplete: "Camp completed successfully!",
      noTasksFound: "No tasks found for this camp",
      contactAdmin: "Contact admin to add tasks",
      loadingTasks: "Loading camp tasks..."
    },
    mr: {
      userName: `नमस्कार, ${userData?.name || 'वापरकर्ता'}`,
      campTitle: `कॅम्प ${campNumber}`,
      athletics: "ग्राउंड",
      strength: "शक्ती",
      nutrition: "आहार",
      markComplete: "पूर्ण झाले",
      startCamera: "कॅमेरा सुरू करा",
      completed: "✓ पूर्ण झाले",
      undo: "रद्द करा",
      continue: "पुढे जा",
      navigateBack: "होमपेजवर परत जात आहे...",
      instructions: "सूचना",
      allTasksCompleted: "सर्व कामे पूर्ण झाली!",
      greatWork: "अभिनंदन!",
      campComplete: "कॅम्प यशस्वीरित्या पूर्ण झाला!",
      noTasksFound: "या कॅम्पसाठी कोणती कामे नाहीत",
      contactAdmin: "कामे जोडण्यासाठी प्रशासकाशी संपर्क साधा",
      loadingTasks: "कॅम्प कामे लोड करत आहे..."
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
    playSound('click');
    triggerHapticFeedback('light');
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
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
      
      await saveCampTaskCompletion(currentUser.uid, campNumber, taskId);
      
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
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const showProgress = () => {
    playSound('click');
    const completedCount = completedTasks.size;
    const totalTasks = tasks.length;
    const percentage = Math.round((completedCount / totalTasks) * 100);
    const progressMessage = currentLanguage === 'en' 
      ? `Progress: ${completedCount}/${totalTasks} tasks (${percentage}%)`
      : `प्रगती: ${completedCount}/${totalTasks} कामे (${percentage}%)`;
    alert(progressMessage);
  };

  const handleBack = () => {
    playSound('click');
    const t = translations[currentLanguage];
    alert(t.navigateBack);
    if (onBack) onBack();
  };

  const renderTaskCard = (task, index) => {
    const isCompleted = completedTasks.has(task.id);
    const t = translations[currentLanguage];
    
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
    <div className="camp-plan-container">
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
          <div className="camp-title">{t.campTitle}</div>
        </div>
        <div className="date-info">{getCurrentDate()}</div>
      </div>

      <div className="progress-tracker" onClick={showProgress}>
        <div className="progress-text">
          {completedTasks.size}/{tasks.length}
        </div>
      </div>

      <div className="task-list">
        {loadingTasks ? (
          <div className="day-locked-message">
            <div className="lock-icon">⏳</div>
            <div className="lock-title">{t.loadingTasks}</div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="day-locked-message">
            <div className="lock-icon">📋</div>
            <div className="lock-title">{t.noTasksFound}</div>
            <div className="lock-message">{t.contactAdmin}</div>
          </div>
        ) : (
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
            <div className="celebration-message">{t.campComplete}</div>
            <button className="celebration-btn" onClick={handleCelebrationClose}>
              {t.continue}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampPlanPage;