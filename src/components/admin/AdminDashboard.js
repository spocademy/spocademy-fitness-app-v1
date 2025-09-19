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
  getWeeklySchedule,
  getDailyPlan
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

  const [newUser, setNewUser] = useState({
    phone: '',
    name: '',
    village: '',
    level: 'beginnerBoys',
    dateOfBirth: '',
    password: ''
  });

  const [newTask, setNewTask] = useState({
    nameEn: '',
    nameMr: '',
    type: 'athletics',
    exerciseType: ''
  });

  const [newPlan, setNewPlan] = useState({
    day: 'monday',
    level: 'beginnerBoys',
    week: 1,
    taskPlans: {},
    excludedTasks: []
  });

  const [selectedDay, setSelectedDay] = useState('monday');
  const [scheduleForm, setScheduleForm] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });

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
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicatePlanData, setDuplicatePlanData] = useState(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Village management state
  const [availableVillages, setAvailableVillages] = useState([]);
  const [showVillageInput, setShowVillageInput] = useState(false);
  const [newVillage, setNewVillage] = useState('');

  const exerciseOptions = {
    squats: { en: 'Squats', mr: 'स्क्वॅट्स' },
    jumpingJacks: { en: 'Jumping Jacks', mr: 'जंपिंग जॅक्स' },
    pushups: { en: 'Push-ups', mr: 'पुश-अप्स' },
    calfRaises: { en: 'Calf Raises', mr: 'काल्फ रेसेस' },
    situps: { en: 'Sit-ups', mr: 'सिट-अप्स' }
  };

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
      
      // Extract unique villages from users
      const uniqueVillages = [...new Set(usersData.map(user => user.village).filter(Boolean))].sort();
      setAvailableVillages(uniqueVillages);
      
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

  const getLastActiveUsers = () => {
    return users
      .filter(user => user.lastActive)
      .sort((a, b) => {
        const aTime = a.lastActive.seconds ? a.lastActive.seconds : a.lastActive;
        const bTime = b.lastActive.seconds ? b.lastActive.seconds : b.lastActive;
        return bTime - aTime;
      })
      .slice(0, 5);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedUsers = () => {
    if (!sortConfig.key) return users;

    return [...users].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle different data types
      if (sortConfig.key === 'name' || sortConfig.key === 'village') {
        aValue = (aValue || '').toLowerCase();
        bValue = (bValue || '').toLowerCase();
      } else if (sortConfig.key === 'currentDay' || sortConfig.key === 'streakCount' || sortConfig.key === 'points') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const renderSortableHeader = (label, key) => (
    <div className="sortable-header" onClick={() => handleSort(key)}>
      {label}
      {sortConfig.key === key && (
        <span className="sort-arrow">
          {sortConfig.direction === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </div>
  );

  const handleAddVillage = async () => {
    if (!newVillage.trim()) {
      alert('Please enter a village name');
      return;
    }

    if (availableVillages.includes(newVillage.trim())) {
      alert('Village already exists');
      return;
    }

    const updatedVillages = [...availableVillages, newVillage.trim()].sort();
    setAvailableVillages(updatedVillages);
    setNewUser({ ...newUser, village: newVillage.trim() });
    setNewVillage('');
    setShowVillageInput(false);
  };

  const getUniqueVillages = () => {
    const villages = [...new Set(users.map(user => user.village).filter(Boolean))];
    return villages.sort();
  };

  const getUniqueLevels = () => {
    return ['beginnerBoys', 'beginnerGirls', 'advancedBoys', 'advancedGirls', 'specialBatch'];
  };

  const handleNotificationFormChange = (field, value) => {
    setNotificationForm(prev => ({
      ...prev,
      [field]: value
    }));
    setPreviewData(null);
    setNotificationResult(null);
  };

  const handleMultiSelect = (field, value, checked) => {
    setNotificationForm(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }));
    setPreviewData(null);
  };

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

  const handlePreviewNotification = () => {
    const errors = validateNotificationForm();
    if (errors.length > 0) {
      alert('Please fix these errors:\n' + errors.join('\n'));
      return;
    }

    let targetedUsers = users.filter(user => user.role !== 'admin');
    let targetedCount = 0;

    const { villages, levels, activityStatus } = notificationForm;
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    targetedUsers.forEach(user => {
      let shouldInclude = false;
      
      if (villages.length > 0) {
        shouldInclude = villages.some(village => 
          user.village && user.village.toLowerCase().includes(village.toLowerCase())
        );
      }
      
      if (levels.length > 0) {
        if (shouldInclude || villages.length === 0) {
          shouldInclude = levels.includes(user.level);
        }
      }
      
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
      totalUsers: users.length - 1,
      villages: villages.length > 0 ? villages : ['All'],
      levels: levels.length > 0 ? levels : ['All'],
      activityStatus
    });
  };

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

      if (newTask.type === 'strength') {
        taskData.exerciseType = newTask.exerciseType;
      }
      
      await createTask(taskData);

      alert('Task created successfully!');
      setNewTask({
        nameEn: '',
        nameMr: '',
        type: 'athletics',
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

  const handleDuplicatePlanConfirm = async (replace) => {
    if (replace && duplicatePlanData) {
      await createConsolidatedPlanInternal(duplicatePlanData, true);
    }
    setShowDuplicateModal(false);
    setDuplicatePlanData(null);
  };

  const createConsolidatedPlanInternal = async (planData, skipCheck = false) => {
    try {
      setLoading(true);
      
      if (!weeklySchedule || !weeklySchedule[planData.day]) {
        alert('No tasks assigned to this day yet. Please set up the weekly schedule first.');
        return;
      }
      
      if (!skipCheck) {
        const existingPlan = await getDailyPlan(planData.day, planData.week, planData.level);
        if (existingPlan) {
          setDuplicatePlanData(planData);
          setShowDuplicateModal(true);
          return;
        }
      }
      
      const tasksForDay = weeklySchedule[planData.day];
      const excludedTasks = planData.excludedTasks || [];
      
      const includedTasks = tasksForDay.filter(taskId => !excludedTasks.includes(taskId));
      
      if (includedTasks.length === 0) {
        alert('No tasks selected for this plan. Please include at least one task.');
        return;
      }
      
      const consolidatedTasks = [];
      
      for (const taskId of includedTasks) {
        const task = tasks.find(t => t.id === taskId);
        const taskPlan = planData.taskPlans?.[taskId];
        
        let taskData = {
          taskId: taskId
        };
        
        if (task && task.type !== 'nutrition') {
          taskData.reps = taskPlan?.reps && taskPlan.reps > 0 ? taskPlan.reps : 5;
          taskData.sets = taskPlan?.sets && taskPlan.sets > 0 ? taskPlan.sets : 2;
          taskData.restTime = taskPlan?.restTime && taskPlan.restTime >= 0 ? taskPlan.restTime : 30;
        }
        
        consolidatedTasks.push(taskData);
      }
      
      const planId = await createDailyPlan(planData.day, planData.week, planData.level, consolidatedTasks);
      
      alert(`Consolidated plan ${skipCheck ? 'replaced' : 'created'}: ${planId} for ${planData.day} Week ${planData.week} ${planData.level}!\nIncluded ${consolidatedTasks.length} tasks.`);
      
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

  const handleCreateConsolidatedPlan = async () => {
    await createConsolidatedPlanInternal(newPlan, false);
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

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.target.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over-zone');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over-zone');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over-zone');
    
    const taskId = e.dataTransfer.getData('text/plain');
    const currentTasks = scheduleForm[selectedDay] || [];
    
    if (!currentTasks.includes(taskId)) {
      setScheduleForm({
        ...scheduleForm,
        [selectedDay]: [...currentTasks, taskId]
      });
    }
  };

  const handleRemoveTaskFromDay = (taskId) => {
    const currentTasks = scheduleForm[selectedDay] || [];
    setScheduleForm({
      ...scheduleForm,
      [selectedDay]: currentTasks.filter(id => id !== taskId)
    });
  };

  const moveTaskUp = (taskId) => {
    const currentTasks = [...(scheduleForm[selectedDay] || [])];
    const index = currentTasks.indexOf(taskId);
    if (index > 0) {
      [currentTasks[index], currentTasks[index - 1]] = [currentTasks[index - 1], currentTasks[index]];
      setScheduleForm({
        ...scheduleForm,
        [selectedDay]: currentTasks
      });
    }
  };

  const moveTaskDown = (taskId) => {
    const currentTasks = [...(scheduleForm[selectedDay] || [])];
    const index = currentTasks.indexOf(taskId);
    if (index < currentTasks.length - 1) {
      [currentTasks[index], currentTasks[index + 1]] = [currentTasks[index + 1], currentTasks[index]];
      setScheduleForm({
        ...scheduleForm,
        [selectedDay]: currentTasks
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

  const handleTaskPlanChange = (taskId, field, value) => {
    const numericValue = value === '' ? '' : parseInt(value.replace(/\D/g, '')) || '';
    
    setNewPlan({
      ...newPlan,
      taskPlans: {
        ...newPlan.taskPlans,
        [taskId]: {
          ...newPlan.taskPlans?.[taskId],
          [field]: numericValue
        }
      }
    });
  };

  const handleLogout = async () => {
  const confirmLogout = window.confirm('Are you sure you want to logout?');
  if (confirmLogout) {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
};

  const sortTasksByCategory = (tasksToSort) => {
    return tasksToSort.sort((a, b) => {
      const order = { athletics: 1, strength: 2, nutrition: 3 };
      return (order[a.type] || 999) - (order[b.type] || 999);
    });
  };

  const sortPlans = (plansToSort) => {
    const dayOrder = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
    const levelOrder = { beginnerBoys: 1, beginnerGirls: 2, advancedBoys: 3, advancedGirls: 4, specialBatch: 5 };
    
    return plansToSort.sort((a, b) => {
      const dayDiff = (dayOrder[a.day] || 999) - (dayOrder[b.day] || 999);
      if (dayDiff !== 0) return dayDiff;
      
      const levelDiff = (levelOrder[a.level] || 999) - (levelOrder[b.level] || 999);
      if (levelDiff !== 0) return levelDiff;
      
      return (a.week || 999) - (b.week || 999);
    });
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
          {['dashboard', 'users', 'tasks', 'plans', 'schedule', 'notifications'].map(tab => (
            <button 
              key={tab}
              className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
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
                <div className="table-title">Recent Active Users</div>
              </div>
              {getLastActiveUsers().map(user => (
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

        {activeTab === 'users' && (
          <div className="users-tab">
            <div className="form-section">
              <h3>Add New User</h3>
              <form onSubmit={handleCreateUser}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
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
                    <div className="village-input-container">
                      <select
                        value={newUser.village}
                        onChange={(e) => setNewUser({...newUser, village: e.target.value})}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select Village</option>
                        {availableVillages.map(village => (
                          <option key={village} value={village}>{village}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="village-add-btn"
                        onClick={() => setShowVillageInput(!showVillageInput)}
                        title="Add new village"
                      >
                        +
                      </button>
                    </div>
                    {showVillageInput && (
                      <div className="village-input-row">
                        <input
                          type="text"
                          placeholder="Enter new village name"
                          value={newVillage}
                          onChange={(e) => setNewVillage(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleAddVillage}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowVillageInput(false);
                            setNewVillage('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
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
                <div>{renderSortableHeader('User', 'name')}</div>
                <div>{renderSortableHeader('Level', 'level')}</div>
                <div>{renderSortableHeader('Day', 'currentDay')}</div>
                <div>{renderSortableHeader('Streak', 'streakCount')}</div>
                <div>{renderSortableHeader('Village', 'village')}</div>
                <div>{renderSortableHeader('Points', 'points')}</div>
              </div>
              {getSortedUsers().map(user => (
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
                      <option value="athletics">Athletics</option>
                      <option value="strength">Strength</option>
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
                <div className="table-title">All Tasks ({tasks.length}) - Sorted by Category</div>
              </div>
              {sortTasksByCategory(tasks).map(task => (
                <div key={task.id} className="table-row">
                  <div>
                    <strong>{task.name?.en || 'Unnamed Task'}</strong>
                    <br />
                    <small>{task.name?.mr}</small>
                  </div>
                  <div style={{ 
                    textTransform: 'capitalize',
                    color: task.type === 'athletics' ? '#007fff' : 
                          task.type === 'strength' ? '#28a745' : '#fd7e14'
                  }}>
                    {task.type}
                  </div>
                  <div>{task.exerciseType || '-'}</div>
                  <div>ID: {task.id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="schedule-tab">
            <div className="day-schedule-section">
              <h3>Daily Schedule Management</h3>
              
              <div className="day-dropdown">
                <label>Select Day:</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
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

              <div className="tasks-for-day">
                <h4>Tasks for {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}</h4>
                
                <div 
                  className="task-list-container"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {scheduleForm[selectedDay]?.length > 0 ? (
                    scheduleForm[selectedDay].map((taskId, index) => {
                      const task = tasks.find(t => t.id === taskId);
                      if (!task) return null;
                      
                      return (
                        <div key={taskId} className="task-item">
                          <div className="task-info">
                            <div className="task-name">{task.name?.en || 'Unknown Task'}</div>
                            <div className="task-type">{task.type}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button 
                              onClick={() => moveTaskUp(taskId)}
                              disabled={index === 0}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              ↑
                            </button>
                            <button 
                              onClick={() => moveTaskDown(taskId)}
                              disabled={index === scheduleForm[selectedDay].length - 1}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              ↓
                            </button>
                            <button 
                              onClick={() => handleRemoveTaskFromDay(taskId)}
                              className="btn btn-warning"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-text">No tasks assigned to {selectedDay}</div>
                      <div className="empty-state-subtext">Drag tasks from below to add them</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="available-tasks">
                <h4>Available Tasks (drag to add)</h4>
                <div className="available-tasks-grid">
                  {sortTasksByCategory(tasks).map(task => (
                    <div
                      key={task.id}
                      className="available-task-item"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="task-info">
                        <div className="task-name">{task.name?.en || 'Unknown Task'}</div>
                        <div className="task-type">{task.type}</div>
                      </div>
                      <div className="drag-handle">⋮⋮</div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleUpdateSchedule} 
                className="btn btn-success" 
                disabled={loading}
                style={{ marginTop: '24px' }}
              >
                {loading ? 'Updating...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="plans-tab">
            <div className="plan-creation-section">
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
                    onChange={(e) => setNewPlan({...newPlan, week: parseInt(e.target.value)})}
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
                  <h4>Tasks Schedule for {newPlan.day.charAt(0).toUpperCase() + newPlan.day.slice(1)}:</h4>
                  <p style={{color: '#666', marginBottom: '15px', fontSize: '14px'}}>
                    Plan ID: <strong>{newPlan.day.slice(0,3)}W{newPlan.week}{newPlan.level.slice(0,2).toUpperCase()}</strong> | 
                    Tasks will appear to users in this exact order:
                  </p>
                  
                  <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h5 style={{ margin: '0 0 12px 0', color: '#007fff' }}>All Scheduled Tasks (in user order):</h5>
                    {weeklySchedule[newPlan.day].map((taskId, index) => {
                      const task = tasks.find(t => t.id === taskId);
                      if (!task) return null;
                      
                      const hasCamera = task.exerciseType && (task.exerciseType === 'squats' || task.exerciseType === 'jumpingJacks');
                      
                      return (
                        <div key={taskId} style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 12px',
                          margin: '4px 0',
                          background: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e9ecef'
                        }}>
                          <span style={{ 
                            background: task.type === 'athletics' ? '#007fff' : 
                                       task.type === 'strength' ? '#28a745' : '#fd7e14',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            marginRight: '12px',
                            minWidth: '60px',
                            textAlign: 'center'
                          }}>
                            {task.type.toUpperCase()}
                          </span>
                          <span style={{ flex: 1, fontWeight: '500' }}>
                            {index + 1}. {task.name?.en}
                          </span>
                          {hasCamera && (
                            <span style={{ 
                              background: '#17a2b8', 
                              color: 'white', 
                              padding: '2px 6px', 
                              borderRadius: '8px', 
                              fontSize: '10px',
                              marginLeft: '8px'
                            }}>
                              📹 CAMERA
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <h4>Configure Task Settings:</h4>
                  <div className="task-config-grid">
                    {weeklySchedule[newPlan.day].map(taskId => {
                      const task = tasks.find(t => t.id === taskId);
                      if (!task) return null;
                      
                      const isExcluded = newPlan.excludedTasks && newPlan.excludedTasks.includes(taskId);
                      
                      return (
                        <div key={taskId} className="task-config-item" style={{
                          opacity: isExcluded ? 0.6 : 1,
                          background: isExcluded ? '#fef2f2' : 'white'
                        }}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px'}}>
                            <h5 style={{margin: 0}}>{task.name?.en} ({task.type})</h5>
                            <button
                              onClick={() => toggleTaskExclusion(taskId)}
                              className={`btn ${isExcluded ? 'btn-success' : 'btn-warning'}`}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              {isExcluded ? 'Include' : 'Exclude'}
                            </button>
                          </div>
                          
                          {!isExcluded && task.type !== 'nutrition' && (
                            <div className="config-inputs">
                              <div className="config-input">
                                <label>Reps</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="5"
                                  value={newPlan.taskPlans?.[taskId]?.reps || ''}
                                  onChange={(e) => handleTaskPlanChange(taskId, 'reps', e.target.value)}
                                />
                              </div>
                              <div className="config-input">
                                <label>Sets</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="2"
                                  value={newPlan.taskPlans?.[taskId]?.sets || ''}
                                  onChange={(e) => handleTaskPlanChange(taskId, 'sets', e.target.value)}
                                />
                              </div>
                              <div className="config-input">
                                <label>Rest (sec)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="30"
                                  value={newPlan.taskPlans?.[taskId]?.restTime || ''}
                                  onChange={(e) => handleTaskPlanChange(taskId, 'restTime', e.target.value)}
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
                  </div>
                  
                  <button 
                    onClick={handleCreateConsolidatedPlan} 
                    className="btn btn-primary" 
                    disabled={loading}
                    style={{ marginTop: '20px' }}
                  >
                    {loading ? 'Creating...' : 'Create Consolidated Plan'}
                  </button>
                </div>
              )}
            </div>

            <div className="data-table">
              <div className="table-header">
                <div className="table-title">All Consolidated Plans ({plans.length}) - Organized by Day & Level</div>
              </div>
              {sortPlans(plans).map(plan => (
                <div key={plan.id} className="table-row">
                  <div>
                    <strong>Plan ID: {plan.id}</strong>
                    <br />
                    <small style={{
                      color: plan.day === 'monday' ? '#007fff' :
                             plan.day === 'tuesday' ? '#28a745' :
                             plan.day === 'wednesday' ? '#fd7e14' :
                             plan.day === 'thursday' ? '#6f42c1' :
                             plan.day === 'friday' ? '#20c997' :
                             plan.day === 'saturday' ? '#dc3545' : '#6c757d'
                    }}>
                      {plan.day.charAt(0).toUpperCase() + plan.day.slice(1)} Week {plan.week} - {plan.level}
                    </small>
                  </div>
                  <div>{plan.tasks?.length || 0} tasks</div>
                  <div>1 point per day</div>
                  <div style={{ fontSize: '12px', maxWidth: '200px', overflow: 'hidden' }}>
                    {plan.tasks?.map(t => {
                      const task = tasks.find(task => task.id === t.taskId);
                      return task?.name?.en || t.taskId;
                    }).join(', ') || 'No tasks'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="notifications-tab">
            <div className="form-section">
              <h3>Send Manual Notification</h3>
              
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
                    </div>
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
      </div>

      {showDuplicateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">⚠️ Plan Already Exists</div>
            <div className="modal-message">
              A plan for {duplicatePlanData?.day} Week {duplicatePlanData?.week} {duplicatePlanData?.level} already exists.
              <br /><br />
              Do you want to replace it with the new configuration?
            </div>
            <div className="modal-buttons">
              <button 
                className="modal-btn cancel"
                onClick={() => handleDuplicatePlanConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn replace"
                onClick={() => handleDuplicatePlanConfirm(true)}
              >
                Replace Existing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;