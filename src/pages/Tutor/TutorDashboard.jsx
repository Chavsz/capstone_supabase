import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import { capitalizeWords } from "../../utils/text";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";

//icons
import * as fiIcons from "react-icons/fi";
import { PiSpeakerHigh } from "react-icons/pi";
import { AiOutlineSchedule } from "react-icons/ai";
import { LuChartLine } from "react-icons/lu";

// Components
import { Cards } from "../../components/cards";

const FINISHED_STATUSES = new Set(["awaiting_feedback", "completed"]);
const isFinishedStatus = (status = "") =>
  FINISHED_STATUSES.has(String(status).toLowerCase());
const PROFILE_POPUP_STORAGE_PREFIX = "tutorProfilePopupDismissed";

const TutorDashboard = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [announcement, setAnnouncement] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [areaRange, setAreaRange] = useState("7d");
  const [tutorProfile, setTutorProfile] = useState(null);
  const [loadingTutorProfile, setLoadingTutorProfile] = useState(true);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [profilePopupDismissed, setProfilePopupDismissed] = useState(false);
  const [profilePopupKey, setProfilePopupKey] = useState("");

  async function getName() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select("name, role, user_id")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setName(data.name);
        if (data.role) {
          setRole(data.role);
        }
        setUserId(data.user_id);
      }
    } catch (err) {
      console.error(err.message);
    }
  }

  const getAppointments = async () => {
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
          student:users!appointment_user_id_fkey(name)
        `
        )
        .eq("tutor_id", session.user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Format data to match expected structure
      const formattedData = (data || []).map((appointment) => ({
        ...appointment,
        student_name: appointment.student?.name || null,
      }));

      setAppointments(formattedData);
    } catch (err) {
      console.error(err.message);
    }
  };

  async function getAnnouncement() {
    try {
      const { data, error } = await supabase
        .from("announcement")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setAnnouncement(data || null);
    } catch (err) {
      console.error(err.message);
    }
  }

  const getTutorProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const accessToken = session.access_token || "session";
      const popupKey = `${PROFILE_POPUP_STORAGE_PREFIX}:${session.user.id}:${accessToken}`;
      setProfilePopupKey(popupKey);
      if (typeof window !== "undefined") {
        try {
          const dismissed =
            sessionStorage.getItem(popupKey) === "1";
          setProfilePopupDismissed(dismissed);
        } catch {
          setProfilePopupDismissed(false);
        }
      }

      const { data, error } = await supabase
        .from("profile")
        .select("program, college, year_level, subject, specialization, profile_image")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== "PGRST116" && error.status !== 406) {
        throw error;
      }

      const profileData = data || {
        program: "",
        college: "",
        year_level: "",
        subject: "",
        specialization: "",
        profile_image: "",
      };

      setTutorProfile(profileData);
    } catch (err) {
      console.error("Unable to load tutor profile:", err.message);
    } finally {
      setLoadingTutorProfile(false);
    }
  };

  const profileComplete = Boolean(
    tutorProfile &&
      tutorProfile.program?.trim() &&
      tutorProfile.college?.trim() &&
      tutorProfile.year_level?.trim() &&
      tutorProfile.subject?.trim() &&
      tutorProfile.specialization?.trim()
  );

  const dismissProfilePopup = () => {
    setShowProfilePopup(false);
    setProfilePopupDismissed(true);
    if (!profilePopupKey || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(profilePopupKey, "1");
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  };

  useEffect(() => {
    getName();
    getAnnouncement();
    getAppointments();
    getTutorProfile();
  }, []);

  useEffect(() => {
    if (!loadingTutorProfile && !profileComplete && !profilePopupDismissed) {
      setShowProfilePopup(true);
    }
    if (profileComplete) {
      setShowProfilePopup(false);
    }
  }, [loadingTutorProfile, profileComplete, profilePopupDismissed]);

  // Helper: Filter appointments by date range
  function filterByRange(appts, range) {
    const now = new Date();
    let startDate;
    if (range === "7d") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
    } else if (range === "30d") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
    } else if (range === "3m") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
    }
    return appts.filter(
      (a) => new Date(a.date) >= startDate && new Date(a.date) <= now
    );
  }

  // Helper: Format date as 'Mon DD'
  function formatShortDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const completedAppointments = appointments.filter((a) =>
    isFinishedStatus(a.status)
  );

  const cancelledAppointments = appointments.filter(
    (a) => a.status === "cancelled" || a.status === "declined"
  );

  // Prepare line chart data
  const filteredAppointments = filterByRange(appointments, areaRange);
  const statusKeys = [
    "pending",
    "confirmed",
    "started",
    "awaiting_feedback",
    "completed",
    "declined",
    "cancelled",
  ];
  // Get all unique dates in range
  const dateSet = new Set(filteredAppointments.map((a) => a.date));
  const sortedDates = Array.from(dateSet).sort();
  // Build data for each date
  const areaChartData = sortedDates.map((date) => {
    const counts = statusKeys.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    filteredAppointments
      .filter((a) => a.date === date)
      .forEach((appointment) => {
        const statusKey = String(appointment.status || "").toLowerCase();
        if (counts[statusKey] !== undefined) {
          counts[statusKey] += 1;
        }
      });

    return { date, ...counts };
  });

  // Get next sessions for today (only confirmed appointments)
  const nextSessions = appointments.filter(
    (a) =>
      new Date(a.date).toDateString() === new Date().toDateString() &&
      a.status === "confirmed"
  );

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

  const dateToday = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const cardText = () => {
    return "text-white";
  };

  return (
    <div className="flex-1 flex flex-col px-6 py-3">
      {showProfilePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-[#e9f1ff] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#1f3b94]">
              Complete your tutor profile
            </h2>
            <p className="mt-3 text-sm text-[#2d3a6d]">
              Please add your year level, program, college, subject, and specialization
              before continuing.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={dismissProfilePopup}
                className="rounded-full border border-[#c7d6f6] bg-white/80 px-4 py-2 text-sm font-semibold text-[#1f3b94] hover:bg-white"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissProfilePopup();
                  navigate("/dashboard/profile");
                }}
                className="rounded-full bg-[#1f3b94] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d6d]"
              >
                Edit Now
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-600">Dashboard</h1>

        {/* Show date today */}
        <p className="text-[13px] font-extralight text-[#696969] flex items-center gap-2">
          {dateToday}
        </p>
      </div>

      <h2 className="ttext-[24px] font-bold text-blue-600">
        Welcome, {capitalizeWords(name)}!
      </h2>

      <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-7 mt-6">
        <Cards
          title="Sessions"
          icon={<fiIcons.FiCalendar />}
          total={completedAppointments.length}
        />
        <Cards
          title="Tutee Request"
          icon={<fiIcons.FiUser />}
          total={appointments.length}
        />
        <Cards
          title="Cancellations"
          icon={<fiIcons.FiCalendar />}
          total={cancelledAppointments.length}
        />
      </div>

      <div className="mt-6 grid lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-1 gap-7">
        <div className="lg:row-span-2">
          {/* Sessions Chart */}
          <div className="bg-[#ffffff] p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-4 items-center">
              <p className="text-blue-600 text-2xl"><LuChartLine /></p>
              <p className="text-gray-600 font-semibold">
                Sessions
              </p>
              </div>
              <select
                value={areaRange}
                onChange={(e) => setAreaRange(e.target.value)}
                className="bg-white border-0 outline-0 text-blue-600 text-sm rounded-md p-[2px]"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="3m">This Sem</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={areaChartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} />
                <YAxis allowDecimals={false} tickLine={false} />
                <Tooltip labelFormatter={formatShortDate} />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: "16px" }}
                />
                <Line
                  type="monotone"
                  dataKey="pending"
                  stroke="#c9c7c9"
                  strokeWidth={3}
                  dot={false}
                  name="Pending"
                />
                <Line
                  type="monotone"
                  dataKey="confirmed"
                  stroke="#4766fe"
                  strokeWidth={3}
                  dot={false}
                  name="Confirmed"
                />
                <Line
                  type="monotone"
                  dataKey="started"
                  stroke="#76acf5"
                  strokeWidth={3}
                  dot={false}
                  name="Started"
                />
                <Line
                  type="monotone"
                  dataKey="awaiting_feedback"
                  stroke="#935226"
                  strokeWidth={3}
                  dot={false}
                  name="Awaiting Feedback"
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#00a65a"
                  strokeWidth={3}
                  dot={false}
                  name="Completed"
                />
                <Line
                  type="monotone"
                  dataKey="declined"
                  stroke="#323335"
                  strokeWidth={3}
                  dot={false}
                  name="Declined"
                />
                <Line
                  type="monotone"
                  dataKey="cancelled"
                  stroke="#ff4b4b"
                  strokeWidth={3}
                  dot={false}
                  name="Cancelled"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:row-span-2 flex flex-col gap-7">
          {/* Announcements */}
          <div className="bg-[#ffffff] p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
            <div className="flex gap-4 items-center">
              <p className="text-blue-600 text-2xl">
                <PiSpeakerHigh />
              </p>
              <p className="text-gray-600 font-semibold">Announcement</p>
            </div>
            <div className="mt-2 ">
              {announcement ? (
                <div>
                  {announcement.announcement_content ? (
                    <p className="text-gray-700">
                      {announcement.announcement_content}
                    </p>
                  ) : (
                    <p className="text-gray-600">No content available</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">No announcement found.</p>
              )}
            </div>
          </div>

          {/* Next Sessions Table */}
          <div className="bg-white p-3.5 rounded-lg border border-[#EBEDEF] flex-1 hover:translate-y-[-5px] transition-all duration-300">
            <div className="flex gap-4 item-center">
              <p className="text-2xl text-blue-600">
                <AiOutlineSchedule />
              </p>
              <p className="text-gray-600 font-semibold mb-4">
                Confirmed Sessions Today
              </p>
            </div>
            {nextSessions.length > 0 ? (
              <div className="overflow-x-auto overflow-y-auto h-[180px]">
                <table className="w-full text-[#1a1a1a]">
                  <thead>
                    <tr className="border-b border-[#EBEDEF]">
                      <th className="text-left font-bold py-3 px-2">Time</th>
                      <th className="text-left font-bold py-3 px-2">Student</th>
                      <th className="text-left font-bold py-3 px-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nextSessions.map((session) => (
                      <tr
                        key={session.appointment_id}
                        className="border-b border-[#EBEDEF]"
                      >
                        <td className="py-3 px-2">
                          {formatTime(session.start_time)} -{" "}
                          {formatTime(session.end_time)}
                        </td>
                        <td className="py-3 px-2">
                          {session.student_name
                            ? capitalizeWords(session.student_name)
                            : "N/A"}
                        </td>
                        <td className="py-3 px-2">
                          {formatDate(session.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-gray-400 text-center">
                  No confirmed sessions today
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorDashboard;
