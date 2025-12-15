import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabase-client";

//component
import { CardsOne } from "../../components/cards";

//icons
import { PiSpeakerHigh } from "react-icons/pi";
import { AiOutlineSchedule } from "react-icons/ai";
import { MdOutlineWorkHistory } from "react-icons/md";

const FINISHED_STATUSES = new Set(["awaiting_feedback", "completed"]);
const isFinishedStatus = (status = "") =>
  FINISHED_STATUSES.has(String(status).toLowerCase());

const STATUS_META = {
  pending: { label: "Pending", badge: "bg-[#e6e7ea] text-[#323335]" },
  confirmed: { label: "Confirmed", badge: "bg-[#76acf5] text-[#0f2d58]" },
  started: { label: "In Session", badge: "bg-[#feda3c] text-[#181718]" },
  awaiting_feedback: { label: "Awaiting Feedback", badge: "bg-[#323335] text-white" },
  completed: { label: "Completed", badge: "bg-[#76acf5] text-[#0f2d58]" },
  declined: { label: "Declined", badge: "bg-[#181718] text-white" },
  cancelled: { label: "Cancelled", badge: "bg-[#181718] text-white" },
};

const formatStatusLabel = (status = "") =>
  STATUS_META[status]?.label || status.replace(/_/g, " ");
const statusBadge = (status = "") =>
  STATUS_META[status]?.badge || "bg-gray-100 text-gray-800";

