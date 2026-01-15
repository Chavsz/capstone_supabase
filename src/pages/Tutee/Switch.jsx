import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import useActionGuard from "../../hooks/useActionGuard";

const Switch = () => {
  const [canSwitchAdmin, setCanSwitchAdmin] = useState(false);
  const [canSwitchStudent, setCanSwitchStudent] = useState(false);
  const [canSwitchTutor, setCanSwitchTutor] = useState(false);
  const [currentViewRole, setCurrentViewRole] = useState("student");
  const [switchChecked, setSwitchChecked] = useState(false);
  const [loginPhoto, setLoginPhoto] = useState(null);
  const { run: runAction, busy: actionBusy } = useActionGuard();
  const navigate = useNavigate();
  const ROLE_OVERRIDE_KEY = "lav.roleOverride";
  const ROLE_OVERRIDE_PREV_KEY = "lav.roleOverridePrev";

  const fetchAdminPermissions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("users")
        .select("role, is_admin, is_superadmin")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const storedOverride = localStorage.getItem(ROLE_OVERRIDE_KEY);
      const role = String(data?.role || "").toLowerCase();
      const isStudent = role === "student";
      const isTutor = role === "tutor";
      setCanSwitchAdmin(Boolean(data?.is_admin && !data?.is_superadmin));
      setCanSwitchStudent(isStudent);
      setCanSwitchTutor(isTutor);
      setCurrentViewRole((storedOverride || data?.role || "student").toLowerCase());
    } catch (err) {
      console.error("Error checking admin permissions:", err.message);
      setCanSwitchAdmin(false);
      setCanSwitchStudent(false);
      setCanSwitchTutor(false);
      setCurrentViewRole("student");
    } finally {
      setSwitchChecked(true);
    }
  }, [ROLE_OVERRIDE_KEY]);

  useEffect(() => {

    const fetchLoginPhoto = async () => {
      try {
        const { data, error } = await supabase
          .from("landing")
          .select("login_photo")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data?.login_photo) {
          setLoginPhoto(data.login_photo);
        }
      } catch (err) {
        console.error("Unable to load login photo:", err.message);
      }
    };

    fetchAdminPermissions();
    fetchLoginPhoto();
  }, [fetchAdminPermissions]);

  useEffect(() => {
    const handleRoleChange = (event) => {
      const nextRole = event.detail?.newRole;
      if (nextRole) {
        setCurrentViewRole(String(nextRole).toLowerCase());
        fetchAdminPermissions();
      }
    };

    const handleStorage = (event) => {
      if (event.key === ROLE_OVERRIDE_KEY) {
        setCurrentViewRole((event.newValue || "student").toLowerCase());
        fetchAdminPermissions();
      }
    };

    window.addEventListener("roleChanged", handleRoleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("roleChanged", handleRoleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [ROLE_OVERRIDE_KEY, fetchAdminPermissions]);

  useEffect(() => {
    if (!switchChecked) return;
    if (!canSwitchAdmin && !canSwitchTutor) {
      navigate("/dashboard", { replace: true });
    }
  }, [canSwitchAdmin, canSwitchTutor, navigate, switchChecked]);

  const handleSwitchToTutor = () => {
    runAction(async () => {
      try {
        localStorage.setItem(ROLE_OVERRIDE_PREV_KEY, "student");
        localStorage.setItem(ROLE_OVERRIDE_KEY, "tutor");
      } catch (err) {
        // Ignore storage errors
      }
      window.dispatchEvent(new CustomEvent("roleChanged", { detail: { newRole: "tutor" } }));
      navigate("/dashboard");
    }, "Failed to switch to tutor.");
  };

  const handleSwitchToAdmin = () => {
    runAction(async () => {
      try {
        localStorage.setItem(ROLE_OVERRIDE_PREV_KEY, "student");
        localStorage.setItem(ROLE_OVERRIDE_KEY, "admin");
      } catch (err) {
        // Ignore storage errors
      }
      window.dispatchEvent(new CustomEvent("roleChanged", { detail: { newRole: "admin" } }));
      navigate("/dashboard");
    }, "Failed to switch to admin.");
  };

  const handleStayStudent = () => {
    runAction(async () => {
      try {
        localStorage.setItem(ROLE_OVERRIDE_KEY, "student");
        localStorage.removeItem(ROLE_OVERRIDE_PREV_KEY);
      } catch (err) {
        // Ignore storage errors
      }
      window.dispatchEvent(new CustomEvent("roleChanged", { detail: { newRole: "student" } }));
      navigate("/dashboard");
    }, "Failed to stay on student view.");
  };

  if (switchChecked && !canSwitchAdmin && !canSwitchTutor) {
    return null;
  }

  const canSwitchToAdmin = canSwitchAdmin && currentViewRole !== "admin";
  const canSwitchToTutor = canSwitchTutor && currentViewRole !== "tutor";
  const canSwitchToStudent = canSwitchStudent && currentViewRole !== "student";
  const primaryTitle = canSwitchToTutor
    ? "Switch to Tutor"
    : canSwitchToAdmin
      ? "Switch to Admin"
      : "Role Switch";

  return (
    <div className="min-h-screen bg-[#f8f9f0] py-10 px-6 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="bg-white/85 backdrop-blur rounded-2xl border border-[#e5e8f2] shadow-lg shadow-blue-100 p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest">
                Role Switch
              </p>
              <h1 className="text-3xl font-bold text-gray-800">{primaryTitle}</h1>
              <p className="text-gray-600">
                Switch between roles based on your access.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-blue-700">
                <span className="px-2 py-1 rounded-full bg-blue-50 border border-blue-100">Keeps profile synced</span>
                <span className="px-2 py-1 rounded-full bg-blue-50 border border-blue-100">Requires confirmation</span>
                <span className="px-2 py-1 rounded-full bg-blue-50 border border-blue-100">Instant redirect</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl p-6 w-full md:w-80 shadow-lg">
              {loginPhoto && (
                <div className="mb-4 rounded-xl overflow-hidden border border-white/30 shadow-md">
                  <img
                    src={loginPhoto}
                    alt="Login visual"
                    className="w-full h-36 object-cover"
                  />
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-blue-100">Current role</p>
                  <p className="text-lg font-semibold">
                    {currentViewRole.charAt(0).toUpperCase() + currentViewRole.slice(1)}
                  </p>
                </div>
                <div className="text-3xl">⇄</div>
              </div>
              <div className="space-y-2 text-sm text-blue-50">
                {canSwitchToTutor && !canSwitchToAdmin && (
                  <>
                    <p>Switch to tutor to:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Host tutoring sessions</li>
                      <li>Manage availability</li>
                      <li>Support your tutees</li>
                    </ul>
                  </>
                )}
                {canSwitchToAdmin && !canSwitchToTutor && (
                  <>
                    <p>Switch to admin to:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Access admin insights</li>
                      <li>Manage reports</li>
                      <li>Switch back anytime</li>
                    </ul>
                  </>
                )}
                {canSwitchToAdmin && canSwitchToTutor && (
                  <>
                    <p>Choose a role to continue:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Tutor: manage sessions and availability</li>
                      <li>Admin: manage reports and insights</li>
                    </ul>
                  </>
                )}
              </div>
              {canSwitchToAdmin && (
                <button
                  onClick={handleSwitchToAdmin}
                  disabled={actionBusy}
                  className="mt-6 w-full rounded-xl bg-[#f7d53a] text-gray-900 font-semibold py-2.5 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Switch to Admin
                </button>
              )}
              {canSwitchToTutor && (
                <button
                  onClick={handleSwitchToTutor}
                  disabled={actionBusy}
                  className="mt-3 w-full rounded-xl border border-white/60 text-white/90 py-2 hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Switch to Tutor
                </button>
              )}
              {canSwitchToStudent && (
                <button
                  onClick={handleStayStudent}
                  disabled={actionBusy}
                  className="mt-3 w-full rounded-xl border border-white/60 text-white/90 py-2 hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Switch to Student
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Switch;
