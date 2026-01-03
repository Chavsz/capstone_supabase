import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../../supabase-client";

import * as mdIcons from "react-icons/md";
import * as piIcons from "react-icons/pi";
import { RiCalendarScheduleLine } from "react-icons/ri";

const RouteSelect = ({ onClose }) => {
  const [canSwitchToTutor, setCanSwitchToTutor] = useState(false);
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    const checkCanSwitch = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const [{ data: userData, error: userError }, { data: tutorProfile }] =
          await Promise.all([
            supabase
              .from("users")
              .select("role")
              .eq("user_id", session.user.id)
              .single(),
            supabase
              .from("profile")
              .select("profile_id")
              .eq("user_id", session.user.id)
              .single(),
          ]);

        if (userError) throw userError;

        const studentRole = (userData?.role || "").toLowerCase() === "student";
        setIsStudent(studentRole);
        setCanSwitchToTutor(!studentRole && !!tutorProfile);
      } catch (err) {
        console.error("Error checking tutor profile:", err);
        setCanSwitchToTutor(false);
      }
    };

    // Check on mount and when capability flags change
    checkCanSwitch();

    const onCanSwitchUpdated = () => checkCanSwitch();

    window.addEventListener("canSwitchUpdated", onCanSwitchUpdated);

    return () => {
      window.removeEventListener("canSwitchUpdated", onCanSwitchUpdated);
    };
  }, []);

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-white/80 hidden md:block tracking-wide">MENU</p>

      <Route
        to="/dashboard"
        Icon={mdIcons.MdOutlineDashboard}
        title="Dashboard"
        onClose={onClose}
      />
      <Route
        to="/dashboard/appointment"
        Icon={mdIcons.MdCalendarMonth}
        title="Appointment"
        onClose={onClose}
      />
      <Route
        to="/dashboard/schedules"
        Icon={RiCalendarScheduleLine}
        title="Schedules"
        onClose={onClose}
      />
      {!isStudent && canSwitchToTutor && (
        <Route
          to="/dashboard/switch"
          Icon={piIcons.PiUserSwitchBold}
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
        `flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-2 md:py-1.5 md:text-sm text-1xl transition-all duration-300 ${
          isActive
            ? "bg-white/20 text-white shadow"
            : "text-white hover:bg-[#f9d31a] hover:text-[#181718]"
        }`
      }
      onClick={() => {
        if (onClose) onClose();
      }}
    >
      {({ isActive }) => (
        <>
          <Icon className={isActive ? "text-[#f9d31a]" : "text-white"} />
          <p className="text-md font-semibold hidden md:block">{title}</p>
        </>
      )}
    </NavLink>
  );
};

export default RouteSelect;