const TuteeDashboard = () => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [announcement, setAnnouncement] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function getName() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select("name, role")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setName(data.name);
        if (data.role) {
          setRole(data.role);
        }
      }

      // Check if user can switch to tutor (has tutor profile)
      const { data: tutorProfile } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", session.user.id)
        .single();

      if (typeof window !== "undefined") {
        const can = tutorProfile ? true : false;
        window.dispatchEvent(new CustomEvent("canSwitchUpdated", { detail: { value: can } }));
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
          tutor:users!tutor_id(name)
        `)
        .eq("user_id", session.user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Format data to match expected structure
      const formattedData = (data || []).map(appointment => ({
        ...appointment,
        tutor_name: appointment.tutor?.name || null
      }));

      setAppointments(formattedData);
    } catch (err) {
      console.error(err.message);
      setMessage("Error loading appointments");
    } finally {
      setLoading(false);
    }
  };

  async function fetchAnnouncement() {
    try {
      const { data, error } = await supabase
        .from("announcement")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      setAnnouncement(data || null);
    } catch (error) {
      console.error("Error fetching announcement:", error);
      setAnnouncement(null);
    }
  }

  useEffect(() => {
    getName();
    fetchAnnouncement();
    getAppointments();
  }, []);

  const dateToday = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
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

  const completedSessions = appointments.filter((a) =>
    isFinishedStatus(a.status)
  );

  const historySessions = appointments.filter(
    (a) =>
      !["pending", "confirmed", "started"].includes(
        (a.status || "").toLowerCase()
      )
  );

  return (
    <div className="flex-1 flex flex-col px-6 py-3 bg-[#f4ece6] min-h-screen">
      <div className="flex justify-between items-center bg-[#4c4ba2] text-white rounded-xl px-4 py-3 shadow-md">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-[13px] font-semibold">{dateToday}</p>
      </div>

      {/* Notices */}
      <div className="flex justify-end items-center">
        <Link
          to="/dashboard/appointment"
          className="lav-btn md:px-8 md:py-2 text-sm md:text-base"
          style={{ background: "#4257a9", color: "#fff", border: "1px solid #3b4c95" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#4766fe")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#4257a9")}
        >
          Make an Appointment
        </Link>
      </div>

      <div className="mt-4 grid sm:grid-cols-1 md:grid-cols-2 gap-7 h-full">
        {/* Announcements */}
        <div className="h-full">
          <div className="lav-card p-3.5 h-full flex flex-col">
            <div className="flex gap-4 items-center">
            <div className="text-[#4c4ba2] text-2xl"><PiSpeakerHigh  /></div>
            <p className="text-[#323335] font-semibold"> Announcement</p>
            </div>
            <div className="mt-2 flex-1">
              {announcement ? (
                <div>
                  {announcement.announcement_content ? (
                    <p className="text-[#323335]">
                      {announcement.announcement_content}
                    </p>
                  ) : (
                    <p className="text-[#6b6c70]">No content available</p>
                  )}
                </div>
              ) : (
                <p className="text-[#6b6c70]">No announcement found.</p>
              )}
            </div>
          </div>
        </div>
        <div className="lav-card p-3.5">
          <div className="flex gap-4 item-center">
          <p className="text-2xl text-[#4c4ba2]">< AiOutlineSchedule /></p>
          <p className="text-[#323335] font-semibold mb-4">
            Confirmed Sessions Today
          </p>
          </div>
          {nextSessions.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto h-[150px]">
              <table className="w-full text-[#1a1a1a]">
                <thead>
                  <tr className="border-b border-[#EBEDEF]">
                    <th className="text-left font-bold py-3 px-2">Time</th>
                    <th className="text-left font-bold py-3 px-2">Tutor</th>
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
                        {session.tutor_name || "N/A"}
                      </td>
                      <td className="py-3 px-2">{formatDate(session.date)}</td>
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
        <div className="flex justify-end mt-3">
          <Link
            to="/dashboard/schedules"
            className="text-xs text-blue-600 font-semibold hover:text-blue-800"
          >
            View schedule details →
          </Link>
        </div>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-1 md:grid-cols-3 grid-rows-3 gap-7">
        <div className="row-span-3 col-span-2">
          <div className="bg-white p-3.5 rounded-lg border border-[#EBEDEF] flex-1">
            <div className="flex gap-4 text-center items-center">
            <p className="text-blue-600 text-2xl"><MdOutlineWorkHistory /></p>
            <p className="text-gray-600 font-semibold">Session History</p>
            <Link
              to="/dashboard/schedules"
              className="text-xs text-blue-600 font-semibold hover:text-blue-800 ml-auto"
            >
              View all
            </Link>
            </div>

            {/*Completed Sessions */}
            <div className="overflow-x-auto overflow-y-auto h-[280px]">
              <table className="w-full text-[#1a1a1a]">
                <thead>
                  <tr className=" border-b border-[#EBEDEF]">
                    <th className="text-left font-bold py-3 px-2">Tutor</th>
                    <th className="text-left font-bold py-3 px-2">Date</th>
                    <th className="text-left font-bold py-3 px-2">Time</th>
                    <th className="text-left font-bold py-3 px-2">Subject</th>
                    <th className="text-left font-bold py-3 px-2">Topic</th>
                    <th className="text-left font-bold py-3 px-2">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {historySessions.length > 0 ? (
                    historySessions.map((session) => (
                      <tr
                        key={session.appointment_id}
                        className="border-b border-[#EBEDEF]"
                      >
                        <td className="py-3 px-2">
                          {session.tutor_name || "N/A"}
                        </td>
                        <td className="py-3 px-2">{formatDate(session.date)}</td>
                        <td className="py-3 px-2">
                          {formatTime(session.start_time)} -{" "}
                          {formatTime(session.end_time)}
                        </td>
                        <td className="py-3 px-2">{session.subject || "N/A"}</td>
                        <td className="py-3 px-2">{session.topic || "N/A"}</td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                              session.status
                            )}`}
                          >
                            {formatStatusLabel(session.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 px-2 text-center text-sm text-gray-500"
                      >
                        No historical sessions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-3">
              <Link
                to="/dashboard/schedules"
                className="text-xs text-blue-600 font-semibold hover:text-blue-800"
              >
                Go to schedules →
              </Link>
            </div>
          </div>
        </div>

      
      </div>
    </div>
  );
};

export default TuteeDashboard;
