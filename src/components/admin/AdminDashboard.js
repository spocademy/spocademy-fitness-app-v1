// src/components/admin/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase/config';
import { 
  getAllUsers, 
  getUserStats, 
  createUser,
  createTask,
  createDailyPlan,
  createWeeklySchedule,
  getAllTasks,
  getAllPlans,
  getWeeklySchedule
} from '../../services/firebaseService';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [weeklySchedule, setWeeklySchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    completionRate: 0,
    villages: 0
  });
  const { logout, currentUser } = useAuth();

  // New user form state
  const [newUser, setNewUser] = useState({
    phone: '',
    name: '',
    village: '',
    level: 'beginnerBoys',
    dateOfBirth: '',
    password: ''
  });

  // New task form state
  const [newTask, setNewTask] = useState({
    nameEn: '',
    nameMr: '',
    type: 'strength',
    exerciseType: ''
  });

  // Daily plan form state
  const [newPlan, setNewPlan] = useState({
    day: 'monday',
    level: 'beginnerBoys',
    week: 1,
    taskPlans: {},
    excludedTasks: []
  });

  // Weekly schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });

  // Manual notification state
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    villages: [],
    levels: [],
    activityStatus: ['all'],
    scheduleType: 'now',
    scheduledDateTime: ''
  });

  const [notificationResult, setNotificationResult] = useState(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Exercise options
  const exerciseOptions = {
    squats: { en: 'Squats', mr: 'स्क्वॅट्स' },
    jumpingJacks: { en: 'Jumping Jacks', mr: 'जंपिंग जॅक्स' },
    pushups: { en: 'Push-ups', mr: 'पुश-अप्स' },
    calfRaises: { en: 'Calf Raises', mr: 'काल्फ रेसेस' },
    situps: { en: 'Sit-ups', mr: 'सिट-अप्स' }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [usersData, statsData, tasksData, plansData, scheduleData] = await Promise.all([
        getAllUsers(),
        getUserStats(),
        getAllTasks(),
        getAllPlans(),
        getWeeklySchedule()
      ]);
      
      setUsers(usersData);
      setStats(statsData);
      setTasks(tasksData);
      setPlans(plansData);
      setWeeklySchedule(scheduleData);
      
      // Initialize schedule form with existing data
      if (scheduleData) {
        setScheduleForm({
          monday: scheduleData.monday || [],
          tuesday: scheduleData.tuesday || [],
          wednesday: scheduleData.wednesday || [],
          thursday: scheduleData.thursday || [],
          friday: scheduleData.friday || [],
          saturday: scheduleData.saturday || [],
          sunday: scheduleData.sunday || []
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique villages and levels for notification targeting
  const getUniqueVillages = () => {
    const villages = [...new Set(users.map(user => user.village).filter(Boolean))];
    return villages.sort();
  };

  const getUniqueLevels = () => {
    return ['beginnerBoys', 'beginnerGirls', 'advancedBoys', 'advancedGirls', 'specialBatch'];
  };

  // Handle notification form changes
  const handleNotificationFormChange = (field, value) => {
    setNotificationForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear preview when form changes
    setPreviewData(null);
    setNotificationResult(null);
  };

  // Handle multi-select for villages and levels
  const handleMultiSelect = (field, value, checked) => {
    setNotificationForm(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }));
    setPreviewData(null);
  };

  // Validate notification form
  const validateNotificationForm = () => {
    const errors = [];
    if (!notificationForm.title || notificationForm.title.trim().length < 3) {
      errors.push('Title must be at least 3 characters');
    }
    if (!notificationForm.message || notificationForm.message.trim().length < 10) {
      errors.push('Message must be at least 10 characters');
    }
    if (notificationForm.title.length > 50) {
      errors.push('Title too long (max 50 characters)');
    }
    if (notificationForm.message.length > 200) {
      errors.push('Message too long (max 200 characters)');
    }
    if (notificationForm.scheduleType === 'scheduled' && !notificationForm.scheduledDateTime) {
      errors.push('Please select date and time for scheduled notification');
    }
    return errors;
  };

  // Preview notification targeting
  const handlePreviewNotification = () => {
    const errors = validateNotificationForm();
    if (errors.length > 0) {
      alert('Please fix these errors:\n' + errors.join('\n'));
      return;
    }

    // Calculate targeted users
    let targetedUsers = users.filter(user => user.role !== 'admin');
    let targetedCount = 0;

    const { villages, levels, activityStatus } = notificationForm;
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    targetedUsers.forEach(user => {
      let shouldInclude = false;
      
      // Village filtering
      if (villages.length > 0) {
        shouldInclude = villages.some(village => 
          user.village && user.village.toLowerCase().includes(village.toLowerCase())
        );
      }
      
      // Level filtering
      if (levels.length > 0) {
        if (shouldInclude || villages.length === 0) {
          shouldInclude = levels.includes(user.level);
        }
      }
      
      // Activity status filtering
      if (activityStatus.includes('all') || (villages.length === 0 && levels.length === 0)) {
        shouldInclude = true;
      } else if (activityStatus.includes('inactive_2_days') || activityStatus.includes('inactive_7_days')) {
        const lastActive = user.lastActive ? new Date(user.lastActive.seconds * 1000) : null;
        
        if (activityStatus.includes('inactive_7_days') && (!lastActive || lastActive < sevenDaysAgo)) {
          shouldInclude = true;
        } else if (activityStatus.includes('inactive_2_days') && (!lastActive || lastActive < twoDaysAgo)) {
          shouldInclude = true;
        }
      }
      
      if (shouldInclude) targetedCount++;
    });

    setPreviewData({
      targetedCount,
      totalUsers: users.length - 1, // Exclude admin
      villages: villages.length > 0 ? villages : ['All'],
      levels: levels.length > 0 ? levels : ['All'],
      activityStatus
    });
  };

  // Send manual notification
  const handleSendNotification = async () => {
    const errors = validateNotificationForm();
    if (errors.length > 0) {
      alert('Please fix these errors:\n' + errors.join('\n'));
      return;
    }

    if (!previewData) {
      alert('Please preview the notification first');
      return;
    }

    setSendingNotification(true);
    setNotificationResult(null);

    try {
      const response = await fetch('/api/notifications/send-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...notificationForm,
          adminUserId: currentUser.uid
        })
      });

      const result = await response.json();

      if (response.ok) {
        setNotificationResult({
          success: true,
          ...result
        });
        
        // Clear form on successful send
        if (notificationForm.scheduleType === 'now') {
          setNotificationForm({
            title: '',
            message: '',
            villages: [],
            levels: [],
            activityStatus: ['all'],
            scheduleType: 'now',
            scheduledDateTime: ''
          });
          setPreviewData(null);
        }
      } else {
        setNotificationResult({
          success: false,
          error: result.error || 'Failed to send notification'
        });
      }
    } catch (error) {
      console.error('Send notification error:', error);
      setNotificationResult({
        success: false,
        error: 'Network error. Please try again.'
      });
    } finally {
      setSendingNotification(false);
    }
  };

  // Clear notification result
  const clearNotificationResult = () => {
    setNotificationResult(null);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.phone || !newUser.name || !newUser.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const cleanPhone = newUser.phone.replace(/[\s+\-()]/g, '').slice(-10);
      const emailFormat = `${cleanPhone}@spocademy.com`;
      
      const userCredential = await createUserWithEmailAndPassword(auth, emailFormat, newUser.password);
      
      await createUser(userCredential.user.uid, {
        phone: `+91${cleanPhone}`,
        name: newUser.name,
        village: newUser.village,
        level: newUser.level,
        dateOfBirth: newUser.dateOfBirth,
        role: 'user',
        currentDay: 1,
        points: 0,
        streakCount: 0,
        language: 'mr'
      });

      alert('User created successfully!');
      setNewUser({
        phone: '',
        name: '',
        village: '',
        level: 'beginnerBoys',
        dateOfBirth: '',
        password: ''
      });
      
      fetchAllData();
      
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!newTask.nameEn || !newTask.nameMr) {
      alert('Please enter task names in both English and Marathi');
      return;
    }

    if (newTask.type === 'strength' && !newTask.exerciseType) {
      alert('Please select an exercise type for strength tasks');
      return;
    }

    try {
      setLoading(true);
      
      let taskData = {
        name: {
          en: newTask.nameEn,
          mr: newTask.nameMr
        },
        type: newTask.type
      };

      // Add exercise type for strength tasks only
      if (newTask.type === 'strength') {
        taskData.exerciseType = newTask.exerciseType;
      }
      
      await createTask(taskData);

      alert('Task created successfully!');
      setNewTask({
        nameEn: '',
        nameMr: '',
        type: 'strength',
        exerciseType: ''
      });
      
      fetchAllData();
      
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error creating task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // CONSOLIDATED PLAN CREATION FUNCTION
  const handleCreateConsolidatedPlan = async () => {
    try {
      setLoading(true);
      
      if (!weeklySchedule || !weeklySchedule[newPlan.day]) {
        alert('No tasks assigned to this day yet. Please set up the weekly schedule first.');
        return;
      }
      
      const tasksForDay = weeklySchedule[newPlan.day];
      const excludedTasks = newPlan.excludedTasks || [];
      
      // Filter out excluded tasks
      const includedTasks = tasksForDay.filter(taskId => !excludedTasks.includes(taskId));
      
      if (includedTasks.length === 0) {
        alert('No tasks selected for this plan. Please include at least one task.');
        return;
      }
      
      // Prepare consolidated tasks data
      const consolidatedTasks = [];
      
      for (const taskId of includedTasks) {
        const task = tasks.find(t => t.id === taskId);
        const taskPlan = newPlan.taskPlans?.[taskId];
        
        let taskData = {
          taskId: taskId
        };
        
        // Only add reps/sets/restTime for non-nutrition tasks
        if (task && task.type !== 'nutrition') {
          taskData.reps = taskPlan?.reps || 5;
          taskData.sets = taskPlan?.sets || 2;
          taskData.restTime = taskPlan?.restTime || 30;
        }
        
        consolidatedTasks.push(taskData);
      }
      
      // Create one consolidated plan
      const planId = await createDailyPlan(newPlan.day, newPlan.week, newPlan.level, consolidatedTasks);
      
      alert(`Consolidated plan created: ${planId} for ${newPlan.day} Week ${newPlan.week} ${newPlan.level}!\nIncluded ${consolidatedTasks.length} tasks.`);
      
      // Reset task plans and exclusions for next entry
      setNewPlan({
        ...newPlan,
        taskPlans: {},
        excludedTasks: []
      });
      
      fetchAllData();
      
    } catch (error) {
      console.error('Error creating consolidated plan:', error);
      alert('Error creating plan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      await createWeeklySchedule(scheduleForm);
      
      alert('Weekly schedule updated successfully!');
      fetchAllData();
      
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Error updating schedule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleTaskToggle = (day, taskId) => {
    const currentTasks = scheduleForm[day] || [];
    const isSelected = currentTasks.includes(taskId);
    
    if (isSelected) {
      setScheduleForm({
        ...scheduleForm,
        [day]: currentTasks.filter(id => id !== taskId)
      });
    } else {
      setScheduleForm({
        ...scheduleForm,
        [day]: [...currentTasks, taskId]
      });
    }
  };

  const toggleTaskExclusion = (taskId) => {
    const currentExcluded = newPlan.excludedTasks || [];
    const isExcluded = currentExcluded.includes(taskId);
    
    if (isExcluded) {
      setNewPlan({
        ...newPlan,
        excludedTasks: currentExcluded.filter(id => id !== taskId)
      });
    } else {
      setNewPlan({
        ...newPlan,
        excludedTasks: [...currentExcluded, taskId]
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <div className="admin-info">Spocademy - Consolidated Plans System</div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="admin-nav">
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button 
            className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button 
            className={`nav-tab ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            Plans
          </button>
          <button 
            className={`nav-tab ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule
          </button>
          <button 
            className={`nav-tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-tab">
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-number">{stats.totalUsers}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.activeUsers}</div>
                <div className="stat-label">Active Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.completionRate}%</div>
                <div className="stat-label">Completion Rate</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.villages}</div>
                <div className="stat-label">Villages</div>
              </div>
            </div>

            <div className="data-table">
              <div className="table-header">
                <div className="table-title">Recent Users</div>
              </div>
              {users.slice(0, 5).map(user => (
                <div key={user.id} className="table-row">
                  <div className="user-info">
                    <div className="user-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="user-name">{user.name}</div>
                      <div className="user-phone">{user.phone}</div>
                    </div>
                  </div>
                  <div>{user.village}</div>
                  <div>Day {user.currentDay || 1}</div>
                  <div>{user.streakCount || 0} days</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="notifications-tab">
            <div className="form-section">
              <h3>Send Manual Notification</h3>
              
              {/* Title and Message */}
              <div className="form-row">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    placeholder="Training Update"
                    value={notificationForm.title}
                    onChange={(e) => handleNotificationFormChange('title', e.target.value)}
                    maxLength="50"
                  />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    placeholder="New workout plans are now available for all levels"
                    value={notificationForm.message}
                    onChange={(e) => handleNotificationFormChange('message', e.target.value)}
                    maxLength="200"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Village Targeting */}
              <div className="form-group">
                <label>Target Villages (leave empty for all)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                  {getUniqueVillages().map(village => (
                    <label key={village} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={notificationForm.villages.includes(village)}
                        onChange={(e) => handleMultiSelect('villages', village, e.target.checked)}
                        style={{ marginRight: '6px' }}
                      />
                      <span>{village}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Level Targeting */}
              <div className="form-group">
                <label>Target Levels (leave empty for all)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                  {getUniqueLevels().map(level => (
                    <label key={level} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={notificationForm.levels.includes(level)}
                        onChange={(e) => handleMultiSelect('levels', level, e.target.checked)}
                        style={{ marginRight: '6px' }}
                      />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Activity Targeting */}
              <div className="form-group">
                <label>Activity Status</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                  {[
                    { key: 'all', label: 'All Users' },
                    { key: 'inactive_2_days', label: 'Inactive 2+ Days' },
                    { key: 'inactive_7_days', label: 'Inactive 7+ Days' }
                  ].map(status => (
                    <label key={status.key} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={notificationForm.activityStatus.includes(status.key)}
                        onChange={(e) => handleMultiSelect('activityStatus', status.key, e.target.checked)}
                        style={{ marginRight: '6px' }}
                      />
                      <span>{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scheduling */}
              <div className="form-row">
                <div className="form-group">
                  <label>Send Time</label>
                  <select
                    value={notificationForm.scheduleType}
                    onChange={(e) => handleNotificationFormChange('scheduleType', e.target.value)}
                  >
                    <option value="now">Send Now</option>
                    <option value="scheduled">Schedule for Later</option>
                  </select>
                </div>
                {notificationForm.scheduleType === 'scheduled' && (
                  <div className="form-group">
                    <label>Date & Time</label>
                    <input
                      type="datetime-local"
                      value={notificationForm.scheduledDateTime}
                      onChange={(e) => handleNotificationFormChange('scheduledDateTime', e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button 
                  onClick={handlePreviewNotification} 
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Preview Targeting
                </button>
                <button 
                  onClick={handleSendNotification} 
                  className="btn btn-primary"
                  disabled={sendingNotification || !previewData}
                >
                  {sendingNotification ? 'Sending...' : 
                   notificationForm.scheduleType === 'scheduled' ? 'Schedule Notification' : 'Send Now'}
                </button>
                {notificationResult && (
                  <button 
                    onClick={clearNotificationResult} 
                    className="btn btn-secondary"
                  >
                    Clear Results
                  </button>
                )}
              </div>
            </div>

            {/* Preview Results */}
            {previewData && (
              <div className="form-section" style={{ background: '#f0f8ff' }}>
                <h3>Notification Preview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <strong>Targeted Users:</strong> {previewData.targetedCount} / {previewData.totalUsers}
                  </div>
                  <div>
                    <strong>Villages:</strong> {previewData.villages.join(', ')}
                  </div>
                  <div>
                    <strong>Levels:</strong> {previewData.levels.join(', ')}
                  </div>
                  <div>
                    <strong>Activity:</strong> {previewData.activityStatus.join(', ')}
                  </div>
                </div>
                <div style={{ marginTop: '12px', padding: '12px', background: 'white', borderRadius: '8px' }}>
                  <strong>Preview:</strong><br />
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                    {notificationForm.title}
                  </div>
                  <div style={{ color: '#666' }}>
                    {notificationForm.message}
                  </div>
                </div>
              </div>
            )}

            {/* Send Results */}
            {notificationResult && (
              <div className="form-section" style={{ 
                background: notificationResult.success ? '#f0fff4' : '#fef2f2' 
              }}>
                <h3>{notificationResult.success ? 'Notification Sent Successfully!' : 'Send Failed'}</h3>
                
                {notificationResult.success ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <strong>Total Sent:</strong> {notificationResult.sent || 0}
                      </div>
                      <div>
                        <strong>Failed:</strong> {notificationResult.failed || 0}
                      </div>
                      <div>
                        <strong>Success Rate:</strong> {
                          notificationResult.total > 0 
                            ? Math.round((notificationResult.sent / notificationResult.total) * 100) 
                            : 0
                        }%
                      </div>
                      {notificationResult.scheduled && (
                        <div>
                          <strong>Status:</strong> Scheduled
                        </div>
                      )}
                    </div>
                    
                    {notificationResult.deliveryResults && notificationResult.deliveryResults.length > 0 && (
                      <div>
                        <h4>Delivery Details:</h4>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                          {notificationResult.deliveryResults.map((result, index) => (
                            <div key={index} style={{ 
                              padding: '8px 12px', 
                              borderBottom: '1px solid #eee',
                              display: 'flex',
                              justifyContent: 'space-between',
                              backgroundColor: result.status === 'sent' ? '#f9f9f9' : '#fff5f5'
                            }}>
                              <span>{result.name}</span>
                              <span style={{ 
                                color: result.status === 'sent' ? '#10b981' : '#ef4444',
                                fontWeight: '600'
                              }}>
                                {result.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#ef4444' }}>
                    <strong>Error:</strong> {notificationResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <div className="form-section">
              <h3>Add New User</h3>
              <form onSubmit={handleCreateUser}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="9876543210"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({
                        ...newUser, 
                        phone: e.target.value.replace(/\D/g, '').slice(0, 10)
                      })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="Rahul Patil"
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Village</label>
                    <input
                      type="text"
                      placeholder="Khed, Pune"
                      value={newUser.village}
                      onChange={(e) => setNewUser({...newUser, village: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>User Level</label>
                    <select
                      value={newUser.level}
                      onChange={(e) => setNewUser({...newUser, level: e.target.value})}
                    >
                      <option value="beginnerBoys">Beginner Boys</option>
                      <option value="beginnerGirls">Beginner Girls</option>
                      <option value="advancedBoys">Advanced Boys</option>
                      <option value="advancedGirls">Advanced Girls</option>
                      <option value="specialBatch">Special Batch</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={newUser.dateOfBirth}
                      onChange={(e) => setNewUser({...newUser, dateOfBirth: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>

            <div className="data-table">
              <div className="table-header">
                <div className="table-title">All Users ({users.length})</div>
              </div>
              <div className="table-row header">
                <div>User</div>
                <div>Level</div>
                <div>Day</div>
                <div>Streak</div>
                <div>Village</div>
                <div>Points</div>
              </div>
              {users.map(user => (
                <div key={user.id} className="table-row">
                  <div className="user-info">
                    <div className="user-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="user-name">{user.name}</div>
                      <div className="user-phone">{user.phone}</div>
                    </div>
                  </div>
                  <div>{user.level}</div>
                  <div>Day {user.currentDay || 1}</div>
                  <div>{user.streakCount || 0} days</div>
                  <div>{user.village}</div>
                  <div>{user.points || 0} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tasks-tab">
            <div className="form-section">
              <h3>Create New Task</h3>
              <form onSubmit={handleCreateTask}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Task Name (English)</label>
                    <input
                      type="text"
                      placeholder="e.g., Squats"
                      value={newTask.nameEn}
                      onChange={(e) => setNewTask({...newTask, nameEn: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Task Name (Marathi)</label>
                    <input
                      type="text"
                      placeholder="e.g., स्क्वॅट्स"
                      value={newTask.nameMr}
                      onChange={(e) => setNewTask({...newTask, nameMr: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Task Type</label>
                    <select
                      value={newTask.type}
                      onChange={(e) => setNewTask({...newTask, type: e.target.value, exerciseType: ''})}
                    >
                      <option value="strength">Strength</option>
                      <option value="athletics">Athletics</option>
                      <option value="nutrition">Nutrition</option>
                    </select>
                  </div>
                  
                  {newTask.type === 'strength' && (
                    <div className="form-group">
                      <label>Exercise Type</label>
                      <select
                        value={newTask.exerciseType}
                        onChange={(e) => setNewTask({...newTask, exerciseType: e.target.value})}
                        required
                      >
                        <option value="">Choose Exercise</option>
                        {Object.entries(exerciseOptions).map(([key, value]) => (
                          <option key={key} value={key}>{value.en}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </form>
            </div>

            <div className="data-table">
              <div className="table-header">
                <div className="table-title">All Tasks ({tasks.length})</div>
              </div>
              {tasks.map(task => (
                <div key={task.id} className="table-row">
                  <div>
                    <strong>{task.name?.en || 'Unnamed Task'}</strong>
                    <br />
                    <small>{task.name?.mr}</small>
                  </div>
                  <div>{task.type}</div>
                  <div>{task.exerciseType || '-'}</div>
                  <div>ID: {task.id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="plans-tab">
            <div className="form-section">
              <h3>Create Consolidated Daily Plan</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Day</label>
                  <select
                    value={newPlan.day}
                    onChange={(e) => setNewPlan({...newPlan, day: e.target.value})}
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Week Number</label>
                  <select
                    value={newPlan.week}
                    onChange={(e) => setNewPlan({...newPlan, week: e.target.value})}
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(week => (
                      <option key={week} value={week}>Week {week}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Level</label>
                  <select
                    value={newPlan.level}
                    onChange={(e) => setNewPlan({...newPlan, level: e.target.value})}
                  >
                    <option value="beginnerBoys">Beginner Boys</option>
                    <option value="beginnerGirls">Beginner Girls</option>
                    <option value="advancedBoys">Advanced Boys</option>
                    <option value="advancedGirls">Advanced Girls</option>
                    <option value="specialBatch">Special Batch</option>
                  </select>
                </div>
              </div>
              
              {weeklySchedule && weeklySchedule[newPlan.day] && (
                <div style={{marginTop: '20px'}}>
                  <h4>Tasks for {newPlan.day.charAt(0).toUpperCase() + newPlan.day.slice(1)}:</h4>
                  <p style={{color: '#666', marginBottom: '15px'}}>
                    This will create ONE consolidated plan (ID: {newPlan.day.slice(0,3)}W{newPlan.week}{newPlan.level.slice(0,2).toUpperCase()}) containing selected tasks below:
                  </p>
                  {weeklySchedule[newPlan.day].map(taskId => {
                    const task = tasks.find(t => t.id === taskId);
                    if (!task) return null;
                    
                    // Check if task is excluded for this plan
                    const isExcluded = newPlan.excludedTasks && newPlan.excludedTasks.includes(taskId);
                    
                    return (
                      <div key={taskId} style={{
                        border: isExcluded ? '1px solid #ef4444' : '1px solid #ddd',
                        padding: '15px',
                        marginBottom: '10px',
                        borderRadius: '8px',
                        backgroundColor: isExcluded ? '#fef2f2' : 'white',
                        opacity: isExcluded ? 0.6 : 1
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px'}}>
                          <h5 style={{margin: 0}}>{task.name?.en} ({task.type})</h5>
                          <button
                            onClick={() => toggleTaskExclusion(taskId)}
                            style={{
                              background: isExcluded ? '#10b981' : '#ef4444',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            {isExcluded ? 'Include' : 'Exclude'}
                          </button>
                        </div>
                        
                        {!isExcluded && task.type !== 'nutrition' && (
                          <div className="form-row">
                            <div className="form-group">
                              <label>Reps</label>
                              <input
                                type="number"
                                value={newPlan.taskPlans?.[taskId]?.reps || 5}
                                onChange={(e) => setNewPlan({
                                  ...newPlan,
                                  taskPlans: {
                                    ...newPlan.taskPlans,
                                    [taskId]: {
                                      ...newPlan.taskPlans?.[taskId],
                                      reps: parseInt(e.target.value)
                                    }
                                  }
                                })}
                                min="1"
                                max="50"
                              />
                            </div>
                            <div className="form-group">
                              <label>Sets</label>
                              <input
                                type="number"
                                value={newPlan.taskPlans?.[taskId]?.sets || 2}
                                onChange={(e) => setNewPlan({
                                  ...newPlan,
                                  taskPlans: {
                                    ...newPlan.taskPlans,
                                    [taskId]: {
                                      ...newPlan.taskPlans?.[taskId],
                                      sets: parseInt(e.target.value)
                                    }
                                  }
                                })}
                                min="1"
                                max="10"
                              />
                            </div>
                            <div className="form-group">
                              <label>Rest Time (seconds)</label>
                              <input
                                type="number"
                                value={newPlan.taskPlans?.[taskId]?.restTime || 30}
                                onChange={(e) => setNewPlan({
                                  ...newPlan,
                                  taskPlans: {
                                    ...newPlan.taskPlans,
                                    [taskId]: {
                                      ...newPlan.taskPlans?.[taskId],
                                      restTime: parseInt(e.target.value)
                                    }
                                  }
                                })}
                                min="0"
                                max="300"
                              />
                            </div>
                          </div>
                        )}
                        {!isExcluded && task.type === 'nutrition' && (
                          <p style={{color: '#666', fontStyle: 'italic'}}>
                            Nutrition tasks don't require reps/sets configuration
                          </p>
                        )}
                        {isExcluded && (
                          <p style={{color: '#ef4444', fontStyle: 'italic', margin: 0}}>
                            This task will be excluded from the plan
                          </p>
                        )}
                      </div>
                    );
                  })}
                  
                  <button 
                    onClick={handleCreateConsolidatedPlan} 
                    className="btn btn-primary" 
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : `Create Consolidated Plan`}
                  </button>
                </div>
              )}
            </div>

            <div className="data-table">
              <div className="table-header">
                <div className="table-title">All Consolidated Plans ({plans.length})</div>
              </div>
              {plans.map(plan => (
                <div key={plan.id} className="table-row">
                  <div>
                    <strong>Plan ID: {plan.id}</strong>
                    <br />
                    <small>{plan.day} Week {plan.week} - {plan.level}</small>
                  </div>
                  <div>{plan.tasks?.length || 0} tasks</div>
                  <div>1 point per day</div>
                  <div>
                    {plan.tasks?.map(t => t.taskId).join(', ') || 'No tasks'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="schedule-tab">
            <div className="form-section">
              <h3>Weekly Schedule</h3>
              <form onSubmit={handleUpdateSchedule}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div key={day} className="form-group" style={{marginBottom: '20px'}}>
                    <label style={{textTransform: 'capitalize', fontSize: '16px', fontWeight: 'bold'}}>
                      {day}
                    </label>
                    <div style={{
                      border: '1px solid #ddd', 
                      padding: '10px', 
                      borderRadius: '8px',
                      maxHeight: '120px',
                      overflowY: 'auto'
                    }}>
                      {tasks.map(task => (
                        <div key={task.id} style={{marginBottom: '5px'}}>
                          <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                            <input
                              type="checkbox"
                              checked={scheduleForm[day]?.includes(task.id) || false}
                              onChange={() => handleScheduleTaskToggle(day, task.id)}
                              style={{marginRight: '10px'}}
                            />
                            <span>{task.name?.en} ({task.type})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Schedule'}
                </button>
              </form>
            </div>

            {weeklySchedule && (
              <div className="data-table">
                <div className="table-header">
                  <div className="table-title">Current Weekly Schedule</div>
                </div>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div key={day} className="table-row">
                    <div style={{textTransform: 'capitalize', fontWeight: 'bold'}}>{day}</div>
                    <div>
                      {weeklySchedule[day]?.map(taskId => {
                        const task = tasks.find(t => t.id === taskId);
                        return task ? task.name?.en : taskId;
                      }).join(', ') || 'No tasks'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;