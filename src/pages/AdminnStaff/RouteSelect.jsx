import React from "react";
import { NavLink } from "react-router-dom";

import * as mdIcons from "react-icons/md";
import * as fiIcons from "react-icons/fi";
import * as faIcons from "react-icons/fa";

const RouteSelect = ({ onClose, canSwitchAdmin }) => {
  return (
    <div className="space-y-1">
      <p className="text-[13px] font-extralight text-[#696969] hidden md:block">MENU</p>
      <Route
        to="/dashboard"
        Icon={mdIcons.MdOutlineDashboard}
        title="Dashboard"
        onClose={onClose}
      />
     
      <Route
        to="/dashboard/lav-room"
        Icon={faIcons.FaCalendarCheck}
        title="LAV Room"
        onClose={onClose}
      />
      <Route
        to="/dashboard/reports"
        Icon={fiIcons.FiBarChart2}
        title="Reports"
        onClose={onClose}
      />
      <Route
        to="/dashboard/users"
        Icon={fiIcons.FiUsers}
        title="Users"
        onClose={onClose}
      />
      <Route
        to="/dashboard/landingadmin"
        Icon={mdIcons.MdHome}
        title="Landing"
        onClose={onClose}
      />
      <Route
        to="/dashboard/announcments"
        Icon={faIcons.FaVolumeUp}
        title="Announcements"
        onClose={onClose}
      />
      <Route
        to="/dashboard/event"
        Icon={faIcons.FaBullhorn}
        title="Events"
        onClose={onClose}
      />
      {canSwitchAdmin && (
        <Route
          to="/dashboard/switch-admin"
          Icon={mdIcons.MdSwapHoriz}
          title="Switch"
          onClose={onClose}
        />
      )}
    </div>
  );
};

const Route = ({ to, Icon, title, onClose }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-2 md:py-1.5 md:text-sm text-1xl transition-colors duration-200 ${
          isActive
            ? "bg-gray-200 text-gray-600 shadow"
            : "hover:bg-gray-200 text-[#696969] shadow-none"
        }`
      }
      onClick={() => {
        if (onClose) onClose();
      }}
    >
      {({ isActive }) => (
        <>
          <Icon className={isActive ? "text-blue-600" : ""} />
          <p className="text-md font-semibold hidden md:block">{title}</p>
        </>
      )}
    </NavLink>
  );
};

export default RouteSelect;
