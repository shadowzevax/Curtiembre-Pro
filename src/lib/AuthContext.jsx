import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { User } from '@/api/entityFactory';
import { getToken, setToken } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkAppState = useCallback(async () => {
    setAuthError(null);
    if (!getToken()) {
      setIsAuthenticated(false);
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }
    try {
      setIsLoadingAuth(true);
      const currentUser = await User.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error.status === 401 || error.status === 403) {
        setToken(null);
      } else {
        setAuthError({ type: 'unknown', message: error.message || 'No se pudo conectar con el servidor' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAppState();
    // Si cualquier llamada a la API detecta sesión expirada, volvemos al login
    const onExpired = () => {
      setUser(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [checkAppState]);

  const login = async (email, password) => {
    const loggedUser = await User.login(email, password);
    setUser(loggedUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return loggedUser;
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await User.logout();
  };

  const navigateToLogin = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      login,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
