import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";

import * as mdIcons from "react-icons/md";
import * as piIcons from "react-icons/pi";
import { RiCalendarScheduleLine } from "react-icons/ri";

const RouteSelect = ({ onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(location.pathname);
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

  useEffect(() => {
    setSelected(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    console.info("[Tutee RouteSelect] route", location.pathname);
  }, [location.pathname]);

  const handleSelect = (to) => {
    console.info("[Tutee RouteSelect] navigate", {
      from: location.pathname,
      to,
    });
    setSelected(to);
    navigate(to);
    if (onClose) onClose();
    setTimeout(() => {
      console.info("[Tutee RouteSelect] after navigate", {
        windowPath: window.location.pathname,
        routerPath: location.pathname,
      });
    }, 0);
  };

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-white/80 hidden md:block tracking-wide">MENU</p>

      <Route
        to="/dashboard"
        selected={selected === "/dashboard"}
        Icon={mdIcons.MdOutlineDashboard}
        title="Dashboard"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      <Route
        to="/dashboard/appointment"
        selected={selected === "/dashboard/appointment"}
        Icon={mdIcons.MdCalendarMonth}
        title="Appointment"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      <Route
        to="/dashboard/schedules"
        selected={selected === "/dashboard/schedules"}
        Icon={RiCalendarScheduleLine}
        title="Schedules"
        handleSelect={handleSelect}
        onClose={onClose}
      />
      {!isStudent && canSwitchToTutor && (
        <Route
          to="/dashboard/switch"
          selected={selected === "/dashboard/switch"}
          Icon={piIcons.PiUserSwitchBold}
          title="Switch"
          handleSelect={handleSelect}
          onClose={onClose}
        />
      )}
    </div>
  );
};

const Route = ({ to, selected, Icon, title, handleSelect }) => {
  return (
    <button
      type="button"
      className={`flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-2 md:py-1.5 md:text-sm text-1xl transition-all duration-300 ${
        selected
          ? "bg-white/20 text-white shadow"
          : "text-white hover:bg-[#f9d31a] hover:text-[#181718]"
      }`}
      onClick={() => handleSelect(to)}
    >
      <Icon className={`${selected ? "text-[#f9d31a]" : "text-white"}`} />
      <p className="text-md font-semibold hidden md:block">{title}</p>
    </button>
  );
};

export default RouteSelect;
