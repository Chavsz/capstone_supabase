import { useEffect, useMemo, useRef, useState } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { FiCalendar } from "react-icons/fi";
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
  const [hoveredAppointment, setHoveredAppointment] = useState(null);
  const gridRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [weekPickerValue, setWeekPickerValue] = useState("");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
  const [searchIndex, setSearchIndex] = useState(0);

  const weekDates = useMemo(() => {
    return dayLabels.map((label, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return { label, date };
    });
  }, [weekStart]);

  const isSearchMode = searchTerm.trim().length > 0;

  const handlePrevWeek = () => {
    if (isSearchMode) {
      if (searchResults.length === 0) return;
      setSearchIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() - 7);
    setWeekStart(next);
  };

  const handleNextWeek = () => {
    if (isSearchMode) {
      if (searchResults.length === 0) return;
      setSearchIndex((prev) =>
        Math.min(prev + 1, Math.max(searchResults.length - 1, 0))
      );
      return;
    }
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + 7);
    setWeekStart(next);
  };

  const handleWeekPick = (value) => {
    if (!value) return;
    const picked = new Date(`${value}T00:00:00`);
    if (Number.isNaN(picked.getTime())) return;
    setWeekStart(getMonday(picked));
  };

  const fetchAppointments = async ({ startDate, searchAll = false } = {}) => {
    let startKey = null;
    let endKey = null;
    if (!searchAll && startDate) {
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setDate(start.getDate() + 4);
      startKey = start.toISOString().slice(0, 10);
      endKey = end.toISOString().slice(0, 10);
    }

    try {
      let query = supabase
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
        );

      if (!searchAll && startKey && endKey) {
        query = query.gte("date", startKey).lte("date", endKey);
      }

      const { data, error } = await query
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
    if (isSearchMode) {
      fetchAppointments({ searchAll: true });
    } else {
      fetchAppointments({ startDate: weekStart });
    }
  }, [weekStart, searchTerm, isSearchMode]);

  useEffect(() => {
    const channel = supabase
      .channel("lav-room-calendar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment" },
        () => {
          if (searchTerm.trim()) {
            fetchAppointments({ searchAll: true });
          } else {
            fetchAppointments({ startDate: weekStart });
          }
        }
      );

    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [weekStart, searchTerm, isSearchMode]);

  const filteredAppointments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return appointments.filter((appointment) => {
      if (statusFilter !== "all" && appointment.status !== statusFilter) {
        return false;
      }
      if (!term) return true;
      const haystack = [
        appointment.subject,
        appointment.topic,
        appointment.tutor?.name,
        appointment.tutee?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [appointments, searchTerm, statusFilter]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return [...filteredAppointments].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return toMinutes(a.start_time) - toMinutes(b.start_time);
    });
  }, [filteredAppointments, searchTerm]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchTerm, statusFilter]);

  const activeSearchAppointment = searchResults[searchIndex] || null;
  const activeSearchDate = activeSearchAppointment?.date || null;
  const activeSearchDayIndex = useMemo(() => {
    if (!activeSearchDate) return null;
    const dateValue = new Date(`${activeSearchDate}T00:00:00`);
    const dayIndex = dateValue.getDay() === 0 ? -1 : dateValue.getDay() - 1;
    return dayIndex >= 0 && dayIndex <= 4 ? dayIndex : null;
  }, [activeSearchDate]);
  const displayDayIndices = useMemo(() => {
    if (!searchTerm.trim()) return dayLabels.map((_, index) => index);
    if (activeSearchDayIndex === null) return [];
    return [activeSearchDayIndex];
  }, [searchTerm, activeSearchDayIndex]);

  useEffect(() => {
    if (!isSearchMode || !activeSearchDate) return;
    const nextWeekStart = getMonday(new Date(`${activeSearchDate}T00:00:00`));
    if (nextWeekStart.getTime() !== weekStart.getTime()) {
      setWeekStart(nextWeekStart);
    }
  }, [activeSearchDate, isSearchMode, weekStart]);

  const bookingsByDay = useMemo(() => {
    const grouped = dayLabels.map(() => []);
    filteredAppointments.forEach((appointment) => {
      if (!appointment.date) return;
      if (isSearchMode && activeSearchDate && appointment.date !== activeSearchDate) {
        return;
      }
      const dateValue = new Date(`${appointment.date}T00:00:00`);
      const dayIndex = dateValue.getDay() === 0 ? -1 : dateValue.getDay() - 1;
      if (dayIndex < 0 || dayIndex > 4) return;
      grouped[dayIndex].push(appointment);
    });
    return grouped.map((items) =>
      items.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
    );
  }, [filteredAppointments, isSearchMode, activeSearchDate]);

  const activeDayBookings = bookingsByDay[selectedDayIndex] || [];

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-700">
            LAV Room
          </h1>
          <p className="text-sm text-gray-500">Weekly schedule (Mon - Fri)</p>
        </div>
        <div className="text-sm text-gray-500">
          {isSearchMode && activeSearchDate
            ? formatLongDate(activeSearchDate)
            : formatRange(weekStart)}
        </div>
      </div>

      <div className="bg-[#f7efe6] rounded-3xl border border-[#d9d2c8] p-3 shadow-sm">
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:overflow-x-auto lg:whitespace-nowrap lg:pb-1 pb-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tutor, student, or subject"
                className="w-full max-w-xs rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm lg:w-64"
              />
              {[
                "all",
                "pending",
                "confirmed",
                "started",
                "awaiting_feedback",
                "completed",
                "declined",
                "cancelled",
              ].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    statusFilter === status
                      ? "text-white"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                  style={
                    statusFilter === status && status !== "all"
                      ? {
                          backgroundColor: getStatusColor(status),
                          borderColor: getStatusColor(status),
                          color: status === "pending" ? "#323335" : "#ffffff",
                        }
                      : statusFilter === status
                        ? {
                            backgroundColor: "#1f3b94",
                            borderColor: "#1f3b94",
                            color: "#ffffff",
                          }
                        : undefined
                  }
                >
                  {STATUS_LABELS[status] || "All"}
                </button>
              ))}
            </div>

            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowWeekPicker((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm whitespace-nowrap"
              >
                <FiCalendar />
                Choose Week
              </button>
              {showWeekPicker && (
                <input
                  type="date"
                  value={weekPickerValue}
                  onChange={(event) => {
                    setWeekPickerValue(event.target.value);
                    handleWeekPick(event.target.value);
                  }}
                  className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-sm"
                />
              )}
            </div>
          </div>
        </div>

        <div
          className="text-center text-[#1f3b94] font-semibold hidden lg:grid"
          style={{
            gridTemplateColumns: `repeat(${displayDayIndices.length || 1}, minmax(0, 1fr))`,
          }}
        >
          {(searchTerm.trim()
            ? displayDayIndices.map((index) => weekDates[index])
            : weekDates
          ).map((day) => (
            <div key={day.label} className="pb-2">
              <div className="text-base md:text-lg tracking-wide">
                {day.label.toUpperCase()}
              </div>
              <div className="text-[10px] text-[#8a8fa8] mt-1">
                {day.date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile day selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {weekDates.map((day, index) => (
            <button
              key={day.label}
              type="button"
              onClick={() => setSelectedDayIndex(index)}
              className={`min-w-[72px] rounded-2xl border px-3 py-2 text-xs font-semibold ${
                selectedDayIndex === index
                  ? "border-[#1f3b94] bg-[#1f3b94] text-white"
                  : "border-gray-200 bg-white text-[#1f3b94]"
              }`}
            >
              <div className="text-[11px]">{day.label.toUpperCase()}</div>
              <div className="text-[10px] opacity-80">
                {day.date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </button>
          ))}
        </div>

        {/* Mobile single-day list */}
        <div className="lg:hidden border border-[#1433a5] bg-[#f7efe6] rounded-2xl p-2">
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {activeDayBookings.length === 0 ? (
              <div className="text-xs text-[#7b8bb8] py-10 text-center">
                No bookings
              </div>
            ) : (
              activeDayBookings.map((booking) => {
                const isExpanded = expandedAppointmentId === booking.appointment_id;
                return (
                  <div
                    key={booking.appointment_id}
                    className="relative rounded-md border border-[#1433a5] p-3 text-xs"
                    style={{ backgroundColor: getStatusColor(booking.status) }}
                  >
                    <div className={`flex justify-between font-semibold ${getTextColor(booking.status)}`}>
                      <span>start</span>
                      <span>{booking.start_time?.slice(0, 5) || "--:--"}</span>
                    </div>
                    <div className={`flex justify-between font-semibold mb-2 ${getTextColor(booking.status)}`}>
                      <span>end</span>
                      <span>{booking.end_time?.slice(0, 5) || "--:--"}</span>
                    </div>
                    <div className={`font-semibold ${getTextColor(booking.status)}`}>tutor</div>
                    <div className={getTextColor(booking.status)}>
                      {booking.tutor?.name || "N/A"}
                    </div>
                    <div className={`font-semibold mt-2 ${getTextColor(booking.status)}`}>tutee</div>
                    <div className={getTextColor(booking.status)}>
                      {booking.tutee?.name || "N/A"}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedAppointmentId(isExpanded ? null : booking.appointment_id)
                      }
                      className={`absolute bottom-3 right-3 ${getTextColor(booking.status)}`}
                      aria-label="Toggle appointment details"
                    >
                      {isExpanded ? (
                        <AiOutlineEyeInvisible className="h-4 w-4" />
                      ) : (
                        <AiOutlineEye className="h-4 w-4" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-3 rounded-xl border border-[#caa37b] bg-[#fffdf7] p-3 text-[11px] text-[#2d3a6d]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-[#8a5328]">
                            {booking.subject || "Appointment"}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: getStatusColor(booking.status) }}
                          >
                            {(STATUS_LABELS[booking.status] || booking.status).toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="font-semibold text-[#1f3b94]">Subject</div>
                            <div className="mt-1 rounded-full bg-[#e7e3d9] px-2 py-1 text-[#20315f]">
                              {booking.subject || "N/A"}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[#1f3b94]">Specialization</div>
                            <div className="mt-1 rounded-full bg-[#e7e3d9] px-2 py-1 text-[#20315f]">
                              {booking.topic || "N/A"}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[#1f3b94]">Date</div>
                            <div className="mt-1 rounded-full bg-[#e7e3d9] px-2 py-1 text-[#20315f]">
                              {formatLongDate(booking.date) || "--"}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[#1f3b94]">Time</div>
                            <div className="mt-1 rounded-full bg-[#e7e3d9] px-2 py-1 text-[#20315f]">
                              {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[#1f3b94]">Mode</div>
                            <div className="mt-1 rounded-full bg-[#e7e3d9] px-2 py-1 text-[#20315f]">
                              {booking.mode_of_session || "N/A"}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[#1f3b94]">Tutees</div>
                            <div className="mt-1 rounded-full bg-[#e7e3d9] px-2 py-1 text-[#20315f]">
                              {booking.number_of_tutees || 1}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Desktop grid */}
        <div
          ref={gridRef}
          className="relative border border-[#1433a5] bg-[#f7efe6] overflow-visible hidden lg:grid"
          style={{
            gridTemplateColumns: `repeat(${displayDayIndices.length || 1}, minmax(0, 1fr))`,
          }}
        >
            {(searchTerm.trim()
              ? displayDayIndices.map((index) => ({
                  items: bookingsByDay[index] || [],
                  dayIndex: index,
                }))
              : bookingsByDay.map((items, dayIndex) => ({ items, dayIndex }))
            ).map(({ items, dayIndex }) => (
              <div
                key={dayLabels[dayIndex]}
                data-day-col
                className="border border-[#1433a5] p-2"
              >
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="text-xs text-[#7b8bb8] py-8 text-center">
                      No bookings
                    </div>
                  ) : (
                    items.map((booking) => (
                      <div
                        key={booking.appointment_id}
                        className="relative rounded-md border border-[#1433a5] p-2 text-[10px] md:text-xs"
                        style={{ backgroundColor: getStatusColor(booking.status) }}
                        onMouseEnter={(event) => {
                          if (!gridRef.current) return;
                          const rect = event.currentTarget.getBoundingClientRect();
                          const containerRect = gridRef.current.getBoundingClientRect();
                          const column = event.currentTarget.closest("[data-day-col]");
                          const columnRect = column
                            ? column.getBoundingClientRect()
                            : rect;
                          const overlayWidth = 380;
                          const baseLeft =
                            dayIndex >= 3
                              ? columnRect.left - containerRect.left - overlayWidth - 16
                              : columnRect.left -
                                containerRect.left +
                                columnRect.width +
                                16;
                          const left = Math.max(
                            8,
                            Math.min(baseLeft, containerRect.width - overlayWidth - 8)
                          );
                          setHoveredAppointment({
                            ...booking,
                            dayIndex,
                            top: rect.top - containerRect.top,
                            left,
                          });
                        }}
                        onMouseLeave={() => setHoveredAppointment(null)}
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
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          {hoveredAppointment && (
            <div
              className="pointer-events-none absolute z-20 w-[380px] rounded-[18px] border border-[#d6c6b0] bg-[#fff8ed] p-4 text-[12px] text-[#2d3a6d] shadow-2xl"
              style={{
                top: Math.max(8, hoveredAppointment.top - 20),
                left: hoveredAppointment.left ?? 0,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[18px] font-bold text-[#8a5328]">
                  {hoveredAppointment.subject || "Appointment"}
                </span>
                <span className="text-[16px] font-semibold text-[#0d2c8c]">
                  {hoveredAppointment.date
                    ? new Date(
                        `${hoveredAppointment.date}T00:00:00`
                      ).toLocaleDateString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "2-digit",
                      })
                    : ""}
                </span>
              </div>

              <div className="mt-3 rounded-2xl border border-[#caa37b] bg-[#fffdf7] p-3">
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Subject</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {hoveredAppointment.subject || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Specialization</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {hoveredAppointment.topic || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Date</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {formatLongDate(hoveredAppointment.date) || "--"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Time</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {formatTime(hoveredAppointment.start_time)} -{" "}
                      {formatTime(hoveredAppointment.end_time)}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Tutor</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {hoveredAppointment.tutor?.name || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Tutee</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {hoveredAppointment.tutee?.name || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Mode</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {hoveredAppointment.mode_of_session || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1f3b94]">Number of Tutees</div>
                    <div className="mt-1 rounded-full bg-[#e7e3d9] px-3 py-1 text-[#20315f]">
                      {hoveredAppointment.number_of_tutees || 1}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-2">
                    <div className="font-semibold text-[#1f3b94]">Status</div>
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: getStatusColor(hoveredAppointment.status) }}
                    >
                      {(STATUS_LABELS[hoveredAppointment.status] ||
                        hoveredAppointment.status).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
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
