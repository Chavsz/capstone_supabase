import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import RouteSelect from "./RouteSelect";

import * as fiIcons from "react-icons/fi";

const Sidebar = ({ setAuth, onClose }) => {
  const navigate = useNavigate();

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

  return (
    <div className="flex flex-col p-4 text-[#181718] sticky top-0 bg-[#76acf5] h-screen w-[240px] shadow-xl">
      {/* Mobile Close Button */}
      <div className="flex justify-between items-center mb-4 md:hidden flex-shrink-0">
        <h1 className="text-xl font-bold text-[#181718]">LAV</h1>
        <button
          onClick={onClose}
          className="p-2 text-[#f1eec8] hover:bg-white/30 rounded"
          aria-label="Close menu"
        >
          <fiIcons.FiX className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop Title */}
      <div className="flex-shrink-0 hidden md:block">
        <h1 className="text-xl md:text-2xl font-bold text-center text-[#f5edbd] mb-9">LAV</h1>
      </div>

      {/* Menu Items - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <RouteSelect onClose={onClose} />
      </div>

      {/* Logout Button - Always Visible at Bottom */}
      <div className="flex-shrink-0 mt-auto pt-4">
        <button
          className="flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-1.5 md:text-sm text-1xl hover:bg-white/30 text-[#181718] shadow-none"
          onClick={(e) => logout(e)}
        >
          <fiIcons.FiLogOut /> <p className="text-md font-semibold hidden md:block">Log out</p>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
