import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import ConfirmationModal from "../../components/ConfirmationModal";
import useActionGuard from "../../hooks/useActionGuard";

const Switch = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [canSwitchAdmin, setCanSwitchAdmin] = useState(false);
  const [canSwitchStudent, setCanSwitchStudent] = useState(false);
  const [canSwitchTutor, setCanSwitchTutor] = useState(false);
  const [currentViewRole, setCurrentViewRole] = useState("tutor");
  const [loginPhoto, setLoginPhoto] = useState(null);
  const { run: runAction, busy: actionBusy } = useActionGuard();
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

    fetchLoginPhoto();
  }, []);

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
      const isAdmin = Boolean(data?.is_admin && !data?.is_superadmin);
      const isTutor = String(data?.role || "").toLowerCase() === "tutor";
      setCanSwitchAdmin(isAdmin);
      setCanSwitchStudent(isTutor);
      setCanSwitchTutor(isTutor);
      setCurrentViewRole((storedOverride || data?.role || "tutor").toLowerCase());
    } catch (err) {
      console.error("Error checking admin permissions:", err.message);
      setCanSwitchAdmin(false);
      setCanSwitchStudent(false);
      setCanSwitchTutor(false);
      setCurrentViewRole("tutor");
    }
  }, [ROLE_OVERRIDE_KEY]);

  useEffect(() => {
    fetchAdminPermissions();
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
        setCurrentViewRole((event.newValue || "tutor").toLowerCase());
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

  const handleSwitchClick = () => {
    setIsModalOpen(true);
  };

  const handleAdminSwitchClick = () => {
    setIsAdminModalOpen(true);
  };

  const handleSwitchToTutor = () => {
    runAction(async () => {
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

      window.dispatchEvent(new CustomEvent("roleChanged", { detail: { newRole: "tutor" } }));
      try {
        localStorage.setItem(ROLE_OVERRIDE_KEY, "tutor");
        localStorage.removeItem(ROLE_OVERRIDE_PREV_KEY);
      } catch (err) {
        // Ignore storage errors
      }
      navigate("/dashboard");
    }, "Failed to switch to tutor.");
  };

  const syncStudentProfile = async (userId) => {
    try {
      const { data: tutorProfile, error: tutorProfileError } = await supabase
        .from("profile")
        .select("program, college, year_level, profile_image")
        .eq("user_id", userId)
        .single();

      if (tutorProfileError && tutorProfileError.code !== "PGRST116") {
        throw tutorProfileError;
      }

      if (!tutorProfile) {
        return;
      }

      const payload = {
        program: tutorProfile.program || "",
        college: tutorProfile.college || "",
        year_level: tutorProfile.year_level || "",
        profile_image: tutorProfile.profile_image || "",
      };

      const { data: studentProfile, error: studentProfileError } = await supabase
        .from("student_profile")
        .select("profile_id")
        .eq("user_id", userId)
        .single();

      if (
        studentProfileError &&
        studentProfileError.code !== "PGRST116" &&
        studentProfileError.status !== 406
      ) {
        throw studentProfileError;
      }

      if (studentProfile) {
        const { error: updateError } = await supabase
          .from("student_profile")
          .update(payload)
          .eq("user_id", userId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("student_profile")
          .insert([{ user_id: userId, ...payload }]);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error("Error syncing student profile:", error);
      throw error;
    }
  };

  const handleConfirmSwitch = () => {
    runAction(async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          alert("You must be logged in to switch roles");
          return;
        }

        const userId = session.user.id;

        await syncStudentProfile(userId);

        // Role will be updated in App.jsx when it detects the change
        setIsModalOpen(false);
        
        // Dispatch custom event to notify App component of role change
        window.dispatchEvent(new CustomEvent('roleChanged', { detail: { newRole: 'student' } }));

        try {
          localStorage.setItem(ROLE_OVERRIDE_KEY, "student");
        } catch (err) {
          // Ignore storage errors
        }
        
        // Navigate to dashboard to trigger role-based routing
        navigate("/dashboard");
      } catch (error) {
        console.error("Error switching role:", error);
        alert("Failed to switch role. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }, "Failed to switch role.");
  };

  const handleCancelSwitch = () => {
    setIsModalOpen(false);
  };

  const handleConfirmAdminSwitch = () => {
    runAction(async () => {
      setIsAdminLoading(true);
      try {
        try {
          localStorage.setItem(ROLE_OVERRIDE_PREV_KEY, "tutor");
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
    }, "Failed to switch to admin.");
  };

  const handleCancelAdminSwitch = () => {
    setIsAdminModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f9f0] py-10 px-6 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="bg-white/85 backdrop-blur rounded-2xl border border-[#e5e8f2] shadow-lg shadow-blue-100 p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest">
                Role Switch
              </p>
              <h1 className="text-3xl font-bold text-gray-800">Switch to Student</h1>
              <p className="text-gray-600 max-w-xl">
                Move to the student experience to book tutors, manage your sessions, and submit evaluations.
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
                  <p className="text-lg font-semibold">Tutor</p>
                </div>
                <div className="text-3xl">⇆</div>
              </div>
              <div className="space-y-2 text-sm text-blue-50">
                <p>Switch to student to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Book sessions as a tutee</li>
                  <li>View tutor availability</li>
                  <li>Submit evaluations</li>
                </ul>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                {canSwitchTutor && currentViewRole !== "tutor" && (
                  <button
                    onClick={handleSwitchToTutor}
                    disabled={actionBusy}
                    className="w-full rounded-lg border border-white/60 text-white/90 py-2 hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Switch to Tutor
                  </button>
                )}
                {canSwitchStudent && currentViewRole !== "student" && (
                  <button
                    onClick={handleSwitchClick}
                    disabled={isLoading || actionBusy}
                    className="lav-btn lav-btn-primary w-full shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Switching..." : "Switch to Student"}
                  </button>
                )}
                {canSwitchAdmin && currentViewRole !== "admin" && (
                  <button
                    onClick={handleAdminSwitchClick}
                    disabled={isAdminLoading || actionBusy}
                    className="w-full rounded-lg border border-white/60 text-white/90 py-2 hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isAdminLoading ? "Switching..." : "Switch to Admin"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={handleCancelSwitch}
        onConfirm={handleConfirmSwitch}
        title="Confirm role switch"
        message="You are about to switch to the Student interface. This keeps your main role and switches your dashboard view. Continue?"
        confirmText="Yes, switch me"
        cancelText="Stay as Tutor"
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
