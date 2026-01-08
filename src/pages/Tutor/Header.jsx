import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";

//icons
import { IoIosNotifications } from "react-icons/io";
import { IoPersonCircleOutline } from "react-icons/io5";

const Header = () => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const [profile, setProfile] = useState({
    profile_image: "",
  });
  const [name, setName] = useState("");

  // Fetch pending appointments count
  const getPendingCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { count, error } = await supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .eq("tutor_id", session.user.id)
        .eq("status", "pending");

      if (error) throw error;

      setPendingCount(count || 0);
    } catch (err) {
      console.error("Error fetching pending count:", err.message);
    }
  };

  // get name
  async function getName() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;
      if (data) setName(data.name);
    } catch (err) {
      console.error(err.message);
    }
  }

  // get profile
  async function getProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const profileData = data || {
        profile_image: "",
      };

      setProfile(profileData);
    } catch (err) {
      console.error(err.message);
    }
  }

  // Fetch unread notifications
  const getUnreadNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("notification")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "unread")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUnreadNotifications(data || []);
      setUnreadCount((data || []).length);
    } catch (err) {
      console.error("Error fetching notifications:", err.message);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from("notification")
        .update({ status: "read" })
        .eq("notification_id", notificationId);

      if (error) throw error;

      // Refresh notifications
      getUnreadNotifications();
    } catch (err) {
      console.error("Error marking notification as read:", err.message);
    }
  };

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification.notification_id);
    setIsDropdownOpen(false);
    try {
      sessionStorage.setItem(
        "lav.pendingNotification.tutor",
        JSON.stringify(notification)
      );
    } catch (err) {
      // Ignore storage errors (private mode, full storage).
    }
    const targetPath = "/dashboard/schedule";
    if (window.location.pathname === targetPath) {
      window.dispatchEvent(
        new CustomEvent("lav.notification.tutor", { detail: notification })
      );
    } else {
      navigate(targetPath, { state: { notification } });
    }
  };

  const formatNotificationContent = (content = "") =>
    content.replace(/\s*\[appointment_id:[^\]]+\]/i, "").trim();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    getName();
    getProfile();
    getPendingCount();
    getUnreadNotifications();

    // Listen for profile update events
    const handleProfileUpdate = () => {
      getProfile();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const toggleDropdown = () => {
    if (!isDropdownOpen) {
      // Refresh data when opening dropdown
      getPendingCount();
      getUnreadNotifications();
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const totalNotifications = pendingCount + unreadCount;

  return (
    <div className="pt-3 px-3">
      <div className="flex gap-2 justify-end items-center text-gray-600 text-xl">
        {/* Notification Icon with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className="relative p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <IoIosNotifications />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {totalNotifications}
              </span>
            )}
          </button>
          
          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2 duration-200">
              <div className="p-4">
                <h3 className="text-gray-800 mb-3 flex items-center gap-2 text-lg">
                  <IoIosNotifications className="text-gray-600" />
                  Notifications
                </h3>
                
                <div className="space-y-3">
                  {/* Pending Appointments */}
                  {pendingCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-blue-800  text-[14px] font-semibold">
                        There {pendingCount === 1 ? 'is' : 'are'} {pendingCount} pending appointment{pendingCount > 1 ? 's' : ''}
                      </p>
                      <p className="text-blue-600 text-sm mt-1">
                        Review and respond to appointment requests
                      </p>
                    </div>
                  )}

                  {/* Unread Notifications */}
                  {unreadNotifications.map((notification) => (
                    <div 
                      key={notification.notification_id}
                      className="bg-yellow-50 border border-yellow-200 rounded-md p-3 cursor-pointer hover:bg-yellow-100 transition-colors"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <p className="text-yellow-800 text-sm">
                        {formatNotificationContent(notification.notification_content)}
                      </p>
                      <p className="text-yellow-600 text-xs mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}

                  {/* No notifications */}
                  {totalNotifications === 0 && (
                    <div className="text-gray-500 text-center py-4">
                      <p>No new notifications</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <Link
                    to="/dashboard/schedule"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-between"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <span>View all appointments</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <span className="font-extralight text-[#696969]">|</span>
        
        {/* Profile Icon */}
        <Link className="w-6.5 h-6.5 bg-blue-500 rounded-full flex items-center justify-center" to="/dashboard/profile">
          {profile.profile_image ? (
            <img
              src={profile.profile_image}
              alt="Profile"
              className="w-6.5 h-6.5 rounded-full object-cover"
            />
          ) : (
            <span className="text-white text-sm font-medium">
              {name && name.length > 0 ? name.charAt(0).toUpperCase() : "?"}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
};

export default Header;
