import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";
import { capitalizeWords } from "../../utils/text";
import useActionGuard from "../../hooks/useActionGuard";

const FINISHED_STATUSES = ["awaiting_feedback", "completed"];
const STATUS_META = {
  pending: { label: "Pending", badge: "bg-[#c9c7c9] text-[#323335]" },
  confirmed: { label: "Confirmed", badge: "bg-[#4766fe] text-white" },
  started: { label: "In Session", badge: "bg-[#76acf5] text-[#0f2d58]" },
  awaiting_feedback: { label: "Awaiting Feedback", badge: "bg-[#935226] text-white" },
  completed: { label: "Completed", badge: "bg-[#00a65a] text-white" },
  declined: { label: "Declined", badge: "bg-[#323335] text-white" },
  cancelled: { label: "Cancelled", badge: "bg-[#ff4b4b] text-white" },
};
const statusBadge = (status = "") => STATUS_META[status]?.badge || "bg-gray-100 text-gray-800";
const formatStatusLabel = (status = "") => STATUS_META[status]?.label || status.replace(/_/g, " ");
const ITEMS_PER_PAGE = 6;

const parseNotificationDetails = (content = "") => {
  if (!content) return null;
  const idMatch = content.match(/\[appointment_id:([^\]]+)\]/i);
  const subjectMatch = content.match(/for (.+?)(?: on | has|$)/i);
  const dateMatch = content.match(/on ([A-Za-z]+ \d{1,2}, \d{4})/);
  const timeMatch = content.match(/at (\d{1,2}:\d{2} [AP]M)/);

  const subjectPart = subjectMatch ? subjectMatch[1].trim() : "";
  const [subject, topic] = subjectPart.split(" - ").map((part) => part.trim());
  const dateText = dateMatch ? dateMatch[1] : "";
  const timeText = timeMatch ? timeMatch[1] : "";
  const appointmentId = idMatch ? idMatch[1].trim() : "";

  return {
    appointmentId,
    subject: subject || "",
    topic: topic || "",
    dateText,
    timeText,
  };
};

const to24Hour = (timeText = "") => {
  const match = timeText.match(/^(\d{1,2}):(\d{2}) ([AP]M)$/);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3];
  if (Number.isNaN(hours)) return "";
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
};

