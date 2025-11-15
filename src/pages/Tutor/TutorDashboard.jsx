import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
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

// Components
import { Cards } from "../../components/cards";

const TutorDashboard = () => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [announcement, setAnnouncement] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [areaRange, setAreaRange] = useState("7d");

  async function getName() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("appointment")
        .select(`
          *,
          student:users!appointment_user_id_fkey(name)
        `)
        .eq("tutor_id", session.user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Format data to match expected structure
      const formattedData = (data || []).map(appointment => ({
        ...appointment,
        student_name: appointment.student?.name || null
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

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setAnnouncement(data || null);
    } catch (err) {
      console.error(err.message);
    }
  }

  useEffect(() => {
    getName();
    getAnnouncement();
    getAppointments();
  }, []);

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

  const completedAppointments = appointments.filter(
    (a) => a.status === "completed"
  );

  const cancelledAppointments = appointments.filter(
    (a) => a.status === "cancelled" || a.status === "declined"
  );

  // Prepare area chart data
  const filteredAppointments = filterByRange(appointments, areaRange);
  // Get all unique dates in range
  const dateSet = new Set(filteredAppointments.map((a) => a.date));
  const sortedDates = Array.from(dateSet).sort();
  // Build data for each date
  const areaChartData = sortedDates.map((date) => {
    const booked = filteredAppointments.filter((a) => a.date === date).length;
    const completed = filteredAppointments.filter(
      (a) => a.date === date && a.status === "completed"
    ).length;
    const cancelled = filteredAppointments.filter(
      (a) =>
        a.date === date && (a.status === "cancelled" || a.status === "declined")
    ).length;
    return { date, booked, completed, cancelled };
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

  const cardStyle = () => {
    return "bg-blue-500 text-white shadow-md shadow-blue-500/50 border-none";
  }

  const cardText = () => {
    return "text-white";
  }

  return (
    <div className="flex-1 flex flex-col bg-white px-6 py-3">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">Dashboard</h1>

        {/* Show date today */}
        <p className="text-[13px] font-extralight text-[#696969] flex items-center gap-2">
          {dateToday}
        </p>
      </div>

      <h2 className="ttext-[24px] font-bold text-blue-600">
        Welcome, {name}!
      </h2>

      <div className="grid lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-1 gap-7 mt-6">
        <Cards
          title="Sessions"
          icon={<fiIcons.FiCalendar />}
          total={completedAppointments.length}
          style={cardStyle()}
          text={cardText()}
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
          {/* Area Chart for Appointments */}
          <div className="bg-[#ffffff] p-3.5 rounded-lg border-2 border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
            <div className="flex justify-between items-center mb-2">
              <p className="text-blue-600 font-semibold">
                Appointments Overview
              </p>
              <select
                value={areaRange}
                onChange={(e) => setAreaRange(e.target.value)}
                className="bg-white border-0 outline-0 text-blue-600 text-sm rounded-md p-[2px]"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="3m">Last 3 Months</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart
                data={areaChartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={formatShortDate} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="booked"
                  stroke="#27aeef"
                  fill="#27aeef33"
                  name="Booked"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#bdcf32"
                  fill="#bdcf3233"
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="cancelled"
                  stroke="#ea5545"
                  fill="#ea554533"
                  name="Cancelled"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:row-span-2 flex flex-col gap-7">
          {/* Announcements */}
          <div className="bg-[#ffffff] p-3.5 rounded-lg border-2 border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
            <p className="text-blue-600 font-semibold">Announcement</p>
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
          <div className="bg-white p-3.5 rounded-lg border-2 border-[#EBEDEF] flex-1 hover:translate-y-[-5px] transition-all duration-300">
            <p className="text-blue-600 font-semibold mb-4">
              Confirmed Sessions Today
            </p>
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
                          {session.student_name || "N/A"}
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
