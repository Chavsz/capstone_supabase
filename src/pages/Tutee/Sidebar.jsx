import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import RouteSelect from "./RouteSelect";
import useActionGuard from "../../hooks/useActionGuard";

import * as fiIcons from "react-icons/fi";

const Sidebar = ({ setAuth, onClose }) => {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState(null);
  const { run: runAction, busy: actionBusy } = useActionGuard();

  const handleLogoClick = () => {
    navigate("/dashboard");
    if (onClose) onClose();
  };

  const fetchLogo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("landing")
        .select("sidebar_logo, home_image, login_photo")
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
  }, []);

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
      sessionStorage.removeItem("lav.pendingNotification.tutee");
    } catch (storageError) {
      // Ignore storage errors
    }
  };

  //logout
  const logout = (e) => {
    e.preventDefault();
    runAction(async () => {
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
        throw error;
      }
    }, "Unable to sign out. Please try again.");
  };

  useEffect(() => {
    fetchLogo();
  }, [fetchLogo]);

  useEffect(() => {
    const handleRoleChange = () => {
      fetchLogo();
    };

    window.addEventListener("roleChanged", handleRoleChange);
    window.addEventListener("storage", handleRoleChange);
    return () => {
      window.removeEventListener("roleChanged", handleRoleChange);
      window.removeEventListener("storage", handleRoleChange);
    };
  }, [fetchLogo]);

  return (
    <div className="flex flex-col p-4 text-white sticky top-0 bg-gradient-to-b from-[#4c4ba2] to-[#2f3283] h-screen w-[240px] shadow-xl">
      {/* Mobile Close Button */}
      <div className="flex justify-center items-center mb-4 md:hidden flex-shrink-0 relative">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="LAV logo"
            className="h-16 w-auto object-contain"
          />
        ) : (
          <span className="text-xl font-bold">LAV</span>
        )}
        <button
          onClick={onClose}
          className="absolute right-0 p-2 text-white hover:bg-white/20 rounded"
          aria-label="Close menu"
        >
          <fiIcons.FiX className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop Title */}
      <div className="flex-shrink-0 hidden md:block">
        <button
          onClick={handleLogoClick}
          className="w-full flex items-center justify-center mb-9"
          aria-label="Go to dashboard"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="LAV logo"
              className="h-16 w-auto object-contain"
            />
          ) : (
            <span className="text-xl md:text-2xl font-bold text-white">LAV</span>
          )}
        </button>
      </div>

      {/* Menu Items - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <RouteSelect onClose={onClose} />
      </div>

      {/* Logout Button - Always Visible at Bottom */}
      <div className="flex-shrink-0 mt-auto pt-4 mb-10">
        <button
          className="flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-1.5 md:text-sm text-1xl hover:bg-white/15 text-white shadow-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={(e) => logout(e)}
          disabled={actionBusy}
        >
          <fiIcons.FiLogOut /> <p className="text-md font-semibold">Log out</p>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
