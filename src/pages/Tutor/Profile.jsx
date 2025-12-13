import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
import { FaEdit, FaPlus, FaTrash, FaTimes } from "react-icons/fa";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const Profile = () => {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState({
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

  const ALLOWED_TIME_BLOCKS = [
    { start: 8 * 60, end: 12 * 60 },
    { start: 13 * 60, end: 17 * 60 },
  ];

  const allowedHoursMessage =
    "Schedules can only be between 8:00 AM - 12:00 PM or 1:00 PM - 5:00 PM (no bookings during 12:00-1:00 PM).";

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
    if (value && value.isValid()) {
      const minutes = getMinutesFromDayjs(value);
      if (!isWithinAllowedBlock(minutes)) {
        alert(allowedHoursMessage);
        return;
      }

      setNewTime((prev) => {
        const otherField = field === "start" ? "end" : "start";
        const otherMinutes = getMinutesFromString(prev[otherField]);

        if (otherMinutes !== null) {
          if (
            (field === "start" && minutes >= otherMinutes) ||
            (field === "end" && minutes <= otherMinutes)
          ) {
            alert("End time must be later than start time.");
            return prev;
          }

          const startMinutes =
            field === "start" ? minutes : otherMinutes;
          const endMinutes =
            field === "end" ? minutes : otherMinutes;

          if (!areWithinSameBlock(startMinutes, endMinutes)) {
            alert(
              "Start and end times need to remain within the same time block (morning or afternoon)."
            );
            return prev;
          }
        }

        return {
          ...prev,
          [field]: value.format("HH:mm"),
        };
      });
    } else {
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
      if (data) setName(data.name);
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

      setProfile(profileData);
      setForm(profileData);
    } catch (err) {
      console.error(err.message);
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
      const { data: profileData } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", session.user.id)
        .single();

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
            subject: form.subject,
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
            subject: form.subject,
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
          <h2 className="text-xl font-bold text-gray-900">
            Student Information
          </h2>
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            <span>Edit</span>
            <FaEdit size={12} />
          </button>
        </div>

        <div className="">
          {/* Profile Image */}
          <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center mb-3">
            {profile.profile_image ? (
              <img
                src={profile.profile_image}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-4xl font-bold">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Profile Information */}
          <div className="flex flex-col">
            <div className="space-y-2 ">
              <p>
                <span className="font-semibold">Name:</span> {name}
              </p>
              <p>
                <span className="font-semibold">Nickname:</span>{" "}
                {profile.nickname || ""}
              </p>
              <p>
                <span className="font-semibold">Year:</span>{" "}
                {profile.year_level || ""}
              </p>
              <p>
                <span className="font-semibold">Subject:</span>{" "}
                <span>{profile.subject || ""}</span>
              </p>
              <p>
                <span className="font-semibold">Program Course:</span>{" "}
                {profile.program || ""}
              </p>
              <p>
                <span className="font-semibold">College:</span>{" "}
                {profile.college || ""}
              </p>
              <p>
                <span className="font-semibold">Specialization:</span>{" "}
                <span>{profile.specialization || ""}</span>
              </p>
              <p>
                <span className="font-semibold">Online Link:</span>{" "}
                <span>{profile.online_link || "Not provided"}</span>
              </p>
              <p>
                <span className="font-semibold">File Link:</span>{" "}
                <span>{profile.file_link || "Not provided"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedules Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w">
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
                      className="flex items-center bg-white border-1 border-[#c2c2c2] rounded-md px-3 py-1 gap-2"
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
                      className="text-green-600 hover:text-green-700"
                      title="Add"
                    >
                      <FaPlus size={14} />
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
                    value={name}
                    disabled
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
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
                  <input
                    type="text"
                    name="subject"
                    value={form.subject || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Link
                  </label>
                  <input
                    type="url"
                    name="file_link"
                    value={form.file_link || ""}
                    onChange={handleChange}
                    // placeholder="https://drive.google.com/file/d/your-file-id/view?usp=sharing"
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
