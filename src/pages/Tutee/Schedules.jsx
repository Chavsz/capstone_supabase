import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";

const FINISHED_STATUSES = ["completed"];
const UPCOMING_STATUS_TABS = [
  { status: "all", label: "All" },
  { status: "pending", label: "Pending" },
  { status: "confirmed", label: "Confirmed" },
  { status: "started", label: "In Session" },
  { status: "awaiting_feedback", label: "Awaiting Feedback" },
];
const HISTORY_STATUS_TABS = [
  { status: "completed", label: "Completed" },
  { status: "declined", label: "Declined" },
  { status: "cancelled", label: "Cancelled" },
];
const ITEMS_PER_PAGE = 6;

const STATUS_META = {
  pending: { label: "Pending", badge: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", badge: "bg-emerald-100 text-emerald-800" },
  started: { label: "In Session", badge: "bg-sky-100 text-sky-800" },
  awaiting_feedback: { label: "Awaiting Feedback", badge: "bg-orange-100 text-orange-800" },
  completed: { label: "Completed", badge: "bg-blue-100 text-blue-800" },
  declined: { label: "Declined", badge: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", badge: "bg-gray-100 text-gray-800" },
};

const formatStatusLabel = (status = "") =>
  STATUS_META[status]?.label || status.replace(/_/g, " ");

const statusBadge = (status = "") =>
  STATUS_META[status]?.badge || "bg-gray-100 text-gray-800";

// Evaluation Modal component
const EvaluationModal = ({
  appointment,
  isOpen,
  onClose,
  onEvaluate,
}) => {
  const [activeTab, setActiveTab] = useState("tutor");
  const [evaluationData, setEvaluationData] = useState({
    presentation_clarity: "",
    drills_sufficiency: "",
    patience_enthusiasm: "",
    study_skills_development: "",
    positive_impact: "",
    tutor_comment: "",
    lav_environment: "",
    lav_scheduling: "",
    lav_support: "",
    lav_book_again: "",
    lav_value: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && appointment) {
      // Reset form when modal opens
      setEvaluationData({
        presentation_clarity: "",
        drills_sufficiency: "",
        patience_enthusiasm: "",
        study_skills_development: "",
        positive_impact: "",
        tutor_comment: "",
        lav_environment: "",
        lav_scheduling: "",
        lav_support: "",
        lav_book_again: "",
        lav_value: "",
      });
      setError("");
      setActiveTab("tutor");
    }
  }, [isOpen, appointment]);

  const handleRatingChange = (criterion, value) => {
    setEvaluationData((prev) => ({
      ...prev,
      [criterion]: value,
    }));
  };

  const handleSubmit = async () => {
    const tutorRequired = [
      "presentation_clarity",
      "drills_sufficiency",
      "patience_enthusiasm",
      "study_skills_development",
      "positive_impact",
    ];

    const lavRequired = [
      "lav_environment",
      "lav_scheduling",
      "lav_support",
      "lav_book_again",
      "lav_value",
    ];

    const missingTutor = tutorRequired.filter(
      (field) => !evaluationData[field]
    );
    const missingLav = lavRequired.filter((field) => !evaluationData[field]);

    if (missingTutor.length > 0 || missingLav.length > 0) {
      setError(
        "Please provide ratings for every Tutor and LAV criterion before submitting."
      );
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await onEvaluate(appointment.appointment_id, evaluationData);
      onClose();
    } catch (err) {
      setError("Failed to submit evaluation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !appointment) return null;
  const ratingOptions = [
    { value: "5", label: "5 - Outstanding" },
    { value: "4", label: "4 - Very Satisfactory" },
    { value: "3", label: "3 - Satisfactory" },
    { value: "2", label: "2 - Needs Improvement" },
    { value: "1", label: "1 - Poor" },
    { value: "N/A", label: "N/A - Not Applicable" },
  ];

  const tutorCriteria = [
    {
      key: "presentation_clarity",
      label: "Clear and organized presentation of the lessons by the peer tutor.",
    },
    {
      key: "drills_sufficiency",
      label: "Sufficiency of drills and exercises provided by the tutor for the skill mastery.",
    },
    {
      key: "patience_enthusiasm",
      label: "Patience & enthusiasm of the peer tutor in satisfactorily answering questions regarding the lesson/s.",
    },
    {
      key: "study_skills_development",
      label: "Opportunity for development of my study skills gained from the tutorial session/s.",
    },
    {
      key: "positive_impact",
      label: "Positive impact in my progress in this subject as a result of the tutorial session.",
    },
  ];

  const lavCriteria = [
    {
      key: "lav_environment",
      label: "The comfort and cleanliness of the tutoring environment (physical or virtual).",
      options: ratingOptions,
    },
    {
      key: "lav_scheduling",
      label: "The convenience of scheduling and availability of tutors through the organization.",
      options: ratingOptions,
    },
    {
      key: "lav_support",
      label: "The level of support and communication provided by the organization before and after the tutoring sessions.",
      options: ratingOptions,
    },
    {
      key: "lav_book_again",
      label: "The likelihood that I would book another session with the organization based on my experience.",
      options: [
        { value: "5", label: "5 - Very Likely" },
        { value: "4", label: "4 - Likely" },
        { value: "3", label: "3 - Neutral" },
        { value: "2", label: "2 - Unlikely" },
        { value: "1", label: "1 - Very Unlikely" },
        { value: "N/A", label: "N/A - Not Applicable" },
      ],
    },
    {
      key: "lav_value",
      label: "How satisfied I am with the overall value of the tutoring services in relation to the cost (if applicable).",
      options: ratingOptions,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-blue-600">
            Evaluation Form
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Tutor:</span> {appointment.tutor_name}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Subject:</span> {appointment.subject}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Specialization:</span> {appointment.topic}
          </p>
        </div>

        <div className="mb-5 flex gap-3 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("tutor")}
            className={`px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "tutor"
                ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                : "text-gray-500"
            }`}
          >
            Evaluate Tutor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lav")}
            className={`px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "lav"
                ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                : "text-gray-500"
            }`}
          >
            Evaluate LAV
          </button>
        </div>

        <div className="space-y-6 mb-6">
          {(activeTab === "tutor" ? tutorCriteria : lavCriteria).map(
            (criterion, index) => (
              <div key={criterion.key} className="border-b border-gray-200 pb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  {index + 1}. {criterion.label}
                </p>
                <div className="flex flex-wrap gap-3">
                  {(criterion.options || ratingOptions).map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={criterion.key}
                        value={option.value}
                        checked={evaluationData[criterion.key] === option.value}
                        onChange={() =>
                          handleRatingChange(criterion.key, option.value)
                        }
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          )}

          {activeTab === "tutor" ? (
            <div className="space-y-2 border-b border-gray-200 pb-4">
              <label className="text-sm font-medium text-gray-700">
                Optional message (visible to your tutor only)
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                value={evaluationData.tutor_comment}
                onChange={(e) =>
                  setEvaluationData((prev) => ({
                    ...prev,
                    tutor_comment: e.target.value,
                  }))
                }
                placeholder="Share additional thoughts for your tutor"
              />
              <p className="text-xs text-gray-500">
                Only your tutor can read this message. It remains anonymous and your personal details are protected.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 border-b border-gray-200 pb-4">
              LAV responses are required and are shared only with Learning Assistance Volunteer administrators to improve the program. Tutors do not see these ratings.
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="bg-gray-500 text-white rounded-md px-4 py-2 text-sm hover:bg-gray-600 flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm hover:bg-blue-700 flex-1 disabled:bg-blue-300 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Evaluation"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal component for appointment details
const AppointmentModal = ({
  appointment,
  isOpen,
  onClose,
  onDelete,
  onUpdate,
  onEvaluate,
  onShareResources,
  onDeclineConfirmed,
  tutorSchedules = {},
}) => {
  const CLASS_TIME_BLOCKS = [
    { start: 8 * 60, end: 12 * 60 },
    { start: 13 * 60, end: 17 * 60 },
  ];

  const getMinutesFromString = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const getDayName = (dateString) => {
    if (!dateString) return null;
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { weekday: "long" });
  };

  const isWithinClassBlock = (startMinutes, endMinutes) =>
    CLASS_TIME_BLOCKS.some(
      (block) =>
        startMinutes >= block.start &&
        endMinutes <= block.end
    );

  const validateAgainstTutorSchedule = () => {
    if (!appointment) return { valid: false, message: "Appointment information not found." };
    const schedules = tutorSchedules[appointment.tutor_id];
    if (!schedules || schedules.length === 0) {
      return {
        valid: false,
        message: "Tutor availability is not available. Please try again later.",
      };
    }

    const startMinutes = getMinutesFromString(formData.start_time);
    const endMinutes = getMinutesFromString(formData.end_time);
    if (startMinutes === null || endMinutes === null) {
      return { valid: false, message: "Invalid start or end time." };
    }

    const dayName = getDayName(formData.date);
    if (!dayName) {
      return { valid: false, message: "Invalid appointment date." };
    }

    const daySchedules = schedules.filter((schedule) => schedule.day === dayName);
    if (daySchedules.length === 0) {
      return {
        valid: false,
        message: `Tutor is not available on ${dayName}. Please choose another date.`,
      };
    }

    if (!isWithinClassBlock(startMinutes, endMinutes)) {
      return {
        valid: false,
        message: "Times must fall within 8:00 AM - 12:00 PM or 1:00 PM - 5:00 PM.",
      };
    }

    const withinSchedule = daySchedules.some((schedule) => {
      const scheduleStart = getMinutesFromString(schedule.start_time);
      const scheduleEnd = getMinutesFromString(schedule.end_time);
      if (scheduleStart === null || scheduleEnd === null) return false;
      return startMinutes >= scheduleStart && endMinutes <= scheduleEnd;
    });

    if (!withinSchedule) {
      return {
        valid: false,
        message: "Selected time is outside of the tutor's availability for that day.",
      };
    }

    return { valid: true };
  };
  const [formData, setFormData] = useState({
    date: "",
    start_time: "",
    end_time: "",
    mode_of_session: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [resourceLink, setResourceLink] = useState("");
  const [resourceNote, setResourceNote] = useState("");
  const [resourceMessage, setResourceMessage] = useState("");
  const [resourceStatus, setResourceStatus] = useState("");
  const [isResourceSaving, setIsResourceSaving] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState("");
  const [isDeclining, setIsDeclining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const initializeForm = useCallback(
    (sourceAppointment) => {
      if (!sourceAppointment) return;

      const normalizeDate = (value) => {
        if (!value) return "";
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString().split("T")[0];
        }
        return value;
      };

      const normalizeTime = (value) => {
        if (!value) return "";
        return value.slice(0, 5);
      };

      setFormData({
        date: normalizeDate(sourceAppointment.date),
        start_time: normalizeTime(sourceAppointment.start_time),
        end_time: normalizeTime(sourceAppointment.end_time),
        mode_of_session: sourceAppointment.mode_of_session || "",
      });
      setResourceLink(sourceAppointment.resource_link || "");
      setResourceNote(sourceAppointment.resource_note || "");
      setResourceMessage("");
      setResourceStatus("");
    },
    []
  );

  useEffect(() => {
    if (appointment && isOpen) {
      initializeForm(appointment);
      setError("");
      setIsSaving(false);
      setIsEditing(false);
      setResourceMessage("");
      setResourceStatus("");
      setDeclineReason("");
      setDeclineError("");
      setIsDeclining(false);
    }
  }, [appointment, initializeForm, isOpen]);

  const handleConfirmedDecline = async () => {
    if (!declineReason.trim()) {
      setDeclineError("Please provide a short reason for declining.");
      return;
    }
    if (!onDeclineConfirmed || !appointment) return;

    setDeclineError("");
    setIsDeclining(true);
    try {
      await onDeclineConfirmed({
        appointment,
        reason: declineReason.trim(),
      });
      setDeclineReason("");
      onClose();
    } catch (err) {
      setDeclineError(
        err?.message || "Unable to decline this appointment. Please try again."
      );
    } finally {
      setIsDeclining(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateClick = async () => {
    if (!appointment || !onUpdate) return;

    if (!formData.date || !formData.start_time || !formData.end_time) {
      setError("Please complete the date and time fields.");
      return;
    }

    const startDate = new Date(`1970-01-01T${formData.start_time}`);
    const endDate = new Date(`1970-01-01T${formData.end_time}`);

    if (startDate >= endDate) {
      setError("End time must be later than start time.");
      return;
    }

    const availabilityCheck = validateAgainstTutorSchedule();
    if (!availabilityCheck.valid) {
      setError(availabilityCheck.message);
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      await onUpdate(appointment.appointment_id, formData);
    } catch (err) {
      // onUpdate handles errors and user feedback
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError("");
    initializeForm(appointment);
  };

  const handleResourceSave = async () => {
    if (!appointment) return;
    if (!resourceLink.trim()) {
      setResourceStatus("error");
      setResourceMessage("Please provide a valid resource link before sharing.");
      return;
    }
    const payload = {
      resource_link: resourceLink.trim() || null,
      resource_note: resourceNote.trim() || null,
    };
    setIsResourceSaving(true);
    setResourceMessage("");
    setResourceStatus("");
    try {
      const success = await onShareResources?.(appointment.appointment_id, payload);
      if (success) {
        setResourceStatus("success");
        setResourceMessage("Shared link");
      } else {
        setResourceStatus("error");
        setResourceMessage("Unable to save link. Please try again.");
      }
    } catch (err) {
      setResourceStatus("error");
      setResourceMessage("Unable to save link. Please try again.");
    } finally {
      setIsResourceSaving(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const canShareResources =
    ["confirmed", "started"].includes(appointment.status);
  const canDeleteAppointment = appointment.status === "pending";

  const handleDeleteClick = async () => {
    if (!onDelete || !appointment) return;
    setIsDeleting(true);
    try {
      await onDelete(appointment.appointment_id);
    } finally {
      setIsDeleting(false);
    }
  };

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-7">
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
            <span className="font-semibold text-gray-600">Subject:</span>
            <span className="text-gray-900">{appointment.subject}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Specialization:</span>
            <span className="text-gray-900">{appointment.topic}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Tutor:</span>
            <span className="text-gray-900">{appointment.tutor_name}</span>
          </div>
          {appointment.tutor_name && (
            <>
              {/* <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">College:</span>
                <span className="text-gray-900">
                  {appointment.college || "Not specified"}
                </span>
              </div> */}
              {/* <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-600">Specialization:</span>
                <span className="text-gray-900">
                  {appointment.topic || "Not specified"}
                </span>
              </div> */}
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Date:</span>
            {appointment.status === "pending" && isEditing ? (
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
              />
            ) : (
              <span className="text-gray-900">
                {formatDate(appointment.date)}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Time:</span>
            {appointment.status === "pending" && isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
                />
                <span className="text-gray-600 text-sm">to</span>
                <input
                  type="time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
                />
              </div>
            ) : (
              <span className="text-gray-900">
                {formatTime(appointment.start_time)} -{" "}
                {formatTime(appointment.end_time)}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Mode:</span>
            {appointment.status === "pending" && isEditing ? (
              <select
                name="mode_of_session"
                value={formData.mode_of_session}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 w-40"
              >
                <option value="">Select mode</option>
                <option value="Face-to-Face">Face-to-Face</option>
                <option value="Online">Online</option>
              </select>
            ) : (
              <span className="text-gray-900">
                {appointment.mode_of_session || "Not specified"}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Number of Tutees:</span>
            <span className="text-gray-900">
              {appointment.number_of_tutees || 1}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Status:</span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(
                appointment.status
              )}`}
            >
              {formatStatusLabel(appointment.status)}
            </span>
          </div>
          {appointment.status === "declined" && appointment.tutor_decline_reason && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              Tutor note: {appointment.tutor_decline_reason}
            </div>
          )}
        {(appointment.status === "confirmed" || appointment.status === "started") && appointment.online_link && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-600">Online Link:</span>
              <a
                href={appointment.online_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
              >
                Join Meeting
              </a>
            </div>
          )}
        {(appointment.status === "confirmed" || appointment.status === "started") && appointment.file_link && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-600">Materials:</span>
              <a
                href={appointment.file_link}
                rel="noopener noreferrer"
                target="_blank"
                className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
              >
                {appointment.file_link}
              </a>
            </div>
          )}
        </div>

        {canShareResources && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Share resources with your tutor
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Paste a Google Drive or resource link along with notes about the topic or specific
              pages your tutor should focus on.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Resource Link
                </label>
                <input
                  type="url"
                  value={resourceLink}
                  onChange={(e) => setResourceLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Note to Tutor
                </label>
                <textarea
                  value={resourceNote}
                  onChange={(e) => setResourceNote(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add page numbers, chapters, or quick instructions for the tutor."
                />
              </div>
              {resourceMessage && (
                <p
                  className={`text-xs ${
                    resourceStatus === "success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {resourceMessage}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResourceSave}
                  className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm hover:bg-blue-700 flex-1 disabled:bg-blue-300 disabled:cursor-not-allowed"
                  disabled={isResourceSaving}
                >
                  {isResourceSaving ? "Saving..." : "Share Link"}
                </button>
              </div>
            </div>
          </div>
        )}

        {appointment.status === "confirmed" && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Cancel confirmed session
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              If you can no longer attend, tell your tutor why. The session will be cancelled and the tutor will receive your message.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Explain why you need to cancel..."
            />
            {declineError && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {declineError}
              </p>
            )}
            <button
              type="button"
              onClick={handleConfirmedDecline}
              className="mt-3 bg-red-600 text-white rounded-md px-4 py-2 text-sm hover:bg-red-700 w-full disabled:bg-red-300 disabled:cursor-not-allowed"
              disabled={isDeclining}
            >
              {isDeclining ? "Sending..." : "Cancel Appointment"}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        {error && (
          <p className="text-sm text-red-600 mb-2" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {appointment.status === "pending" && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm hover:bg-blue-700 flex-1"
              >
              Update Appointment
            </button>
          )}
          {appointment.status === "pending" && isEditing && (
            <>
              <button
                onClick={handleUpdateClick}
                className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm hover:bg-blue-700 flex-1 disabled:bg-blue-300 disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelEdit}
                className="bg-gray-200 text-gray-800 rounded-md px-4 py-2 text-sm hover:bg-gray-300 flex-1"
                disabled={isSaving}
              >
                Cancel
              </button>
            </>
          )}
          {appointment.status === "awaiting_feedback" && (
            <button
              onClick={() => {
                onClose();
                if (onEvaluate) {
                  onEvaluate(appointment);
                }
              }}
              className="bg-green-500 text-white font-medium rounded-md px-4 py-2 text-sm hover:bg-green-500 flex-1"
            >
              Evaluate Session
            </button>
          )}
        </div>
        {canDeleteAppointment && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              Remove pending request
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              You can only delete appointments while they are still pending.
            </p>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-full bg-red-600 text-white rounded-md px-4 py-2 text-sm hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Appointment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Schedules = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("upcoming");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvaluationAppointment, setSelectedEvaluationAppointment] = useState(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [tutorSchedules, setTutorSchedules] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notificationCount, setNotificationCount] = useState(0);
  const [upcomingPages, setUpcomingPages] = useState({});
  const [historyPages, setHistoryPages] = useState({});

  const getAppointments = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCurrentUserId(session.user.id);

      const { data, error } = await supabase
        .from("appointment")
        .select(`
          *,
          tutor:users!tutor_id(name)
        `)
        .eq("user_id", session.user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Fetch tutor profiles to get online_link and file_link
      const tutorIds = [...new Set((data || []).map(apt => apt.tutor_id))];
      let tutorProfiles = {};
      let scheduleMap = {};
      if (tutorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profile")
          .select("user_id, profile_id, online_link, file_link")
          .in("user_id", tutorIds);
        
        if (profilesData) {
          const profileIdToUserId = {};
          profilesData.forEach(profile => {
            tutorProfiles[profile.user_id] = {
              online_link: profile.online_link,
              file_link: profile.file_link
            };
            if (profile.profile_id) {
              profileIdToUserId[profile.profile_id] = profile.user_id;
            }
          });

          const profileIds = profilesData
            .map(profile => profile.profile_id)
            .filter(Boolean);

          if (profileIds.length > 0) {
            const { data: schedulesData } = await supabase
              .from("schedule")
              .select("profile_id, day, start_time, end_time")
              .in("profile_id", profileIds);

            if (schedulesData) {
              schedulesData.forEach((slot) => {
                const userId = profileIdToUserId[slot.profile_id];
                if (!userId) return;
                if (!scheduleMap[userId]) {
                  scheduleMap[userId] = [];
                }
                scheduleMap[userId].push(slot);
              });
            }
          }
        }
      }
      setTutorSchedules(scheduleMap);

      // Check which appointments have evaluations
      const appointmentIds = (data || []).map(apt => apt.appointment_id);
      const { data: evaluations } = await supabase
        .from("evaluation")
        .select("appointment_id")
        .in("appointment_id", appointmentIds);

      const evaluatedAppointmentIds = new Set(
        (evaluations || []).map(evaluationItem => evaluationItem.appointment_id)
      );

      // Format data to match expected structure
      const formattedData = (data || []).map(appointment => {
        // Use links from appointment table if available, otherwise use profile links
        const profileLinks = tutorProfiles[appointment.tutor_id] || {};
        
        return {
          ...appointment,
          tutor_name: appointment.tutor?.name || null,
          hasEvaluation: evaluatedAppointmentIds.has(appointment.appointment_id),
          online_link: appointment.online_link || profileLinks.online_link || null,
          file_link: appointment.file_link || profileLinks.file_link || null,
          resource_link: appointment.resource_link || null,
          resource_note: appointment.resource_note || null,
          tutor_note: appointment.tutor_note || null,
          tutor_decline_reason: appointment.tutor_decline_reason || null,
        };
      });

      setAppointments(formattedData);
    } catch (err) {
      console.error(err.message);
      toast.error("Error loading appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotificationCount = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { count, error } = await supabase
        .from("notification")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("status", "unread");

      if (error) throw error;

      setNotificationCount(count || 0);
    } catch (err) {
      console.error(err.message);
    }
  }, []);

  useEffect(() => {
    getAppointments();
    fetchNotificationCount();
  }, [getAppointments, fetchNotificationCount]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`tutee-appointments-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => getAppointments()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, getAppointments]);

  const handleAppointmentUpdate = async (appointmentId, updatedFields) => {
    try {
      const { error } = await supabase
        .from("appointment")
        .update(updatedFields)
        .eq("appointment_id", appointmentId);

      if (error) throw error;

      toast.success("Appointment updated successfully");
      await getAppointments();
      setIsModalOpen(false);
      setSelectedAppointment(null);
      return true;
    } catch (err) {
      console.error(err.message);
      toast.error("Error updating appointment");
      return false;
    }
  };

  const handleDelete = async (appointmentId) => {
    const target = appointments.find((apt) => apt.appointment_id === appointmentId);
    if (!target || target.status !== "pending") {
      toast.error("Only pending requests can be deleted.");
      return false;
    }
    if (!window.confirm("Remove this pending appointment?")) {
      return false;
    }
    try {
      const { error } = await supabase
        .from("appointment")
        .delete()
        .eq("appointment_id", appointmentId)
        .eq("status", "pending");

      if (error) throw error;

      toast.success("Appointment deleted");
      await getAppointments();
      setIsModalOpen(false);
      setSelectedAppointment(null);
      return true;
    } catch (err) {
      console.error(err.message);
      toast.error("Unable to delete appointment");
      return false;
    }
  };

  const handleResourceShare = async (appointmentId, payload) => {
    try {
      const { error } = await supabase
        .from("appointment")
        .update(payload)
        .eq("appointment_id", appointmentId);

      if (error) throw error;

      toast.success("Resources shared with your tutor.");
      await getAppointments();
      return true;
    } catch (err) {
      console.error(err.message);
      toast.error("Unable to save resources.");
      return false;
    }
  };

  const handleConfirmedDecline = async ({ appointment, reason }) => {
    if (!appointment) return;
    try {
      const { error } = await supabase
        .from("appointment")
        .update({
          status: "cancelled",
          tutee_decline_reason: reason,
        })
        .eq("appointment_id", appointment.appointment_id)
        .eq("status", "confirmed");

      if (error) throw error;

      if (appointment.tutor_id) {
        const formattedDate = new Date(appointment.date).toLocaleDateString(
          "en-US",
          { month: "long", day: "numeric", year: "numeric" }
        );
        const formattedTime = formatTime(appointment.start_time);
        const notificationMessage = `Your tutee cancelled the session for ${
          appointment.subject || "a session"
        }${appointment.topic ? ` - ${appointment.topic}` : ""} on ${
          formattedDate || appointment.date
        } at ${formattedTime}. Reason: ${reason}`;

        const { error: notificationError } = await supabase
          .from("notification")
          .insert([
            {
              user_id: appointment.tutor_id,
              notification_content: notificationMessage,
              status: "unread",
            },
          ]);

        if (notificationError) throw notificationError;
      }

      toast.success("Session cancelled and your tutor has been notified.");
      await getAppointments();
    } catch (err) {
      console.error(err.message);
      toast.error("Unable to cancel this appointment right now.");
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

  const openEvaluationModal = (appointment) => {
    setSelectedEvaluationAppointment(appointment);
    setIsEvaluationModalOpen(true);
  };

  const closeEvaluationModal = () => {
    setIsEvaluationModalOpen(false);
    setSelectedEvaluationAppointment(null);
  };

  const handleEvaluate = async (appointmentId, evaluationData) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to submit an evaluation");
        return;
      }

      // Get appointment details to get tutor_id
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointment")
        .select("tutor_id")
        .eq("appointment_id", appointmentId)
        .single();

      if (appointmentError) throw appointmentError;

      // Insert evaluation
      const { error } = await supabase
        .from("evaluation")
        .insert([
          {
            appointment_id: appointmentId,
            tutor_id: appointmentData.tutor_id,
            user_id: session.user.id,
            presentation_clarity: evaluationData.presentation_clarity,
            drills_sufficiency: evaluationData.drills_sufficiency,
            patience_enthusiasm: evaluationData.patience_enthusiasm,
            study_skills_development: evaluationData.study_skills_development,
            positive_impact: evaluationData.positive_impact,
            tutor_comment: evaluationData.tutor_comment?.trim() || null,
            lav_environment: evaluationData.lav_environment,
            lav_scheduling: evaluationData.lav_scheduling,
            lav_support: evaluationData.lav_support,
            lav_book_again: evaluationData.lav_book_again,
            lav_value: evaluationData.lav_value,
          },
        ]);

      if (error) throw error;

      const { error: statusError } = await supabase
        .from("appointment")
        .update({ status: "completed" })
        .eq("appointment_id", appointmentId)
        .eq("status", "awaiting_feedback");

      if (statusError) throw statusError;

      toast.success("Evaluation submitted successfully!");
      await getAppointments(); // Refresh appointments
    } catch (err) {
      console.error(err.message);
      toast.error("Error submitting evaluation");
      throw err;
    }
  };

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (appointment) => {
    if (!normalizedSearch) return true;
    const haystack = `${appointment.tutor_name || ""} ${appointment.subject || ""} ${appointment.topic || ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  };

  const upcomingAppointments = appointments.filter(
    (appointment) =>
      ["pending", "confirmed", "started", "awaiting_feedback"].includes(
        appointment.status
      ) && matchesSearch(appointment)
  );

  const historyAppointments = appointments.filter(
    (appointment) =>
      (FINISHED_STATUSES.includes(appointment.status) ||
        appointment.status === "declined" ||
        appointment.status === "cancelled") &&
      matchesSearch(appointment)
  );

  const upcomingStatusOrder = [
    "pending",
    "confirmed",
    "started",
    "awaiting_feedback",
  ];
  const upcomingByStatus = upcomingStatusOrder.reduce((acc, status) => {
    acc[status] = upcomingAppointments.filter(
      (appointment) => appointment.status === status
    );
    return acc;
  }, {});

  const historyStatusOrder = ["completed", "declined", "cancelled"];
  const historyByStatus = historyStatusOrder.reduce((acc, status) => {
    acc[status] = historyAppointments.filter(
      (appointment) => appointment.status === status
    );
    return acc;
  }, {});

  useEffect(() => {
    setStatusFilter("all");
  }, [selectedFilter]);

  const statusTabs =
    selectedFilter === "upcoming" ? UPCOMING_STATUS_TABS : HISTORY_STATUS_TABS;

  const baseAppointments =
    selectedFilter === "upcoming" ? upcomingAppointments : historyAppointments;

  const getStatusCount = (status) => {
    if (status === "all") return baseAppointments.length;
    return baseAppointments.filter((apt) => apt.status === status).length;
  };

  const displayUpcomingStatuses =
    statusFilter === "all" ? upcomingStatusOrder : [statusFilter];
  const displayHistoryStatuses =
    statusFilter === "all" ? historyStatusOrder : [statusFilter];

  const shouldShowStatus = (status) => {
    if (!status) return false;
    return (historyByStatus[status] || []).length > 0;
  };

  const getCurrentPage = (status, isUpcoming, totalPages) => {
    const pages = isUpcoming ? upcomingPages : historyPages;
    const current = pages[status] || 1;
    return Math.min(Math.max(current, 1), Math.max(totalPages, 1));
  };

  const handlePageChange = (status, delta, isUpcoming, totalPages) => {
    const setter = isUpcoming ? setUpcomingPages : setHistoryPages;
    setter((prev) => {
      const current = Math.max(1, Math.min(prev[status] || 1, totalPages));
      const next = Math.min(Math.max(current + delta, 1), totalPages);
      return { ...prev, [status]: next };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-gray-600 font-bold text-2xl">Schedules</h1>
        <div className="mt-6 text-center">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="py-3 px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
        <h1 className="text-gray-600 font-bold text-2xl">Schedules</h1>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tutor, subject or topic"
          className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        {statusTabs.map((tab) => (
          <button
            key={tab.status}
            onClick={() => setStatusFilter(tab.status)}
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition ${
              statusFilter === tab.status
                ? "bg-blue-600 text-white border-blue-600"
                : "text-gray-600 border-gray-300 hover:border-blue-500"
            }`}
          >
            {tab.label}
            <span className="text-xs text-gray-500 rounded-full bg-white px-2 py-0.5">
              {getStatusCount(tab.status)}
            </span>
          </button>
        ))}
        <span className="ml-auto text-xs font-semibold text-blue-600">
          Unread notifications: {notificationCount}
        </span>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          className={`py-2 font-medium transition-all duration-200 text-gray-600 border-b-2 ${
            selectedFilter === "upcoming"
              ? "border-b-blue-600 text-blue-600"
              : "border-b-transparent"
          }`}
          onClick={() => handleFilterChange("upcoming")}
        >
          Upcoming
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
      </div>

      {/* Upcoming Appointments View */}
      {selectedFilter === "upcoming" && (
        <div className="space-y-6">
          {Object.values(upcomingByStatus).every((list) => list.length === 0) ? (
            <div className="text-center text-gray-500 py-8">
              <p>No upcoming appointments match this search.</p>
            </div>
          ) : (
            displayUpcomingStatuses.map((status) => {
              const list = upcomingByStatus[status] || [];
              if (list.length === 0) return null;
              const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
              const currentPage = getCurrentPage(status, true, totalPages);
              const pagedList = list.slice(
                (currentPage - 1) * ITEMS_PER_PAGE,
                currentPage * ITEMS_PER_PAGE
              );
              return (
                <section key={status}>
                  <h3 className="text-lg font-semibold text-gray-700">
                    {formatStatusLabel(status)} appointments
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {pagedList.map((appointment) => (
                      <div
                        key={appointment.appointment_id}
                        className="bg-white border border-blue-300 rounded-lg p-4 cursor-pointer hover:shadow-md hover:shadow-blue-100 transition-shadow"
                        onClick={() => openModal(appointment)}
                      >
                        <div className="pl-3 border-l-3 border-blue-300 space-y-2">
                          <div className="font-medium text-gray-900">
                            {appointment.tutor_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatTime(appointment.start_time)} -{" "}
                            {formatTime(appointment.end_time)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {appointment.mode_of_session}
                          </div>
                          <div className="text-sm text-gray-500">
                            Number of tutees: {appointment.number_of_tutees || 1}
                          </div>
                          <div className="text-sm text-gray-500">
                            Number of tutees: {appointment.number_of_tutees || 1}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                              appointment.status
                            )}`}
                          >
                            {formatStatusLabel(appointment.status)}
                          </span>
                          {appointment.status === "declined" &&
                            appointment.tutor_decline_reason && (
                              <div className="mt-2 text-xs text-red-600 font-medium">
                                Tutor note: {appointment.tutor_decline_reason}
                              </div>
                            )}
                          {appointment.status === "awaiting_feedback" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEvaluationModal(appointment);
                              }}
                              className="mt-2 bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700"
                            >
                              Evaluate
                            </button>
                          )}
                          {appointment.status === "completed" && (
                            <div className="mt-2 text-xs text-emerald-600 font-medium">
                              Evaluated
                            </div>
                          )}
                          {appointment.tutor_note && (
                            <div className="mt-2 text-xs text-gray-600 font-medium">
                              Tutor note: {appointment.tutor_note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex justify-end items-center gap-2 mt-3 text-sm text-gray-600">
                      <button
                        className={`px-3 py-1 rounded border ${currentPage === 1 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "text-gray-600 border-gray-300 hover:border-blue-500"}`}
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(status, -1, true, totalPages)}
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-500">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className={`px-3 py-1 rounded border ${currentPage === totalPages ? "text-gray-400 border-gray-200 cursor-not-allowed" : "text-gray-600 border-gray-300 hover:border-blue-500"}`}
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(status, 1, true, totalPages)}
                      >
                        Next
                      </button>
                    </div>
                  )}
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
            displayHistoryStatuses.map((status) => {
              const list = historyByStatus[status] || [];
              if (list.length === 0) return null;
              if (!shouldShowStatus(status)) return null;
              const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
              const currentPage = getCurrentPage(status, false, totalPages);
              const pagedList = list.slice(
                (currentPage - 1) * ITEMS_PER_PAGE,
                currentPage * ITEMS_PER_PAGE
              );
              return (
                <section key={status}>
                  <h3 className="text-lg font-semibold text-gray-700">
                    {formatStatusLabel(status)} history
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {pagedList.map((appointment) => (
                      <div
                        key={appointment.appointment_id}
                        className="bg-white border border-blue-300 rounded-lg p-4 cursor-pointer hover:shadow-md hover:shadow-blue-100 transition-shadow"
                        onClick={() => openModal(appointment)}
                      >
                        <div className="pl-3 border-l-3 border-blue-300 space-y-2">
                          <div className="font-medium text-gray-900">
                            {appointment.tutor_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatTime(appointment.start_time)} -{" "}
                            {formatTime(appointment.end_time)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {appointment.mode_of_session}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                              appointment.status
                            )}`}
                          >
                            {formatStatusLabel(appointment.status)}
                          </span>
                          {appointment.status === "declined" &&
                            appointment.tutor_decline_reason && (
                              <div className="mt-2 text-xs text-red-600 font-medium">
                                Tutor note: {appointment.tutor_decline_reason}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex justify-end items-center gap-2 mt-3 text-sm text-gray-600">
                      <button
                        className={`px-3 py-1 rounded border ${currentPage === 1 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "text-gray-600 border-gray-300 hover:border-blue-500"}`}
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(status, -1, false, totalPages)}
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-500">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className={`px-3 py-1 rounded border ${currentPage === totalPages ? "text-gray-400 border-gray-200 cursor-not-allowed" : "text-gray-600 border-gray-300 hover:border-blue-500"}`}
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(status, 1, false, totalPages)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      )}

      {/* Appointment Modal */}
      <AppointmentModal
        appointment={selectedAppointment}
        isOpen={isModalOpen}
        onClose={closeModal}
        onDelete={handleDelete}
        onUpdate={handleAppointmentUpdate}
        onEvaluate={openEvaluationModal}
        onShareResources={handleResourceShare}
        onDeclineConfirmed={handleConfirmedDecline}
        tutorSchedules={tutorSchedules}
      />

      {/* Evaluation Modal */}
      <EvaluationModal
        appointment={selectedEvaluationAppointment}
        isOpen={isEvaluationModalOpen}
        onClose={closeEvaluationModal}
        onEvaluate={handleEvaluate}
      />
    </div>
  );
};

export default Schedules;
