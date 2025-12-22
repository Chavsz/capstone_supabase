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

  //logout
  const logout = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // onAuthStateChange in App.jsx will handle state updates
      // Small delay to ensure state is cleared before navigation
      setTimeout(() => {
        navigate("/login");
      }, 100);
    } catch (error) {
      console.error("Error signing out:", error);
      // Force navigation even if signOut fails
      navigate("/");
    }
  };

  useEffect(() => {
    fetchLogo();
  }, []);

  return (
    <div className="flex flex-col p-4 text-white sticky top-0 bg-white h-screen w-[240px]">
      {/* Mobile Close Button */}
      <div className="flex justify-between items-center mb-4 md:hidden flex-shrink-0">
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 text-left"
          aria-label="Go to dashboard"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="LAV logo"
              className="h-8 w-auto rounded-sm bg-blue-50 p-1"
            />
          ) : (
            <span className="text-xl font-bold text-blue-600">LAV</span>
          )}
        </button>
        <button
          onClick={onClose}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded"
          aria-label="Close menu"
        >
          <fiIcons.FiX className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop Title */}
      <div className="flex-shrink-0 hidden md:block">
        <button
          onClick={handleLogoClick}
          className="w-full flex items-center justify-center mb-9 hover:opacity-90 transition-opacity"
          aria-label="Go to dashboard"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="LAV logo"
              className="h-12 w-auto rounded-md bg-blue-50 p-2"
            />
          ) : (
            <span className="text-xl md:text-2xl font-bold text-blue-600">LAV</span>
          )}
        </button>
      </div>

      {/* Menu Items - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <RouteSelect onClose={onClose} />
      </div>

      {/* Logout Button - Always Visible at Bottom */}
      <div className="flex-shrink-0 mt-auto pt-4">
        <button
          className="flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-1.5 cursor-pointer text-sm hover:bg-gray-200 text-[#696969] shadow-none"
          onClick={(e) => logout(e)}
        >
          <fiIcons.FiLogOut /> <p className="text-md font-semibold hidden md:block">Log out</p>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
