import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import ConfirmationModal from "../../components/ConfirmationModal";

const Switch = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [canSwitchAdmin, setCanSwitchAdmin] = useState(false);
  const [canSwitchTutor, setCanSwitchTutor] = useState(false);
  const [loginPhoto, setLoginPhoto] = useState(null);
  const navigate = useNavigate();
  const ROLE_OVERRIDE_KEY = "lav.roleOverride";
  const ROLE_OVERRIDE_PREV_KEY = "lav.roleOverridePrev";

  useEffect(() => {
    const fetchAdminPermissions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data, error } = await supabase
          .from("users")
          .select("is_admin, is_superadmin")
          .eq("user_id", session.user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        setCanSwitchAdmin(Boolean(data?.is_admin && !data?.is_superadmin));
        const { data: tutorProfile } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("user_id", session.user.id)
          .single();
        setCanSwitchTutor(Boolean(tutorProfile));
      } catch (err) {
        console.error("Error checking admin permissions:", err.message);
        setCanSwitchAdmin(false);
        setCanSwitchTutor(false);
      }
    };

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
  }, []);

  const handleSwitchClick = () => {
    setIsModalOpen(true);
  };

  const handleAdminSwitchClick = () => {
    setIsAdminModalOpen(true);
  };

  const handleConfirmSwitch = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("You must be logged in to switch roles");
        return;
      }

      const { error } = await supabase
        .from("users")
        .update({ role: "tutor" })
        .eq("user_id", session.user.id);

      if (error) throw error;

      setIsModalOpen(false);
      window.dispatchEvent(new CustomEvent("roleChanged", { detail: { newRole: "tutor" } }));

      try {
        localStorage.setItem(ROLE_OVERRIDE_KEY, "tutor");
      } catch (err) {
        // Ignore storage errors
      }
      
      navigate("/dashboard");
    } catch (error) {
      console.error("Error switching role:", error);
      alert("Failed to switch role. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAdminSwitch = async () => {
    setIsAdminLoading(true);
    try {
      try {
        localStorage.setItem(ROLE_OVERRIDE_PREV_KEY, "student");
        localStorage.setItem(ROLE_OVERRIDE_KEY, "admin");
      } catch (err) {
        // Ignore storage errors
      }

      window.dispatchEvent(new CustomEvent("roleChanged", { detail: { newRole: "admin" } }));
      setIsAdminModalOpen(false);
      navigate("/dashboard");
    } catch (error) {
      console.error("Error switching to admin:", error);
      alert("Failed to switch to admin. Please try again.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleCancelSwitch = () => {
    setIsModalOpen(false);
  };

  const handleCancelAdminSwitch = () => {
    setIsAdminModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f9f0] py-10 px-6 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="bg-white/85 backdrop-blur rounded-2xl border border-[#e5e8f2] shadow-lg shadow-blue-100 p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest">
                Role Switch
              </p>
              <h1 className="text-3xl font-bold text-gray-800">Switch to Tutor</h1>
              <p className="text-gray-600">
                Move to the tutor experience to host sessions, manage your availability,
                and support your tutees. You can switch back if your account permits.
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
                  <p className="text-lg font-semibold">Student</p>
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
              <button
                onClick={handleSwitchClick}
                disabled={isLoading || !canSwitchTutor}
                className="mt-6 w-full rounded-xl bg-[#f7d53a] text-gray-900 font-semibold py-2.5 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Switching..." : "Switch to Tutor"}
              </button>
              {!canSwitchTutor && (
                <p className="mt-3 text-xs text-blue-100">
                  Switch back to tutor is available only if you previously had a tutor profile.
                </p>
              )}
              {canSwitchAdmin && (
                <button
                  onClick={handleAdminSwitchClick}
                  disabled={isAdminLoading}
                  className="mt-3 w-full rounded-xl border border-white/60 text-white/90 py-2 hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isAdminLoading ? "Switching..." : "Switch to Admin"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={handleCancelSwitch}
        onConfirm={handleConfirmSwitch}
        title="Switch to Tutor Role"
        message="Are you sure you want to switch to the Tutor interface? This will permanently change your role in the database and affect your available features."
        confirmText="Switch to Tutor"
        cancelText="Cancel"
      />

      <ConfirmationModal
        isOpen={isAdminModalOpen}
        onClose={handleCancelAdminSwitch}
        onConfirm={handleConfirmAdminSwitch}
        title="Switch to Admin Role"
        message="Switch to the Admin interface? This does not change your main role, but will open the admin dashboard until you switch back."
        confirmText="Switch to Admin"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Switch;
