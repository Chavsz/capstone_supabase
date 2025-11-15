import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import RouteSelect from "./RouteSelect";

import * as fiIcons from "react-icons/fi";

const Sidebar = ({ setAuth }) => {
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
    <div className="p-4 sticky top-0 bg-[#f0f5fa] h-screen">
      <div className="top-4 h-[calc(100vh-32px-50px)]">
        <h1 className="text-xl md:text-2xl font-bold text-center text-blue-600 mb-9">LAV</h1>

        <RouteSelect />
      </div>

      <div>
        <button
          className="flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-1.5 md:text-sm text-1xl hover:bg-[#e0ecfd] text-[#696969] shadow-none "
          onClick={(e) => logout(e)}
        >
          <fiIcons.FiLogOut /> <p className="text-md font-semibold hidden md:block">Log out</p>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
