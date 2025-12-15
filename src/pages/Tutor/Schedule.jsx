import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";

const FINISHED_STATUSES = ["awaiting_feedback", "completed"];
const STATUS_META = {
  pending: { label: "Pending", badge: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", badge: "bg-emerald-100 text-emerald-800" },
  started: { label: "In Session", badge: "bg-sky-100 text-sky-800" },
  awaiting_feedback: { label: "Awaiting Feedback", badge: "bg-orange-100 text-orange-800" },
  completed: { label: "Completed", badge: "bg-blue-100 text-blue-800" },
  declined: { label: "Declined", badge: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", badge: "bg-gray-100 text-gray-800" },
};
const statusBadge = (status = "") => STATUS_META[status]?.badge || "bg-gray-100 text-gray-800";
const formatStatusLabel = (status = "") => STATUS_META[status]?.label || status.replace(/_/g, " ");

// Modal component for appointment details
const AppointmentModal = ({
  appointment,
  isOpen,
  onClose,
  onStatusUpdate,
  feedbacks,
  evaluation,
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

  const getRatingLabel = (rating) => {
    const labels = {
      "5": "Outstanding",
      "4": "Very Satisfactory",
      "3": "Satisfactory",
      "2": "Needs Improvement",
      "1": "Poor",
      "N/A": "Not Applicable",
    };
    return labels[rating] || rating;
  };

  const [declineMode, setDeclineMode] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState("");
  const [isDeclining, setIsDeclining] = useState(false);

  useEffect(() => {
    setDeclineMode(false);
    setDeclineReason("");
    setDeclineError("");
    setIsDeclining(false);
  }, [appointment, isOpen]);

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
            <span className="text-gray-900">{appointment.topic}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Student:</span>
            <span className="text-gray-900">{appointment.student_name}</span>
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

        {/* Evaluation Display */}
        {evaluation && appointment.status === "completed" && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-4">
              Session Evaluation
            </h3>
            <div className="space-y-3">
              <div className="border-b border-green-200 pb-2">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  1. Clear and organized presentation of the lessons
                </p>
                <p className="text-sm text-gray-600">
                  Rating: <span className="font-semibold">{evaluation.presentation_clarity}</span>
                  {evaluation.presentation_clarity !== "N/A" && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({getRatingLabel(evaluation.presentation_clarity)})
                    </span>
                  )}
                </p>
              </div>
              <div className="border-b border-green-200 pb-2">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  2. Sufficiency of drills and exercises
                </p>
                <p className="text-sm text-gray-600">
                  Rating: <span className="font-semibold">{evaluation.drills_sufficiency}</span>
                  {evaluation.drills_sufficiency !== "N/A" && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({getRatingLabel(evaluation.drills_sufficiency)})
                    </span>
                  )}
                </p>
              </div>
              <div className="border-b border-green-200 pb-2">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  3. Patience & enthusiasm in answering questions
                </p>
                <p className="text-sm text-gray-600">
                  Rating: <span className="font-semibold">{evaluation.patience_enthusiasm}</span>
                  {evaluation.patience_enthusiasm !== "N/A" && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({getRatingLabel(evaluation.patience_enthusiasm)})
                    </span>
                  )}
                </p>
              </div>
              <div className="border-b border-green-200 pb-2">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  4. Opportunity for development of study skills
                </p>
                <p className="text-sm text-gray-600">
                  Rating: <span className="font-semibold">{evaluation.study_skills_development}</span>
                  {evaluation.study_skills_development !== "N/A" && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({getRatingLabel(evaluation.study_skills_development)})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  5. Positive impact on progress in the subject
                </p>
                <p className="text-sm text-gray-600">
                  Rating: <span className="font-semibold">{evaluation.positive_impact}</span>
                  {evaluation.positive_impact !== "N/A" && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({getRatingLabel(evaluation.positive_impact)})
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {appointment.status === "pending" && (
            <>
              {!declineMode ? (
                <>
                  <button
                    onClick={() => {
                      onStatusUpdate(appointment.appointment_id, "confirmed");
                      onClose();
                    }}
                    className="bg-[#132c91] text-white rounded-md px-4 py-2 text-sm hover:bg-[#0f1f6b] flex-1"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setDeclineMode(true);
                    }}
                    className="bg-[#e02402] text-white rounded-md px-4 py-2 text-sm hover:bg-[#b81d02] flex-1"
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
                      disabled={isDeclining}
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
                      disabled={isDeclining}
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
              <button
                onClick={() => {
                  onStatusUpdate(appointment.appointment_id, "started");
                  onClose();
                }}
                className="bg-[#1e90ff] text-white rounded-md px-4 py-2 text-sm hover:bg-[#1565c0] flex-1"
              >
                Start Session
              </button>
              <button
                onClick={() => {
                  onStatusUpdate(appointment.appointment_id, "cancelled");
                  onClose();
                }}
                className="bg-[#e02402] text-white rounded-md px-4 py-2 text-sm hover:bg-[#b81d02] flex-1"
              >
                Decline Session
              </button>
            </>
          )}
          {appointment.status === "started" && (
            <button
              onClick={() => {
                onStatusUpdate(appointment.appointment_id, "awaiting_feedback");
                onClose();
              }}
              className="bg-[#16a34a] text-white rounded-md px-4 py-2 text-sm hover:bg-[#166534] w-full"
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
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("confirmed");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [evaluations, setEvaluations] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

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

      // Fetch evaluations for completed appointments
      const appointmentIds = formattedData
        .filter(apt => FINISHED_STATUSES.includes(apt.status))
        .map(apt => apt.appointment_id);

      if (appointmentIds.length > 0) {
        const { data: evaluationData, error: evalError } = await supabase
          .from("evaluation")
          .select("*")
          .in("appointment_id", appointmentIds);

        if (!evalError && evaluationData) {
          const evaluationsMap = {};
          evaluationData.forEach(evaluationItem => {
            evaluationsMap[evaluationItem.appointment_id] = evaluationItem;
          });
          setEvaluations(evaluationsMap);
        }
      }
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
        .select("user_id, subject, topic, date, start_time")
        .eq("appointment_id", appointmentId)
        .single();

      if (fetchError) throw fetchError;

      // Update the appointment status
      const updates = { status };
      if (status === "declined") {
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
          notificationMessage = `Your appointment request for ${appointmentData.subject}${appointmentData.topic ? ` - ${appointmentData.topic}` : ""} on ${formattedDate} at ${formattedTime} has been confirmed.`;
        } else if (status === "declined") {
          notificationMessage = `Your appointment request for ${appointmentData.subject}${appointmentData.topic ? ` - ${appointmentData.topic}` : ""} has been declined.`;
          if (metadata.reason) {
            notificationMessage += ` Reason: ${metadata.reason}`;
          }
        } else if (status === "cancelled") {
          notificationMessage = `Your appointment for ${appointmentData.subject}${appointmentData.topic ? ` - ${appointmentData.topic}` : ""} has been cancelled.`;
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

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-gray-600 font-bold text-2xl">Appointments</h1>
        <div className="mt-6 text-center">Loading appointments...</div>
      </div>
    );
  }

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (appointment) => {
    if (!normalizedSearch) return true;
    const haystack = `${appointment.student_name || ""} ${appointment.subject || ""} ${appointment.mode_of_session || ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  };

  const confirmedAppointments = appointments.filter(
    (appointment) =>
      ["pending", "confirmed", "started"].includes(appointment.status) &&
      matchesSearch(appointment)
  );

  const historyAppointments = appointments.filter(
    (appointment) =>
      (FINISHED_STATUSES.includes(appointment.status) ||
        appointment.status === "declined" ||
        appointment.status === "cancelled") &&
      matchesSearch(appointment)
  );

  const confirmedStatusOrder = ["pending", "confirmed", "started"];
  const confirmedByStatus = confirmedStatusOrder.reduce((acc, status) => {
    acc[status] = confirmedAppointments.filter(
      (appointment) => appointment.status === status
    );
    return acc;
  }, {});

  const historyStatusOrder = [
    "awaiting_feedback",
    "completed",
    "declined",
    "cancelled",
  ];
  const historyByStatus = historyStatusOrder.reduce((acc, status) => {
    acc[status] = historyAppointments.filter(
      (appointment) => appointment.status === status
    );
    return acc;
  }, {});

  const commentEntries = Object.entries(evaluations || {})
    .filter(([, evalData]) => evalData?.tutor_comment)
    .map(([appointmentId, evalData]) => {
      const appointmentInfo = appointments.find(
        (apt) => String(apt.appointment_id) === String(appointmentId)
      );
      const dateValue = appointmentInfo?.date
        ? new Date(appointmentInfo.date).getTime()
        : evalData?.created_at
        ? new Date(evalData.created_at).getTime()
        : 0;

      return {
        appointment: appointmentInfo,
        evaluation: evalData,
        appointmentId,
        dateValue,
      };
    })
    .sort((a, b) => b.dateValue - a.dateValue);

  const shuffledComments = commentEntries.slice().sort(() => Math.random() - 0.5);

  return (
    <div className="py-3 px-6">
      <h1 className="text-gray-600 font-bold text-2xl mb-6">Schedules</h1>

      {/* Filter Buttons */}
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <button
            className={`py-2 font-medium transition-all duration-200 text-gray-600 border-b-2 ${
              selectedFilter === "confirmed"
                ? "border-b-blue-600 text-blue-600"
                : "border-b-transparent"
            }`}
            onClick={() => handleFilterChange("confirmed")}
          >
            Appointments
          </button>
          <button
            className={`py-2 font-medium transition-all duration-200 text-gray-600 border-b-2 ${
              selectedFilter === "history"
                ? "border-b-blue-600 text-blue-600"
                : "border-b-transparent"
            }`}
            onClick={() => handleFilterChange("history")}
          >
            History
          </button>
          <button
            className={`py-2 font-medium transition-all duration-200 text-gray-600 border-b-2 ${
              selectedFilter === "comments"
                ? "border-b-blue-600 text-blue-600"
                : "border-b-transparent"
            }`}
            onClick={() => handleFilterChange("comments")}
          >
            Comments
          </button>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search student or subject"
          className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Appointments View */}
      {selectedFilter === "confirmed" && (
        <div className="space-y-6">
          {Object.values(confirmedByStatus).every((list) => list.length === 0) ? (
            <div className="text-center text-gray-500 py-8">
              <p>No appointments found. Students will appear here when they book sessions with you.</p>
            </div>
          ) : (
            confirmedStatusOrder.map((status) => {
              const list = confirmedByStatus[status] || [];
              if (list.length === 0) return null;
              return (
                <section key={status}>
                  <h3 className="text-lg font-semibold text-gray-700">
                    {formatStatusLabel(status)} sessions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {list.map((appointment) => (
                      <div
                        key={appointment.appointment_id}
                        className="bg-white border border-blue-300 rounded-lg p-4 cursor-pointer hover:shadow-md hover:shadow-blue-100 transition-shadow"
                        onClick={() => openModal(appointment)}
                      >
                        <div className="pl-3 border-l-3 border-blue-300 space-y-2">
                          <div className="font-medium text-gray-900">
                            {appointment.student_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatTime(appointment.start_time)} - {" "}
                            {formatTime(appointment.end_time)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {appointment.mode_of_session}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                              appointment.status
                            )}`}>
                            {formatStatusLabel(appointment.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* History View */}
      {selectedFilter === "history" && (
        <div className="space-y-6">
          {Object.values(historyByStatus).every((list) => list.length === 0) ? (
            <div className="text-center text-gray-500 py-8">
              <p>No historical appointments match this search.</p>
            </div>
          ) : (
            historyStatusOrder.map((status) => {
              const list = historyByStatus[status] || [];
              if (list.length === 0) return null;
              return (
                <section key={status}>
                  <h3 className="text-lg font-semibold text-gray-700">
                    {formatStatusLabel(status)} history
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {list.map((appointment) => (
                      <div
                        key={appointment.appointment_id}
                        className="bg-white border border-blue-300 rounded-lg p-4 cursor-pointer hover:shadow-md hover:shadow-blue-100 transition-shadow"
                        onClick={() => openModal(appointment)}
                      >
                        <div className="pl-3 border-l-3 border-blue-300 space-y-2">
                          <div className="font-medium text-gray-900">
                            {appointment.student_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatTime(appointment.start_time)} - {" "}
                            {formatTime(appointment.end_time)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {appointment.mode_of_session}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                              appointment.status
                            )}`}>
                            {formatStatusLabel(appointment.status)}
                          </span>
                          {appointment.status === "declined" &&
                            appointment.tutee_decline_reason && (
                              <div className="mt-2 text-xs text-red-600 font-medium">
                                Tutee reason: {appointment.tutee_decline_reason}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* Comments View */}
      {selectedFilter === "comments" && (
        <div className="space-y-4">
          {shuffledComments.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No anonymous comments yet.</p>
            </div>
          ) : (
            shuffledComments.map(({ appointment, evaluation, appointmentId }) => (
              <div
                key={appointmentId}
                className="bg-white border border-blue-300 rounded-lg p-4 space-y-3"
              >
                <h3 className="font-semibold text-gray-800">
                  Anonymous Comment
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-blue-50 border border-blue-100 rounded-md p-3">
                  {evaluation.tutor_comment}
                </p>
                <p className="text-xs text-gray-500">
                  These notes are submitted anonymously. Tutee information stays
                  hidden for privacy.
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      <AppointmentModal
        appointment={selectedAppointment}
        isOpen={isModalOpen}
        onClose={closeModal}
        onStatusUpdate={handleStatusUpdate}
        evaluation={selectedAppointment ? evaluations[selectedAppointment.appointment_id] : null}
      />
    </div>
  );
};

export default Schedule;
