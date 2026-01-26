import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import { useDataSync } from "../../contexts/DataSyncContext";

// icons
import { FaClipboardList, FaCheckCircle, FaUserPlus, FaTimesCircle } from "react-icons/fa";

// Components
import {
  CollegePieChart,
  SessionBarChart,
  AppointmentsAreaChart,
  SubjectBarChart,
} from "../../components/graphs";

const FINISHED_STATUSES = new Set(["awaiting_feedback", "completed"]);
const isFinishedStatus = (status = "") =>
  FINISHED_STATUSES.has(String(status).toLowerCase());

function Dashboard() {
  const [appointments, setAppointments] = useState([]);
  const [collegeData, setCollegeData] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const navigate = useNavigate();
  const { version } = useDataSync();

  async function getAppointments() {
    try {
      // Fetch all appointments
      const { data, error } = await supabase
        .from("appointment")
        .select("*")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      setAppointments([]);
    }
  }

  async function getCollegeData() {
    try {
      // Fetch student profiles to get college data
      const { data, error } = await supabase
        .from("student_profile")
        .select("college");

      if (error) {
        if (error.status === 406) {
          setCollegeData([]);
          return;
        }
        throw error;
      }

      // Count students by college
      const collegeCounts = {};
      (data || []).forEach((profile) => {
        const college = profile.college || "Unknown";
        collegeCounts[college] = (collegeCounts[college] || 0) + 1;
      });

      // Format for chart
      const formattedData = Object.entries(collegeCounts).map(([college, count]) => ({
        college,
        count,
      }));

      setCollegeData(formattedData);
    } catch (error) {
      console.error("Error fetching college data:", error);
      setCollegeData([]);
    }
  }

  async function getEvaluations() {
    try {
      const { data, error } = await supabase
        .from("evaluation")
        .select("evaluation_id, created_at");

      if (error) throw error;

      setEvaluations(data || []);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      setEvaluations([]);
    }
  }

  useEffect(() => {
    getAppointments();
    getEvaluations();
    getCollegeData();
  }, [version]);

  // Total number of cancelled appointments
  const cancelledAppointments = appointments.filter(
    (a) => a.status === "cancelled"
  );

  const bookedAppointments = appointments.filter((appointment) => {
    const status = String(appointment.status || "").toLowerCase();
    return status && status !== "pending";
  });

  //Total number of completed appointments
  const completedAppointments = appointments.filter((a) =>
    isFinishedStatus(a.status)
  );

  const tuteeRequests = appointments.filter((a) => a.status);
  const pendingAppointments = appointments.filter((a) => a.status === "pending");

  const isSameDay = (value) => {
    if (!value) return false;
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return false;
    const today = new Date();
    return (
      dateValue.getFullYear() === today.getFullYear() &&
      dateValue.getMonth() === today.getMonth() &&
      dateValue.getDate() === today.getDate()
    );
  };

  // Date today
  const dateToday = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const completedSessionsToday = bookedAppointments.filter(
    (a) => formatDate(a.date) === dateToday
  );
  const tuteeRequestsToday = tuteeRequests.filter((a) =>
    isSameDay(a.created_at)
  );
  const cancelledSessionsToday = cancelledAppointments.filter(
    (a) => formatDate(a.date) === dateToday
  );
  const evaluationsToday = evaluations.filter((e) => isSameDay(e.created_at));
  const evaluationTotal = completedAppointments.length;
  const evaluationDone = evaluations.length;
  const evaluationRate = evaluationTotal
    ? (evaluationDone / evaluationTotal) * 100
    : 0;
  const todayKey = new Date().toISOString().slice(0, 10);

  const openLavRoomFocus = (status) => {
    navigate("/dashboard/lav-room", {
      state: {
        lavRoomFocus: {
          date: todayKey,
          status,
          openFirst: true,
        },
      },
    });
  };

  return (
    <div className="flex">
      <div className="min-h-screen flex-1 flex flex-col p-4 md:p-6">
        <div className="">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 md:mb-0">
            <h1 className="text-[20px] md:text-[24px] font-bold text-gray-600">Dashboard</h1>

            {/* Show date today */}
            <p className="text-[12px] md:text-[13px] font-extralight text-[#696969] flex items-center gap-2">
              {dateToday}
            </p>
          </div>

          {/* Admin Dashboard Cards  */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 md:mt-6">
            {/* Sessions */}
            <div className="rounded-md bg-[#ffffff] p-4 shadow-sm border border-[#EBEDEF]">
              <div className="flex items-center justify-between">
                <p className="text-blue-600 font-semibold">Sessions</p>
                <button
                  type="button"
                  onClick={() => openLavRoomFocus("finished")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#1f3b94] text-blue-600 hover:bg-[#f2f7ff] cursor-pointer"
                  aria-label="View completed sessions"
                >
                  <FaClipboardList />
                </button>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[#0d2c8c] mt-2">
                {bookedAppointments.length}
              </p>
              <div className="mt-3 border-b border-dotted border-[#8ea3ff]" />
              <button
                type="button"
                onClick={() => openLavRoomFocus("finished")}
                className="mt-2 flex items-center gap-2 text-xs text-[#7b8bb8] hover:text-[#1f3b94]"
              >
                <span className="font-bold text-[#1f9e2c]">
                  {completedSessionsToday.length || 0}
                </span>
                <span>New Sessions Today!</span>
              </button>
            </div>

            {/* Evaluations */}
            <div className="rounded-md bg-[#ffffff] p-4 shadow-sm border border-[#EBEDEF]">
              <div className="flex items-center justify-between">
                <p className="text-blue-600 font-semibold">Evaluations</p>
                <button
                  type="button"
                  onClick={() => openLavRoomFocus("completed")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#1f3b94] text-blue-600 hover:bg-[#f2f7ff] cursor-pointer"
                  aria-label="View evaluated sessions"
                >
                  <FaCheckCircle />
                </button>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[#0d2c8c] mt-2">
                {evaluationDone} / {evaluationTotal}
              </p>
              <div className="mt-3 border-b border-dotted border-[#8ea3ff]" />
              <button
                type="button"
                onClick={() => openLavRoomFocus("completed")}
                className="mt-2 flex items-center gap-2 text-xs text-[#7b8bb8] hover:text-[#1f3b94]"
              >
                <span className="font-bold text-[#1f9e2c]">
                  {evaluationTotal ? evaluationRate.toFixed(2) : "0.00"}%
                </span>
                <span>Evaluated!</span>
              </button>
            </div>

            {/* Tutee Request */}
            <div className="rounded-md bg-[#ffffff] p-4 shadow-sm border border-[#EBEDEF]">
              <div className="flex items-center justify-between">
                <p className="text-blue-600 font-semibold">Tutee Request</p>
                <button
                  type="button"
                  onClick={() => openLavRoomFocus("pending")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#1f3b94] text-blue-600 hover:bg-[#f2f7ff] cursor-pointer"
                  aria-label="View pending requests"
                >
                  <FaUserPlus />
                </button>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[#0d2c8c] mt-2">
                {tuteeRequests.length}
              </p>
              <div className="mt-3 border-b border-dotted border-[#8ea3ff]" />
              <button
                type="button"
                onClick={() => openLavRoomFocus("pending")}
                className="mt-2 flex items-center gap-2 text-xs text-[#7b8bb8] hover:text-[#1f3b94]"
              >
                <span className="font-bold text-[#1f9e2c]">
                  {tuteeRequestsToday.length || 0}
                </span>
                <span>New Booked Today!</span>
              </button>
            </div>

            {/* Cancellations */}
            <div className="rounded-md bg-[#ffffff] p-4 shadow-sm border border-[#EBEDEF]">
              <div className="flex items-center justify-between">
                <p className="text-blue-600 font-semibold">Cancellations</p>
                <button
                  type="button"
                  onClick={() => openLavRoomFocus("cancelled")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#1f3b94] text-blue-600 hover:bg-[#f2f7ff] cursor-pointer"
                  aria-label="View cancelled sessions"
                >
                  <FaTimesCircle />
                </button>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[#0d2c8c] mt-2">
                {cancelledAppointments.length}
              </p>
              <div className="mt-3 border-b border-dotted border-[#8ea3ff]" />
              <button
                type="button"
                onClick={() => openLavRoomFocus("cancelled")}
                className="mt-2 flex items-center gap-2 text-xs text-[#7b8bb8] hover:text-[#1f3b94]"
              >
                <span className="font-bold text-[#b10f0f]">
                  {cancelledSessionsToday.length || 0}
                </span>
                <span>New Cancelled Today!</span>
              </button>
            </div>
          </div>

          {/* Line and bar chart cards */}
          <div className="mt-4 md:mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* confirmed Appointments bar chart */}
            <div className="bg-[#ffffff] p-3 md:p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <SessionBarChart appointmentsData={appointments} />
            </div>

            {/* Area Chart for Appointments */}
            <div className="bg-[#ffffff] p-3 md:p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <AppointmentsAreaChart appointmentsData={appointments} />
            </div>
          </div>

          {/* Pie Chart for student from each college */}
          <div className="mt-4 md:mt-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#ffffff] w-full p-3 md:p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <CollegePieChart collegeData={collegeData} />
            </div>
            <div className="bg-[#ffffff] w-full p-3 md:p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <SubjectBarChart appointmentsData={appointments} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
