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
  const { logout } = useAuth();

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