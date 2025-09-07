// src/components/dashboard/Homepage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getVillageRankings } from '../../services/firebaseService';
import DailyPlanPage from '../daily/DailyPlanPage';
import './Homepage.css';

const Homepage = () => {
  const [language, setLanguage] = useState('mr');
  const [currentView, setCurrentView] = useState('homepage');
  const [selectedDay, setSelectedDay] = useState(null);
  const [villageRankings, setVillageRankings] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(true);
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
      preparingFor: 'Preparing for'
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
      preparingFor: 'तयारी करत आहे'
    }
  };

  const t = text[language];

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

  const userStats = {
    name: userData?.name || 'User',
    currentDay: userData?.currentDay || 1,
    streak: userData?.streakCount || 0,
    totalPoints: userData?.points || 0,
    village: userData?.village || 'Unknown',
    district: language === 'mr' ? 'पुणे' : 'Pune'
  };

  const generatePathDays = () => {
    const days = [];
    for (let i = Math.max(1, userStats.currentDay - 5); i < userStats.currentDay; i++) {
      days.push({ day: i, status: 'completed' });
    }
    days.push({ day: userStats.currentDay, status: 'current' });
    for (let i = userStats.currentDay + 1; i <= userStats.currentDay + 5; i++) {
      days.push({ day: i, status: 'locked' });
    }
    return days;
  };

  const pathDays = generatePathDays();

  useEffect(() => {
    if (currentView === 'homepage') {
      const scrollToCurrentDay = () => {
        const currentDayCard = document.querySelector('.day-card.current');
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
  }, [currentView, userData]);

  const handleDayClick = (day, status) => {
    if (status === 'current') {
      setSelectedDay(day);
      setCurrentView('dailyplan');
    }
  };

  const handleBackToHomepage = () => {
    setCurrentView('homepage');
    setSelectedDay(null);
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
          <div className="village-info">{userStats.village} {t.village}, {userStats.district}</div>
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