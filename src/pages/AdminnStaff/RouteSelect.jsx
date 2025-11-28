import React, { useState } from "react";
import { Link } from "react-router-dom";

import * as mdIcons from "react-icons/md";
import * as fiIcons from "react-icons/fi";

const RouteSelect = ({ onClose }) => {
  const [selected, setSelected] = useState(window.location.pathname);

  const handleSelect = (to) => {
    setSelected(to);
  };

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-extralight text-[#696969] hidden md:block">MENU</p>
      <Route
        to="/dashboard"
        selected={selected === "/dashboard"}
        Icon={mdIcons.MdOutlineDashboard}
        title="Dashboard"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      <Route
        to="/dashboard/lavroom"
        selected={selected === "/dashboard/lavroom"}
        Icon={mdIcons.MdCalendarMonth}
        title="Lavroom"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      <Route
        to="/dashboard/users"
        selected={selected === "/dashboard/users"}
        Icon={fiIcons.FiUsers}
        title="Users"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      <Route
        to="/dashboard/landingadmin"
        selected={selected === "/dashboard/landingadmin"}
        Icon={mdIcons.MdHome}
        title="Landing"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      <Route
        to="/dashboard/announcments"
        selected={selected === "/dashboard/announcments"}
        Icon={mdIcons.MdOutlineAnnouncement}
        title="Announcements"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      <Route
        to="/dashboard/event"
        selected={selected === "/dashboard/event"}
        Icon={mdIcons.MdOutlineAnnouncement}
        title="Events"
        handleSelect={handleSelect}
        onClose={onClose}
      />
    </div>
  );
};

const Route = ({ to, selected, Icon, title, handleSelect, onClose }) => {
  return (
    <Link
      to={to}
      className={`flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-2 md:py-1.5 md:text-sm text-1xl transition-all duration-300 ${
        selected
          ? "bg-gray-200 text-gray-600 shadow"
          : "hover:bg-gray-200 text-[#696969] shadow-none"
      }`}
      onClick={() => {
        handleSelect(to);
        if (onClose) onClose(); // Close mobile menu on navigation
      }}
    >
      <Icon className={`${selected ? "text-blue-600" : ""}`} />
      <p className="text-md font-semibold hidden md:block">{title}</p>
    </Link>
  );
};

export default RouteSelect;
