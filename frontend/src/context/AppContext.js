// frontend/src/context/AppContext.js
// Provides gigs, venues, tours, and user data to the older page components.
// Fetches real data from the API once the user is logged in.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { gigsApi, venuesApi, toursApi } from '../utils/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user, bandId, isAuthenticated } = useAuth();

  const [gigs,    setGigs]    = useState([]);
  const [venues,  setVenues]  = useState([]);
  const [tours,   setTours]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !bandId) { setLoading(false); return; }

    setLoading(true);
    Promise.all([
      gigsApi.list(bandId).catch(() => []),
      venuesApi.list(bandId).catch(() => []),
      toursApi.list(bandId).catch(() => []),
    ]).then(([g, v, t]) => {
      setGigs(g);
      setVenues(v);
      setTours(t);
    }).finally(() => setLoading(false));
  }, [isAuthenticated, bandId]);

  return (
    <AppContext.Provider value={{
      user,
      gigs,    setGigs,
      venues,  setVenues,
      tours,   setTours,
      loading,
      // notifications stub so Sidebar doesn't crash
      unreadCount: 0,
      notifications: [],
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
