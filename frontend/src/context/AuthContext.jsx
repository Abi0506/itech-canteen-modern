import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/profile');
      setUser(res.data);
    } catch (err) {
      setUser(null);
      localStorage.removeItem('access_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (roll_no, password) => {
    const res = await api.post('/auth/login', { roll_no, password });
    const { access_token, role, roll_no: userRoll } = res.data;
    
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user_role', role);
    localStorage.setItem('roll_no', userRoll);
    
    await fetchProfile();
    return res.data;
  };

  const register = async (roll_no, email, phone_no, password, user_type) => {
    await api.post('/auth/register', { roll_no, email, phone_no, password, user_type });
  };

  const loginWithGoogle = async (credential) => {
    const res = await api.post('/auth/google', { credential });
    const { access_token, role, roll_no: userRoll } = res.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user_role', role);
    localStorage.setItem('roll_no', userRoll);

    await fetchProfile();
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('roll_no');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
