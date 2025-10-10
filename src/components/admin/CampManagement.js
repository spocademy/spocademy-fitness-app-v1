// src/components/admin/CampManagement.js
import React, { useState, useEffect } from 'react';
import { 
  getAllUsers,
  getAllTasks,
  getAllCampPlans,
  createCampPlan,
  unlockCampForUser,
  bulkUnlockCamp,
  getCampCompletionSummary
} from '../../services/firebaseService';
import './CampManagement.css';

const CampManagement = () => {
  const [activeSection, setActiveSection] = useState('plans');
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [campPlans, setCampPlans] = useState([]);
  const [completionSummary, setCompletionSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  // Camp Plan Creation State
  const [selectedCamp, setSelectedCamp] = useState(1);
  const [orderedTasks, setOrderedTasks] = useState([]);
  const [campTaskPlans, setCampTaskPlans] = useState({});
  const [excludedCampTasks, setExcludedCampTasks] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingPlanData, setPendingPlanData] = useState(null);

  // Unlock State
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [unlockCampNumber, setUnlockCampNumber] = useState(1);
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [singleUserId, setSingleUserId] = useState('');
  const [singleCampNumber, setSingleCampNumber] = useState(1);
  const [singleSearchQuery, setSingleSearchQuery] = useState('');

  // Summary State
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [completionFilter, setCompletionFilter] = useState('all');

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      setOrderedTasks(sortTasksByCategory(tasks));
    }
  }, [tasks]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [usersData, tasksData, campsData, summaryData] = await Promise.all([
        getAllUsers(),
        getAllTasks(),
        getAllCampPlans(),
        getCampCompletionSummary()
      ]);
      
      setUsers(usersData.sort((a, b) => a.name.localeCompare(b.name)));
      setTasks(tasksData);
      setCampPlans(campsData);
      setCompletionSummary(summaryData);
    } catch (error) {
      console.error('Error fetching camp data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampPlan = async () => {
    try {
      const includedTasks = orderedTasks.filter(task => !excludedCampTasks.includes(task.id));
      
      if (includedTasks.length === 0) {
        alert('Please include at least one task in the camp plan');
        return;
      }

      const consolidatedTasks = includedTasks.map(task => {
        const taskPlan = campTaskPlans[task.id];
        
        let taskData = {
          taskId: task.id
        };
        
        if (task.type !== 'nutrition') {
          taskData.reps = taskPlan?.reps && taskPlan.reps > 0 ? taskPlan.reps : 5;
          taskData.sets = taskPlan?.sets && taskPlan.sets > 0 ? taskPlan.sets : 2;
          taskData.restTime = taskPlan?.restTime && taskPlan.restTime >= 0 ? taskPlan.restTime : 30;
        }
        
        return taskData;
      });

      // Check if camp plan already exists - ensure both values are numbers for comparison
      const existingPlan = campPlans.find(plan => Number(plan.campNumber) === Number(selectedCamp));
      
      if (existingPlan) {
        setPendingPlanData({ campNumber: selectedCamp, tasks: consolidatedTasks });
        setShowDuplicateModal(true);
        return;
      }

      // No existing plan, create new one
      setLoading(true);
      await createCampPlan(selectedCamp, consolidatedTasks);
      
      alert(`Camp ${selectedCamp} plan created successfully with ${consolidatedTasks.length} tasks!`);
      
      setCampTaskPlans({});
      setExcludedCampTasks([]);
      
      await fetchAllData();
      setLoading(false);
      
    } catch (error) {
      console.error('Error creating camp plan:', error);
      alert('Error creating camp plan: ' + error.message);
      setLoading(false);
    }
  };

  const handleDuplicatePlanConfirm = async (replace) => {
    setShowDuplicateModal(false);
    
    if (replace && pendingPlanData) {
      try {
        setLoading(true);
        await createCampPlan(pendingPlanData.campNumber, pendingPlanData.tasks);
        alert(`Camp ${pendingPlanData.campNumber} plan replaced successfully!`);
        setCampTaskPlans({});
        setExcludedCampTasks([]);
        setPendingPlanData(null);
        await fetchAllData();
      } catch (error) {
        console.error('Error replacing camp plan:', error);
        alert('Error replacing camp plan: ' + error.message);
      } finally {
        setLoading(false);
      }
    } else {
      setPendingPlanData(null);
    }
  };

  const handleBulkUnlock = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }

    try {
      setLoading(true);
      await bulkUnlockCamp(selectedUsers, unlockCampNumber);
      alert(`Camp ${unlockCampNumber} unlocked for ${selectedUsers.length} users!`);
      setSelectedUsers([]);
      setBulkSearchQuery('');
      await fetchAllData();
    } catch (error) {
      console.error('Error bulk unlocking camp:', error);
      alert('Error unlocking camp: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleUnlock = async () => {
    if (!singleUserId) {
      alert('Please select a user');
      return;
    }

    try {
      setLoading(true);
      await unlockCampForUser(singleUserId, singleCampNumber);
      alert(`Camp ${singleCampNumber} unlocked for selected user!`);
      setSingleUserId('');
      setSingleSearchQuery('');
      await fetchAllData();
    } catch (error) {
      console.error('Error unlocking camp:', error);
      alert('Error unlocking camp: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleTaskExclusion = (taskId) => {
    setExcludedCampTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleTaskPlanChange = (taskId, field, value) => {
    const numericValue = value === '' ? '' : parseInt(value.replace(/\D/g, '')) || '';
    
    setCampTaskPlans(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: numericValue
      }
    }));
  };

  const sortTasksByCategory = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      const order = { athletics: 1, strength: 2, nutrition: 3 };
      return (order[a.type] || 999) - (order[b.type] || 999);
    });
  };

  const moveTaskUp = (index) => {
    if (index === 0) return;
    const newOrder = [...orderedTasks];
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    setOrderedTasks(newOrder);
  };

  const moveTaskDown = (index) => {
    if (index === orderedTasks.length - 1) return;
    const newOrder = [...orderedTasks];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderedTasks(newOrder);
  };

  const filteredBulkUsers = users.filter(user =>
    user.name.toLowerCase().includes(bulkSearchQuery.toLowerCase()) ||
    user.village.toLowerCase().includes(bulkSearchQuery.toLowerCase())
  );

  const filteredSingleUsers = users.filter(user =>
    user.name.toLowerCase().includes(singleSearchQuery.toLowerCase()) ||
    user.village.toLowerCase().includes(singleSearchQuery.toLowerCase())
  );

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedSummary = () => {
    let filtered = [...completionSummary];

    if (completionFilter !== 'all') {
      const targetCount = parseInt(completionFilter);
      filtered = filtered.filter(user => {
        const completed = [user.camp1, user.camp2, user.camp3, user.camp4, user.camp5]
          .filter(status => status === 'Yes').length;
        return completed === targetCount;
      });
    }

    if (!sortConfig.key) return filtered;

    return filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'name' || sortConfig.key === 'village') {
        aValue = (aValue || '').toLowerCase();
        bValue = (bValue || '').toLowerCase();
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const renderSortableHeader = (label, key) => (
    <th onClick={() => handleSort(key)} style={{ cursor: 'pointer' }}>
      {label}
      {sortConfig.key === key && (
        <span style={{ marginLeft: '5px', color: '#007fff' }}>
          {sortConfig.direction === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </th>
  );

  return (
    <div className="camp-management">
      <div className="camp-nav">
        <button 
          className={`camp-nav-btn ${activeSection === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveSection('plans')}
        >
          Camp Plans
        </button>
        <button 
          className={`camp-nav-btn ${activeSection === 'unlock' ? 'active' : ''}`}
          onClick={() => setActiveSection('unlock')}
        >
          Unlock Camps
        </button>
        <button 
          className={`camp-nav-btn ${activeSection === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveSection('summary')}
        >
          Completion Summary
        </button>
      </div>

      {activeSection === 'plans' && (
        <div className="camp-section">
          <h3>Create/Edit Camp Plans</h3>
          
          <div className="form-group">
            <label>Select Camp</label>
            <select
              value={selectedCamp}
              onChange={(e) => setSelectedCamp(parseInt(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map(num => (
                <option key={num} value={num}>Camp {num}</option>
              ))}
            </select>
          </div>

          <div className="tasks-config">
            <h4>Configure Tasks for Camp {selectedCamp}</h4>
            <p style={{color: '#666', marginBottom: '15px', fontSize: '14px'}}>
              Tasks will appear to users in this exact order. Use arrows to rearrange.
            </p>

            <div className="task-config-grid">
              {orderedTasks.map((task, index) => {
                const isExcluded = excludedCampTasks.includes(task.id);
                
                return (
                  <div key={task.id} className="task-config-item" style={{
                    opacity: isExcluded ? 0.6 : 1,
                    background: isExcluded ? '#fef2f2' : 'white'
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                          <button
                            onClick={() => moveTaskUp(index)}
                            disabled={index === 0}
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '10px', minWidth: '24px' }}
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveTaskDown(index)}
                            disabled={index === orderedTasks.length - 1}
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '10px', minWidth: '24px' }}
                          >
                            ▼
                          </button>
                        </div>
                        <h5 style={{margin: 0}}>{index + 1}. {task.name?.en || 'Task'} ({task.type})</h5>
                      </div>
                      <button
                        onClick={() => toggleTaskExclusion(task.id)}
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
                            value={campTaskPlans[task.id]?.reps || ''}
                            onChange={(e) => handleTaskPlanChange(task.id, 'reps', e.target.value)}
                          />
                        </div>
                        <div className="config-input">
                          <label>Sets</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="2"
                            value={campTaskPlans[task.id]?.sets || ''}
                            onChange={(e) => handleTaskPlanChange(task.id, 'sets', e.target.value)}
                          />
                        </div>
                        <div className="config-input">
                          <label>Rest (sec)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="30"
                            value={campTaskPlans[task.id]?.restTime || ''}
                            onChange={(e) => handleTaskPlanChange(task.id, 'restTime', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    {!isExcluded && task.type === 'nutrition' && (
                      <p style={{color: '#666', fontStyle: 'italic', margin: 0}}>
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
              onClick={handleCreateCampPlan} 
              className="btn btn-primary" 
              disabled={loading}
              style={{ marginTop: '20px' }}
            >
              {loading ? 'Creating...' : `Create/Update Camp ${selectedCamp} Plan`}
            </button>
          </div>

          {/* View Existing Camp Plans */}
          <div style={{marginTop: '40px', paddingTop: '30px', borderTop: '2px solid #e9ecef'}}>
            <h3>Existing Camp Plans</h3>
            {campPlans.length === 0 ? (
              <p style={{color: '#666', fontStyle: 'italic'}}>No camp plans created yet</p>
            ) : (
              <div style={{display: 'grid', gap: '16px', marginTop: '16px'}}>
                {[1, 2, 3, 4, 5].map(campNum => {
                  const plan = campPlans.find(p => Number(p.campNumber) === campNum);
                  return (
                    <div key={campNum} style={{
                      background: plan ? '#f0f8ff' : '#f8f9fa',
                      border: `1px solid ${plan ? '#007fff' : '#e9ecef'}`,
                      borderRadius: '8px',
                      padding: '16px'
                    }}>
                      <h4 style={{margin: '0 0 12px 0', color: plan ? '#007fff' : '#6c757d'}}>
                        Camp {campNum} {plan ? `(${plan.tasks?.length || 0} tasks)` : '(Not created)'}
                      </h4>
                      {plan && plan.tasks && (
                        <div style={{fontSize: '14px', color: '#4d4d4d'}}>
                          {plan.tasks.map((taskPlan, index) => {
                            const task = tasks.find(t => t.id === taskPlan.taskId);
                            if (!task) return null;
                            return (
                              <div key={taskPlan.taskId} style={{
                                padding: '8px',
                                background: 'white',
                                borderRadius: '4px',
                                marginBottom: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span><strong>{index + 1}.</strong> {task.name?.en || 'Task'} ({task.type})</span>
                                {task.type !== 'nutrition' && (
                                  <span style={{fontSize: '12px', color: '#6c757d'}}>
                                    {taskPlan.sets} sets × {taskPlan.reps} reps, {taskPlan.restTime}s rest
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'unlock' && (
        <div className="camp-section">
          <div className="unlock-section">
            <h3>Bulk Unlock Camp</h3>
            
            <div className="form-group">
              <label>Select Camp to Unlock</label>
              <select
                value={unlockCampNumber}
                onChange={(e) => setUnlockCampNumber(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>Camp {num}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Search Users</label>
              <input
                type="text"
                placeholder="Search by name or village..."
                value={bulkSearchQuery}
                onChange={(e) => setBulkSearchQuery(e.target.value)}
              />
            </div>

            <div className="users-selection">
              <label>Select Users ({selectedUsers.length} selected)</label>
              <div className="users-grid">
                {filteredBulkUsers.map(user => (
                  <label key={user.id} className="user-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                    <span>{user.name} ({user.village})</span>
                  </label>
                ))}
              </div>
            </div>

            <button 
              onClick={handleBulkUnlock} 
              className="btn btn-primary" 
              disabled={loading}
            >
              {loading ? 'Unlocking...' : `Unlock Camp ${unlockCampNumber} for ${selectedUsers.length} Users`}
            </button>
          </div>

          <div className="unlock-section" style={{marginTop: '30px'}}>
            <h3>Individual Unlock</h3>
            
            <div className="form-group">
              <label>Search User</label>
              <input
                type="text"
                placeholder="Search by name or village..."
                value={singleSearchQuery}
                onChange={(e) => setSingleSearchQuery(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Select User</label>
                <select
                  value={singleUserId}
                  onChange={(e) => setSingleUserId(e.target.value)}
                >
                  <option value="">Choose User</option>
                  {filteredSingleUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.village}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Select Camp</label>
                <select
                  value={singleCampNumber}
                  onChange={(e) => setSingleCampNumber(parseInt(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>Camp {num}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              onClick={handleSingleUnlock} 
              className="btn btn-primary" 
              disabled={loading}
            >
              {loading ? 'Unlocking...' : 'Unlock Camp'}
            </button>
          </div>
        </div>
      )}

      {activeSection === 'summary' && (
        <div className="camp-section">
          <h3>Camp Completion Summary</h3>
          
          <div className="form-group" style={{maxWidth: '300px', marginBottom: '20px'}}>
            <label>Filter by Completion</label>
            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value)}
            >
              <option value="all">All Users</option>
              <option value="5">Completed All 5 Camps</option>
              <option value="4">Completed 4 Camps</option>
              <option value="3">Completed 3 Camps</option>
              <option value="2">Completed 2 Camps</option>
              <option value="1">Completed 1 Camp</option>
              <option value="0">Completed 0 Camps</option>
            </select>
          </div>
          
          <div className="summary-table">
            <table>
              <thead>
                <tr>
                  {renderSortableHeader('User', 'name')}
                  {renderSortableHeader('Village', 'village')}
                  {renderSortableHeader('Current Unlocked', 'currentCampUnlocked')}
                  <th>Camp 1</th>
                  <th>Camp 2</th>
                  <th>Camp 3</th>
                  <th>Camp 4</th>
                  <th>Camp 5</th>
                </tr>
              </thead>
              <tbody>
                {getSortedSummary().length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{textAlign: 'center', padding: '20px'}}>
                      {completionFilter === 'all' 
                        ? 'No users have been assigned camps yet'
                        : `No users match the selected filter`
                      }
                    </td>
                  </tr>
                ) : (
                  getSortedSummary().map(user => (
                    <tr key={user.userId}>
                      <td>{user.name}</td>
                      <td>{user.village}</td>
                      <td>{user.currentCampUnlocked ? `Camp ${user.currentCampUnlocked}` : '-'}</td>
                      <td className={user.camp1 === 'Yes' ? 'completed' : ''}>{user.camp1}</td>
                      <td className={user.camp2 === 'Yes' ? 'completed' : ''}>{user.camp2}</td>
                      <td className={user.camp3 === 'Yes' ? 'completed' : ''}>{user.camp3}</td>
                      <td className={user.camp4 === 'Yes' ? 'completed' : ''}>{user.camp4}</td>
                      <td className={user.camp5 === 'Yes' ? 'completed' : ''}>{user.camp5}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duplicate Plan Modal */}
      {showDuplicateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">⚠️ Camp Plan Already Exists</div>
            <div className="modal-message">
              Camp {pendingPlanData?.campNumber} plan already exists.
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

export default CampManagement;