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

        setCanSwitchAdmin(Boolean(data?.is_admin || data?.is_superadmin));
      } catch (err) {
        console.error("Error checking admin permissions:", err.message);
        setCanSwitchAdmin(false);
      }
    };

    fetchAdminPermissions();
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

      try {
        localStorage.setItem(ROLE_OVERRIDE_KEY, "tutor");
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

      {canSwitchAdmin && (
        <div className="mt-6">
          <h1 className="text-sm font-medium text-gray-600 mb-2">Switch to Admin</h1>
          <button
            onClick={handleAdminSwitchClick}
            disabled={isAdminLoading}
            className="bg-gray-700 text-white px-4 py-2 rounded-md cursor-pointer hover:bg-gray-800 hover:translate-y-[-5px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdminLoading ? "Switching..." : "Switch to Admin"}
          </button>
        </div>
      )}

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
