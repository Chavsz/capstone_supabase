import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import RouteSelect from "./RouteSelect";

import * as fiIcons from "react-icons/fi";

const Sidebar = ({ setAuth, onClose }) => {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState(null);

  const handleLogoClick = () => {
    navigate("/dashboard");
    if (onClose) onClose();
  };

  const fetchLogo = async () => {
    try {
      const { data, error } = await supabase
        .from("landing")
        .select("sidebar_logo, login_photo, home_image")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setLogoUrl(data?.sidebar_logo || data?.login_photo || data?.home_image || null);
    } catch (err) {
      console.error("Error loading logo:", err.message);
      setLogoUrl(null);
    }
  };

  const clearAuthStorage = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (
          key.startsWith("sb-") ||
          key.includes("auth-token") ||
          key.includes("supabase")
        ) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem("lav.roleOverride");
      localStorage.removeItem("lav.roleOverridePrev");
    } catch (storageError) {
      // Ignore storage errors
    }

    try {
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach((key) => {
        if (
          key.startsWith("sb-") ||
          key.includes("auth-token") ||
          key.includes("supabase")
        ) {
          sessionStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem("lav.pendingNotification.tutor");
    } catch (storageError) {
      // Ignore storage errors
    }
  };

  //logout
  const logout = async (e) => {
    e.preventDefault();
    if (!window.confirm("Log out from all devices?")) {
      return;
    }
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      clearAuthStorage();
      // onAuthStateChange in App.jsx will handle state updates
      // Small delay to ensure state is cleared before navigation
      setTimeout(() => {
        navigate("/login");
      }, 100);
    } catch (error) {
      console.error("Error signing out:", error);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (err) {
        // Ignore local sign out error
      }
      clearAuthStorage();
      // Force navigation even if signOut fails
      navigate("/");
    }
  };

  useEffect(() => {
    fetchLogo();
  }, []);

  return (
    <div className="flex flex-col p-4 text-[#181718] sticky top-0 bg-[#feda3c] h-screen w-[240px] shadow-xl">
      {/* Logo Header */}
      <div className="relative mb-9 flex-shrink-0">
        <button
          onClick={handleLogoClick}
          className="w-full flex items-center justify-center"
          aria-label="Go to dashboard"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="LAV logo"
              className="h-16 w-auto object-contain"
            />
          ) : (
            <span className="text-xl md:text-2xl font-bold text-[#181718]">LAV</span>
          )}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[#181718] hover:bg-black/10 rounded md:hidden"
            aria-label="Close menu"
          >
            <fiIcons.FiX className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Menu Items - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <RouteSelect onClose={onClose} />
      </div>

      {/* Logout Button - Always Visible at Bottom */}
      <div className="flex-shrink-0 mt-auto pt-4 mb-10">
        <button
          className="flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-1.5 cursor-pointer text-sm hover:bg-black/10 text-[#181718] shadow-none"
          onClick={(e) => logout(e)}
        >
          <fiIcons.FiLogOut /> <p className="text-md font-semibold hidden md:block">Log out</p>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
