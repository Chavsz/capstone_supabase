import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

// components
import Sidebar from "./Sidebar";

// Tutor Pages
import Header from "./Header";

import * as fiIcons from "react-icons/fi";

function TutorPage({ setAuth }) {
  const location = useLocation();
  const isProfilePage = location.pathname.includes("/profile");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="bg-[#f8f9f0] min-h-screen">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md text-gray-600 hover:bg-gray-100"
        aria-label="Toggle menu"
      >
        <fiIcons.FiMenu className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] transition-width duration-300">
        {/* Sidebar */}
        <div
          className={`fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar setAuth={setAuth} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main Content */}
        <div className="w-full flex flex-col">
          {!isProfilePage && <Header />}
          <div className="flex-1">
            <div key={location.pathname}>
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TutorPage;
