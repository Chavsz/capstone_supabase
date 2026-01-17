import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";
import useActionGuard from "../../hooks/useActionGuard";

//icons
import { IoIosNotifications } from "react-icons/io";
import { IoPersonCircleOutline } from "react-icons/io5";

const Header = () => {
  const NOTIFICATION_PAGE_SIZE = 5;
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visibleNotifications, setVisibleNotifications] = useState(
    NOTIFICATION_PAGE_SIZE
  );
  const dropdownRef = useRef(null);
  const { run: runAction, busy: actionBusy } = useActionGuard();
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

  // Fetch notifications
  const getNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("notification")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const next = data || [];
      setNotifications(next);
      setUnreadCount(next.filter((item) => item.status === "unread").length);
    } catch (err) {
      console.error("Error fetching notifications:", err.message);
    }
  };

  // Mark notification as read
  const markAsReadRecord = async (notificationId) => {
    const { error } = await supabase
      .from("notification")
      .update({ status: "read" })
      .eq("notification_id", notificationId);

    if (error) throw error;

    // Refresh notifications
    getNotifications();
  };

  const handleNotificationClick = async (notification) => {
    if (notification.status === "unread") {
      await runAction(
        () => markAsReadRecord(notification.notification_id),
        "Unable to mark notification as read."
      );
    }
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

  const handlePendingClick = () => {
    setIsDropdownOpen(false);
    const notification = {
      notification_id: `pending-${Date.now()}`,
      notification_content: "Pending appointment request.",
    };
    try {
      sessionStorage.setItem(
        "lav.pendingNotification.tutor",
        JSON.stringify(notification)
      );
    } catch (err) {
      // Ignore storage errors.
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

  const markAllAsRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase
      .from("notification")
      .update({ status: "read" })
      .eq("user_id", session.user.id)
      .eq("status", "unread");
    if (error) throw error;
    getNotifications();
  };

  const deleteAllNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase
      .from("notification")
      .delete()
      .eq("user_id", session.user.id);
    if (error) throw error;
    setNotifications([]);
    setUnreadCount(0);
    getNotifications();
  };

  const handleMarkAllClick = () => {
    if (unreadCount === 0) {
      toast.error("No unread notifications.");
      return;
    }
    runAction(markAllAsRead, "Unable to mark all as read.");
  };

  const handleDeleteAllClick = () => {
    if (notifications.length === 0) {
      toast.error("No notifications to delete.");
      return;
    }
    if (!window.confirm("Delete all notifications?")) return;
    runAction(deleteAllNotifications, "Unable to delete notifications.");
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
    getNotifications();

    // Listen for profile update events
    const handleProfileUpdate = () => {
      getProfile();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  // Realtime updates for notifications and pending appointments
  useEffect(() => {
    let channel;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        channel = supabase
          .channel(`tutor-notifications-${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notification",
              filter: `user_id=eq.${session.user.id}`,
            },
            () => {
              getNotifications();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "appointment",
              filter: `tutor_id=eq.${session.user.id}`,
            },
            () => {
              getPendingCount();
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Error subscribing to notifications:", err.message);
      }
    })();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const toggleDropdown = () => {
    if (!isDropdownOpen) {
      // Refresh data when opening dropdown
      getPendingCount();
      getNotifications();
      setVisibleNotifications(NOTIFICATION_PAGE_SIZE);
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const totalNotifications = pendingCount + unreadCount;
  const visibleNotificationList = notifications.slice(0, visibleNotifications);
  const canShowMoreNotifications =
    notifications.length > visibleNotifications;

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
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>{unreadCount} unread</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleMarkAllClick}
                      className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-50"
                      disabled={actionBusy}
                    >
                      Read All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAllClick}
                      className="text-red-600 hover:text-red-700 font-semibold disabled:opacity-50"
                      disabled={actionBusy}
                    >
                      Delete All
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {/* Pending Appointments */}
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={handlePendingClick}
                      className="w-full text-left bg-blue-50 border border-blue-200 rounded-md p-3 hover:bg-blue-100 transition-colors"
                      disabled={actionBusy}
                    >
                      <p className="text-blue-800  text-[14px] font-semibold">
                        There {pendingCount === 1 ? 'is' : 'are'} {pendingCount} pending appointment{pendingCount > 1 ? 's' : ''}
                      </p>
                      <p className="text-blue-600 text-sm mt-1">
                        Review and respond to appointment requests
                      </p>
                    </button>
                  )}

                  {/* Unread Notifications */}
                  {visibleNotificationList.map((notification) => (
                    <div 
                      key={notification.notification_id}
                      className={`rounded-md border p-3 cursor-pointer transition-colors ${
                        notification.status === "unread"
                          ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      aria-disabled={actionBusy}
                    >
                      <p
                        className={`text-sm ${
                          notification.status === "unread"
                            ? "text-yellow-800"
                            : "text-gray-700"
                        } break-words`}
                      >
                        {formatNotificationContent(notification.notification_content)}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          notification.status === "unread"
                            ? "text-yellow-600"
                            : "text-gray-500"
                        }`}
                      >
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}

                  {canShowMoreNotifications && (
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleNotifications((prev) => prev + NOTIFICATION_PAGE_SIZE)
                      }
                      className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      disabled={actionBusy}
                    >
                      Show more notifications
                    </button>
                  )}

                  {/* No notifications */}
                  {pendingCount === 0 && notifications.length === 0 && (
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
