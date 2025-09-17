// src/components/dashboard/Homepage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getVillageRankings, canUserTrainToday } from '../../services/firebaseService';
import DailyPlanPage from '../daily/DailyPlanPage';
import './Homepage.css';

const Homepage = () => {
  const [language, setLanguage] = useState('mr');
  const [currentView, setCurrentView] = useState('homepage');
  const [selectedDay, setSelectedDay] = useState(null);
  const [villageRankings, setVillageRankings] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [canTrainToday, setCanTrainToday] = useState(true);
  const { currentUser, userData, logout } = useAuth();

  const text = {
    en: {
      day: 'Day',
      village: 'Village',
      dayStreak: 'Day Streak',
      totalPoints: 'Total Points',
      villageRankings: 'Village Rankings',
      points: 'pts',
      completed: 'Completed',
      current: 'Start Training',
      locked: 'Locked',
      profile: 'Profile',
      logout: 'Logout',
      preparingFor: 'Preparing for',
      alreadyTrainedToday: 'Already Trained Today',
      comeTomorrowToTrain: 'Come Tomorrow'
    },
    mr: {
      day: 'दिवस',
      village: 'गाव',
      dayStreak: 'दिवसांची स्ट्रीक',
      totalPoints: 'एकूण गुण',
      villageRankings: 'गावांची क्रमवारी',
      points: 'गुण',
      completed: 'पूर्ण',
      current: 'प्रशिक्षण सुरू करा',
      locked: 'बंद',
      profile: 'प्रोफाइल',
      logout: 'लॉगआउट',
      preparingFor: 'तयारी करत आहे',
      alreadyTrainedToday: 'आज आधीच प्रशिक्षण घेतले',
      comeTomorrowToTrain: 'उद्या येऊन प्रशिक्षण घ्या'
    }
  };

  const t = text[language];

  // Load village rankings on component mount
  useEffect(() => {
    const loadRankings = async () => {
      try {
        const rankings = await getVillageRankings();
        setVillageRankings(rankings);
      } catch (error) {
        console.error('Error loading village rankings:', error);
      } finally {
        setLoadingRankings(false);
      }
    };

    loadRankings();
  }, []);

  // Check if user can train today
  useEffect(() => {
    const checkTrainingAccess = async () => {
      if (!currentUser) return;
      
      try {
        const canTrain = await canUserTrainToday(currentUser.uid);
        setCanTrainToday(canTrain);
      } catch (error) {
        console.error('Error checking training access:', error);
      }
    };
    
    checkTrainingAccess();
  }, [currentUser, userData]);

  // Calculate user stats with proper limits
  const userStats = {
    name: userData?.name || 'User',
    currentDay: userData?.currentDay || 1,
    streak: Math.min(userData?.streakCount || 0, (userData?.currentDay || 1) - 1),
    totalPoints: Math.min(userData?.points || 0, (userData?.currentDay || 1) - 1),
    village: userData?.village || 'Unknown'
  };

  // Generate path days for display
  const generatePathDays = () => {
    const days = [];
    const currentDay = userStats.currentDay;
    
    // Show previous completed days (up to 5)
    for (let i = Math.max(1, currentDay - 5); i < currentDay; i++) {
      days.push({ day: i, status: 'completed' });
    }
    
    // Current day
    days.push({ 
      day: currentDay, 
      status: canTrainToday ? 'current' : 'completed-today'
    });
    
    // Future locked days (up to 5)
    for (let i = currentDay + 1; i <= currentDay + 5; i++) {
      days.push({ day: i, status: 'locked' });
    }
    
    return days;
  };

  const pathDays = generatePathDays();

  // Auto-scroll to current day
  useEffect(() => {
    if (currentView === 'homepage') {
      const scrollToCurrentDay = () => {
        const currentDayCard = document.querySelector('.day-card.current, .day-card.completed-today');
        if (currentDayCard) {
          currentDayCard.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        }
      };
      const timer = setTimeout(scrollToCurrentDay, 200);
      return () => clearTimeout(timer);
    }
  }, [currentView, userData, canTrainToday]);

  const handleDayClick = (day, status) => {
    if (status === 'current') {
      setSelectedDay(day);
      setCurrentView('dailyplan');
    }
  };

  const handleBackToHomepage = () => {
    setCurrentView('homepage');
    setSelectedDay(null);
    
    // Refresh training access status when returning
    const refreshAccess = async () => {
      if (currentUser) {
        try {
          const canTrain = await canUserTrainToday(currentUser.uid);
          setCanTrainToday(canTrain);
        } catch (error) {
          console.error('Error refreshing training access:', error);
        }
      }
    };
    
    refreshAccess();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (currentView === 'dailyplan') {
    return (
      <DailyPlanPage 
        day={selectedDay} 
        onBack={handleBackToHomepage}
      />
    );
  }

  return (
    <div className="homepage-container">
      <div className="homepage-header">
        <div className="header-info">
          <h1>{userStats.name}</h1>
          <div className="village-info">{userStats.village}</div>
        </div>
        <button 
          className="lang-toggle"
          onClick={() => setLanguage(language === 'en' ? 'mr' : 'en')}
          type="button"
        >
          {language === 'en' ? 'मराठी' : 'EN'}
        </button>
      </div>

      <div className="homepage-content">
        <div className="stats-row">
          <div className="stat-box streak">
            <div className="stat-icon">🔥</div>
            <div className="stat-content">
              <div className="stat-number">{userStats.streak}</div>
              <div className="stat-label">{t.dayStreak}</div>
            </div>
          </div>
          
          <div className="stat-box points">
            <div className="stat-content">
              <div className="stat-number">{userStats.totalPoints}</div>
              <div className="stat-label">{t.totalPoints}</div>
            </div>
          </div>
        </div>

        <div className="training-path">
          <div className="path-container">
            {pathDays.map((dayData) => (
              <div 
                key={dayData.day}
                className={`day-card ${dayData.status}`}
                onClick={() => handleDayClick(dayData.day, dayData.status)}
              >
                <div className="day-circle">
                  {`${t.day} ${dayData.day}`}
                </div>
                
                {dayData.status === 'current' && (
                  <div className="action-button">
                    {t.current}
                  </div>
                )}
                
                {dayData.status === 'completed-today' && (
                  <div className="status-text completed-today">
                    {t.alreadyTrainedToday}
                  </div>
                )}
                
                {dayData.status === 'completed' && (
                  <div className="status-text completed">
                    {t.completed}
                  </div>
                )}
                
                {dayData.status === 'locked' && (
                  <div className="status-text locked">
                    {t.locked}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="village-section">
          <h3>{t.villageRankings}</h3>
          <div className="rankings-compact">
            {loadingRankings ? (
              <div>Loading rankings...</div>
            ) : villageRankings.length > 0 ? (
              villageRankings.map((village) => (
                <div 
                  key={village.rank}
                  className={`ranking-row ${village.village === userStats.village ? 'user-village' : ''}`}
                >
                  <span className="rank">{village.rank}</span>
                  <span className="village-name">{village.village}</span>
                  <span className="village-points">{village.points} {t.points}</span>
                </div>
              ))
            ) : (
              <div>No village data yet</div>
            )}
          </div>
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          {t.logout}
        </button>
      </div>
    </div>
  );
};

export default Homepage;