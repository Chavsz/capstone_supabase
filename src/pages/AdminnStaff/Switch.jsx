import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";

const Switch = () => {
  const [loginPhoto, setLoginPhoto] = useState(null);
  const [canSwitchAdmin, setCanSwitchAdmin] = useState(false);
  const [currentViewRole, setCurrentViewRole] = useState("admin");
  const navigate = useNavigate();
  const ROLE_OVERRIDE_KEY = "lav.roleOverride";
  const ROLE_OVERRIDE_PREV_KEY = "lav.roleOverridePrev";

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

    const fetchAdminPermissions = async () => {
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
        setCanSwitchAdmin(Boolean(data?.is_admin && !data?.is_superadmin));
        setCurrentViewRole((storedOverride || data?.role || "admin").toLowerCase());
      } catch (err) {
        console.error("Error checking admin permissions:", err.message);
        setCanSwitchAdmin(false);
        setCurrentViewRole("admin");
      }
    };

    fetchLoginPhoto();
    fetchAdminPermissions();
  }, []);

  const handleSwitchToRole = (role) => {
    if (!canSwitchAdmin) return;
    try {
      localStorage.setItem(ROLE_OVERRIDE_PREV_KEY, "admin");
      localStorage.setItem(ROLE_OVERRIDE_KEY, role);
    } catch (err) {
      // Ignore storage errors
    }
    window.dispatchEvent(new CustomEvent("roleChanged", { detail: { newRole: role } }));
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#f8f9f0] py-10 px-6 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        {!canSwitchAdmin ? (
          <div className="bg-white/85 backdrop-blur rounded-2xl border border-[#e5e8f2] shadow-lg shadow-blue-100 p-6 md:p-10 text-center text-gray-600">
            Switch is available only for admin accounts (not superadmin).
          </div>
        ) : (
        <div className="bg-white/85 backdrop-blur rounded-2xl border border-[#e5e8f2] shadow-lg shadow-blue-100 p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest">
                Role Switch
              </p>
              <h1 className="text-3xl font-bold text-gray-800">Switch to Tutor</h1>
              <p className="text-gray-600">
                Move to the tutor experience to host sessions, manage your availability,
                and support your tutees. You can switch to student if needed.
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
                  <p className="text-lg font-semibold">Admin</p>
                </div>
                <div className="text-3xl">⇄</div>
              </div>
              <div className="space-y-2 text-sm text-blue-50">
                <p>Switch to tutor to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Accept tutoring sessions</li>
                  <li>Manage availability</li>
                  <li>Support more learners</li>
                </ul>
              </div>
              {currentViewRole !== "tutor" && (
                <button
                  onClick={() => handleSwitchToRole("tutor")}
                  className="mt-6 w-full rounded-xl bg-[#f7d53a] text-gray-900 font-semibold py-2.5 shadow-md hover:shadow-lg"
                >
                  Switch to Tutor
                </button>
              )}
              {currentViewRole !== "student" && (
                <button
                  onClick={() => handleSwitchToRole("student")}
                  className="mt-3 w-full rounded-xl border border-white/60 text-white/90 py-2 hover:bg-white/10 transition"
                >
                  Switch to Student
                </button>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default Switch;
