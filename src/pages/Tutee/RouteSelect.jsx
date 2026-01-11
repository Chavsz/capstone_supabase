import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../../supabase-client";

import * as mdIcons from "react-icons/md";
import { PiUserSwitchBold } from "react-icons/pi";
import { RiCalendarScheduleLine } from "react-icons/ri";

const RouteSelect = ({ onClose }) => {
  const location = useLocation();
  const [canShowSwitch, setCanShowSwitch] = React.useState(false);

  const fetchSwitchAccess = React.useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role, is_admin, is_superadmin")
        .eq("user_id", session.user.id)
        .single();

      if (userError && userError.code !== "PGRST116") {
        throw userError;
      }

      const isAdmin = Boolean(userData?.is_admin && !userData?.is_superadmin);
      const isStudent = String(userData?.role || "").toLowerCase() === "student";
      setCanShowSwitch(Boolean(isAdmin && isStudent));
    } catch (err) {
      console.error("Unable to check switch access:", err.message);
      setCanShowSwitch(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSwitchAccess();
  }, [fetchSwitchAccess]);

  React.useEffect(() => {
    const handleRoleChange = () => {
      fetchSwitchAccess();
    };

    window.addEventListener("roleChanged", handleRoleChange);
    window.addEventListener("storage", handleRoleChange);
    return () => {
      window.removeEventListener("roleChanged", handleRoleChange);
      window.removeEventListener("storage", handleRoleChange);
    };
  }, [fetchSwitchAccess]);

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
      {canShowSwitch && (
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
          : "text-white hover:bg-white/20 hover:text-white"
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
