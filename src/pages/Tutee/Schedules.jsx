import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";

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
    // Validate that all fields are filled
    const requiredFields = [
      "presentation_clarity",
      "drills_sufficiency",
      "patience_enthusiasm",
      "study_skills_development",
      "positive_impact",
    ];

    const missingFields = requiredFields.filter(
      (field) => !evaluationData[field]
    );

    if (missingFields.length > 0) {
      setError("Please rate all criteria before submitting.");
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
                Optional comment for your tutor
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
                This comment is sent anonymously. Your personal details remain hidden and protected.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 border-b border-gray-200 pb-4">
              LAV responses are optional and help improve the overall peer tutoring experience. You can still submit even if these items are blank.
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
    },
    []
  );

  useEffect(() => {
    if (appointment && isOpen) {
      initializeForm(appointment);
      setError("");
      setIsSaving(false);
      setIsEditing(false);
    }
  }, [appointment, initializeForm, isOpen]);

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

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "declined":
        return "bg-red-100 text-red-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!isOpen || !appointment) return null;

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
              <input
                type="text"
                name="mode_of_session"
                value={formData.mode_of_session}
                onChange={handleInputChange}
                placeholder="Mode of session"
                className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 w-40"
              />
            ) : (
              <span className="text-gray-900">
                {appointment.mode_of_session || "Not specified"}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Status:</span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                appointment.status
              )}`}
            >
              {appointment.status}
            </span>
          </div>
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
          {appointment.status === "completed" && appointment.hasEvaluation === false && (
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
          {!isEditing && (
            <button
              onClick={() => {
                onDelete(appointment.appointment_id);
                onClose();
              }}
              className="bg-red-500 text-white font-medium rounded-md px-4 py-2 text-sm hover:bg-red-600 flex-1"
            >
              Delete Appointment
            </button>
          )}
        </div>
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

  const getAppointments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
          file_link: appointment.file_link || profileLinks.file_link || null
        };
      });

      setAppointments(formattedData);
    } catch (err) {
      console.error(err.message);
      toast.error("Error loading appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAppointments();
  }, []);

  const handleDelete = async (appointmentId) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("appointment")
        .delete()
        .eq("appointment_id", appointmentId);

      if (error) throw error;

      getAppointments(); // Refresh the list
      toast.success("Appointment deleted successfully");
    } catch (err) {
      console.error(err.message);
      toast.error("Error deleting appointment");
    }
  };

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
          },
        ]);

      if (error) throw error;

      toast.success("Evaluation submitted successfully!");
      await getAppointments(); // Refresh appointments
    } catch (err) {
      console.error(err.message);
      toast.error("Error submitting evaluation");
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-gray-600 font-bold text-2xl">Schedules</h1>
        <div className="mt-6 text-center">Loading appointments...</div>
      </div>
    );
  }

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };

  const upcomingAppointments = appointments.filter(
    (appointment) =>
      appointment.status === "confirmed" ||
      appointment.status === "pending" ||
      appointment.status === "started"
  );

  const historyAppointments = appointments.filter(
    (appointment) =>
      appointment.status === "completed" ||
      appointment.status === "declined" ||
      appointment.status === "cancelled"
  );

  // Group appointments by date
  const groupAppointmentsByDate = (appointmentsList) => {
    const grouped = {};
    appointmentsList.forEach((appointment) => {
      const dateKey = getDateLabel(appointment.date);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(appointment);
    });

    // Sort the grouped appointments by date priority
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      // Priority order: Today, Tomorrow, then chronological
      if (a === "Today") return -1;
      if (b === "Today") return 1;
      if (a === "Tomorrow") return -1;
      if (b === "Tomorrow") return 1;

      // For other dates, sort chronologically
      const dateA = new Date(
        appointmentsList.find((apt) => getDateLabel(apt.date) === a)?.date
      );
      const dateB = new Date(
        appointmentsList.find((apt) => getDateLabel(apt.date) === b)?.date
      );
      return dateA - dateB;
    });

    // Create new sorted object
    const sortedGrouped = {};
    sortedKeys.forEach((key) => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  };

  // Group appointments for history: use pure date keys and uniform display labels
  const groupHistoryAppointmentsByDate = (appointmentsList) => {
    const grouped = {};
    appointmentsList.forEach((appointment) => {
      const d = new Date(appointment.date);
      const isoKey = new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
      )
        .toISOString()
        .slice(0, 10); // YYYY-MM-DD
      if (!grouped[isoKey]) grouped[isoKey] = [];
      grouped[isoKey].push(appointment);
    });

    const sortedKeys = Object.keys(grouped).sort(
      (a, b) => new Date(b) - new Date(a)
    );

    const sortedGrouped = {};
    sortedKeys.forEach((key) => {
      sortedGrouped[key] = grouped[key];
    });
    return sortedGrouped;
  };

  const groupedUpcomingAppointments = groupAppointmentsByDate(
    upcomingAppointments
  );
  const groupedHistoryAppointments =
    groupHistoryAppointmentsByDate(historyAppointments);

  return (
    <div className="py-3 px-6">
      <h1 className="text-gray-600 font-bold text-2xl mb-6">Schedules</h1>

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
          {Object.keys(groupedUpcomingAppointments).length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>
                No upcoming appointments found. Book your first appointment!
              </p>
            </div>
          ) : (
            Object.entries(groupedUpcomingAppointments).map(
              ([date, appointments]) => (
                <div key={date}>
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-700">
                      {date}
                    </h3>
                    {getDateSubtitle(appointments[0]?.date) && (
                      <p className="text-sm text-gray-500">
                        {getDateSubtitle(appointments[0]?.date)}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {appointments.map((appointment) => (
                      <div
                        key={appointment.appointment_id}
                        className="bg-white border border-blue-300 rounded-lg p-4 cursor-pointer hover:shadow-md hover:shadow-blue-100 transition-shadow"
                        onClick={() => openModal(appointment)}
                      >
                        <div className="pl-3 border-l-3 border-blue-300">
                          <div className="font-medium text-gray-900 mb-1">
                            {appointment.tutor_name}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            {formatTime(appointment.start_time)} -{" "}
                            {formatTime(appointment.end_time)}
                          </div>
                          <div className="text-sm text-gray-500 mb-1">
                            {appointment.mode_of_session}
                          </div>
                          {/* {appointment.status === "confirmed" && appointment.online_link && (
                            <div className="text-xs text-green-600 font-medium">
                              Online link available
                            </div>
                          )} */}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}

      {/* History View */}
      {selectedFilter === "history" && (
        <div className="space-y-6">
          {Object.keys(groupedHistoryAppointments).length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No appointment history found.</p>
            </div>
          ) : (
            Object.entries(groupedHistoryAppointments).map(
              ([isoDate, appointments]) => (
                <div key={isoDate}>
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-700">
                      {getFormattedDate(appointments[0]?.date)}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {appointments.map((appointment) => (
                      <div
                        key={appointment.appointment_id}
                        className="bg-white border border-blue-300 rounded-lg p-4 cursor-pointer hover:shadow-md hover:shadow-blue-100 transition-shadow"
                        onClick={() => openModal(appointment)}
                      >
                        <div className="pl-3 border-l-3 border-blue-300">
                          <div className="font-medium text-gray-900 mb-1">
                            {appointment.tutor_name}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            {formatTime(appointment.start_time)} -{" "}
                            {formatTime(appointment.end_time)}
                          </div>
                          <div className="text-sm text-gray-500 mb-1">
                            {appointment.mode_of_session}
                          </div>
                          {appointment.status === "completed" && !appointment.hasEvaluation && (
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
                          {appointment.status === "completed" && appointment.hasEvaluation && (
                            <div className="mt-2 text-xs text-green-600 font-medium">
                              ✓ Evaluated
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
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
