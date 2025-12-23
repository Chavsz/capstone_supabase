import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import ConfirmationModal from "../../components/ConfirmationModal";

const Switch = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
   const [loginPhoto, setLoginPhoto] = useState(null);
  const navigate = useNavigate();

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

  const handleSwitchClick = () => {
    setIsModalOpen(true);
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

  const handleConfirmSwitch = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("You must be logged in to switch roles");
        return;
      }

      const userId = session.user.id;

      // Update role in users table
      const { error } = await supabase
        .from("users")
        .update({ role: "student" })
        .eq("user_id", userId);

      if (error) throw error;

      await syncStudentProfile(userId);

      // Role will be updated in App.jsx when it detects the change
      setIsModalOpen(false);
      
      // Dispatch custom event to notify App component of role change
      window.dispatchEvent(new CustomEvent('roleChanged', { detail: { newRole: 'student' } }));
      
      // Navigate to dashboard to trigger role-based routing
      navigate("/dashboard");
    } catch (error) {
      console.error("Error switching role:", error);
      alert("Failed to switch role. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSwitch = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9f0] via-[#f7f1ea] to-[#f8f9f0] py-10 px-6 flex items-center justify-center">
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
                You can switch back to the tutor view anytime if your account permits.
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
              <button
                onClick={handleSwitchClick}
                disabled={isLoading}
                className="lav-btn lav-btn-primary mt-6 w-full shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Switching..." : "Switch to Student"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={handleCancelSwitch}
        onConfirm={handleConfirmSwitch}
        title="Confirm role switch"
        message="You are about to switch to the Student interface. This updates your role in the database and will log you into the student dashboard. Continue?"
        confirmText="Yes, switch me"
        cancelText="Stay as Tutor"
      />
    </div>
  );
};

export default Switch;
