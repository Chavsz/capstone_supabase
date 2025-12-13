import { useState } from "react";
import { Routes, Route } from "react-router-dom";

import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import Landing from "./Landing";
import Lavroom from "./Lavroom";
import Users from "./Users";
import Event from "./Event";
import Announcments from "./Announcments";
import Reports from "./Reports";

import * as fiIcons from "react-icons/fi";

function AdminPage({ setAuth }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="bg-[#f8fcff] min-h-screen">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-md shadow-md text-gray-600 hover:bg-gray-100"
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
          className={`fixed md:static inset-y-0 right-0 z-50 transform transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar setAuth={setAuth} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main Content */}
        <div className="w-full">
          <Routes>
            <Route
              exact
              path="/"
              element={<Dashboard setAuth={setAuth} />}
            />
            <Route exact path="/landingadmin" element={<Landing />} />
            <Route exact path="/lavroom" element={<Lavroom />} />
            <Route exact path="/reports" element={<Reports />} />
            <Route exact path="/event" element={<Event />} />
            <Route exact path="/announcments" element={<Announcments />} />
            <Route exact path="/users" element={<Users />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
