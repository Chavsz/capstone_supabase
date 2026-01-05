import { useMemo, useState } from "react";
import { AiOutlineEye } from "react-icons/ai";

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

const sampleBookings = [
  {
    id: "b1",
    dayIndex: 0,
    color: "bg-[#cfeccf]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b2",
    dayIndex: 1,
    color: "bg-[#f6b4b6]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b3",
    dayIndex: 2,
    color: "bg-[#cfeccf]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b4",
    dayIndex: 4,
    color: "bg-[#d9e6ff]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b5",
    dayIndex: 1,
    color: "bg-[#f6b4b6]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
];

const toMinutes = (timeValue) => {
  if (!timeValue) return 0;
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

const LavRoomCalendar = () => {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));

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

  const bookingsByDay = useMemo(() => {
    const grouped = dayLabels.map(() => []);
    sampleBookings.forEach((booking) => {
      if (grouped[booking.dayIndex]) {
        grouped[booking.dayIndex].push(booking);
      }
    });
    return grouped.map((items) =>
      items.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    );
  }, []);

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
                      key={booking.id}
                      className={`relative rounded-md border border-[#1433a5] p-2 text-[10px] md:text-xs ${booking.color} group`}
                    >
                      <div className="flex justify-between text-[#1433a5] font-semibold">
                        <span>start</span>
                        <span>{booking.start}</span>
                      </div>
                      <div className="flex justify-between text-[#1433a5] font-semibold mb-1">
                        <span>end</span>
                        <span>{booking.end}</span>
                      </div>
                      <div className="text-[#1433a5] font-semibold">tutor</div>
                      <div className="text-[#1433a5]">{booking.tutor}</div>
                      <div className="text-[#1433a5] font-semibold mt-1">tutee</div>
                      <div className="text-[#1433a5]">{booking.tutee}</div>
                      <div className="absolute bottom-2 right-2 text-[#1433a5]">
                        <AiOutlineEye className="h-4 w-4" />
                      </div>
                      <div className="pointer-events-none absolute right-2 -top-8 hidden rounded-md border border-[#1433a5] bg-white px-2 py-1 text-[10px] text-[#1433a5] shadow group-hover:block">
                        View appointment details
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
