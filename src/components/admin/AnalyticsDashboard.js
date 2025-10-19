// src/components/admin/AnalyticsDashboard.js
import React, { useState, useEffect } from 'react';
import { 
  getAllUsers, 
  getTodayCompletion 
} from '../../services/firebaseService';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { exportToCSV } from '../../utils/exportUtils';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('daily');
  const [inactiveDays, setInactiveDays] = useState(3);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: '',
    to: ''
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'lastActive', direction: 'asc' });
  
  const [analytics, setAnalytics] = useState({
    completionRate: 0,
    atRiskUsers: [],
    villageRankings: [],
    streakDistribution: {
      '0-7': 0,
      '8-14': 0,
      '15-21': 0,
      '21+': 0
    },
    activeThisWeek: 0,
    completionTrend: [],
    previousPeriodCompletion: 0,
    totalUsers: 0
  });

  useEffect(() => {
    if (!useCustomRange) {
      fetchAnalytics();
    }
  }, [timePeriod, inactiveDays, useCustomRange]);

  const getIndiaDate = () => {
    const INDIA_TIMEZONE_OFFSET = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const indiaTime = new Date(utc + INDIA_TIMEZONE_OFFSET);
    return indiaTime;
  };

  const getDaysInPeriod = () => {
    if (timePeriod === 'daily') return 1;
    if (timePeriod === 'yesterday') return 1;
    if (timePeriod === 'weekly') return 7;
    return 30;
  };

  const handleCustomDateLoad = () => {
    if (!dateRange.from || !dateRange.to) {
      alert('Please select both From and To dates');
      return;
    }
    
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    
    if (fromDate > toDate) {
      alert('From date must be before To date');
      return;
    }
    
    setUseCustomRange(true);
    fetchAnalytics(fromDate, toDate);
  };

  const fetchAnalytics = async (customFrom = null, customTo = null) => {
    try {
      setLoading(true);
      const allUsers = await getAllUsers();
        const users = allUsers.filter(user => user.status !== 'inactive');
      
      const today = getIndiaDate();
      const daysToAnalyze = getDaysInPeriod();
      
      let startDate, endDate;
      if (customFrom && customTo) {
        startDate = customFrom;
        endDate = customTo;
      } else if (timePeriod === 'yesterday') {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        startDate = yesterday;
        endDate = yesterday;
      } else {
        endDate = today;
        startDate = new Date(today.getTime() - (daysToAnalyze - 1) * 24 * 60 * 60 * 1000);
      }
      
      const actualDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      // 1. COMPLETION RATE (for selected period)
      let totalCompletions = 0;
      let totalPossibleCompletions = users.length * actualDays;
      
      const completionTrend = [];
      
      for (let i = 0; i < actualDays; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        let dayCompleted = 0;
        for (const user of users) {
          const completion = await getTodayCompletion(user.id, dateStr);
          if (completion && completion.allTasksCompleted) {
            dayCompleted++;
            totalCompletions++;
          }
        }
        
        completionTrend.push({
          date: dateStr,
          displayDate: `${date.getDate()}/${date.getMonth() + 1}`,
          rate: users.length > 0 ? Math.round((dayCompleted / users.length) * 100) : 0
        });
      }
      
      const completionRate = totalPossibleCompletions > 0 
        ? Math.round((totalCompletions / totalPossibleCompletions) * 100) 
        : 0;

      // Previous period comparison
      const prevStartDate = new Date(startDate.getTime() - actualDays * 24 * 60 * 60 * 1000);
      const prevEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      
      let prevTotalCompletions = 0;
      let prevTotalPossible = users.length * actualDays;
      
      for (let i = 0; i < actualDays; i++) {
        const date = new Date(prevStartDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        for (const user of users) {
          const completion = await getTodayCompletion(user.id, dateStr);
          if (completion && completion.allTasksCompleted) {
            prevTotalCompletions++;
          }
        }
      }
      
      const previousPeriodCompletion = prevTotalPossible > 0 
        ? Math.round((prevTotalCompletions / prevTotalPossible) * 100) 
        : 0;

      // 2. AT-RISK USERS (configurable days)
      const inactiveDaysAgo = new Date(today.getTime() - inactiveDays * 24 * 60 * 60 * 1000);
      const atRiskUsers = users.filter(user => {
        if (!user.lastActive) return true;
        const lastActive = user.lastActive.seconds 
          ? new Date(user.lastActive.seconds * 1000) 
          : new Date(user.lastActive);
        return lastActive < inactiveDaysAgo;
      }).map(user => ({
        id: user.id,
        name: user.name,
        village: user.village,
        currentDay: user.currentDay,
        lastActive: user.lastActive,
        phone: user.phone,
        daysInactive: user.lastActive 
          ? Math.floor((today - (user.lastActive.seconds ? new Date(user.lastActive.seconds * 1000) : new Date(user.lastActive))) / (1000 * 60 * 60 * 24))
          : 999
      }));

      // 3. VILLAGE RANKINGS (for selected period)
      const villageMap = {};
      const villageUserCount = {};
      
      // First, count unique users per village
      users.forEach(user => {
        if (user.village) {
          villageUserCount[user.village] = (villageUserCount[user.village] || 0) + 1;
        }
      });
      
      for (let i = 0; i < actualDays; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        for (const user of users) {
          if (!user.village) continue;
          
          if (!villageMap[user.village]) {
            villageMap[user.village] = { totalPossible: 0, completed: 0 };
          }
          villageMap[user.village].totalPossible++;
          
          const completion = await getTodayCompletion(user.id, dateStr);
          if (completion && completion.allTasksCompleted) {
            villageMap[user.village].completed++;
          }
        }
      }
      
      const villageRankings = Object.entries(villageMap)
        .map(([village, data]) => {
          const userCount = villageUserCount[village];
          const completionRate = Math.round((data.completed / data.totalPossible) * 100);
          return {
            village,
            completionRate,
            totalUsers: userCount,
            totalCompletions: data.completed,
            totalPossible: data.totalPossible,
            displayText: `${completionRate}% (${data.completed}/${data.totalPossible} total)`
          };
        })
        .sort((a, b) => b.completionRate - a.completionRate);

      // 4. STREAK DISTRIBUTION
      const streakDistribution = {
        '0-7': 0,
        '8-14': 0,
        '15-21': 0,
        '21+': 0
      };
      
      users.forEach(user => {
        const streak = user.streakCount || 0;
        if (streak <= 7) streakDistribution['0-7']++;
        else if (streak <= 14) streakDistribution['8-14']++;
        else if (streak <= 21) streakDistribution['15-21']++;
        else streakDistribution['21+']++;
      });

      // 5. ACTIVE THIS WEEK (used yesterday for comparison to avoid morning skew)
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(yesterday.getTime() - 6 * 24 * 60 * 60 * 1000);
      
      const activeThisWeek = users.filter(user => {
        if (!user.lastActive) return false;
        const lastActive = user.lastActive.seconds 
          ? new Date(user.lastActive.seconds * 1000) 
          : new Date(user.lastActive);
        return lastActive >= sevenDaysAgo && lastActive <= yesterday;
      }).length;

      setAnalytics({
        completionRate,
        atRiskUsers,
        villageRankings,
        streakDistribution,
        activeThisWeek,
        completionTrend,
        previousPeriodCompletion,
        totalUsers: users.length
      });
      
      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching analytics:', error);
      alert('Error loading analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAtRiskUsers = () => {
    if (!sortConfig.key) return analytics.atRiskUsers;

    return [...analytics.atRiskUsers].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'name' || sortConfig.key === 'village') {
        aValue = (aValue || '').toLowerCase();
        bValue = (bValue || '').toLowerCase();
      } else if (sortConfig.key === 'currentDay' || sortConfig.key === 'daysInactive') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      } else if (sortConfig.key === 'lastActive') {
        aValue = a.daysInactive;
        bValue = b.daysInactive;
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const getStatusColor = (rate, metric) => {
    if (metric === 'completion') {
      if (rate >= 60) return '#28a745';
      if (rate >= 40) return '#fd7e14';
      return '#dc3545';
    }
    return '#007fff';
  };

  const getComparisonIndicator = () => {
    const diff = analytics.completionRate - analytics.previousPeriodCompletion;
    if (diff === 0) return null;
    
    const arrow = diff > 0 ? '↑' : '↓';
    const color = diff > 0 ? '#28a745' : '#dc3545';
    
    return (
      <span style={{ color, fontSize: '14px', marginLeft: '8px' }}>
        {arrow}{Math.abs(diff)}%
      </span>
    );
  };

  const formatLastActive = (lastActive) => {
    if (!lastActive) return 'Never';
    const date = lastActive.seconds 
      ? new Date(lastActive.seconds * 1000) 
      : new Date(lastActive);
    const now = getIndiaDate();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const handleExportAtRisk = () => {
    const data = analytics.atRiskUsers.map(user => ({
      Name: user.name,
      Phone: user.phone,
      Village: user.village,
      'Current Day': user.currentDay,
      'Days Inactive': user.daysInactive,
      'Last Active': formatLastActive(user.lastActive)
    }));
    
    exportToCSV(data, `at-risk-users-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportVillages = () => {
    const data = analytics.villageRankings.map((village, index) => ({
      Rank: index + 1,
      Village: village.village,
      'Completion Rate': `${village.completionRate}%`,
      'Total Completions': village.totalCompletions,
      'Total Possible': village.totalPossible,
      'Number of Users': village.totalUsers
    }));
    
    exportToCSV(data, `village-rankings-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportAllAnalytics = () => {
    const data = [{
      'Completion Rate': `${analytics.completionRate}%`,
      'Previous Period': `${analytics.previousPeriodCompletion}%`,
      'At-Risk Users': analytics.atRiskUsers.length,
      'Active This Week': `${analytics.activeThisWeek}/${analytics.totalUsers}`,
      'Total Users': analytics.totalUsers,
      'Period': timePeriod,
      'Generated On': new Date().toLocaleString()
    }];
    
    exportToCSV(data, `analytics-summary-${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Analytics Dashboard</h2>
          {lastUpdated && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              Last updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div className="analytics-controls">
          <div className="period-selector">
            <button 
              className={timePeriod === 'daily' && !useCustomRange ? 'active' : ''}
              onClick={() => { setTimePeriod('daily'); setUseCustomRange(false); }}
            >
              Today
            </button>
            <button 
              className={timePeriod === 'yesterday' && !useCustomRange ? 'active' : ''}
              onClick={() => { setTimePeriod('yesterday'); setUseCustomRange(false); }}
            >
              Yesterday
            </button>
            <button 
              className={timePeriod === 'weekly' && !useCustomRange ? 'active' : ''}
              onClick={() => { setTimePeriod('weekly'); setUseCustomRange(false); }}
            >
              Last 7 Days
            </button>
            <button 
              className={timePeriod === 'monthly' && !useCustomRange ? 'active' : ''}
              onClick={() => { setTimePeriod('monthly'); setUseCustomRange(false); }}
            >
              Last 30 Days
            </button>
          </div>
          
          <div className="custom-range-selector">
            <input 
              type="date" 
              value={dateRange.from}
              onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
              max={new Date().toISOString().split('T')[0]}
            />
            <span>to</span>
            <input 
              type="date" 
              value={dateRange.to}
              onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
              max={new Date().toISOString().split('T')[0]}
            />
            <button className="btn-load-custom" onClick={handleCustomDateLoad}>
              Load Historical
            </button>
          </div>

          <div className="inactive-days-selector">
            <label>Inactive for</label>
            <input 
              type="number" 
              min="1" 
              max="30"
              value={inactiveDays}
              onChange={(e) => setInactiveDays(parseInt(e.target.value) || 3)}
              style={{ width: '60px' }}
            />
            <label>days</label>
          </div>
        </div>
      </div>

      {/* KEY METRICS */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Completion Rate</div>
          <div 
            className="metric-value" 
            style={{ color: getStatusColor(analytics.completionRate, 'completion') }}
          >
            {analytics.completionRate}%
            {getComparisonIndicator()}
          </div>
          <div className="metric-subtitle">
            Target: 60%+ | {analytics.completionRate >= 60 ? '✓ Good' : '⚠ Needs attention'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">At-Risk Users</div>
          <div 
            className="metric-value"
            style={{ color: analytics.atRiskUsers.length / analytics.totalUsers > 0.2 ? '#dc3545' : '#28a745' }}
          >
            {analytics.atRiskUsers.length}
          </div>
          <div className="metric-subtitle">
            {Math.round((analytics.atRiskUsers.length / analytics.totalUsers) * 100)}% of total | Target: &lt;20%
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Active This Week</div>
          <div 
            className="metric-value"
            style={{ color: '#007fff' }}
          >
            {analytics.activeThisWeek}/{analytics.totalUsers}
          </div>
          <div className="metric-subtitle">
            {Math.round((analytics.activeThisWeek / analytics.totalUsers) * 100)}% active (based on yesterday)
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Users</div>
          <div className="metric-value" style={{ color: '#007fff' }}>
            {analytics.totalUsers}
          </div>
          <div className="metric-subtitle">
            Paying users
          </div>
        </div>
      </div>

      {/* EXPORT BUTTONS */}
      <div className="export-section">
        <button className="btn-export" onClick={handleExportAllAnalytics}>
          📊 Export Analytics Summary
        </button>
      </div>

      {/* COMPLETION TREND CHART */}
      <div className="chart-section">
        <h3>Completion Rate Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.completionTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayDate" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="rate" 
              stroke="#007fff" 
              strokeWidth={2}
              name="Completion Rate (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* VILLAGE RANKINGS */}
      <div className="chart-section">
        <div className="section-header">
          <h3>Village Performance Rankings</h3>
          <button className="btn-export-small" onClick={handleExportVillages}>
            📥 Export
          </button>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(300, analytics.villageRankings.length * 50)}>
          <BarChart 
            data={analytics.villageRankings} 
            layout="vertical"
            margin={{ left: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="village" type="category" />
            <Tooltip />
            <Legend />
            <Bar 
              dataKey="completionRate" 
              fill="#28a745" 
              name="Completion Rate (%)"
            />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="village-details">
          {analytics.villageRankings.map((village, index) => (
            <div key={village.village} className="village-row">
              <span className="village-rank">#{index + 1}</span>
              <span className="village-name">{village.village}</span>
              <span className="village-stats">
                {village.displayText}
              </span>
              <span 
                className="village-rate"
                style={{ color: getStatusColor(village.completionRate, 'completion') }}
              >
                {village.completionRate}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* STREAK DISTRIBUTION */}
      <div className="chart-section">
        <h3>Streak Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={[
            { range: '0-7 days', users: analytics.streakDistribution['0-7'] },
            { range: '8-14 days', users: analytics.streakDistribution['8-14'] },
            { range: '15-21 days', users: analytics.streakDistribution['15-21'] },
            { range: '21+ days', users: analytics.streakDistribution['21+'] }
          ]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="users" fill="#6f42c1" name="Number of Users" />
          </BarChart>
        </ResponsiveContainer>
        <div className="metric-subtitle" style={{ textAlign: 'center', marginTop: '10px' }}>
          Target: 30%+ users with 7+ day streaks | 
          Current: {Math.round(((analytics.streakDistribution['8-14'] + analytics.streakDistribution['15-21'] + analytics.streakDistribution['21+']) / analytics.totalUsers) * 100)}%
        </div>
      </div>

      {/* AT-RISK USERS TABLE */}
      {analytics.atRiskUsers.length > 0 && (
        <div className="data-section">
          <div className="section-header">
            <h3>At-Risk Users (Inactive {inactiveDays}+ Days) - Action Required</h3>
            <button className="btn-export-small" onClick={handleExportAtRisk}>
              📥 Export
            </button>
          </div>
          <div className="at-risk-table">
            <div className="table-header">
              <div onClick={() => handleSort('name')} style={{cursor: 'pointer'}}>
                User {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
              </div>
              <div onClick={() => handleSort('village')} style={{cursor: 'pointer'}}>
                Village {sortConfig.key === 'village' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
              </div>
              <div onClick={() => handleSort('currentDay')} style={{cursor: 'pointer'}}>
                Current Day {sortConfig.key === 'currentDay' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
              </div>
              <div onClick={() => handleSort('lastActive')} style={{cursor: 'pointer'}}>
                Last Active {sortConfig.key === 'lastActive' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
              </div>
              <div>Phone</div>
            </div>
            {getSortedAtRiskUsers().map(user => (
              <div key={user.id} className="table-row at-risk">
                <div className="user-info">
                  <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                  <div className="user-name">{user.name}</div>
                </div>
                <div>{user.village}</div>
                <div>Day {user.currentDay}</div>
                <div className="last-active-warning">{formatLastActive(user.lastActive)}</div>
                <div>{user.phone}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;