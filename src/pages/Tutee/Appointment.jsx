import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../supabase-client";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";
import { capitalizeWords } from "../../utils/text";
import useActionGuard from "../../hooks/useActionGuard";

const BOOKED_STATUSES = ["confirmed", "started", "awaiting_feedback"];

const Appointment = () => {
  const location = useLocation();
  const [tutors, setTutors] = useState([]);
  const [tutorDetails, setTutorDetails] = useState({});
  const [tutorSchedules, setTutorSchedules] = useState({});
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [formData, setFormData] = useState({
    subject: "",
    topic: "",
    mode_of_session: "",
    date: "",
    start_time: "",
    end_time: "",
    number_of_tutees: "",
  });
  const [tuteeProfile, setTuteeProfile] = useState(null);
  const [loadingTuteeProfile, setLoadingTuteeProfile] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [hasPendingEvaluation, setHasPendingEvaluation] = useState(false);
  const [detailsTutorId, setDetailsTutorId] = useState(null);
  const [showAllSubjectTutors, setShowAllSubjectTutors] = useState(false);
  const [showTutorDrawer, setShowTutorDrawer] = useState(false);
  const [tutorUnavailableDays, setTutorUnavailableDays] = useState({});
  const [drawerDismissedKey, setDrawerDismissedKey] = useState("");
  const [appointmentsForDate, setAppointmentsForDate] = useState([]);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [draftTutorId, setDraftTutorId] = useState(null);
  const { run: runAction, busy: actionBusy } = useActionGuard();
  const lastDetailsAvailabilityRef = useRef(null);

  const subjects = [
    {
      name: "Programming",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
    },
    {
      name: "Chemistry",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
    },
    {
      name: "Physics",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50",
    },
    {
      name: "Calculus and Statistics",
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-50",
    },
    {
      name: "Psychology and Language",
      color: "from-teal-500 to-lime-500",
      bgColor: "bg-teal-50",
    },
    {
      name: "Engineering",
      color: "from-indigo-500 to-blue-600",
      bgColor: "bg-indigo-50",
    },
    {
      name: "Accountancy and Economics",
      color: "from-yellow-500 to-amber-500",
      bgColor: "bg-yellow-50",
    },
  ];

  const getTutors = async () => {
    try {
      setLoadingProfiles(true);
      const { data: { session } } = await supabase.auth.getSession();
      const selfId = session?.user?.id || null;
      setCurrentUserId(selfId);
      if (selfId) {
        await checkPendingEvaluations(selfId);
      }
      // Get all tutors (users with role = 'tutor')
      const { data: tutorsData, error: tutorsError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "tutor");

      if (tutorsError) throw tutorsError;

      const filteredTutors = (tutorsData || []).filter(
        (tutor) => tutor.user_id !== selfId
      );

      setTutors(filteredTutors);

      // Get tutor profiles
      const tutorIds = filteredTutors.map((t) => t.user_id);
      if (tutorIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profile")
          .select("*")
          .in("user_id", tutorIds);

        if (profilesError) throw profilesError;

        const profilesMap = {};
        const profileIdToUserId = {};
        (profilesData || []).forEach((profile) => {
          profilesMap[profile.user_id] = {
            profile_id: profile.profile_id,
            nickname: profile.nickname,
            subject: profile.subject,
            specialization: profile.specialization,
            college: profile.college,
            program: profile.program,
            year_level: profile.year_level,
            profile_image: profile.profile_image,
            online_link: profile.online_link,
          };
          if (profile.profile_id) {
            profileIdToUserId[profile.profile_id] = profile.user_id;
          }
        });

        setTutorDetails(profilesMap);

        const profileIds = (profilesData || [])
          .map((profile) => profile.profile_id)
          .filter(Boolean);
        if (profileIds.length > 0) {
          const { data: unavailableData, error: unavailableError } =
            await supabase
              .from("tutor_unavailable_days")
              .select("profile_id, date, reason")
              .in("profile_id", profileIds);

          if (unavailableError) throw unavailableError;

          const unavailableMap = {};
          (unavailableData || []).forEach((entry) => {
            const userId = profileIdToUserId[entry.profile_id];
            if (!userId) return;
            if (!unavailableMap[userId]) {
              unavailableMap[userId] = [];
            }
            unavailableMap[userId].push({
              date: entry.date,
              reason: entry.reason || "",
            });
          });

          setTutorUnavailableDays(unavailableMap);
        } else {
          setTutorUnavailableDays({});
        }
      }
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const getTuteeProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("student_profile")
        .select("program, college, year_level, profile_image")
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

      setTuteeProfile(profileData);
    } catch (err) {
      console.error("Unable to load student profile:", err.message);
    } finally {
      setLoadingTuteeProfile(false);
    }
  };

  const checkPendingEvaluations = useCallback(
    async (userIdOverride) => {
      try {
        const targetUserId = userIdOverride || currentUserId;
        if (!targetUserId) return;
        const { data, error } = await supabase
          .from("appointment")
          .select("appointment_id")
          .eq("user_id", targetUserId)
          .eq("status", "awaiting_feedback")
          .limit(1);

        if (error) throw error;
        setHasPendingEvaluation((data || []).length > 0);
      } catch (err) {
        console.error("Unable to check pending evaluations:", err.message);
      }
    },
    [currentUserId]
  );

  const fetchAppointmentsForDate = useCallback(async (targetDate) => {
    if (!targetDate) {
      setAppointmentsForDate([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("appointment")
        .select("tutor_id, start_time, end_time, status")
        .eq("date", targetDate)
        .in("status", BOOKED_STATUSES);

      if (error) throw error;
      setAppointmentsForDate(data || []);
    } catch (err) {
      console.error("Unable to load tutor bookings:", err.message);
    }
  }, []);

  const getTutorDetails = async (tutorId) => {
    try {
      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", tutorId)
        .single();

      if (error) {
        if (error.code === "PGRST116" || error.status === 406) {
          return;
        }
        throw error;
      }

      if (data) {
        setTutorDetails((prev) => ({
          ...prev,
          [tutorId]: data,
        }));
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  const getTutorSchedules = async (tutorId) => {
    try {
      // Get profile_id first
      const { data: profileData, error: profileError } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", tutorId)
        .single();

      if (profileError) {
        if (profileError.code === "PGRST116" || profileError.status === 406) {
          return;
        }
        throw profileError;
      }

      if (!profileData) return;

      const { data, error } = await supabase
        .from("schedule")
        .select("*")
        .eq("profile_id", profileData.profile_id)
        .order("day", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      setTutorSchedules((prev) => ({
        ...prev,
        [tutorId]: data || [],
      }));
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "number_of_tutees") {
      if (!value) {
        nextValue = "";
      } else {
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
          nextValue = "";
        } else {
          nextValue = Math.min(10, numeric).toString();
        }
      }
    }
    setFormData({
      ...formData,
      [name]: nextValue,
    });
  };

  const handleModeChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      mode_of_session: value,
    }));
  };

  const getMinSelectableDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const min = new Date(today);
    min.setDate(min.getDate() + 3);
    while (min.getDay() === 0 || min.getDay() === 6) {
      min.setDate(min.getDate() + 1);
    }
    return min;
  };

  const formatDateYMD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const validateAndApplyDate = (rawValue, { showToast } = {}) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
      if (showToast) {
        toast.error("Please enter a valid date.");
      }
      setFormData((prev) => ({ ...prev, date: "" }));
      return false;
    }

    const selected = new Date(`${rawValue}T00:00:00`);
    if (Number.isNaN(selected.getTime())) {
      if (showToast) {
        toast.error("Please enter a valid date.");
      }
      setFormData((prev) => ({ ...prev, date: "" }));
      return false;
    }

    const minSelectable = getMinSelectableDate();

    // Enforce 3-day lead time (block today and the next two days)
    if (selected < minSelectable) {
      if (showToast) {
        toast.error("Selected date is too soon.");
      }
      setFormData((prev) => ({ ...prev, date: "" }));
      return false;
    }

    // Check if selected date is a weekend
    const day = selected.getDay();
    if (day === 0 || day === 6) {
      if (showToast) {
        toast.error("Weekends are not available.");
      }
      setFormData((prev) => ({ ...prev, date: "" }));
      return false;
    }

    setFormData((prev) => ({ ...prev, date: rawValue }));
    return true;
  };

  const handleDateChange = (value) => {
    if (!value || !value.isValid()) {
      return;
    }
    const normalizedValue = value.format("YYYY-MM-DD");
    setFormData((prev) => ({ ...prev, date: normalizedValue }));
  };

  const CLASS_TIME_RANGES = [
    { start: { hour: 8, minute: 0 }, end: { hour: 12, minute: 0 } },
    { start: { hour: 13, minute: 0 }, end: { hour: 17, minute: 0 } },
  ];
  const TIME_STEP_MINUTES = 30;

  const classHoursMessage =
    "Class hours are 8:00 AM - 12:00 PM and 1:00 PM - 5:00 PM (no bookings during 12:00-1:00 PM).";

  const isWithinClassHours = (timeValue) => {
    if (!timeValue || !timeValue.isValid()) return false;
    const totalMinutes = timeValue.hour() * 60 + timeValue.minute();
    return CLASS_TIME_RANGES.some(({ start, end }) => {
      const startMinutes = start.hour * 60 + start.minute;
      const endMinutes = end.hour * 60 + end.minute;
      return totalMinutes >= startMinutes && totalMinutes <= endMinutes;
    });
  };

  const timeOptions = useMemo(() => {
    const options = [];
    CLASS_TIME_RANGES.forEach(({ start, end }) => {
      const startMinutes = start.hour * 60 + start.minute;
      const endMinutes = end.hour * 60 + end.minute;
      for (let minutes = startMinutes; minutes <= endMinutes; minutes += TIME_STEP_MINUTES) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const value = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
        options.push({
          value,
          label: dayjs(`2000-01-01T${value}`).format("h:mm A"),
        });
      }
    });
    return options;
  }, []);

  const handleTimeSelect = (field, value) => {
    if (!value) {
      setFormData((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    const timeValue = dayjs(`2000-01-01T${value}`);
    if (!isWithinClassHours(timeValue)) {
      toast.error(classHoursMessage);
      setFormData((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const minClassTime = dayjs()
    .set("hour", 8)
    .set("minute", 0)
    .set("second", 0)
    .set("millisecond", 0);
  const maxClassTime = dayjs()
    .set("hour", 17)
    .set("minute", 0)
    .set("second", 0)
    .set("millisecond", 0);

  const getMinutesFromValue = (timeValue) =>
    timeValue ? timeValue.hour() * 60 + timeValue.minute() : null;

  const getMinutesFromStored = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const getAvailabilityForTutor = useCallback(
    (tutorId) => {
      const startMinutes = getMinutesFromStored(formData.start_time);
      const endMinutes = getMinutesFromStored(formData.end_time);
      const hasDate = Boolean(formData.date);
      const hasTimeRange = startMinutes !== null && endMinutes !== null;
      const hasSlot = hasDate && hasTimeRange;
      const dayName = formData.date
        ? new Date(`${formData.date}T00:00:00`).toLocaleDateString("en-US", {
            weekday: "long",
          })
        : "";

      if (!hasSlot) return { available: false, label: "Select date & time" };
      const unavailableEntries = tutorUnavailableDays[tutorId] || [];
      const unavailableEntry = unavailableEntries.find(
        (entry) => entry.date === formData.date
      );
      if (hasDate && unavailableEntry) {
        return {
          available: false,
          label: unavailableEntry.reason
            ? `Not available: ${unavailableEntry.reason}`
            : "Not available on selected date",
        };
      }

      const conflictTutorIds = getConflictTutorIds(
        appointmentsForDate,
        startMinutes,
        endMinutes
      );
      if (conflictTutorIds.has(tutorId)) {
        return { available: false, label: "Booked" };
      }

      const schedules = tutorSchedules[tutorId] || [];
      const daySchedules = schedules.filter((s) => s.day === dayName);
      if (daySchedules.length === 0) {
        return { available: false, label: `Not available on ${dayName}` };
      }

      const match = daySchedules.some((s) => {
        const scheduleStart = getMinutesFromStored(s.start_time);
        const scheduleEnd = getMinutesFromStored(s.end_time);
        if (scheduleStart === null || scheduleEnd === null) return false;
        return startMinutes >= scheduleStart && endMinutes <= scheduleEnd;
      });

      if (match) {
        return { available: true, label: "Available now" };
      }
      return { available: false, label: "Not available at selected time" };
    },
    [
      appointmentsForDate,
      formData.date,
      formData.end_time,
      formData.start_time,
      tutorSchedules,
      tutorUnavailableDays,
    ]
  );

  const getConflictTutorIds = (appointments, startMinutes, endMinutes) => {
    if (startMinutes === null || endMinutes === null) return new Set();
    const conflicts = new Set();

    (appointments || []).forEach((appointment) => {
      const appointmentStart = getMinutesFromStored(appointment.start_time);
      const appointmentEnd = getMinutesFromStored(appointment.end_time);

      if (
        appointmentStart !== null &&
        appointmentEnd !== null &&
        startMinutes < appointmentEnd &&
        endMinutes > appointmentStart
      ) {
        conflicts.add(appointment.tutor_id);
      }
    });

    return conflicts;
  };

  const getBlockIndex = (minutes) => {
    if (minutes === null) return -1;

    return CLASS_TIME_RANGES.findIndex(({ start, end }) => {
      const startMinutes = start.hour * 60 + start.minute;
      const endMinutes = end.hour * 60 + end.minute;
      return minutes >= startMinutes && minutes <= endMinutes;
    });
  };

  const areWithinSameBlock = (startMinutes, endMinutes) => {
    if (startMinutes === null || endMinutes === null) return false;
    const startBlock = getBlockIndex(startMinutes);
    const endBlock = getBlockIndex(endMinutes);
    return startBlock !== -1 && startBlock === endBlock;
  };

  const handleTimeChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value && value.isValid() ? value.format("HH:mm") : "",
    }));
  };

  const handleTimeAccept = (field, value) => {
    if (!value || !value.isValid()) {
      setFormData((prev) => ({
        ...prev,
        [field]: "",
      }));
      return;
    }

    if (!isWithinClassHours(value)) {
      toast.error(classHoursMessage);
      setFormData((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateTutorAvailability = () => {
    if (!selectedTutor) {
      return { valid: false, message: "Please select a tutor first." };
    }

    const schedules = tutorSchedules[selectedTutor.user_id];

    if (!schedules) {
      return {
        valid: false,
        message: "Tutor availability is still loading. Please wait a moment.",
      };
    }

    const selectedDate = formData.date
      ? new Date(`${formData.date}T00:00:00`)
      : null;

    if (!selectedDate) {
      return { valid: false, message: "Please select a valid date." };
    }

    const dayName = selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const unavailableEntries = tutorUnavailableDays[selectedTutor.user_id] || [];
    const unavailableEntry = unavailableEntries.find(
      (entry) => entry.date === formData.date
    );
    if (unavailableEntry) {
      return {
        valid: false,
        message: unavailableEntry.reason
          ? `Tutor is not available on the selected date. Reason: ${unavailableEntry.reason}`
          : "Tutor is not available on the selected date.",
      };
    }

    const daySchedules = schedules.filter(
      (schedule) => schedule.day === dayName
    );

    if (daySchedules.length === 0) {
      return {
        valid: false,
        message: `Tutor is not available on ${dayName}. Please choose another date.`,
      };
    }

    const startMinutes = getMinutesFromStored(formData.start_time);
    const endMinutes = getMinutesFromStored(formData.end_time);

    if (startMinutes === null || endMinutes === null) {
      return {
        valid: false,
        message: "Please select a valid start and end time.",
      };
    }

    const withinSchedule = daySchedules.some((schedule) => {
      const scheduleStart = getMinutesFromStored(schedule.start_time);
      const scheduleEnd = getMinutesFromStored(schedule.end_time);

      if (scheduleStart === null || scheduleEnd === null) return false;

      return startMinutes >= scheduleStart && endMinutes <= scheduleEnd;
    });

    if (!withinSchedule) {
      return {
        valid: false,
        message:
          "Selected time does not match the tutor's available hours for that day.",
      };
    }

    return { valid: true };
  };

  const handleSubjectSelect = (subject) => {
    const nextSubject = selectedSubject === subject ? "" : subject;
    setSelectedSubject(nextSubject);
    setFormData({
      ...formData,
      subject: nextSubject,
    });
    setSelectedTutor(null); // Reset selected tutor when subject changes
    setDetailsTutorId(null);
    setShowAllSubjectTutors(false);
  };

  const handleTutorSelect = (tutor) => {
    if (tutor.user_id === currentUserId) {
      toast.error("You cannot book yourself as a tutor.");
      return;
    }
    setSelectedTutor(tutor);
    if (detailsTutorId === null) {
      setDetailsTutorId(tutor.user_id);
    }
    // Profiles are already loaded, only fetch schedules if not already loaded
    if (!tutorSchedules[tutor.user_id]) {
      getTutorSchedules(tutor.user_id);
    }
  };

  const profileComplete = Boolean(
    tuteeProfile &&
      tuteeProfile.program?.trim() &&
      tuteeProfile.college?.trim() &&
      tuteeProfile.year_level?.trim()
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    runAction(async () => {
      if (!profileComplete) {
        toast.error("Complete your tutee profile (year level, program, and college) before booking an appointment.");
        return;
      }

      if (!selectedTutor) {
        toast.error("Please select a tutor first");
        return;
      }

      const tuteeCount =
        formData.number_of_tutees && !Number.isNaN(Number(formData.number_of_tutees))
          ? Number(formData.number_of_tutees)
          : 1;
      if (
        !formData.subject ||
        !formData.topic ||
        !formData.mode_of_session ||
        !formData.date ||
        !formData.start_time ||
        !formData.end_time
      ) {
        toast.error("Please fill in all required fields");
        return;
      }

      if (tuteeCount > 10) {
        toast.error("Number of tutees must be between 1 and 10.");
        return;
      }

      const startMinutes = getMinutesFromStored(formData.start_time);
      const endMinutes = getMinutesFromStored(formData.end_time);

      if (startMinutes === null || endMinutes === null) {
        toast.error("Invalid start or end time selected.");
        return;
      }

      if (!areWithinSameBlock(startMinutes, endMinutes)) {
        toast.error("Start and end times must stay within the same session (8 AM - 12 PM or 1 PM - 5 PM).");
        return;
      }

      if (endMinutes <= startMinutes) {
        toast.error("End time must be later than start time.");
        return;
      }

    // Extra guard: prevent booking on past dates and weekends
      const selected = new Date(`${formData.date}T00:00:00`);
      const minSelectable = getMinSelectableDate();
    
      if (selected < minSelectable) {
        toast.error("Selected date is too soon.");
        return;
      }
    
      const day = selected.getDay();
      if (day === 0 || day === 6) {
        toast.error("Selected date falls on a weekend. Please choose a weekday.");
        return;
      }

      const availabilityCheck = validateTutorAvailability();
      if (!availabilityCheck.valid) {
        toast.error(availabilityCheck.message);
        return;
      }

      let session;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        session = sessionData?.session;
        if (!session) {
          toast.error("You must be logged in to create an appointment");
          return;
        }

      const { data: tutorAppointments, error: tutorError } = await supabase
        .from("appointment")
        .select("start_time, end_time, status")
        .eq("tutor_id", selectedTutor.user_id)
        .eq("date", formData.date)
        .in("status", BOOKED_STATUSES);

      if (tutorError) throw tutorError;

      const hasTutorConflict = (tutorAppointments || []).some((appointment) => {
        const appointmentStart = getMinutesFromStored(appointment.start_time);
        const appointmentEnd = getMinutesFromStored(appointment.end_time);
        return (
          appointmentStart !== null &&
          appointmentEnd !== null &&
          startMinutes < appointmentEnd &&
          endMinutes > appointmentStart
        );
      });

      if (hasTutorConflict) {
        toast.error(
          "That tutor already has a session at the selected time. Please choose another slot."
        );
        return;
      }

      const { data: userAppointments, error: userError } = await supabase
        .from("appointment")
        .select("start_time, end_time, status")
        .eq("user_id", session.user.id)
        .eq("date", formData.date)
        .in("status", BOOKED_STATUSES);

      if (userError) throw userError;

      const hasUserConflict = (userAppointments || []).some((appointment) => {
        const appointmentStart = getMinutesFromStored(appointment.start_time);
        const appointmentEnd = getMinutesFromStored(appointment.end_time);
        return (
          appointmentStart !== null &&
          appointmentEnd !== null &&
          startMinutes < appointmentEnd &&
          endMinutes > appointmentStart
        );
      });

      if (hasUserConflict) {
        toast.error(
          "You already have another appointment at this time. Cancel it before booking a new one."
        );
        return;
      }
      } catch (conflictCheckError) {
        console.error(conflictCheckError.message);
        toast.error("Unable to verify appointment availability. Please try again.");
        return;
      }

      setLoading(true);

      const startLabel = new Date(`2000-01-01T${formData.start_time}`).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const endLabel = new Date(`2000-01-01T${formData.end_time}`).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const confirmMessage = `Confirm appointment on ${formData.date} from ${startLabel} to ${endLabel}?`;
      if (!window.confirm(confirmMessage)) {
        setLoading(false);
        return;
      }

      try {
        const { error } = await supabase
          .from("appointment")
          .insert([
            {
              user_id: session.user.id,
              tutor_id: selectedTutor.user_id,
              subject: formData.subject,
              topic: formData.topic,
              mode_of_session: formData.mode_of_session,
              date: formData.date,
              start_time: formData.start_time,
              end_time: formData.end_time,
              number_of_tutees: tuteeCount,
              status: "pending",
            },
          ]);

      if (error) throw error;

      toast.success("Appointment created successfully!");
      if (typeof window !== "undefined" && currentUserId) {
        window.localStorage.removeItem(`appointmentDraft:${currentUserId}`);
      }
      setDraftTutorId(null);
      setFormData({
        subject: "",
        topic: "",
        mode_of_session: "",
        date: "",
        start_time: "",
        end_time: "",
          number_of_tutees: "",
        });
        setSelectedTutor(null);
        setSelectedSubject("");
      } catch (err) {
        console.error(err.message);
        toast.error(`Error creating appointment: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, "Unable to create appointment.");
  };

  useEffect(() => {
    getTutors();
    getTuteeProfile();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !currentUserId) return;
    const savedDraft = window.localStorage.getItem(`appointmentDraft:${currentUserId}`);
    if (!savedDraft) return;
    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed?.formData) {
        setFormData((prev) => ({ ...prev, ...parsed.formData }));
      }
      if (typeof parsed?.selectedSubject === "string") {
        setSelectedSubject(parsed.selectedSubject);
      }
      if (parsed?.selectedTutorId) {
        setDraftTutorId(parsed.selectedTutorId);
      }
    } catch (err) {
      console.error("Unable to restore appointment draft:", err.message);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!draftTutorId) return;
    const matchedTutor = tutors.find((tutor) => tutor.user_id === draftTutorId);
    if (!matchedTutor) return;
    setSelectedTutor(matchedTutor);
    if (!tutorSchedules[matchedTutor.user_id]) {
      getTutorSchedules(matchedTutor.user_id);
    }
  }, [draftTutorId, tutors, tutorSchedules]);

  useEffect(() => {
    if (typeof window === "undefined" || !currentUserId) return;
    const payload = {
      formData,
      selectedSubject,
      selectedTutorId: selectedTutor?.user_id || null,
    };
    window.localStorage.setItem(
      `appointmentDraft:${currentUserId}`,
      JSON.stringify(payload)
    );
  }, [currentUserId, formData, selectedSubject, selectedTutor]);

  useEffect(() => {
    setShowAllSubjectTutors(false);
  }, [formData.date, formData.start_time, formData.end_time]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const smallQuery = window.matchMedia("(max-width: 900px)");
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const largeQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => {
      setIsSmallScreen(smallQuery.matches || coarseQuery.matches);
      setIsLargeScreen(largeQuery.matches);
    };

    handleChange();
    smallQuery.addEventListener("change", handleChange);
    coarseQuery.addEventListener("change", handleChange);
    largeQuery.addEventListener("change", handleChange);
    return () => {
      smallQuery.removeEventListener("change", handleChange);
      coarseQuery.removeEventListener("change", handleChange);
      largeQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!formData.date) {
      setAppointmentsForDate([]);
      return;
    }

    fetchAppointmentsForDate(formData.date);

    const channel = supabase
      .channel(`appointment-date-${formData.date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment",
          filter: `date=eq.${formData.date}`,
        },
        () => fetchAppointmentsForDate(formData.date)
      );

    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [formData.date, fetchAppointmentsForDate]);

  useEffect(() => {
    if (!selectedSubject) return;
    const subjectLower = selectedSubject.toLowerCase();
    const subjectTutors = tutors.filter((tutor) => {
      const tutorSubject = tutorDetails[tutor.user_id]?.subject || "";
      return tutorSubject.toLowerCase().includes(subjectLower);
    });

    subjectTutors.forEach((tutor) => {
      if (!tutorSchedules[tutor.user_id]) {
        getTutorSchedules(tutor.user_id);
      }
    });
  }, [
    selectedSubject,
    formData.date,
    formData.start_time,
    formData.end_time,
    tutors,
    tutorDetails,
    tutorSchedules,
  ]);

  useEffect(() => {
    const hasDetails = Boolean(
      selectedSubject ||
      formData.date ||
      formData.start_time ||
      formData.end_time
    );
    const nextKey = `${selectedSubject}|${formData.date}|${formData.start_time}|${formData.end_time}`;
    if (!hasDetails || isLargeScreen) {
      setShowTutorDrawer(false);
      setDrawerDismissedKey("");
      return;
    }
    if (drawerDismissedKey !== nextKey) {
      setShowTutorDrawer(true);
    }
  }, [
    selectedSubject,
    formData.date,
    formData.start_time,
    formData.end_time,
    drawerDismissedKey,
    isLargeScreen,
  ]);

  const openTutorDrawer = () => setShowTutorDrawer(true);
  const closeTutorDrawer = () => {
    const currentKey = `${selectedSubject}|${formData.date}|${formData.start_time}|${formData.end_time}`;
    setDrawerDismissedKey(currentKey);
    setShowTutorDrawer(false);
    setDetailsTutorId(null);
  };

  // Helper function to format time
  const formatTime = (timeString) => {
    if (!timeString) return "";
    const time = new Date(`2000-01-01T${timeString}`);
    return time.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Helper function to get schedules for a specific day
  const getSchedulesForDay = (tutorId, day) => {
    const schedules = tutorSchedules[tutorId] || [];
    return schedules.filter((schedule) => schedule.day === day);
  };

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const getInitial = (name = "") => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`appointment-awaiting-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => checkPendingEvaluations(currentUserId)
      );

    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, checkPendingEvaluations]);

  useEffect(() => {
    setShowTutorDrawer(false);
    setDrawerDismissedKey("");
  }, [location.pathname]);

  useEffect(() => {
    if (!detailsTutorId) {
      lastDetailsAvailabilityRef.current = null;
      return;
    }
    const availability = getAvailabilityForTutor(detailsTutorId);
    const previousAvailability = lastDetailsAvailabilityRef.current;
    if (previousAvailability === true && !availability.available) {
      setDetailsTutorId(null);
      lastDetailsAvailabilityRef.current = null;
      return;
    }
    lastDetailsAvailabilityRef.current = availability.available;
  }, [detailsTutorId, getAvailabilityForTutor]);

  const renderTutorDetails = (options = {}) => {
    const { compact = false, showHeading = true } = options;
    const containerClass = compact
      ? showHeading
        ? "bg-white p-4 rounded-md border border-gray-300"
        : "bg-transparent p-0 border-0"
      : "bg-white p-8 rounded-md border border-gray-300";
    const titleClass = compact ? "font-semibold text-base mb-3" : "font-semibold text-lg mb-4";
    const listClass = compact
      ? "space-y-3 max-h-[320px] overflow-y-auto pr-1"
      : "space-y-4 max-h-[420px] overflow-y-auto pr-1";
    const cardClass = compact
      ? "flex items-center gap-3 p-3 rounded-lg border border-gray-200 shadow-sm"
      : "flex items-center gap-4 p-4 rounded-lg border border-gray-200 shadow-sm";
    const avatarClass = compact ? "w-12 h-12" : "w-16 h-16";
    const nameClass = compact ? "font-semibold text-sm" : "font-semibold text-base";
    const metaClass = compact ? "text-xs text-gray-600" : "text-sm text-gray-600";
    const statusClass = compact ? "text-xs font-semibold" : "text-sm font-semibold";
    const buttonClass = compact
      ? "px-3 py-1 rounded-md text-xs font-semibold"
      : "px-4 py-1.5 rounded-md text-sm font-semibold";
    const detailsAvatarClass = compact ? "w-12 h-12" : "w-16 h-16";
    const detailsTextClass = compact ? "text-xs text-gray-600" : "text-sm text-gray-600";
    const scheduleBadgeClass = compact
      ? "bg-gray-200 px-2 py-0.5 rounded text-[11px]"
      : "bg-gray-200 px-2 py-1 rounded text-xs";

    return (
      <div className={containerClass}>
        {showHeading && <h3 className={titleClass}>Tutor Details</h3>}

        {(() => {
        const subjectSelected = selectedSubject.trim().length > 0;
        const startMinutes = getMinutesFromStored(formData.start_time);
        const endMinutes = getMinutesFromStored(formData.end_time);
        const hasDate = Boolean(formData.date);
        const hasTimeRange = startMinutes !== null && endMinutes !== null;
        const hasSlot = hasDate && hasTimeRange;
        const dayName = formData.date
          ? new Date(`${formData.date}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
            })
          : "";

        const matchesSubject = (tutor) => {
          const tutorSubject = tutorDetails[tutor.user_id]?.subject || "";
          return (
            subjectSelected &&
            tutorSubject.toLowerCase().includes(selectedSubject.toLowerCase())
          );
        };

        const conflictTutorIds = getConflictTutorIds(
          appointmentsForDate,
          startMinutes,
          endMinutes
        );

        const visibleTutors = tutors
          .filter((tutor) => matchesSubject(tutor))
          .filter((tutor) => {
            if (!hasDate || showAllSubjectTutors) return true;
            const unavailableEntries = tutorUnavailableDays[tutor.user_id] || [];
            if (
              unavailableEntries.some((entry) => entry.date === formData.date)
            ) {
              return false;
            }
            const schedules = tutorSchedules[tutor.user_id] || [];
            const daySchedules = schedules.filter((s) => s.day === dayName);
            if (daySchedules.length === 0) return false;
            if (!hasTimeRange) return true;
            return daySchedules.some((s) => {
              const scheduleStart = getMinutesFromStored(s.start_time);
              const scheduleEnd = getMinutesFromStored(s.end_time);
              if (scheduleStart === null || scheduleEnd === null) return false;
              return startMinutes >= scheduleStart && endMinutes <= scheduleEnd;
            });
          })
          .map((tutor) => {
            const availability = getAvailabilityForTutor(tutor.user_id);
            return { tutor, availability };
          })
          .sort((a, b) => Number(b.availability.available) - Number(a.availability.available));

        if (!subjectSelected) {
          return (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500 text-lg">Select a subject to see tutors</p>
            </div>
          );
        }

        if (visibleTutors.length === 0) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-2">
                <p className="text-gray-500 text-lg">
                  No available tutor in {selectedSubject}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAllSubjectTutors(true)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  Try checking here
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <div className={listClass}>
              {visibleTutors.map(({ tutor, availability }) => {
                const details = tutorDetails[tutor.user_id] || {};
                const isSelected = selectedTutor?.user_id === tutor.user_id;
                const isDetailsOpen = detailsTutorId === tutor.user_id;
                const isBooked = hasTimeRange && conflictTutorIds.has(tutor.user_id);
                return (
                  <div
                    key={tutor.user_id}
                    className={cardClass}
                  >
                    <div className={`${avatarClass} bg-blue-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0`}>
                      {details.profile_image ? (
                        <img
                          src={details.profile_image}
                          alt={`${tutor.name} profile`}
                          className={`${avatarClass} rounded-full object-cover`}
                        />
                      ) : (
                        <span className={compact ? "text-blue-700 text-base font-bold" : "text-blue-700 text-xl font-bold"}>
                          {getInitial(tutor.name)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                        <p className={nameClass}>
                          {capitalizeWords(details.nickname || tutor.name)}
                        </p>
                        <p className={metaClass}>
                          {capitalizeWords(tutor.name)}
                        </p>
                      {hasSlot && (
                        <p
                          className={`${statusClass} ${
                            availability.available ? "text-green-600" : "text-orange-600"
                          }`}
                        >
                          {availability.label}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailsTutorId((prev) =>
                            prev === tutor.user_id ? null : tutor.user_id
                          );
                          if (!tutorSchedules[tutor.user_id]) {
                            getTutorSchedules(tutor.user_id);
                          }
                          openTutorDrawer();
                        }}
                        className={`${buttonClass} bg-blue-700 text-white hover:bg-blue-800 hover:underline transition-colors`}
                      >
                        {isDetailsOpen ? "Hide Details" : "See Details"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isBooked) {
                            handleTutorSelect(tutor);
                            openTutorDrawer();
                          }
                        }}
                        disabled={isBooked}
                        className={`${buttonClass} ${
                          isBooked
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : isSelected
                              ? "bg-green-600 text-white"
                              : "bg-[#f9d31a] text-[#181718] hover:bg-[#fce15c]"
                        }`}
                      >
                        {isBooked ? "Booked" : isSelected ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {detailsTutorId && (
              <div className="border-t border-gray-200 pt-4">
                {(() => {
                  const detailsTutor = tutors.find(
                    (tutor) => tutor.user_id === detailsTutorId
                  );
                  if (!detailsTutor) {
                    return (
                      <div className={detailsTextClass}>
                        Tutor details not available.
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div className="flex items-center gap-4">
                        <div className={`${detailsAvatarClass} bg-blue-500 rounded-full flex items-center justify-center overflow-hidden`}>
                          {tutorDetails[detailsTutor.user_id]?.profile_image ? (
                            <img
                              src={tutorDetails[detailsTutor.user_id].profile_image}
                              alt={`${detailsTutor.name} profile`}
                              className={`${detailsAvatarClass} rounded-full object-cover`}
                            />
                          ) : (
                            <span className={compact ? "text-white text-base font-bold" : "text-white text-xl font-bold"}>
                              {getInitial(detailsTutor.name)}
                            </span>
                          )}
                        </div>
                        <div>
                            <p className={nameClass}>
                              {capitalizeWords(
                                tutorDetails[detailsTutor.user_id]?.nickname ||
                                  detailsTutor.name
                              )}
                            </p>
                            <p className={detailsTextClass}>
                              {capitalizeWords(detailsTutor.name)}
                            </p>
                            <p className={detailsTextClass}>
                              {tutorDetails[detailsTutor.user_id]?.college ||
                                "College not specified"}
                            </p>
                          <p className={detailsTextClass}>
                            {tutorDetails[detailsTutor.user_id]?.subject ||
                              "No subject"}
                          </p>
                          <p className={detailsTextClass}>
                            {tutorDetails[detailsTutor.user_id]?.specialization
                              ? capitalizeWords(
                                  tutorDetails[detailsTutor.user_id]
                                    ?.specialization
                                )
                              : "No specialization"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className={compact ? "font-semibold text-xs mb-2" : "font-semibold text-sm mb-2"}>
                          Available Schedules
                        </h4>
                        <div className="space-y-2">
                          {daysOfWeek.map((day) => {
                            const daySchedules = getSchedulesForDay(
                              detailsTutor.user_id,
                              day
                            );
                            return (
                              <div key={day} className="flex justify-between items-center">
                                <span className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
                                  {day}
                                </span>
                                {daySchedules.length > 0 ? (
                                  <div className="flex gap-2 flex-wrap justify-end">
                                    {daySchedules.map((schedule, index) => (
                                      <span
                                        key={index}
                                        className={scheduleBadgeClass}
                                      >
                                        {formatTime(schedule.start_time)} -{" "}
                                        {formatTime(schedule.end_time)}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className={detailsTextClass}>No schedule</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
        })()}
      </div>
    );
  };

  return (
    <div className="py-3 px-6 bg-[#f8f9f0] min-h-screen">
        <h1 className="text-gray-600 font-bold text-2xl mb-6">
        Make Appointment
      </h1>
      {hasPendingEvaluation && (
        <p className="mb-4 text-sm text-red-600 font-semibold">
          You still have a session awaiting feedback. Please evaluate your last tutor before booking a new appointment.
        </p>
      )}
      {!loadingTuteeProfile && !profileComplete && (
        <p className="mb-4 text-sm text-red-600 font-semibold">
          Complete your tutee profile (year level, program, and college) in My Profile before booking an appointment.
        </p>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-9">
        {/* Left Panel - Appointment Form */}
        <div className="bg-white p-8 rounded-md border border-gray-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {/* Choose Subject */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Choose Subject</h3>
                {isSmallScreen ? (
                  <select
                    value={selectedSubject}
                    onChange={(e) => handleSubjectSelect(e.target.value)}
                    className="border border-gray-300 rounded-md p-3 w-full"
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.name} value={subject.name}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-3 flex-wrap">
                    {subjects.map((subject) => (
                      <button
                        key={subject.name}
                        type="button"
                        onClick={() => handleSubjectSelect(subject.name)}
                          className={`px-4 py-2 rounded-md border transition-colors bg-transparent ${
                            selectedSubject === subject.name
                              ? "text-[#4c4ba2] border-[#4c4ba2] shadow-sm"
                              : "text-gray-700 border-gray-300 hover:border-[bg-blue-600]"
                          }`}
                      >
                        {subject.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Topic */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Specialization</h3>
                <input
                  type="text"
                  name="topic"
                  value={formData.topic}
                  onChange={handleInputChange}
                  placeholder="ex. SubCode - Topic (MAT070 - Line Integrals)"
                  className="border border-gray-300 rounded-md p-3 w-full"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Number of Tutees */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Number of Tutees</h3>
                <input
                  type="number"
                  name="number_of_tutees"
                  value={formData.number_of_tutees}
                  onChange={handleInputChange}
                  min={1}
                  max={10}
                  className="border border-gray-300 rounded-md p-3 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: leave blank for a single student, or enter 2-10 learners (values above 10 are capped automatically).
                </p>
              </div>

              {/* Mode of Session */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Mode of Session</h3>
                <select
                  name="mode_of_session"
                  value={formData.mode_of_session}
                  onChange={handleModeChange}
                  className="border border-gray-300 rounded-md p-3 w-full"
                  required
                >
                  <option value="">Select mode</option>
                  <option value="Face-to-Face">Face-to-Face</option>
                  <option value="Online">Online</option>
                </select>
              </div>
            </div>

            {/* Choose Date and Time */}
            <div>
              <h3 className="font-semibold text-lg mb-3">
                Choose Date and Time
              </h3>
              <div className="space-y-3">
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    value={formData.date ? dayjs(formData.date) : null}
                    onChange={handleDateChange}
                    format="YYYY/MM/DD"
                    minDate={dayjs(getMinSelectableDate())}
                    shouldDisableDate={(date) => {
                      const day = date.day();
                      return day === 0 || day === 6;
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true,
                        required: true,
                        className: "border border-gray-300 rounded-md",
                        onChange: (event) => {
                          if (!event.target.value) {
                            setFormData((prev) => ({ ...prev, date: "" }));
                          }
                        },
                        sx: {
                          "& .MuiInputBase-root": {
                            height: 48,
                            fontSize: 14,
                            paddingX: 1,
                          },
                          "& .MuiInputBase-input": {
                            paddingY: "12px",
                          },
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                {/* time picker */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  {isSmallScreen ? (
                    <>
                      <div className="w-full">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Start Time
                        </label>
                        <select
                          value={formData.start_time}
                          onChange={(event) => handleTimeSelect("start_time", event.target.value)}
                          className="border border-gray-300 rounded-md p-3 w-full"
                        >
                          <option value="">Select start time</option>
                          {timeOptions.map((option) => (
                            <option key={`start-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          End Time
                        </label>
                        <select
                          value={formData.end_time}
                          onChange={(event) => handleTimeSelect("end_time", event.target.value)}
                          className="border border-gray-300 rounded-md p-3 w-full"
                        >
                          <option value="">Select end time</option>
                          {timeOptions.map((option) => (
                            <option key={`end-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* start time */}
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DemoContainer components={["TimePicker"]}>
                          <TimePicker
                            value={
                              formData.start_time
                                ? dayjs(`2000-01-01T${formData.start_time}`)
                                : null
                            }
                            onChange={(value) =>
                              handleTimeChange("start_time", value)
                            }
                            onAccept={(value) =>
                              handleTimeAccept("start_time", value)
                            }
                            label="Start Time"
                            minTime={minClassTime}
                            maxTime={maxClassTime}
                            slotProps={{
                              textField: {
                                size: "small",
                                fullWidth: true,
                                sx: {
                                  "& .MuiInputBase-root": {
                                    height: 40,
                                    fontSize: 14,
                                  },
                                  "& .MuiInputBase-input": {
                                    paddingY: "8px",
                                  },
                                  "& .MuiIconButton-root": {
                                    padding: "6px",
                                  },
                                  "& .MuiSvgIcon-root": {
                                    fontSize: 18,
                                  },
                                },
                              },
                            }}
                          />
                        </DemoContainer>
                      </LocalizationProvider>

                      {/* end time */}
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DemoContainer components={["TimePicker"]}>
                          <TimePicker
                            value={
                              formData.end_time
                                ? dayjs(`2000-01-01T${formData.end_time}`)
                                : null
                            }
                            onChange={(value) =>
                              handleTimeChange("end_time", value)
                            }
                            onAccept={(value) =>
                              handleTimeAccept("end_time", value)
                            }
                            label="End Time"
                            minTime={minClassTime}
                            maxTime={maxClassTime}
                            slotProps={{
                              textField: {
                                size: "small",
                                fullWidth: true,
                                sx: {
                                  "& .MuiInputBase-root": {
                                    height: 40,
                                    fontSize: 14,
                                  },
                                  "& .MuiInputBase-input": {
                                    paddingY: "8px",
                                  },
                                  "& .MuiIconButton-root": {
                                    padding: "6px",
                                  },
                                  "& .MuiSvgIcon-root": {
                                    fontSize: 18,
                                  },
                                },
                              },
                            }}
                          />
                        </DemoContainer>
                      </LocalizationProvider>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Book Appointment Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || hasPendingEvaluation || !profileComplete || actionBusy}
                className="bg-blue-600 text-white rounded-md p-3 w-full md:w-auto md:min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                {loading ? "Creating..." : "Book Appointment"}
              </button>
            </div>
          </form>
        </div>
        {/* Right Panel - Tutor Details */}
        {isLargeScreen && (
          <div>
            {renderTutorDetails()}
          </div>
        )}

        {/* Mobile Tutor Details Drawer */}
        {!isLargeScreen && showTutorDrawer && (
            <div className="fixed inset-0 z-40 flex items-end pointer-events-none">
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              <div className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-6 pointer-events-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Tutor Details</h3>
                  <button
                    type="button"
                    onClick={closeTutorDrawer}
                    className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
                {renderTutorDetails({ compact: true, showHeading: false })}
              </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Appointment;
