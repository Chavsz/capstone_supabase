import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";

// components
import Sidebar from "./Sidebar";

// Tutor Pages
import TutorDashboard from "./TutorDashboard";
import Profile from "./Profile";
import Schedules from "./Schedule";
import Header from "./Header";
import Switch from "./Switch";

function TutorPage({ setAuth }) {
  return (
    <div className="grid grid-cols-[80px_1fr] md:grid-cols-[240px_1fr] transition-width duration-300 bg-white min-h-screen">
      <div>
        <Sidebar setAuth={setAuth} />
      </div>
      <div className="flex flex-col">
        <Header />
        <div className="flex-1">
          <Routes>
            <Route
              exact
              path="/"
              element={<TutorDashboard setAuth={setAuth} />}
            />
            <Route exact path="/profile" element={<Profile />} />
            <Route exact path="/schedules" element={<Schedules />} />
            <Route exact path="/switch" element={<Switch />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default TutorPage;
