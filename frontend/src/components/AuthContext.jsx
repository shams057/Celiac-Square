import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMe, logOut } from '../services/api';
import { getUser, hasSession, refresh, saveAuthResponse, setSession, updateUser, SESSION_EVENT } from '../services/session';

const AuthContext = createContext(null);

/**
 * The signed-in account ({ _id, email, fullName, role } or null) for the whole app.
 * Roles: ADMIN, SELLER, CLIENT.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser);

  useEffect(() => {
    const sync = () => setUser(getUser());
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);

  // The role can change while signed out (a seller request approved, say): reload it
  const refreshUser = useCallback(async () => {
    if (!hasSession()) return;
    try {
      const res = await fetchMe();
      if (res?.user) updateUser(res.user);
    } catch {
      // A dead session is cleared by services/session.js
    }
  }, []);

  // After a reload only the hint is known: the session cookie gives a fresh access token and account
  useEffect(() => {
    if (hasSession()) refresh();
  }, []);

  const signIn = useCallback((authResponse) => saveAuthResponse(authResponse), []);

  const signOut = useCallback(async () => {
    try {
      await logOut();
    } catch {
      // Signing out locally is enough
    }
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ user, signIn, signOut, refreshUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
