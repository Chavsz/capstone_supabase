import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import ConfirmationModal from "../../components/ConfirmationModal";

const Switch = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
    <div className="py-3 px-6">
      <h1 className="text-gray-600 font-bold text-2xl mb-6">Switch</h1>
      <div>
        <h1 className="text-sm font-medium text-gray-600 mb-2">Switch to Student</h1>
        <button 
          onClick={handleSwitchClick}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md cursor-pointer hover:bg-blue-700 hover:translate-y-[-2px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Switching..." : "Switch"}
        </button>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={handleCancelSwitch}
        onConfirm={handleConfirmSwitch}
        title="Switch to Student Role"
        message="Are you sure you want to switch to the Student interface? This will permanently change your role in the database and affect your available features."
        confirmText="Switch to Student"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Switch;
