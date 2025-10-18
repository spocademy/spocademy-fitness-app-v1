// src/utils/exportUtils.js

/**
 * Converts array of objects to CSV and triggers download
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file to download
 */
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  let csvContent = '';
  
  // Add headers
  csvContent += headers.join(',') + '\n';
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert to string and escape quotes
      const stringValue = String(value).replace(/"/g, '""');
      
      // Wrap in quotes if contains comma, newline, or quote
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue}"`;
      }
      
      return stringValue;
    });
    
    csvContent += values.join(',') + '\n';
  });
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Create a link and trigger download
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    alert('Your browser does not support file downloads');
  }
};

/**
 * Export users data to CSV
 * @param {Array} users - Array of user objects
 * @param {string} filename - Optional filename
 */
export const exportUsersToCSV = (users, filename = 'users-export.csv') => {
  const data = users.map(user => ({
    Name: user.name || '',
    Phone: user.phone || '',
    Village: user.village || '',
    Level: user.level || '',
    'Current Day': user.currentDay || 1,
    'Streak Count': user.streakCount || 0,
    Points: user.points || 0,
    'Last Active': user.lastActive 
      ? new Date(user.lastActive.seconds * 1000).toLocaleString() 
      : 'Never',
    'Created At': user.createdAt 
      ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() 
      : '',
    'Date of Birth': user.dateOfBirth || ''
  }));
  
  exportToCSV(data, filename);
};