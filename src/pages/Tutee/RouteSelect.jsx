import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabase-client";

import * as mdIcons from "react-icons/md";
import * as piIcons from "react-icons/pi";
import { RiCalendarScheduleLine } from "react-icons/ri";

const RouteSelect = () => {
  const [selected, setSelected] = useState(window.location.pathname);
  const [canSwitchToTutor, setCanSwitchToTutor] = useState(false);

  useEffect(() => {
    const checkCanSwitch = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: tutorProfile } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("user_id", session.user.id)
          .single();

        setCanSwitchToTutor(!!tutorProfile);
      } catch (err) {
        console.error("Error checking tutor profile:", err);
        setCanSwitchToTutor(false);
      }
    };

    const updateFlag = (event) => {
      if (event && event.detail) {
        setCanSwitchToTutor(event.detail.value === true || event.detail.value === "true");
      } else {
        checkCanSwitch();
      }
    };

    // Check on mount
    checkCanSwitch();

    // Update when capability flags change
    const onCanSwitchUpdated = (event) => updateFlag(event);

    window.addEventListener("canSwitchUpdated", onCanSwitchUpdated);

    return () => {
      window.removeEventListener("canSwitchUpdated", onCanSwitchUpdated);
    };
  }, []);

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
      />
      <Route
        to="/dashboard/appointment"
        selected={selected === "/dashboard/appointment"}
        Icon={mdIcons.MdCalendarMonth}
        title="Appointment"
        handleSelect={handleSelect}
      />
      <Route
        to="/dashboard/schedules"
        selected={selected === "/dashboard/schedules"}
        Icon={RiCalendarScheduleLine}
        title="Schedules"
        handleSelect={handleSelect}
      />
      {canSwitchToTutor && (
        <Route
          to="/dashboard/switch"
          selected={selected === "/dashboard/switch"}
          Icon={piIcons.PiUserSwitchBold}
          title="Switch"
          handleSelect={handleSelect}
        />
      )}
    </div>
  );
};

const Route = ({ to, selected, Icon, title, handleSelect }) => {
  return (
    <Link
      to={to}
      className={`flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-2 md:py-1.5 md:text-sm text-1xl transition-all duration-300 ${
        selected
          ? "bg-gray-200 text-gray-600 shadow"
          : "hover:bg-gray-200 text-[#696969] shadow-none"
      }`}
      onClick={() => handleSelect(to)}  
    >
      <Icon className={`${selected ? "text-blue-600" : ""}`} />
      <p className="text-md font-semibold hidden md:block">{title}</p>
    </Link>
  );
};

export default RouteSelect;
