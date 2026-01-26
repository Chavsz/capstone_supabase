import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { FaRegCalendarAlt } from "react-icons/fa";
import { useDataSync } from "../../contexts/DataSyncContext";

const tutorRatingFields = [
  { key: "presentation_clarity", label: "Presentation" },
  { key: "drills_sufficiency", label: "Drills" },
  { key: "patience_enthusiasm", label: "Patience" },
  { key: "study_skills_development", label: "Study Skills" },
  { key: "positive_impact", label: "Impact" },
];

const FINISHED_STATUSES = new Set(["awaiting_feedback", "completed"]);
const isFinishedStatus = (status = "") =>
  FINISHED_STATUSES.has(String(status).toLowerCase());

const shuffle = (items) => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const computeTutorStats = (items = []) => {
  const totals = tutorRatingFields.reduce(
    (acc, field) => ({
      ...acc,
      [field.key]: { sum: 0, count: 0 },
    }),
    {}
  );

  items.forEach((evaluation) => {
    tutorRatingFields.forEach((field) => {
      const value = Number(evaluation[field.key]);
      if (!Number.isNaN(value)) {
        totals[field.key].sum += value;
        totals[field.key].count += 1;
      }
    });
  });

  let overallSum = 0;
  let overallCount = 0;
  const averages = {};

  tutorRatingFields.forEach((field) => {
    const { sum, count } = totals[field.key];
    averages[field.key] = count ? sum / count : null;
    overallSum += sum;
    overallCount += count;
  });

  return {
    averages,
    overallAverage: overallCount ? overallSum / overallCount : null,
  };
};

const normalizeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [userId, setUserId] = useState(null);
  const { version, reportError, clearError } = useDataSync();
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [rangeTouched, setRangeTouched] = useState(false);
  const [rangeStart, setRangeStart] = useState(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  });
  const [rangeEnd, setRangeEnd] = useState(() => {
    const end = new Date();
    end.setDate(1);
    end.setMonth(end.getMonth() + 1);
    end.setHours(0, 0, 0, 0);
    return end;
  });

  const displayPeriodLabel = useMemo(() => {
    const startLabel = rangeStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const endDisplay = new Date(rangeEnd);
    endDisplay.setDate(endDisplay.getDate() - 1);
    const endLabel = endDisplay.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startLabel} - ${endLabel}`;
  }, [rangeStart, rangeEnd]);

  const toDateInputValue = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const resetRangeToMonth = () => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setHours(0, 0, 0, 0);
    setRangeStart(start);
    setRangeEnd(end);
    setRangeTouched(true);
  };

  const fetchReportsData = useCallback(async (shouldUpdate) => {
    try {
      if (shouldUpdate()) setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (shouldUpdate()) {
          setEvaluations([]);
          setAppointments([]);
          setUserId(null);
          clearError("tutor-reports");
        }
        return;
      }

      if (shouldUpdate()) setUserId(session.user.id);

      const { data, error } = await supabase
        .from("evaluation")
        .select(
          [
            "evaluation_id",
            "appointment_id",
            "created_at",
            "presentation_clarity",
            "drills_sufficiency",
            "patience_enthusiasm",
            "study_skills_development",
            "positive_impact",
          ].join(", ")
        )
        .eq("tutor_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointment")
        .select("appointment_id, tutor_id, date, created_at, start_time, end_time, number_of_tutees, status")
        .eq("tutor_id", session.user.id)
        .order("date", { ascending: false });

      if (appointmentError) throw appointmentError;

      if (!shouldUpdate()) return;
      setEvaluations(data || []);
      setAppointments(appointmentData || []);
      if (!rangeTouched) {
        const dateValues = (appointmentData || [])
          .map((appointment) => appointment.date)
          .filter(Boolean)
          .map((date) => normalizeDate(date))
          .filter(Boolean);
        if (dateValues.length > 0) {
          const minDate = new Date(Math.min(...dateValues.map((date) => date.getTime())));
          const maxDate = new Date(Math.max(...dateValues.map((date) => date.getTime())));
          const nextEnd = new Date(maxDate);
          nextEnd.setDate(nextEnd.getDate() + 1);
          setRangeStart(minDate);
          setRangeEnd(nextEnd);
        }
      }
      clearError("tutor-reports");
    } catch (err) {
      console.error("Unable to load reports:", err.message);
      if (shouldUpdate()) {
        setEvaluations([]);
        setAppointments([]);
        reportError("tutor-reports", "Unable to load tutor reports.", () =>
          fetchReportsData(() => true)
        );
      }
    } finally {
      if (shouldUpdate()) setLoading(false);
    }
  }, [clearError, reportError]);

  useEffect(() => {
    let active = true;
    fetchReportsData(() => active);
    return () => {
      active = false;
    };
  }, [fetchReportsData, version]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tutor-reports-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment", filter: `tutor_id=eq.${userId}` },
        () => fetchReportsData(() => true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evaluation", filter: `tutor_id=eq.${userId}` },
        () => fetchReportsData(() => true)
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchReportsData, userId]);

  const appointmentsById = useMemo(() => {
    const map = new Map();
    appointments.forEach((appointment) => {
      map.set(appointment.appointment_id, appointment);
    });
    return map;
  }, [appointments]);

  const evaluationsInPeriod = useMemo(() => {
    return evaluations.filter((evaluation) => {
      const appointment = appointmentsById.get(evaluation.appointment_id);
      const baseDate = appointment?.date || evaluation.created_at;
      if (!baseDate) return false;
      const date = normalizeDate(baseDate);
      if (!date) return false;
      return date >= rangeStart && date < rangeEnd;
    });
  }, [appointmentsById, evaluations, rangeStart, rangeEnd]);

  const appointmentsInPeriod = useMemo(() => {
    return appointments.filter((appointment) => {
      const baseDate = appointment.date || appointment.created_at;
      if (!baseDate) return false;
      const date = normalizeDate(baseDate);
      if (!date) return false;
      return date >= rangeStart && date < rangeEnd;
    });
  }, [appointments, rangeStart, rangeEnd]);

  const completedAppointmentsInPeriod = useMemo(
    () => appointmentsInPeriod.filter((appointment) => isFinishedStatus(appointment.status)),
    [appointmentsInPeriod]
  );

  const totalSessionsCompleted = completedAppointmentsInPeriod.length;
  const totalHoursTeach = useMemo(() => {
    return completedAppointmentsInPeriod.reduce((sum, appointment) => {
      const startTime = appointment.start_time;
      const endTime = appointment.end_time;
      if (!startTime || !endTime) return sum;
      const minutes =
        (new Date(`2000-01-01T${endTime}`) - new Date(`2000-01-01T${startTime}`)) / 60000;
      return sum + Math.max(minutes / 60, 0);
    }, 0);
  }, [completedAppointmentsInPeriod]);

  const totalTuteesServed = useMemo(() => {
    return completedAppointmentsInPeriod.reduce((sum, appointment) => {
      const count = Number(appointment.number_of_tutees);
      return sum + (Number.isNaN(count) || count <= 0 ? 1 : count);
    }, 0);
  }, [completedAppointmentsInPeriod]);

  const tutorStatsPeriod = useMemo(
    () => computeTutorStats(evaluationsInPeriod),
    [evaluationsInPeriod]
  );

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#f8f9f0]">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#2b8a6f] font-semibold">
                LAV
              </p>
              <h1 className="text-3xl font-bold text-gray-800">Performance Reports</h1>
              <p className="text-sm text-gray-500">
                Overview of completed sessions and feedback.
              </p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRangePicker((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
              >
                <FaRegCalendarAlt className="text-sm" />
                {displayPeriodLabel}
              </button>
              {showRangePicker && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg z-10">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-500">
                      Start date
                      <input
                        type="date"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                        value={toDateInputValue(rangeStart)}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) return;
                          const nextStart = new Date(value);
                          nextStart.setHours(0, 0, 0, 0);
                          if (nextStart < rangeEnd) {
                            setRangeStart(nextStart);
                            setRangeTouched(true);
                          }
                        }}
                      />
                    </label>
                    <label className="block text-xs font-semibold text-gray-500">
                      End date
                      <input
                        type="date"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                        value={toDateInputValue(rangeEnd)}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) return;
                          const nextEnd = new Date(value);
                          nextEnd.setHours(0, 0, 0, 0);
                          if (nextEnd > rangeStart) {
                            setRangeEnd(nextEnd);
                            setRangeTouched(true);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={resetRangeToMonth}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-blue-400 hover:text-blue-600"
                    >
                      Reset Month
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Sessions Completed",
              value: totalSessionsCompleted,
              detail: displayPeriodLabel,
              color: "bg-blue-100 text-blue-700",
              accent: "#3b82f6",
            },
            {
              label: "Teaching Hours",
              value: `${totalHoursTeach.toFixed(1)} hrs`,
              detail: "Confirmed sessions only",
              color: "bg-emerald-100 text-emerald-700",
              accent: "#10b981",
            },
            {
              label: "Tutees Served",
              value: totalTuteesServed,
              detail: "Counting groups",
              color: "bg-purple-100 text-purple-700",
              accent: "#8b5cf6",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-gray-200 shadow-md p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{card.label}</p>
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${card.accent}1a`, color: card.accent }}
                >
                  {card.label
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-3">{card.value}</p>
              <div className="mt-3 h-1 rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: "45%", backgroundColor: card.accent }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">{card.detail}</p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 shadow-md">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Tutee Satisfaction</h2>
            <p className="text-sm text-gray-500">
              Average ratings for {displayPeriodLabel}.
            </p>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading feedback...</p>
            ) : evaluationsInPeriod.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No tutor feedback has been submitted yet.
              </p>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-end justify-between gap-3">
                  {tutorRatingFields.map((field, index) => {
                    const avg = tutorStatsPeriod.averages[field.key];
                    const height = avg ? Math.round((avg / 5) * 120) : 0;
                    const barColors = [
                      "#f6d110",
                      "#ed5f1e",
                      "#e7b0f8",
                      "#bad381",
                      "#ffe5b6",
                    ];
                    const barColor = barColors[index % barColors.length];
                    return (
                      <div key={field.key} className="flex flex-col items-center gap-2 flex-1">
                        <span className="text-xs font-semibold text-gray-600">
                          {avg !== null ? avg.toFixed(1) : "-"}
                        </span>
                        <div className="w-8 h-32 rounded-full bg-white border border-gray-200 flex items-end overflow-hidden">
                          <div
                            className="w-full transition-all"
                            style={{ height: `${height}px`, backgroundColor: barColor }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500 text-center leading-tight">
                          {field.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-[#2fb592] bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Overall Average
                  </p>
                  <p className="text-xl font-bold text-[#2fb592]">
                    {tutorStatsPeriod.overallAverage !== null
                      ? tutorStatsPeriod.overallAverage.toFixed(2)
                      : "-"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Reports;
