import React, { createContext, useContext, useMemo, useState } from "react";

const UserContext = createContext(null);
const STORAGE_KEY = "lav.userDetails";

export const UserProvider = ({ children }) => {
  const [userDetails, setUserDetailsState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  });

  const setUserDetails = (details) => {
    const nextDetails = details || null;
    setUserDetailsState(nextDetails);
    try {
      if (nextDetails) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDetails));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      // Ignore storage errors (e.g. privacy mode)
    }
  };

  const clearUserDetails = () => setUserDetails(null);

  const value = useMemo(
    () => ({ userDetails, setUserDetails, clearUserDetails }),
    [userDetails]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserDetails = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserDetails must be used within UserProvider");
  }
  return context;
};