const readStoredNotification = () => {
  try {
    const raw = sessionStorage.getItem("lav.pendingNotification.tutor");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
};

const clearStoredNotification = () => {
  try {
    sessionStorage.removeItem("lav.pendingNotification.tutor");
  } catch (err) {
    // Ignore storage errors.
  }
};

// Modal component for appointment details
const AppointmentModal = ({
  appointment,
  isOpen,
  onClose,
  onStatusUpdate,
  feedbacks,
  isBusy,
}) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const [declineMode, setDeclineMode] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState("");
  const [isDeclining, setIsDeclining] = useState(false);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmLocation, setConfirmLocation] = useState("");
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    setDeclineMode(false);
    setDeclineReason("");
    setDeclineError("");
    setIsDeclining(false);
    setCancelMode(false);
    setCancelReason("");
    setCancelError("");
    setIsCancelling(false);
    setConfirmLocation("");
    setConfirmError("");
  }, [appointment, isOpen]);

  const handleConfirm = async () => {
    if (!confirmLocation.trim()) {
      setConfirmError("Please provide a session location.");
      return;
    }
    setConfirmError("");
    try {
      await onStatusUpdate(appointment.appointment_id, "confirmed", {
        location: confirmLocation.trim(),
      });
      onClose();
    } catch (err) {
      setConfirmError(err?.message || "Unable to confirm this appointment.");
    }
  };

  const handleDeclineSubmit = async () => {
    if (!declineReason.trim()) {
      setDeclineError("Please share a brief reason.");
      return;
    }
    if (!appointment) return;
    setDeclineError("");
    setIsDeclining(true);
    try {
      await onStatusUpdate(appointment.appointment_id, "declined", {
        reason: declineReason.trim(),
      });
      onClose();
    } catch (err) {
      setDeclineError(err?.message || "Unable to decline this appointment.");
    } finally {
      setIsDeclining(false);
    }
  };

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-600">
            Appointment Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Subject:</span>
            <span className="text-gray-900">{appointment.subject}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Specialization:</span>
            <span className="text-gray-900">
              {capitalizeWords(appointment.topic)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Student:</span>
            <span className="text-gray-900">
              {capitalizeWords(appointment.student_name)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Date:</span>
            <span className="text-gray-900">
              {formatDate(appointment.date)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Time:</span>
            <span className="text-gray-900">
              {formatTime(appointment.start_time)} -{" "}
              {formatTime(appointment.end_time)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Mode:</span>
            <span className="text-gray-900">{appointment.mode_of_session}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Status:</span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(
                appointment.status
              )}`}
            >
              {formatStatusLabel(appointment.status)}
            </span>
          </div>
          {(appointment.status === "declined" || appointment.status === "cancelled") && (
            <div className="mt-3 space-y-2">
              {appointment.tutor_decline_reason && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  Tutor note: {appointment.tutor_decline_reason}
                </div>
              )}
              {appointment.tutee_decline_reason && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-700">
                  Tutee note: {appointment.tutee_decline_reason}
                </div>
              )}
            </div>
          )}
          {(appointment.resource_link || appointment.resource_note) && (
            <div className="mt-4 p-3 border border-blue-200 bg-blue-50 rounded-lg space-y-2">
              <h3 className="text-sm font-semibold text-blue-900">
                Shared Resources
              </h3>
              {appointment.resource_link && (
                <p className="text-sm">
                  <span className="font-medium text-gray-700">Link: </span>
                  <a
                    href={appointment.resource_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    {appointment.resource_link}
                  </a>
                </p>
              )}
              {appointment.resource_note && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Note:</span>{" "}
                  {appointment.resource_note}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Shared by the tutee to guide your preparation.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {appointment.status === "pending" && (
            <>
              {!declineMode ? (
                <>
                  <div className="w-full space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Session Location
                    </label>
                    <input
                      type="text"
                      value={confirmLocation}
                      onChange={(event) => {
                        setConfirmLocation(event.target.value);
                        if (confirmError) {
                          setConfirmError("");
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#132c91]"
                      placeholder="e.g., LAV Room 2, Library Study Area"
                    />
                    {confirmError && (
                      <p className="text-xs text-red-600">{confirmError}</p>
                    )}
                  </div>
                  <button
                    onClick={handleConfirm}
                    className="bg-[#132c91] text-white rounded-md px-4 py-2 text-sm hover:bg-[#0f1f6b] flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isBusy || isDeclining}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setDeclineMode(true);
                    }}
                    className="bg-[#e02402] text-white rounded-md px-4 py-2 text-sm hover:bg-[#b81d02] flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isBusy || isDeclining}
                  >
                    Decline
                  </button>
                </>
              ) : (
                <div className="w-full space-y-2">
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Share the reason for declining so the tutee understands why."
                  />
                  {declineError && (
                    <p className="text-xs text-red-600">{declineError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeclineSubmit}
                      className="bg-[#e02402] text-white rounded-md px-4 py-2 text-sm hover:bg-[#b81d02] flex-1 disabled:bg-red-300 disabled:cursor-not-allowed"
                      disabled={isDeclining || isBusy}
                    >
                      {isDeclining ? "Declining..." : "Confirm Decline"}
                    </button>
                    <button
                      onClick={() => {
                        setDeclineMode(false);
                        setDeclineReason("");
                        setDeclineError("");
                      }}
                      className="bg-gray-200 text-gray-800 rounded-md px-4 py-2 text-sm hover:bg-gray-300 flex-1"
                      disabled={isDeclining || isBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {appointment.status === "confirmed" && (
            <>
              {!cancelMode ? (
                <>
                  <button
                    onClick={() => {
                      onStatusUpdate(appointment.appointment_id, "started");
                      onClose();
                    }}
                    className="bg-[#1e90ff] text-white rounded-md px-4 py-2 text-sm hover:bg-[#1565c0] flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isBusy || isCancelling}
                  >
                    Start Session
                  </button>
                  <button
                    onClick={() => {
                      setCancelMode(true);
                    }}
                    className="bg-[#e02402] text-white rounded-md px-4 py-2 text-sm hover:bg-[#b81d02] flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isBusy || isCancelling}
                  >
                    Cancel Session
                  </button>
                </>
              ) : (
                <div className="w-full space-y-2">
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Share the reason for cancelling so the tutee understands why."
                  />
                  {cancelError && (
                    <p className="text-xs text-red-600">{cancelError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelSubmit}
                      className="bg-[#e02402] text-white rounded-md px-4 py-2 text-sm hover:bg-[#b81d02] flex-1 disabled:bg-red-300 disabled:cursor-not-allowed"
                      disabled={isCancelling || isBusy}
                    >
                      {isCancelling ? "Cancelling..." : "Confirm Cancel"}
                    </button>
                    <button
                      onClick={() => {
                        setCancelMode(false);
                        setCancelReason("");
                        setCancelError("");
                      }}
                      className="bg-gray-200 text-gray-800 rounded-md px-4 py-2 text-sm hover:bg-gray-300 flex-1"
                      disabled={isCancelling || isBusy}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {appointment.status === "started" && (
            <button
              onClick={() => {
                onStatusUpdate(appointment.appointment_id, "awaiting_feedback");
                onClose();
              }}
              className="bg-[#16a34a] text-white rounded-md px-4 py-2 text-sm hover:bg-[#166534] w-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isBusy}
            >
              End Session (Awaiting Feedback)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Schedule = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [appointmentPages, setAppointmentPages] = useState({});
  const [handledNotificationId, setHandledNotificationId] = useState(null);
  const { run: runAction, busy: actionBusy } = useActionGuard();

  const getAppointments = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("appointment")
        .select(`
          *,
          student:users!appointment_user_id_fkey(name),
          tutee_decline_reason
        `)
        .eq("tutor_id", session.user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Format data to match expected structure
        const formattedData = (data || []).map(appointment => ({
          ...appointment,
          student_name: appointment.student?.name || null,
          tutee_decline_reason: appointment.tutee_decline_reason || null,
        }));

      setAppointments(formattedData);

    } catch (err) {
      console.error(err.message);
      toast.error("Error loading appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  // Get current tutor's user id
  const getUserId = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;
      if (data) setUserId(data.user_id);
    } catch (err) {
      // ignore
    }
  };


  useEffect(() => {
    getAppointments();
    getUserId();
  }, [getAppointments]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tutor-appointments-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment",
          filter: `tutor_id=eq.${userId}`,
        },
        () => {
          getAppointments();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, getAppointments]);


  const handleStatusUpdate = async (appointmentId, status, metadata = {}) => {
    try {
      // First, get the appointment details to get the tutee's user_id
      const { data: appointmentData, error: fetchError } = await supabase
        .from("appointment")
        .select("appointment_id, user_id, subject, topic, date, start_time")
        .eq("appointment_id", appointmentId)
        .single();

      if (fetchError) throw fetchError;

      // Update the appointment status
      const updates = { status };
      if (status === "confirmed") {
        updates.session_location = metadata.location?.trim() || null;
      }
      if (status === "declined" || status === "cancelled") {
        updates.tutor_decline_reason = metadata.reason || null;
      }
      const { error } = await supabase
        .from("appointment")
        .update(updates)
        .eq("appointment_id", appointmentId);

      if (error) throw error;

      // Create notification for the tutee based on status
      if (appointmentData && appointmentData.user_id && (status === "confirmed" || status === "declined" || status === "cancelled")) {
        let notificationMessage = "";
        
        if (status === "confirmed") {
          const formattedDate = new Date(appointmentData.date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const formattedTime = new Date(`2000-01-01T${appointmentData.start_time}`).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const locationText = metadata.location
            ? ` Location: ${metadata.location.trim()}.`
            : "";
          notificationMessage = `Your appointment request for ${appointmentData.subject}${appointmentData.topic ? ` - ${appointmentData.topic}` : ""} on ${formattedDate} at ${formattedTime} has been confirmed.${locationText} [appointment_id:${appointmentData.appointment_id}]`;
        } else if (status === "declined") {
          notificationMessage = `Your appointment request for ${appointmentData.subject}${appointmentData.topic ? ` - ${appointmentData.topic}` : ""} has been declined. [appointment_id:${appointmentData.appointment_id}]`;
          if (metadata.reason) {
            notificationMessage += ` Reason: ${metadata.reason}`;
          }
        } else if (status === "cancelled") {
          notificationMessage = `Your appointment for ${appointmentData.subject}${appointmentData.topic ? ` - ${appointmentData.topic}` : ""} has been cancelled. [appointment_id:${appointmentData.appointment_id}]`;
          if (metadata.reason) {
            notificationMessage += ` Reason: ${metadata.reason}`;
          }
        }

        // Create notification for the tutee
        const { error: notificationError } = await supabase
          .from("notification")
          .insert([
            {
              user_id: appointmentData.user_id,
              notification_content: notificationMessage,
              status: "unread",
            },
          ]);

        if (notificationError) {
          console.error("Error creating notification:", notificationError);
          // Don't throw here, as the appointment update was successful
        }
      }

      getAppointments(); // Refresh the list
      toast.success(`Appointment ${status} successfully`);
      return true;
    } catch (err) {
      console.error(err.message);
      toast.error("Error updating appointment status");
      throw err;
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      setCancelError("Please share a brief reason.");
      return;
    }
    if (!appointment) return;
    setCancelError("");
    setIsCancelling(true);
    try {
      await onStatusUpdate(appointment.appointment_id, "cancelled", {
        reason: cancelReason.trim(),
      });
      onClose();
    } catch (err) {
      setCancelError(err?.message || "Unable to cancel this appointment.");
    } finally {
      setIsCancelling(false);
    }
  };

  const guardedStatusUpdate = (appointmentId, status, metadata = {}) =>
    runAction(
      () => handleStatusUpdate(appointmentId, status, metadata),
      "Unable to update appointment status.",
      { rethrow: true }
    );

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const getDateLabel = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  // Always return a consistent formatted date string for display (no Today/Tomorrow)
  const getFormattedDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDateSubtitle = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } else {
      return null;
    }
  };

  const openModal = (appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleIncomingNotification = useCallback(
    (notification) => {
      if (!notification || !appointments.length) return;
      if (handledNotificationId === notification.notification_id) return;

      const notificationContent = notification.notification_content || "";
      const details = parseNotificationDetails(notificationContent) || {
        appointmentId: "",
        subject: "",
        topic: "",
        dateText: "",
        timeText: "",
      };

      const subjectMatch = (appointment) => {
        if (details.subject && appointment.subject !== details.subject) return false;
        if (details.topic && appointment.topic !== details.topic) return false;
        return true;
      };

      let match = null;
      if (details.appointmentId) {
        match = appointments.find(
          (appointment) => appointment.appointment_id === details.appointmentId
        );
      } else if (details.dateText && details.timeText) {
        const targetDate = new Date(details.dateText);
        const targetDateStr =
          !Number.isNaN(targetDate.getTime())
            ? targetDate.toISOString().split("T")[0]
            : "";
        const targetTime = to24Hour(details.timeText);

        match = appointments.find((appointment) => {
          if (!subjectMatch(appointment)) return false;
          if (targetDateStr && appointment.date !== targetDateStr) return false;
          if (targetTime && appointment.start_time?.slice(0, 5) !== targetTime) return false;
          return true;
        });
      } else {
        const candidates = appointments.filter(subjectMatch);
        if (candidates.length) {
          candidates.sort((a, b) => {
            const aTime = new Date(`${a.date}T${a.start_time || "00:00"}`).getTime();
            const bTime = new Date(`${b.date}T${b.start_time || "00:00"}`).getTime();
            return bTime - aTime;
          });
          match = candidates[0];
        }
      }

      if (!match) {
        const wantsPending = /pending appointment|pending request|appointment request/i.test(
          notificationContent
        );
        const candidates = wantsPending
          ? appointments.filter((appointment) => appointment.status === "pending")
          : appointments;
        if (candidates.length) {
          candidates.sort((a, b) => {
            const aTime = new Date(`${a.date}T${a.start_time || "00:00"}`).getTime();
            const bTime = new Date(`${b.date}T${b.start_time || "00:00"}`).getTime();
            return bTime - aTime;
          });
          match = candidates[0];
        }
      }

      if (match) {
        openModal(match);
      }

      setHandledNotificationId(notification.notification_id);
      clearStoredNotification();
      navigate("/dashboard/schedule", { replace: true, state: {} });
    },
    [appointments, handledNotificationId, navigate]
  );

  useEffect(() => {
    const notification =
      location.state?.notification || readStoredNotification();
    if (!notification) return;
    handleIncomingNotification(notification);
  }, [handleIncomingNotification, location.state, appointments.length]);

  useEffect(() => {
    const handleEvent = (event) => {
      handleIncomingNotification(event.detail);
    };
    window.addEventListener("lav.notification.tutor", handleEvent);
    return () => window.removeEventListener("lav.notification.tutor", handleEvent);
  }, [handleIncomingNotification]);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-gray-600 font-bold text-2xl">Appointments</h1>
        <div className="mt-6 text-center">Loading appointments...</div>
      </div>
    );
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (appointment) => {
    if (!normalizedSearch) return true;
    const haystack = `${appointment.student_name || ""} ${appointment.subject || ""} ${appointment.topic || ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  };

  const statusOrder = [
    "pending",
    "confirmed",
    "started",
    "awaiting_feedback",
    "completed",
    "declined",
    "cancelled",
  ];

  const statusTabs = [{ status: "all", label: "All" }].concat(
    statusOrder.map((status) => ({ status, label: formatStatusLabel(status) }))
  );

  const filteredAppointments = appointments
    .filter(matchesSearch)
    .filter((appointment) =>
      statusFilter === "all" ? true : appointment.status === statusFilter
    )
    .sort((a, b) => {
      const aTime = new Date(`${a.date}T${a.start_time || "00:00"}`).getTime();
      const bTime = new Date(`${b.date}T${b.start_time || "00:00"}`).getTime();
      return bTime - aTime;
    });

  const getStatusCount = (status) => {
    if (status === "all") return appointments.filter(matchesSearch).length;
    return appointments.filter(matchesSearch).filter((apt) => apt.status === status).length;
  };

  const getCurrentPage = (status, totalPages) => {
    const current = appointmentPages[status] || 1;
    return Math.min(Math.max(current, 1), Math.max(totalPages, 1));
  };

  const handlePageChange = (status, delta, totalPages) => {
    setAppointmentPages((prev) => {
      const current = Math.max(1, Math.min(prev[status] || 1, totalPages));
      const next = Math.min(Math.max(current + delta, 1), totalPages);
      return { ...prev, [status]: next };
    });
  };

  return (
    <div className="py-3 px-6">
      <h1 className="text-[#181718] font-bold text-2xl mb-6">Schedules</h1>

      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#181718]">Booked Sessions</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student or subject"
            className="border border-[#d9c98a] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#feda3c] focus:border-[#feda3c] bg-white"
          />
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-[#dbe8ff] text-[#2b4ea2] font-semibold px-5 py-2.5 pr-9 rounded-full border border-[#b5c8f5] focus:outline-none text-sm"
            >
              {statusTabs.map((tab) => (
                <option key={tab.status} value={tab.status}>
                  {tab.label} ({getStatusCount(tab.status)})
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#2b4ea2] text-xs">
              v
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#d7d9df] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-[#feda3c] text-[#181718]">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Tutee</th>
                <th className="text-left font-semibold px-4 py-2">Course</th>
                <th className="text-left font-semibold px-4 py-2">Topic</th>
                <th className="text-left font-semibold px-4 py-2">Time</th>
                <th className="text-left font-semibold px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    {statusFilter === "all"
                      ? "No appointments available."
                      : `No ${formatStatusLabel(statusFilter).toLowerCase()} appointments.`}
                  </td>
                </tr>
              ) : (
                (() => {
                  const totalPages = Math.max(
                    1,
                    Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE)
                  );
                  const currentPage = getCurrentPage(statusFilter, totalPages);
                  const pagedList = filteredAppointments.slice(
                    (currentPage - 1) * ITEMS_PER_PAGE,
                    currentPage * ITEMS_PER_PAGE
                  );

                  return pagedList.map((appointment) => (
                    <tr
                      key={appointment.appointment_id}
                      className="border-b border-[#eceff4] hover:bg-[#f8f9f0] cursor-pointer"
                      onClick={() => openModal(appointment)}
                    >
                      <td className="px-4 py-2 font-semibold text-[#323335]">
                        {capitalizeWords(appointment.student_name)}
                      </td>
                      <td className="px-4 py-2">{appointment.subject}</td>
                      <td className="px-4 py-2">
                        {capitalizeWords(appointment.topic)}
                      </td>
                      <td className="px-4 py-2">
                        {formatDate(appointment.date)}{" "}
                        {formatTime(appointment.start_time)} -{" "}
                        {formatTime(appointment.end_time)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                            appointment.status
                          )}`}
                        >
                          {formatStatusLabel(appointment.status)}
                        </span>
                      </td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAppointments.length > 0 && (
        <div className="flex justify-end items-center gap-2 mt-3 text-sm text-gray-600">
          {(() => {
            const totalPages = Math.max(
              1,
              Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE)
            );
            const currentPage = getCurrentPage(statusFilter, totalPages);
            if (totalPages <= 1) return null;

            return (
              <>
                <button
                  className={`px-3 py-1 rounded border ${
                    currentPage === 1
                      ? "text-gray-400 border-gray-200 cursor-not-allowed"
                      : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
                  }`}
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(statusFilter, -1, totalPages)}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className={`px-3 py-1 rounded border ${
                    currentPage === totalPages
                      ? "text-gray-400 border-gray-200 cursor-not-allowed"
                      : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
                  }`}
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(statusFilter, 1, totalPages)}
                >
                  Next
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Modal */}
      <AppointmentModal
        appointment={selectedAppointment}
        isOpen={isModalOpen}
        onClose={closeModal}
        onStatusUpdate={guardedStatusUpdate}
        isBusy={actionBusy}
      />
    </div>
  );
};

export default Schedule;
