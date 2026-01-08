import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../../supabase-client";

import * as mdIcons from "react-icons/md";
import { PiUserSwitchBold } from "react-icons/pi";
import { RiCalendarScheduleLine } from "react-icons/ri";

const RouteSelect = ({ onClose }) => {
  const location = useLocation();
  const [canSwitchTutor, setCanSwitchTutor] = React.useState(false);

  React.useEffect(() => {
    const fetchSwitchAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("is_admin, is_superadmin")
          .eq("user_id", session.user.id)
          .single();

        if (userError && userError.code !== "PGRST116") {
          throw userError;
        }

        const isAdmin = Boolean(userData?.is_admin || userData?.is_superadmin);
        const { data: tutorProfile } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("user_id", session.user.id)
          .single();

        setCanSwitchTutor(Boolean(tutorProfile));
      } catch (err) {
        console.error("Unable to check switch access:", err.message);
        setCanSwitchTutor(false);
      }
    };

    fetchSwitchAccess();
  }, []);

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-white/80 hidden md:block tracking-wide">MENU</p>

      <Route
        to="/dashboard"
        Icon={mdIcons.MdOutlineDashboard}
        title="Dashboard"
        isActive={location.pathname === "/dashboard"}
        onClose={onClose}
      />
      <Route
        to="/dashboard/appointment"
        Icon={mdIcons.MdCalendarMonth}
        title="Appointment"
        isActive={location.pathname === "/dashboard/appointment"}
        onClose={onClose}
      />
      <Route
        to="/dashboard/schedules"
        Icon={RiCalendarScheduleLine}
        title="Schedules"
        isActive={location.pathname === "/dashboard/schedules"}
        onClose={onClose}
      />
      {canSwitchTutor && (
        <Route
          to="/dashboard/switch"
          Icon={PiUserSwitchBold}
          title="Switch"
          isActive={location.pathname === "/dashboard/switch"}
          onClose={onClose}
        />
      )}
    </div>
  );
};

const Route = ({ to, Icon, title, isActive, onClose }) => {
  return (
    <NavLink
      to={to}
      className={`flex items-center md:justify-start justify-center gap-2 w-full rounded px-2 py-2 md:py-1.5 md:text-sm text-1xl transition-all duration-300 ${
        isActive
          ? "bg-white/20 text-white shadow"
          : "text-white hover:bg-[#f9d31a] hover:text-[#181718]"
      }`}
      onClick={() => {
        if (onClose) onClose();
      }}
    >
      <Icon className={isActive ? "text-[#f9d31a]" : "text-white"} />
      <p className="text-md font-semibold hidden md:block">{title}</p>
    </NavLink>
  );
};

export default RouteSelect;
