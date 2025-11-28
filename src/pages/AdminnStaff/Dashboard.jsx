import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

// icons
import * as fiIcons from "react-icons/fi";

// Components
import { Cards } from "../../components/cards";
import {
  CollegePieChart,
  SessionBarChart,
  AppointmentsAreaChart,
} from "../../components/graphs";

function Dashboard() {
  const [appointments, setAppointments] = useState([]);
  const [collegeData, setCollegeData] = useState([]);

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

      if (error) throw error;

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

  useEffect(() => {
    getAppointments();
    // getFeedbacks();
    // getEvaluatedAppointments();
    getCollegeData();
  }, []);

  // Total number of cancelled appointments
  const cancelledAppointments = appointments.filter(
    (a) => a.status === "cancelled"
  );

  //Total number of completed appointments
  const completedAppointments = appointments.filter(
    (a) => a.status === "completed"
  );


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

  const completedSessionsToday = completedAppointments.filter(
    (a) => formatDate(a.date) === dateToday
  );
  const bookedSessionsToday = appointments.filter(
    (a) => formatDate(a.date) === dateToday
  );
  const cancelledSessionsToday = cancelledAppointments.filter(
    (a) => formatDate(a.date) === dateToday
  );

  return (
    <div className="flex">
      <div className="min-h-screen flex-1 flex flex-col p-6">
        <div className="">
          <div className="flex justify-between items-center">

            <h1 className="text-[24px] font-bold text-gray-600">Dashboard</h1>

            {/* Show date today */}
            <p className="text-[13px] font-extralight text-[#696969] flex items-center gap-2">
              {dateToday}
            </p>
          </div>

          {/* Admin Dashboard Cards  */}
          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 mt-6">
            {/* Sessions Card */}
            <Cards
              title="Sessions"
              icon={<fiIcons.FiCalendar />}
              total={completedAppointments.length}
              newToday={
                completedSessionsToday.length === 0
                  ? ""
                  : completedSessionsToday.length
              }
              latestText={
                completedSessionsToday.length === 0
                  ? "No completed sessions today"
                  : "Completed Sessions Today"
              }
            />


            {/* Student Request Card */}
            <Cards
              title="Tutee Request"
              icon={<fiIcons.FiUser />}
              total={appointments.length}
              newToday={
                bookedSessionsToday.length === 0
                  ? ""
                  : bookedSessionsToday.length
              }
              latestText={
                bookedSessionsToday.length === 0
                  ? "No bookings today"
                  : "Bookings Today"
              }
            />

            {/* Cancellations Card */}
            <div className="bg-[#ffffff] p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <div className="flex items-center justify-between">
                <p className="text-gray-600 font-semibold">Cancellations</p>
                <p className="text-2xl text-blue-600">
                  <fiIcons.FiCalendar />
                </p>
              </div>
              <p className="text-[30px] font-bold pl-4 py-4 text-gray-600">
                {cancelledAppointments.length}
              </p>
              <div className="flex gap-2">
                <p className="text-[13.5px] text-[#ad0d0d] font-bold">
                  {cancelledSessionsToday.length === 0
                    ? ""
                    : cancelledSessionsToday.length}
                </p>
                <p className="text-[13.5px] text-[#A0A0A0]">
                  {" "}
                  {cancelledSessionsToday.length === 0
                    ? "No cancelled sessions today"
                    : "Cancelled Sessions Today"}
                </p>
              </div>
            </div>
          </div>

          {/* Line and bar chart cards */}
          <div className="mt-6 grid lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-1 gap-4 ">
            {/* confirmed Appointments bar chart */}
            <div className="bg-[#ffffff] p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <SessionBarChart appointmentsData={appointments} />
            </div>

            {/* Area Chart for Appointments */}
            <div className="bg-[#ffffff] p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <AppointmentsAreaChart appointmentsData={appointments} />
            </div>
          </div>

          {/* Pie Chart for student from each college */}
          <div className="mt-6 w-full">
            <div className="bg-[#ffffff] w-1/2 p-3.5 rounded-lg border border-[#EBEDEF] hover:translate-y-[-5px] transition-all duration-300">
              <CollegePieChart collegeData={collegeData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
