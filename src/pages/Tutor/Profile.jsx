import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
import { FaEdit, FaPlus, FaTrash, FaTimes, FaCalendarAlt } from "react-icons/fa";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import { capitalizeWords } from "../../utils/text";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const Profile = () => {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    nickname: "",
    program: "",
    college: "",
    year_level: "",
    subject: "",
    specialization: "",
    profile_image: "",
    online_link: "",
    file_link: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState(profile);
  const [schedules, setSchedules] = useState([]);
  const [scheduleEditDay, setScheduleEditDay] = useState(null);
  const [newTime, setNewTime] = useState({ start: "", end: "" });
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [newUnavailableDate, setNewUnavailableDate] = useState("");
  const [newUnavailableReason, setNewUnavailableReason] = useState("");
  const [loadingUnavailable, setLoadingUnavailable] = useState(false);

  const ALLOWED_TIME_BLOCKS = [
    { start: 8 * 60, end: 12 * 60 },
    { start: 13 * 60, end: 17 * 60 },
  ];

  const allowedHoursMessage =
    "Schedules can only be between 8:00 AM - 12:00 PM or 1:00 PM - 5:00 PM.";

  const getMinutesFromDayjs = (value) =>
    value ? value.hour() * 60 + value.minute() : null;

  const getMinutesFromString = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const isWithinAllowedBlock = (minutes) =>
    minutes !== null &&
    ALLOWED_TIME_BLOCKS.some(
      (block) => minutes >= block.start && minutes <= block.end
    );

  const areWithinSameBlock = (startMinutes, endMinutes) =>
    startMinutes !== null &&
    endMinutes !== null &&
    ALLOWED_TIME_BLOCKS.some(
      (block) =>
        startMinutes >= block.start &&
        endMinutes <= block.end &&
        endMinutes > startMinutes
    );

  const validateTimePair = (startTime, endTime) => {
    const startMinutes = getMinutesFromString(startTime);
    const endMinutes = getMinutesFromString(endTime);

    if (startMinutes === null || endMinutes === null) {
      alert("Please select both start and end times.");
      return false;
    }

    if (!isWithinAllowedBlock(startMinutes) || !isWithinAllowedBlock(endMinutes)) {
      alert(allowedHoursMessage);
      return false;
    }

    if (endMinutes <= startMinutes) {
      alert("End time must be later than start time.");
      return false;
    }

    if (!areWithinSameBlock(startMinutes, endMinutes)) {
      alert(
        "Start and end times need to remain within the same time block (morning or afternoon)."
      );
      return false;
    }

    return true;
  };

  const handleTimeChange = (field, value) => {
    setNewTime((prev) => ({
      ...prev,
      [field]: value && value.isValid() ? value.format("HH:mm") : "",
    }));
  };

  const handleTimeAccept = (field, value) => {
    if (!value || !value.isValid()) {
      setNewTime((prev) => ({
        ...prev,
        [field]: "",
      }));
      return;
    }

    const minutes = getMinutesFromDayjs(value);
    if (!isWithinAllowedBlock(minutes)) {
      alert(allowedHoursMessage);
      setNewTime((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  async function getName() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;
      if (data) {
        setName(data.name);
        setForm((prev) => ({ ...prev, name: data.name || "" }));
      }
    } catch (err) {
      console.error(err.message);
    }
  }

  async function getProfile() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        nickname: "",
        program: "",
        college: "",
        year_level: "",
        subject: "",
        specialization: "",
        profile_image: "",
        online_link: "",
        file_link: "",
      };

      setProfileId(data?.profile_id || null);
      setProfile(profileData);
      setForm(profileData);
    } catch (err) {
      console.error(err.message);
    }
  }

  async function getUnavailableDays() {
    setLoadingUnavailable(true);
    try {
      let activeProfileId = profileId;
      if (!activeProfileId) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        if (form.name && form.name !== name) {
          const { error: nameError } = await supabase
            .from("users")
            .update({ name: form.name })
            .eq("user_id", session.user.id);

          if (nameError) throw nameError;
          setName(form.name);
        }

        const { data } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("user_id", session.user.id)
          .single();

        activeProfileId = data?.profile_id || null;
        setProfileId(activeProfileId);
      }

      if (!activeProfileId) {
        setUnavailableDays([]);
        return;
      }

      const { data, error } = await supabase
        .from("tutor_unavailable_days")
        .select("unavailable_id, date, reason")
        .eq("profile_id", activeProfileId)
        .order("date", { ascending: true });

      if (error) throw error;

      setUnavailableDays(data || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoadingUnavailable(false);
    }
  }

  async function getSchedules() {
    setLoadingSchedules(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Get profile_id first
      let profileData = null;
      if (!profileId) {
        const { data } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("user_id", session.user.id)
          .single();
        profileData = data;
        if (data?.profile_id) {
          setProfileId(data.profile_id);
        }
      } else {
        profileData = { profile_id: profileId };
      }

      if (!profileData) {
        setSchedules([]);
        return;
      }

      const { data, error } = await supabase
        .from("schedule")
        .select("*")
        .eq("profile_id", profileData.profile_id)
        .order("day", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      setSchedules(data || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoadingSchedules(false);
    }
  }

  useEffect(() => {
    getName();
    getProfile();
    getSchedules();
    getUnavailableDays();
  }, []);

  // Group schedules by day
  const schedulesByDay = daysOfWeek.reduce((acc, day) => {
    acc[day] = schedules.filter((s) => s.day === day);
    return acc;
  }, {});

  // Add new time slot
  const minScheduleTime = dayjs()
    .set("hour", 8)
    .set("minute", 0)
    .set("second", 0)
    .set("millisecond", 0);
  const maxScheduleTime = dayjs()
    .set("hour", 17)
    .set("minute", 0)
    .set("second", 0)
    .set("millisecond", 0);

  const handleAddTime = async (day) => {
    if (!newTime.start || !newTime.end) return;
    if (!validateTimePair(newTime.start, newTime.end)) return;
    const existingSlots = schedulesByDay[day] || [];
    const isDuplicate = existingSlots.some(
      (slot) =>
        slot.start_time?.slice(0, 5) === newTime.start &&
        slot.end_time?.slice(0, 5) === newTime.end
    );
    if (isDuplicate) {
      alert("This schedule already exists for that day.");
      return;
    }
    const confirmation = window.confirm(
      `Add availability on ${day} from ${newTime.start} to ${newTime.end}?`
    );
    if (!confirmation) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Get profile_id first
      const { data: profileData } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profileData) {
        alert("Please create a profile first");
        return;
      }

      const { error } = await supabase.from("schedule").insert([
        {
          profile_id: profileData.profile_id,
          day,
          start_time: newTime.start,
          end_time: newTime.end,
        },
      ]);

      if (error) throw error;

      setNewTime({ start: "", end: "" });
      setScheduleEditDay(null);
      getSchedules();
    } catch (err) {
      console.error(err.message);
    }
  };

  // Delete time slot
  const handleDeleteTime = async (id) => {
    try {
      const { error } = await supabase
        .from("schedule")
        .delete()
        .eq("schedule_id", id);

      if (error) throw error;

      getSchedules();
    } catch (err) {
      console.error(err.message);
    }
  };

  // Edit time slot
  const handleEditTime = async (id, start, end) => {
    if (!validateTimePair(start, end)) return;
    const confirmation = window.confirm(
      `Update availability to ${start} - ${end}?`
    );
    if (!confirmation) return;
    try {
      const { error } = await supabase
        .from("schedule")
        .update({
          day: scheduleEditDay,
          start_time: start,
          end_time: end,
        })
        .eq("schedule_id", id);

      if (error) throw error;

      setScheduleEditDay(null);
      getSchedules();
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleAddUnavailableDay = async () => {
    if (!newUnavailableDate) return;
    const trimmedReason = newUnavailableReason.trim();
    if (!trimmedReason) {
      alert("Please provide a reason for this unavailable day.");
      return;
    }
    if (!profileId) {
      alert("Please save your profile first.");
      return;
    }
    const exists = unavailableDays.some(
      (entry) => entry.date === newUnavailableDate
    );
    if (exists) {
      alert("That date is already marked as unavailable.");
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.from("tutor_unavailable_days").insert([
        {
          profile_id: profileId,
          date: newUnavailableDate,
          reason: trimmedReason,
        },
      ]);

      if (error) throw error;

      setNewUnavailableDate("");
      setNewUnavailableReason("");
      await autoUpdateAppointmentsForUnavailableDay(
        session.user.id,
        newUnavailableDate,
        trimmedReason
      );
      getUnavailableDays();
    } catch (err) {
      console.error(err.message);
    }
  };

  const autoUpdateAppointmentsForUnavailableDay = async (
    tutorId,
    unavailableDate,
    reason
  ) => {
    try {
      const { data: appointments, error } = await supabase
        .from("appointment")
        .select("appointment_id, user_id, subject, topic, date, start_time, status")
        .eq("tutor_id", tutorId)
        .eq("date", unavailableDate)
        .in("status", ["pending", "confirmed"]);

      if (error) throw error;

      for (const appointment of appointments || []) {
        const nextStatus = appointment.status === "confirmed" ? "cancelled" : "declined";
        const { error: updateError } = await supabase
          .from("appointment")
          .update({
            status: nextStatus,
            tutor_decline_reason: reason,
          })
          .eq("appointment_id", appointment.appointment_id);

        if (updateError) {
          console.error("Error updating appointment:", updateError.message);
          continue;
        }

        const formattedDate = new Date(`${appointment.date}T00:00:00`).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
        const formattedTime = new Date(`2000-01-01T${appointment.start_time}`).toLocaleTimeString(
          "en-US",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
        const appointmentLabel = `${appointment.subject}${
          appointment.topic ? ` - ${appointment.topic}` : ""
        }`;
        let notificationMessage =
          nextStatus === "declined"
            ? `Your appointment request for ${appointmentLabel} on ${formattedDate} at ${formattedTime} has been declined.`
            : `Your appointment for ${appointmentLabel} on ${formattedDate} at ${formattedTime} has been cancelled.`;
        if (reason) {
          notificationMessage += ` Reason: ${reason}`;
        }
        notificationMessage += ` [appointment_id:${appointment.appointment_id}]`;

        const { error: notificationError } = await supabase
          .from("notification")
          .insert([
            {
              user_id: appointment.user_id,
              notification_content: notificationMessage,
            },
          ]);

        if (notificationError) {
          console.error("Error creating notification:", notificationError);
        }

        const tutorNotice = `Appointment for ${appointmentLabel} on ${formattedDate} at ${formattedTime} was ${nextStatus} automatically. Reason: ${reason} [appointment_id:${appointment.appointment_id}]`;
        const { error: tutorNoticeError } = await supabase
          .from("notification")
          .insert([
            {
              user_id: tutorId,
              notification_content: tutorNotice,
            },
          ]);

        if (tutorNoticeError) {
          console.error("Error creating tutor notification:", tutorNoticeError);
        }
      }
    } catch (err) {
      console.error("Auto-update unavailable day appointments failed:", err.message);
    }
  };

  const handleRemoveUnavailableDay = async (entry) => {
    try {
      if (!entry) return;
      const formattedDate = new Date(`${entry.date}T00:00:00`).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
      const confirmDelete = window.confirm(
        `Remove unavailable day for ${formattedDate}? Appointments on this date will return to pending if the date has not passed.`
      );
      if (!confirmDelete) return;

      const hasId = Boolean(entry.unavailable_id);
      if (!hasId && !profileId) {
        alert("Unable to remove this date right now. Please try again.");
        return;
      }

      const deleteQuery = supabase.from("tutor_unavailable_days").delete();
      const { error } = hasId
        ? await deleteQuery.eq("unavailable_id", entry.unavailable_id)
        : await deleteQuery
            .eq("profile_id", profileId)
            .eq("date", entry.date);

      if (error) throw error;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await autoRestoreAppointmentsForAvailableDay(
          session.user.id,
          entry.date,
          entry.reason || ""
        );
      }

      getUnavailableDays();
    } catch (err) {
      console.error(err.message);
    }
  };

  const autoRestoreAppointmentsForAvailableDay = async (
    tutorId,
    targetDate,
    reason
  ) => {
    try {
      if (!tutorId || !targetDate) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateValue = new Date(`${targetDate}T00:00:00`);
      if (Number.isNaN(dateValue.getTime()) || dateValue < today) return;

      const { data: appointments, error } = await supabase
        .from("appointment")
        .select(
          "appointment_id, user_id, subject, topic, date, start_time, end_time, status, tutor_decline_reason"
        )
        .eq("tutor_id", tutorId)
        .eq("date", targetDate)
        .in("status", ["declined", "cancelled"]);

      if (error) throw error;

      const eligibleAppointments = (appointments || []).filter((appointment) => {
        if (!reason) return true;
        return appointment.tutor_decline_reason === reason;
      });

      for (const appointment of eligibleAppointments) {
        const startMinutes = getMinutesFromString(appointment.start_time);
        const endMinutes = getMinutesFromString(appointment.end_time);

        if (startMinutes === null || endMinutes === null) continue;

        const { data: tuteeBookings, error: tuteeError } = await supabase
          .from("appointment")
          .select("start_time, end_time")
          .eq("user_id", appointment.user_id)
          .eq("date", targetDate)
          .in("status", ["confirmed", "started", "awaiting_feedback"]);

        if (tuteeError) {
          console.error("Error checking tutee conflicts:", tuteeError.message);
          continue;
        }

        const hasConflict = (tuteeBookings || []).some((booking) => {
          const bookingStart = getMinutesFromString(booking.start_time);
          const bookingEnd = getMinutesFromString(booking.end_time);
          if (bookingStart === null || bookingEnd === null) return false;
          return startMinutes < bookingEnd && endMinutes > bookingStart;
        });

        const formattedDate = new Date(`${appointment.date}T00:00:00`).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
        const formattedTime = new Date(`2000-01-01T${appointment.start_time}`).toLocaleTimeString(
          "en-US",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
        const appointmentLabel = `${appointment.subject}${
          appointment.topic ? ` - ${appointment.topic}` : ""
        }`;

        if (hasConflict) {
          const conflictReason =
            "Tutee already has a confirmed appointment at this time.";
          await supabase
            .from("appointment")
            .update({
              status: "declined",
              tutor_decline_reason: conflictReason,
            })
            .eq("appointment_id", appointment.appointment_id);

          const conflictNotification = `Your appointment request for ${appointmentLabel} on ${formattedDate} at ${formattedTime} remains declined. Reason: ${conflictReason} [appointment_id:${appointment.appointment_id}]`;
          await supabase.from("notification").insert([
            {
              user_id: appointment.user_id,
              notification_content: conflictNotification,
            },
          ]);
          await supabase.from("notification").insert([
            {
              user_id: tutorId,
              notification_content: `Appointment for ${appointmentLabel} on ${formattedDate} at ${formattedTime} stays declined. Reason: ${conflictReason} [appointment_id:${appointment.appointment_id}]`,
            },
          ]);
          continue;
        }

        await supabase
          .from("appointment")
          .update({
            status: "pending",
            tutor_decline_reason: null,
          })
          .eq("appointment_id", appointment.appointment_id);

        const restoreNotification = `Your appointment request for ${appointmentLabel} on ${formattedDate} at ${formattedTime} is pending again because the tutor is now available. [appointment_id:${appointment.appointment_id}]`;
        await supabase.from("notification").insert([
          {
            user_id: appointment.user_id,
            notification_content: restoreNotification,
          },
        ]);
        await supabase.from("notification").insert([
          {
            user_id: tutorId,
            notification_content: `Appointment for ${appointmentLabel} on ${formattedDate} at ${formattedTime} is back to pending after removing the unavailable day. [appointment_id:${appointment.appointment_id}]`,
          },
        ]);
      }
    } catch (err) {
      console.error("Auto-restore unavailable day appointments failed:", err.message);
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const subjectValue = form.subject?.trim() ? form.subject : "Programming";

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", session.user.id)
        .single();

      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from("profile")
          .update({
            nickname: form.nickname,
            program: form.program,
            college: form.college,
            year_level: form.year_level,
            subject: subjectValue,
            specialization: form.specialization,
            profile_image: form.profile_image,
            online_link: form.online_link,
            file_link: form.file_link,
          })
          .eq("user_id", session.user.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase.from("profile").insert([
          {
            user_id: session.user.id,
            nickname: form.nickname,
            program: form.program,
            college: form.college,
            year_level: form.year_level,
            subject: subjectValue,
            specialization: form.specialization,
            profile_image: form.profile_image,
            online_link: form.online_link,
            file_link: form.file_link,
          },
        ]);

        if (error) throw error;
      }

      setProfile(form);
      setShowEditModal(false);

      // Dispatch event to notify Header component to refresh profile
      window.dispatchEvent(new CustomEvent("profileUpdated"));
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("capstone")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("capstone").getPublicUrl(filePath);

      // Update the profile with the new image URL
      setProfile((prev) => ({
        ...prev,
        profile_image: publicUrl,
      }));
      setForm((prev) => ({ ...prev, profile_image: publicUrl }));
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, profile_image: "" }));
  };

  return (
    <div className="min-h-screen py-3 px-6">
      {/* Page Header */}
      <h1 className="text-2xl font-bold text-gray-600 mb-6">My Profile</h1>

      {/* Student Information Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 max-w">
        <div className="flex justify-between items-center mb-6">
          
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            <span>Edit</span>
            <FaEdit size={12} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:gap-8">
          {/* Profile Image */}
          <div className="w-32 h-32 md:w-44 md:h-44 bg-blue-500 rounded-full flex items-center justify-center mb-4 md:mb-0">
            {profile.profile_image ? (
              <img
                src={profile.profile_image}
                alt="Profile"
                className="w-32 h-32 md:w-44 md:h-44 rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-4xl md:text-5xl font-bold">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Profile Information */}
          <div className="flex-1">
            <div className="space-y-2 md:space-y-3 md:grid md:grid-cols-2 md:gap-x-10 md:gap-y-3">
              <p>
                <span className="font-semibold">Name:</span>{" "}
                {capitalizeWords(name)}
              </p>
              <p>
                <span className="font-semibold">Nickname:</span>{" "}
                {capitalizeWords(profile.nickname || "")}
              </p>
              <p>
                <span className="font-semibold">Year:</span>{" "}
                {profile.year_level || ""}
              </p>
              <p>
                <span className="font-semibold">Subject:</span>{" "}
                <span>{capitalizeWords(profile.subject || "")}</span>
              </p>
              <p>
                <span className="font-semibold">Program Course:</span>{" "}
                {capitalizeWords(profile.program || "")}
              </p>
              <p>
                <span className="font-semibold">College:</span>{" "}
                {capitalizeWords(profile.college || "")}
              </p>
              <p>
                <span className="font-semibold">Specialization:</span>{" "}
                <span>{capitalizeWords(profile.specialization || "")}</span>
              </p>
              <p>
                <span className="font-semibold">Online Link:</span>{" "}
                <span>{profile.online_link || "Not provided"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedules + Unavailable Days */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Schedules</h2>
          <div className="space-y-4">
            {daysOfWeek.map((day) => (
              <div key={day} className="flex items-start gap-4">
                <span className="font-semibold text-gray-900 w-24">{day}</span>
                <div className="flex-1 flex flex-wrap gap-2">
                  {schedulesByDay[day] && schedulesByDay[day].length > 0 ? (
                    schedulesByDay[day].map((slot) => (
                      <div
                        key={slot.schedule_id}
                        className="flex items-center bg-white border border-[#c2c2c2] rounded-md px-3 py-1 gap-2"
                      >
                        <span className="text-sm font-mono">
                          {slot.start_time.slice(0, 5)} -{" "}
                          {slot.end_time.slice(0, 5)}
                        </span>
                        <button
                          onClick={() => handleDeleteTime(slot.schedule_id)}
                          className="text-[#c2c2c2]"
                          title="Delete"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-400">No schedule</span>
                  )}
                  {scheduleEditDay === day ? (
                    <div className="flex items-center gap-2">
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DemoContainer components={["TimePicker"]}>
                          <TimePicker
                            value={
                              newTime.start
                                ? dayjs(`2000-01-01T${newTime.start}`)
                                : null
                            }
                            onChange={(value) => handleTimeChange("start", value)}
                            onAccept={(value) => handleTimeAccept("start", value)}
                            label="Start Time"
                            minTime={minScheduleTime}
                            maxTime={maxScheduleTime}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                "& fieldset": {
                                  borderColor: "red",
                                },
                                "&:hover fieldset": {
                                  borderColor: "red",
                                },
                                "&.Mui-focused fieldset": {
                                  borderColor: "red",
                                },
                              },
                            }}
                          />
                        </DemoContainer>
                      </LocalizationProvider>
                      <span>-</span>
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DemoContainer components={["TimePicker"]}>
                          <TimePicker
                            value={
                              newTime.end
                                ? dayjs(`2000-01-01T${newTime.end}`)
                                : null
                            }
                            onChange={(value) => handleTimeChange("end", value)}
                            onAccept={(value) => handleTimeAccept("end", value)}
                            label="End Time"
                            minTime={minScheduleTime}
                            maxTime={maxScheduleTime}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                "& fieldset": {
                                  borderColor: "red",
                                },
                                "&:hover fieldset": {
                                  borderColor: "red",
                                },
                                "&.Mui-focused fieldset": {
                                  borderColor: "red",
                                },
                              },
                            }}
                          />
                        </DemoContainer>
                      </LocalizationProvider>
                      <button
                        onClick={() => handleAddTime(day)}
                        className="text-green-600 hover:text-green-700 text-sm font-semibold"
                        title="Confirm"
                      >
                        Enter
                      </button>
                      <button
                        onClick={() => {
                          setScheduleEditDay(null);
                          setNewTime({ start: "", end: "" });
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setScheduleEditDay(day)}
                      className="text-blue-700 hover:text-blue-900"
                      title="Add time slot"
                    >
                      <FaEdit size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {loadingSchedules && (
            <div className="text-gray-500 mt-4">Loading schedules...</div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <FaCalendarAlt className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Tutor Not Available
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Mark whole days you are unavailable so tutees cannot book sessions.
          </p>
          <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center">
            <input
              type="date"
              value={newUnavailableDate}
              onChange={(e) => setNewUnavailableDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:flex-1"
            />
            <input
              type="text"
              value={newUnavailableReason}
              onChange={(e) => setNewUnavailableReason(e.target.value)}
              placeholder="Reason (required)"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:flex-1"
            />
            <button
              onClick={handleAddUnavailableDay}
              className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          {loadingUnavailable && (
            <div className="text-gray-500 text-sm">Loading dates...</div>
          )}
          {!loadingUnavailable && unavailableDays.length === 0 && (
            <div className="text-sm text-gray-400">No blocked days.</div>
          )}
          <div className="space-y-2">
            {unavailableDays.map((entry) => (
              <div
                key={entry.unavailable_id}
                className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span>
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {entry.reason && (
                    <span className="text-xs text-gray-500">Reason: {entry.reason}</span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveUnavailableDay(entry)}
                  className="text-red-500 hover:text-red-600"
                  title="Remove"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
        </div>

      {/* Edit Information Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Edit Information
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Profile Image Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Image
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center">
                    {form.profile_image ? (
                      <img
                        src={form.profile_image}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      name="profile_image"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-sm text-gray-500 ml-2">
                        Upload a new profile picture
                      </p>
                      {form.profile_image && (
                        <button
                          onClick={handleRemoveImage}
                          className="flex items-center gap-1 px-3 py-1 text-sm border border-red-300 rounded-md text-red-700 hover:bg-red-50 transition-colors"
                        >
                          <FaTrash size={12} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name || ""}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nickname
                  </label>
                  <input
                    type="text"
                    name="nickname"
                    value={form.nickname || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <select
                    name="year_level"
                    value={form.year_level || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <select
                    name="subject"
                    value={form.subject || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="Programming">Programming</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Physics">Physics</option>
                    <option value="Calculus and Statistics">Calculus and Statistics</option>
                    <option value="Psychology and Language">Psychology and Language</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Accountancy and Economics">Accountancy and Economics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program Course
                  </label>
                  <input
                    type="text"
                    name="program"
                    value={form.program || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    College
                  </label>
                  <select
                    name="college"
                    value={form.college || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select College</option>
                    <option value="College of Engineering">
                      College of Engineering
                    </option>
                    <option value="College of Arts and Social Sciences">
                      College of Arts and Social Sciences
                    </option>
                    <option value="College of Computer Studies">
                      College of Computer Studies
                    </option>
                    <option value="College of Education">
                      College of Education
                    </option>
                    <option value="College of Health and Sciences">
                      College of Health and Sciences
                    </option>
                    <option value="College of Economics, Business, and Accountancy">
                      College of Economics, Business, and Accountancy
                    </option>
                    <option value="College of Science and Mathematics">
                      College of Science and Mathematics
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    name="specialization"
                    value={form.specialization || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Online Link
                  </label>
                  <input
                    type="url"
                    name="online_link"
                    value={form.online_link || ""}
                    onChange={handleChange}
                    placeholder="https://meet.google.com/your-meeting-link"
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
               
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
