import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase-client";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";

const Appointment = () => {
  const [searchTerm, setSearchTerm] = useState("");
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
  const [currentTutorPage, setCurrentTutorPage] = useState(0);
  const [hasPendingEvaluation, setHasPendingEvaluation] = useState(false);

  const subjects = [
    "Programming",
    "Chemistry",
    "Physics",
    "Calculus and Statistics",
    "Psychology and Language",
    "Engineering",
    "Accountancy and Economics",
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
        (profilesData || []).forEach((profile) => {
          profilesMap[profile.user_id] = {
            subject: profile.subject,
            specialization: profile.specialization,
            college: profile.college,
            program: profile.program,
            year_level: profile.year_level,
            profile_image: profile.profile_image,
            online_link: profile.online_link
          };
        });

        setTutorDetails(profilesMap);
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

  const getTutorDetails = async (tutorId) => {
    try {
      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", tutorId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

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
      const { data: profileData } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", tutorId)
        .single();

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
    return min;
  };

  const formatDateYMD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Prevent selecting past dates and weekends
  const handleDateChange = (e) => {
    const value = e.target.value;
    if (!value) {
      setFormData({ ...formData, date: "" });
      return;
    }
    
    const selected = new Date(`${value}T00:00:00`);
    const minSelectable = getMinSelectableDate();
    
    // Enforce 3-day lead time (block today and the next two days)
    if (selected < minSelectable) {
      toast.error(
        `Earliest available date is ${minSelectable.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}.`
      );
      setFormData({ ...formData, date: "" });
      e.target.value = "";
      return;
    }
    
    // Check if selected date is a weekend
    const day = selected.getDay();
    if (day === 0 || day === 6) {
      toast.error("Weekends are not available.");
      setFormData({ ...formData, date: "" });
      e.target.value = "";
      return;
    }
    
    setFormData({ ...formData, date: value });
  };

  const CLASS_TIME_RANGES = [
    { start: { hour: 8, minute: 0 }, end: { hour: 12, minute: 0 } },
    { start: { hour: 13, minute: 0 }, end: { hour: 17, minute: 0 } },
  ];

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

  const tutorsPerPage = 4;

  const resetTutorPagination = () => {
    setCurrentTutorPage(0);
  };

  const handleSubjectSelect = (subject) => {
    setSelectedSubject(subject);
    setFormData({
      ...formData,
      subject: subject,
    });
    setSelectedTutor(null); // Reset selected tutor when subject changes
    resetTutorPagination();
  };

  const handleTutorSelect = (tutor) => {
    if (tutor.user_id === currentUserId) {
      toast.error("You cannot book yourself as a tutor.");
      return;
    }
    setSelectedTutor(tutor);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      toast.error(
        `Selected date is too soon. Earliest available is ${minSelectable.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}.`
      );
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

      const blockingStatuses = ["pending", "confirmed", "started"];

      const { data: tutorAppointments, error: tutorError } = await supabase
        .from("appointment")
        .select("start_time, end_time, status")
        .eq("tutor_id", selectedTutor.user_id)
        .eq("date", formData.date)
        .in("status", blockingStatuses);

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
        .in("status", blockingStatuses);

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
  };

  useEffect(() => {
    getTutors();
    getTuteeProfile();
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    resetTutorPagination();
  };

  // Filter tutors by selected subject and search term
  const filteredTutors = tutors.filter((tutor) => {
    const tutorSubject = tutorDetails[tutor.user_id]?.subject || "";
    const matchesSubject =
      !selectedSubject ||
      tutorSubject.toLowerCase().includes(selectedSubject.toLowerCase());
    const matchesSearch = tutor.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const totalTutorPages = Math.ceil(filteredTutors.length / tutorsPerPage);
  const paginatedTutors = filteredTutors.slice(
    currentTutorPage * tutorsPerPage,
    currentTutorPage * tutorsPerPage + tutorsPerPage
  );

  const handleTutorPageChange = (direction) => {
    setCurrentTutorPage((prevPage) => {
      if (direction === "prev") {
        return Math.max(prevPage - 1, 0);
      }
      if (direction === "next") {
        return Math.min(
          prevPage + 1,
          Math.max(totalTutorPages - 1, 0)
        );
      }
      return prevPage;
    });
  };

  useEffect(() => {
    if (currentTutorPage > 0 && currentTutorPage >= totalTutorPages) {
      setCurrentTutorPage(Math.max(totalTutorPages - 1, 0));
    }
  }, [currentTutorPage, totalTutorPages]);

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

  const minDate = formatDateYMD(getMinSelectableDate());

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

  return (
    <div className="py-3 px-6 bg-[#f4ece6] min-h-screen">
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
            {/* Choose Subject */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Choose Subject</h3>
              <div className="flex gap-3 flex-wrap">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => handleSubjectSelect(subject)}
                    className={`px-4 py-2 rounded-md border transition-colors ${
                      selectedSubject === subject
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Specialization</h3>
              <input
                type="text"
                name="topic"
                value={formData.topic}
                onChange={handleInputChange}
                placeholder="Enter specicalization"
                className="border border-gray-300 rounded-md p-3 w-full"
                required
              />
            </div>

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
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: leave blank for a single student, or enter 2–10 learners (values above 10 are capped automatically).
              </p>
            </div>

            {/* Mode of Session */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Mode of Session</h3>
              <select
                name="mode_of_session"
                value={formData.mode_of_session}
                onChange={handleModeChange}
                className="border border-gray-300 rounded-md p-3 w-[280px]"
                required
              >
                <option value="">Select mode</option>
                <option value="Face-to-Face">Face-to-Face</option>
                <option value="Online">Online</option>
              </select>
            </div>

            {/* Choose Date and Time */}
            <div>
              <h3 className="font-semibold text-lg mb-3">
                Choose Date and Time
              </h3>
              <div className="space-y-3">
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleDateChange}
                  min={minDate}
                  className="border border-gray-300 rounded-md p-3 w-full"
                  required
                />
                {/* time picker */}
                <div className="flex gap-3">
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
                      />
                    </DemoContainer>
                  </LocalizationProvider>
                </div>
              </div>
            </div>

            {/* Choose Tutor */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-lg">Choose Tutor</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTutorPageChange("prev")}
                    disabled={currentTutorPage === 0}
                    className="text-gray-500 hover:text-gray-700 disabled:text-gray-300 transition-colors"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTutorPageChange("next")}
                    disabled={
                      totalTutorPages === 0 ||
                      currentTutorPage >= totalTutorPages - 1
                    }
                    className="text-gray-500 hover:text-gray-700 disabled:text-gray-300 transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>

              {totalTutorPages > 1 && (
                <div className="text-sm text-gray-500 mb-2 text-right">
                  Page {currentTutorPage + 1} of {totalTutorPages}
                </div>
              )}

              {/* Search Tutors */}
              <input
                type="text"
                placeholder="Search tutors..."
                value={searchTerm}
                onChange={handleSearch}
                className="border border-gray-300 rounded-md p-3 w-full mb-4"
              />

              {/* Tutor Grid */}
              {loadingProfiles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading tutors...</div>
                </div>
              ) : paginatedTutors.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  No tutors found. Try adjusting your filters.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {paginatedTutors.map((tutor) => (
                    <div
                      key={tutor.user_id}
                      onClick={() => handleTutorSelect(tutor)}
                      className={`p-4 rounded-md border cursor-pointer transition-colors ${
                        selectedTutor?.user_id === tutor.user_id
                          ? "bg-blue-50 border-blue-500"
                          : "bg-white border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-blue-500 rounded-full mb-2 flex items-center justify-center overflow-hidden">
                          {tutorDetails[tutor.user_id]?.profile_image ? (
                            <img
                              src={tutorDetails[tutor.user_id].profile_image}
                              alt={`${tutor.name} profile`}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white text-base font-semibold">
                              {getInitial(tutor.name)}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm">{tutor.name}</p>
                        <p className="text-xs text-gray-600">
                          {tutorDetails[tutor.user_id]?.subject ||
                            "No subject"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Book Appointment Button */}
            <button
              type="submit"
              disabled={loading || hasPendingEvaluation || !profileComplete}
              className="bg-blue-600 text-white rounded-md p-3 w-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              {loading ? "Creating..." : "Book Appointment"}
            </button>
          </form>
        </div>

        {/* Right Panel - Tutor Details */}
        <div className="bg-white p-8 rounded-md border border-gray-300">
          <h3 className="font-semibold text-lg mb-6">Tutor Details</h3>

          {selectedTutor ? (
            <div className="space-y-6">
              {/* Tutor Profile */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-blue-500 rounded-full mb-4 flex items-center justify-center overflow-hidden">
                  {tutorDetails[selectedTutor.user_id]?.profile_image ? (
                    <img
                      src={tutorDetails[selectedTutor.user_id].profile_image}
                      alt={`${selectedTutor.name} profile`}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-4xl font-bold">
                      {getInitial(selectedTutor.name)}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-lg">{selectedTutor.name}</p>
                <p className="text-gray-600">
                  {tutorDetails[selectedTutor.user_id]?.college ||
                    "College not specified"}
                </p>
                <p className="text-gray-600">
                  {tutorDetails[selectedTutor.user_id]?.subject ||
                    "No subject"}
                </p>
                <p className="text-gray-600">
                  {tutorDetails[selectedTutor.user_id]?.specialization ||
                    "No specialization"}
                </p>
              </div>

              {/* Available Schedules */}
              <div>
                <h4 className="font-semibold text-lg mb-4">
                  Available Schedules
                </h4>
                <div className="space-y-3">
                  {daysOfWeek.map((day) => {
                    const daySchedules = getSchedulesForDay(
                      selectedTutor.user_id,
                      day
                    );
                    return (
                      <div
                        key={day}
                        className="flex justify-between items-center"
                      >
                        <span className="font-medium">{day}</span>
                        {daySchedules.length > 0 ? (
                          <div className="flex gap-2">
                            {daySchedules.map((schedule, index) => (
                              <span
                                key={index}
                                className="bg-gray-200 px-3 py-1 rounded text-sm"
                              >
                                {formatTime(schedule.start_time)} -{" "}
                                {formatTime(schedule.end_time)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">
                            No schedule
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500 text-lg">Select a tutor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Appointment;
