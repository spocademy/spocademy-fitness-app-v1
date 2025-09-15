// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth } from '../services/firebase/config';
import { getUserData } from '../services/firebaseService';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set persistence to keep users logged in
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        console.log('Auth persistence set to local storage');
      } catch (error) {
        console.error('Error setting auth persistence:', error);
      }
    };
    
    initializeAuth();
  }, []);

  const login = async (phone, password) => {
    try {
      // Ensure persistence is set before login
      await setPersistence(auth, browserLocalPersistence);
      
      // Convert phone to email format
      const cleanPhone = phone.replace(/[\s+\-()]/g, '').slice(-10);
      const emailFormat = `${cleanPhone}@spocademy.com`;
      
      const userCredential = await signInWithEmailAndPassword(auth, emailFormat, password);
      
      // Fetch user data from Firestore
      const userDataFromDb = await getUserData(userCredential.user.uid);
      setUserData(userDataFromDb);
      
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Refresh user data from database with data validation
  const refreshUserData = async () => {
    if (currentUser) {
      try {
        const freshUserData = await getUserData(currentUser.uid);
        
        if (freshUserData) {
          // Validate and fix data integrity
          const currentDay = freshUserData.currentDay || 1;
          const maxPossibleStreak = Math.max(0, currentDay - 1);
          const maxPossiblePoints = Math.max(0, currentDay - 1);
          
          // Fix any corrupted data
          const validatedData = {
            ...freshUserData,
            currentDay: Math.max(1, currentDay),
            streakCount: Math.min(freshUserData.streakCount || 0, maxPossibleStreak),
            points: Math.min(freshUserData.points || 0, maxPossiblePoints)
          };
          
          setUserData(validatedData);
          console.log('User data refreshed and validated');
        } else {
          setUserData(null);
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Fetch user data when auth state changes
          const userDataFromDb = await getUserData(user.uid);
          
          if (userDataFromDb) {
            // Validate data on load
            const currentDay = userDataFromDb.currentDay || 1;
            const maxPossibleStreak = Math.max(0, currentDay - 1);
            const maxPossiblePoints = Math.max(0, currentDay - 1);
            
            const validatedData = {
              ...userDataFromDb,
              currentDay: Math.max(1, currentDay),
              streakCount: Math.min(userDataFromDb.streakCount || 0, maxPossibleStreak),
              points: Math.min(userDataFromDb.points || 0, maxPossiblePoints)
            };
            
            setUserData(validatedData);
          } else {
            setUserData(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    login,
    logout,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};