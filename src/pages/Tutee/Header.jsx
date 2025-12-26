import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabase-client";

//icons
import { IoIosNotifications } from "react-icons/io";
import { IoPersonCircleOutline } from "react-icons/io5";

const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const dropdownRef = useRef(null);
  const isProcessingAutoDecline = useRef(false);
  const [profile, setProfile] = useState({
    program: "",
    college: "",
    year_level: "",
    profile_image: "",
  });
  const [name, setName] = useState("");

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


  // Fetch unread notifications
  const getUnreadNotifications = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

  // get profile
  async function getProfile() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("student_profile")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== "PGRST116" && error.status !== 406) {
        throw error;
      }

      const profileData = data || {
        program: "",
        college: "",
        year_level: "",
        profile_image: "",
      };

      setProfile(profileData);
    } catch (err) {
      console.error(err.message);
    }
  }

  const getUpcomingSessions = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("appointment")
        .select(
          `
          *,
          tutor:users!tutor_id(name)
        `
        )
        .eq("user_id", session.user.id)
        .eq("status", "confirmed")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      const now = new Date();
      const upcoming = (data || [])
        .filter((appointment) => {
          if (!appointment.date || !appointment.start_time) {
            return false;
          }

          const startDate = new Date(
            `${appointment.date}T${appointment.start_time}`
          );
          if (isNaN(startDate.getTime())) {
            return false;
          }

          const diffMs = startDate.getTime() - now.getTime();
          return diffMs > 0 && diffMs <= 20 * 60 * 1000;
        })
        .map((appointment) => {
          const startDate = new Date(
            `${appointment.date}T${appointment.start_time}`
          );
          const diffMs = Math.max(startDate.getTime() - now.getTime(), 0);
          const minutesUntil = Math.max(Math.ceil(diffMs / (60 * 1000)), 0);
          return {
            appointment: {
              ...appointment,
              tutor_name: appointment.tutor?.name || null,
            },
            minutesUntil,
          };
        })
        .sort((a, b) => a.minutesUntil - b.minutesUntil);

      setUpcomingSessions(upcoming);
    } catch (err) {
      console.error("Error fetching upcoming sessions:", err.message);
    }
  };

  // Fetch confirmed appointments count
  const getConfirmedCount = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { count, error } = await supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("status", "confirmed");

      if (error) throw error;

      setConfirmedCount(count || 0);
    } catch (err) {
      console.error("Error fetching confirmed count:", err.message);
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

  // Auto-decline appointments that are pending for more than 14 hours
  const checkAndAutoDeclineAppointments = async () => {
    // Prevent concurrent execution
    if (isProcessingAutoDecline.current) {
      return;
    }

    isProcessingAutoDecline.current = true;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        isProcessingAutoDecline.current = false;
        return;
      }

      // Get all pending appointments for the current user
      const { data: pendingAppointments, error: fetchError } = await supabase
        .from("appointment")
        .select("appointment_id, user_id, subject, topic, created_at")
        .eq("user_id", session.user.id)
        .eq("status", "pending");

      if (fetchError) {
        console.error("Error fetching pending appointments:", fetchError);
        isProcessingAutoDecline.current = false;
        return;
      }

      if (!pendingAppointments || pendingAppointments.length === 0) {
        isProcessingAutoDecline.current = false;
        return;
      }

      const now = new Date();
      const fourteenHoursInMs = 14 * 60 * 60 * 1000; // 14 hours in milliseconds
      //14 * 60 * 60 * 1000;
      const appointmentsToDecline = [];

      // Check each pending appointment
      for (const appointment of pendingAppointments) {
        if (!appointment.created_at) continue;

        const createdDate = new Date(appointment.created_at);
        const timeDiff = now.getTime() - createdDate.getTime();

        // If appointment is older than 14 hours, mark for auto-decline
        if (timeDiff >= fourteenHoursInMs) {
          appointmentsToDecline.push(appointment);
        }
      }

      // Auto-decline appointments and create notifications
      for (const appointment of appointmentsToDecline) {
        try {
          // Double-check that appointment is still pending before processing
          const { data: currentAppointment, error: checkError } = await supabase
            .from("appointment")
            .select("status")
            .eq("appointment_id", appointment.appointment_id)
            .single();

          if (checkError || !currentAppointment || currentAppointment.status !== "pending") {
            // Appointment is no longer pending, skip it
            continue;
          }

          // Check if notification already exists for this auto-decline
          const notificationMessage = `Your appointment request for ${appointment.subject}${appointment.topic ? ` - ${appointment.topic}` : ""} has been automatically declined as it was not confirmed within 14 hours.`;
          
          const { data: existingNotifications } = await supabase
            .from("notification")
            .select("notification_id")
            .eq("user_id", appointment.user_id)
            .eq("notification_content", notificationMessage)
            .eq("status", "unread")
            .limit(1);

          // If notification already exists, skip creating a duplicate
          if (existingNotifications && existingNotifications.length > 0) {
            continue;
          }

          // Update appointment status to declined
          const { error: updateError } = await supabase
            .from("appointment")
            .update({ status: "declined" })
            .eq("appointment_id", appointment.appointment_id)
            .eq("status", "pending"); // Only update if still pending

          if (updateError) {
            console.error(`Error declining appointment ${appointment.appointment_id}:`, updateError);
            continue;
          }

          // Create notification for the tutee
          const { error: notificationError } = await supabase
            .from("notification")
            .insert([
              {
                user_id: appointment.user_id,
                notification_content: notificationMessage,
                status: "unread",
              },
            ]);

          if (notificationError) {
            console.error(`Error creating notification for appointment ${appointment.appointment_id}:`, notificationError);
          }
        } catch (err) {
          console.error(`Error processing appointment ${appointment.appointment_id}:`, err.message);
        }
      }

      // Refresh notifications if any appointments were declined
      if (appointmentsToDecline.length > 0) {
        getUnreadNotifications();
      }
    } catch (err) {
      console.error("Error in auto-decline check:", err.message);
    } finally {
      isProcessingAutoDecline.current = false;
    }
  };

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
    getUnreadNotifications();
    getConfirmedCount();
    getUpcomingSessions();
    checkAndAutoDeclineAppointments(); // Check on mount

    // Check for upcoming sessions every minute
    const upcomingIntervalId = setInterval(() => {
      getUpcomingSessions();
    }, 60000);

    // Check for auto-decline every hour (3600000 ms)
    const autoDeclineIntervalId = setInterval(() => {
      checkAndAutoDeclineAppointments();
    }, 3600000);

    return () => {
      clearInterval(upcomingIntervalId);
      clearInterval(autoDeclineIntervalId);
    };
  }, []);

  // Realtime updates for notifications
  useEffect(() => {
    let channel;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        channel = supabase
          .channel(`tutee-notifications-${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notification",
              filter: `user_id=eq.${session.user.id}`,
            },
            () => {
              getUnreadNotifications();
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
      getUnreadNotifications();
      getConfirmedCount();
      getUpcomingSessions();
      checkAndAutoDeclineAppointments(); // Also check for auto-decline when opening dropdown
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Calculate total notifications // confirmedCount
  const totalNotifications = unreadCount + upcomingSessions.length;

  return (
    <div className="pt-3 px-3 text-[#323335] bg-[#f8f9f0]">
      <div className="flex gap-2 justify-end items-center text-[#323335] text-xl">
        {/* Notification Icon with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className="relative p-1 hover:bg-[#f8f9f0] rounded-full transition-colors"
          >
            <IoIosNotifications />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#935226] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {totalNotifications}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#e5e8f2] rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2 duration-200">
              <div className="p-4">
                <h3 className="text-[#323335] mb-3 flex items-center gap-2 text-lg">
                  <IoIosNotifications className="text-[#4c4ba2]" />
                  Notifications
                </h3>

                <div className="space-y-3">
                  {upcomingSessions.length > 0 && (
                    <div className="bg-[#def0e4] border border-[#c9e1d3] rounded-md p-3">
                      <p className="text-[#323335] font-medium">
                        Upcoming session{upcomingSessions.length > 1 ? "s" : ""}{" "}
                        soon
                      </p>
                      <div className="mt-2 space-y-2">
                        {upcomingSessions.map(
                          ({ appointment, minutesUntil }) => (
                            <div
                              key={appointment.appointment_id}
                              className="text-[#4c4ba2] text-sm"
                            >
                              <p className="font-semibold">
                                In {minutesUntil}{" "}
                                {minutesUntil === 1 ? "minute" : "minutes"}
                              </p>
                              <p>
                                {appointment.tutor_name
                                  ? `With ${appointment.tutor_name}`
                                  : "Tutoring session"}{" "}
                                at{" "}
                                {new Date(
                                  `2000-01-01T${appointment.start_time}`
                                ).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })}{" "}
                                on{" "}
                                {new Date(appointment.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  }
                                )}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Confirmed Appointments */}
                  {/* {confirmedCount > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-green-800 font-medium">
                        {confirmedCount} appointment{confirmedCount > 1 ? 's' : ''} recently confirmed
                      </p>
                      <p className="text-green-600 text-sm mt-1">
                        Your appointment requests have been approved
                      </p>
                    </div>
                  )} */}

                  {/* Unread Notifications */}
                  {unreadNotifications.map((notification) => (
                    <div
                      key={notification.notification_id}
                      className="bg-[#def0e4] border border-[#c9e1d3] rounded-md p-3 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => markAsRead(notification.notification_id)}
                    >
                      <p className="text-[#323335] text-sm font-semibold">
                        {notification.notification_content}
                      </p>
                      <p className="text-[#4c4ba2] text-xs mt-1">
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

                <div className="mt-3 pt-3 border-t border-[#e5e8f2]">
                  <Link
                    to="/dashboard/schedules"
                    className="text-[#4c4ba2] hover:text-[#323335] text-sm font-medium flex items-center justify-between"
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
        <Link className="w-6.5 h-6.5 bg-[#4257a9] rounded-full flex items-center justify-center" to="/dashboard/profile" >
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
