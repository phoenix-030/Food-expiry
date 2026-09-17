import { useState, useEffect } from "react";
import { api } from "../services/api";
import { AuthContext } from "./authContextObject";

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    // Instantly restore user from localStorage (no flicker)
    const saved = localStorage.getItem("freshtrack_user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem("freshtrack_user");
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // On app start: validate the httpOnly cookie with the server
  useEffect(() => {
    const validateSession = async () => {
      try {
        const user = await api.getCurrentUser(); // reads cookie on server
        if (user) {
          setCurrentUser(user);
          localStorage.setItem("freshtrack_user", JSON.stringify(user));
        } else {
          setCurrentUser(null);
          localStorage.removeItem("freshtrack_user");
        }
      } catch {
        setCurrentUser(null);
        localStorage.removeItem("freshtrack_user");
      } finally {
        setLoading(false);
      }
    };
    validateSession();
  }, []);

  // Register → DB stores hashed password, cookie set, user in localStorage
  const register = async (name, email, password, role) => {
    const data = await api.register(name, email, password, role);
    setCurrentUser(data.user);
    localStorage.setItem("freshtrack_user", JSON.stringify(data.user));
    return data.user;
  };

  // Login → DB checks password, cookie set, user in localStorage
  const login = async (email, password) => {
    const data = await api.login(email, password);
    setCurrentUser(data.user);
    localStorage.setItem("freshtrack_user", JSON.stringify(data.user));
    return data.user;
  };

  // Logout → clears cookie on server + localStorage on client
  const logout = async () => {
    await api.logout();
    setCurrentUser(null);
    localStorage.removeItem("freshtrack_user");
  };

  const updateProfile = async (profile) => {
    const user = await api.updateProfile(profile);
    setCurrentUser(user);
    localStorage.setItem("freshtrack_user", JSON.stringify(user));
    return user;
  };

  const value = {
    currentUser,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!currentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
