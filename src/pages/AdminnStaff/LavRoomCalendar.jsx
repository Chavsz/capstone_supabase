import { useMemo, useState } from "react";

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
    row: 1,
    color: "bg-[#cfeccf]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b2",
    dayIndex: 1,
    row: 2,
    color: "bg-[#f6b4b6]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b3",
    dayIndex: 2,
    row: 3,
    color: "bg-[#cfeccf]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b4",
    dayIndex: 4,
    row: 2,
    color: "bg-[#d9e6ff]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
  {
    id: "b5",
    dayIndex: 1,
    row: 4,
    color: "bg-[#f6b4b6]",
    start: "10:00",
    end: "11:30",
    tutor: "Brent Manalo",
    tutee: "Danaya Pirena E.",
  },
];

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

        <div className="grid grid-cols-5 grid-rows-5 border border-[#1433a5] bg-[#f7efe6]">
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            Array.from({ length: 5 }).map((_, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="h-24 md:h-28 border border-[#1433a5]"
              />
            ))
          ))}

          {sampleBookings.map((booking) => (
            <div
              key={booking.id}
              className={`col-start-${booking.dayIndex + 1} row-start-${booking.row} row-span-1 m-1 rounded-md border border-[#1433a5] p-2 text-[10px] md:text-xs ${booking.color}`}
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
