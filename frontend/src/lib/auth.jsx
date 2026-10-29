import { createContext, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getUser } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser());
  const login = ({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); setUser(user); };
  const logout = () => { localStorage.clear(); setUser(null); };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function RequireRole({ role, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role?.toLowerCase() !== role.toLowerCase()) {
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  return children;
}
