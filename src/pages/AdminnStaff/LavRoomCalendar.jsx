import { useEffect, useMemo, useState } from "react";
import { AiOutlineEye } from "react-icons/ai";
import { supabase } from "../../supabase-client";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDate = (date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatRange = (start) => {
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  return `${formatDate(start)} - ${formatDate(end)}`;
};

const STATUS_COLORS = {
  pending: "#c9c7c9",
  confirmed: "#4766fe",
  started: "#76acf5",
  awaiting_feedback: "#935226",
  completed: "#00a65a",
  declined: "#323335",
  cancelled: "#ff4b4b",
};

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  started: "Started",
  awaiting_feedback: "Awaiting Feedback",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

const toMinutes = (timeValue) => {
  if (!timeValue) return 0;
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

const formatTime = (timeValue) => {
  if (!timeValue) return "";
  return new Date(`2000-01-01T${timeValue}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatLongDate = (dateValue) => {
  if (!dateValue) return "";
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getStatusColor = (status) => STATUS_COLORS[status] || "#c9c7c9";

const getTextColor = (status) => {
  const darkStatuses = new Set([
    "confirmed",
    "awaiting_feedback",
    "declined",
    "cancelled",
  ]);
  return darkStatuses.has(status) ? "text-white" : "text-[#1433a5]";
};

const LavRoomCalendar = () => {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [appointments, setAppointments] = useState([]);

  const weekDates = useMemo(() => {
    return dayLabels.map((label, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return { label, date };
    });
  }, [weekStart]);

  const handlePrevWeek = () => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() - 7);
    setWeekStart(next);
  };

  const handleNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + 7);
    setWeekStart(next);
  };

  const fetchAppointments = async (startDate) => {
    const start = new Date(startDate);
    const end = new Date(startDate);
    end.setDate(start.getDate() + 4);
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);

    try {
      const { data, error } = await supabase
        .from("appointment")
        .select(
          `appointment_id,
          subject,
          topic,
          date,
          start_time,
          end_time,
          mode_of_session,
          number_of_tutees,
          status,
          tutor:users!appointment_tutor_id_fkey(name),
          tutee:users!appointment_user_id_fkey(name)`
        )
        .gte("date", startKey)
        .lte("date", endKey)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error("Error loading LAV room appointments:", err.message);
      setAppointments([]);
    }
  };

  useEffect(() => {
    fetchAppointments(weekStart);
  }, [weekStart]);

  useEffect(() => {
    const channel = supabase
      .channel("lav-room-calendar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment" },
        () => fetchAppointments(weekStart)
      );

    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [weekStart]);

  const bookingsByDay = useMemo(() => {
    const grouped = dayLabels.map(() => []);
    appointments.forEach((appointment) => {
      if (!appointment.date) return;
      const dateValue = new Date(`${appointment.date}T00:00:00`);
      const dayIndex = dateValue.getDay() === 0 ? -1 : dateValue.getDay() - 1;
      if (dayIndex < 0 || dayIndex > 4) return;
      grouped[dayIndex].push(appointment);
    });
    return grouped.map((items) =>
      items.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
    );
  }, [appointments]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-700">
            LAV Room
          </h1>
          <p className="text-sm text-gray-500">Weekly schedule (Mon - Fri)</p>
        </div>
        <div className="text-sm text-gray-500">{formatRange(weekStart)}</div>
      </div>

      <div className="bg-[#f7efe6] rounded-3xl border border-[#d9d2c8] p-4 shadow-sm">
        <div className="grid grid-cols-5 text-center text-[#1f3b94] font-semibold">
          {weekDates.map((day) => (
            <div key={day.label} className="pb-2">
              <div className="text-base md:text-lg tracking-wide">
                {day.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 border border-[#1433a5] bg-[#f7efe6]">
            {bookingsByDay.map((items, dayIndex) => (
              <div
                key={dayLabels[dayIndex]}
                className="border border-[#1433a5] p-2"
              >
                <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="text-xs text-[#7b8bb8] py-8 text-center">
                      No bookings
                    </div>
                  ) : (
                    items.map((booking) => (
                      <div
                        key={booking.appointment_id}
                        className="relative rounded-md border border-[#1433a5] p-2 text-[10px] md:text-xs group"
                        style={{ backgroundColor: getStatusColor(booking.status) }}
                      >
                        <div className={`flex justify-between font-semibold ${getTextColor(booking.status)}`}>
                          <span>start</span>
                          <span>{booking.start_time?.slice(0, 5) || "--:--"}</span>
                        </div>
                        <div className={`flex justify-between font-semibold mb-1 ${getTextColor(booking.status)}`}>
                          <span>end</span>
                          <span>{booking.end_time?.slice(0, 5) || "--:--"}</span>
                        </div>
                        <div className={`font-semibold ${getTextColor(booking.status)}`}>tutor</div>
                        <div className={getTextColor(booking.status)}>
                          {booking.tutor?.name || "N/A"}
                        </div>
                        <div className={`font-semibold mt-1 ${getTextColor(booking.status)}`}>tutee</div>
                        <div className={getTextColor(booking.status)}>
                          {booking.tutee?.name || "N/A"}
                        </div>
                        <div
                          className={`absolute bottom-2 right-2 ${getTextColor(booking.status)}`}
                          aria-hidden="true"
                        >
                          <AiOutlineEye className="h-4 w-4" />
                        </div>
                        <div
                          className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[#d6c6b0] bg-[#fff8ed] p-4 text-[12px] text-[#2d3a6d] shadow-2xl group-hover:block z-20"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[18px] font-bold text-[#8a5328]">
                              {booking.subject || "Appointment"}
                            </span>
                            <span className="text-[16px] font-semibold text-[#0d2c8c]">
                              {booking.date
                                ? new Date(`${booking.date}T00:00:00`).toLocaleDateString(
                                    "en-US",
                                    { month: "2-digit", day: "2-digit", year: "2-digit" }
                                  )
                                : ""}
                            </span>
                          </div>

                          <div className="mt-3 rounded-2xl border border-[#caa37b] bg-[#fffdf7] p-3">
                            <div className="grid grid-cols-2 gap-3 text-[12px]">
                              <div>
                                <div className="font-semibold text-[#1f3b94]">Start Time</div>
                                <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                                  {formatTime(booking.start_time) || "--"}
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-[#1f3b94]">End Time</div>
                                <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                                  {formatTime(booking.end_time) || "--"}
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-[#1f3b94]">Tutor</div>
                                <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                                  {booking.tutor?.name || "N/A"}
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-[#1f3b94]">Tutee</div>
                                <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                                  {booking.tutee?.name || "N/A"}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                              <div>
                                <div className="font-semibold text-[#1f3b94]">Topic</div>
                                <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                                  {booking.topic || "N/A"}
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-[#1f3b94]">Status</div>
                                </div>
                                <span
                                  className="rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                                  style={{ backgroundColor: getStatusColor(booking.status) }}
                                >
                                  {(STATUS_LABELS[booking.status] || booking.status).toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={handlePrevWeek}
            className="px-4 py-2 rounded-full border border-[#1f3b94] text-[#1f3b94] text-sm hover:bg-[#e9e0d3]"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={handleNextWeek}
            className="px-4 py-2 rounded-full border border-[#1f3b94] text-[#1f3b94] text-sm hover:bg-[#e9e0d3]"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default LavRoomCalendar;
