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

  const handleConfirmSwitch = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("You must be logged in to switch roles");
        return;
      }

      // Update role in users table
      const { error } = await supabase
        .from("users")
        .update({ role: "tutor" })
        .eq("user_id", session.user.id);

      if (error) throw error;

      // Role will be updated in App.jsx when it detects the change
      setIsModalOpen(false);
      
      // Dispatch custom event to notify App component of role change
      window.dispatchEvent(new CustomEvent('roleChanged', { detail: { newRole: 'tutor' } }));
      
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
        <h1 className="text-sm font-medium text-gray-600 mb-2">Switch to Tutor</h1>
        <button 
          onClick={handleSwitchClick}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md cursor-pointer hover:bg-blue-700 hover:translate-y-[-5px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Switching..." : "Switch"}
        </button>
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
    </div>
  );
};

export default Switch;
