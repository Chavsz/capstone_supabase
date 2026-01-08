import React from "react";
import { NavLink } from "react-router-dom";

//icons
import * as mdIcons from "react-icons/md";
import * as piIcons from "react-icons/pi";
import { FaComment } from "react-icons/fa";

const RouteSelect = ({ onClose }) => {
  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-[#181718]/70 hidden md:block">MENU</p>

      <Route
        to="/dashboard"
        Icon={mdIcons.MdOutlineDashboard}
        title="Dashboard"
        onClose={onClose}
      />
      <Route
        to="/dashboard/schedule"
        Icon={mdIcons.MdCalendarMonth}
        title="Schedule"
        onClose={onClose}
      />
      <Route
        to="/dashboard/comments"
        Icon={FaComment}
        title="Comments"
        onClose={onClose}
      />
      <Route
        to="/dashboard/switch"
        Icon={piIcons.PiUserSwitchBold}
        
        onClose={onClose}
      />
    </div>
  );
};

const Route = ({ to, Icon, title, onClose }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-2 md:py-1.5 md:text-sm text-1xl transition-all duration-300 ${
          isActive
            ? "bg-black/10 text-[#181718] shadow"
            : "hover:bg-black/10 text-[#181718]/80 shadow-none"
        }`
      }
      onClick={() => {
        if (onClose) onClose();
      }}
    >
      {({ isActive }) => (
        <>
          <Icon className={isActive ? "text-[#181718]" : "text-[#181718]/70"} />
          <p className="text-md font-semibold hidden md:block">{title}</p>
        </>
      )}
    </NavLink>
  );
};

export default RouteSelect;
