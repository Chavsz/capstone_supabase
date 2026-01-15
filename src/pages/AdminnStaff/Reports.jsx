import { useCallback, useEffect, useMemo, useState } from "react";
import { FaDownload, FaPrint, FaRegCalendarAlt } from "react-icons/fa";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";
import { capitalizeWords } from "../../utils/text";

const tutorRatingFields = [
  { key: "presentation_clarity", label: "Presentation" },
  { key: "drills_sufficiency", label: "Drills" },
  { key: "patience_enthusiasm", label: "Patience" },
  { key: "study_skills_development", label: "Study Skills" },
  { key: "positive_impact", label: "Impact" },
];

const lavRatingFields = [
  { key: "lav_environment", label: "Environment" },
  { key: "lav_scheduling", label: "Scheduling" },
  { key: "lav_support", label: "Support" },
  { key: "lav_book_again", label: "Book Again" },
  { key: "lav_value", label: "Value for Time" },
];

const FINISHED_STATUSES = new Set(["awaiting_feedback", "completed"]);
const isFinishedStatus = (status = "") =>
  FINISHED_STATUSES.has(String(status).toLowerCase());

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const Reports = () => {
  const [appointments, setAppointments] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [tutorProfiles, setTutorProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [monthlyExporting, setMonthlyExporting] = useState(false);
  const [landingImage, setLandingImage] = useState("");
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
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
    end.setDate(0);
    end.setHours(0, 0, 0, 0);
    return end;
  });

  const fetchData = async (shouldUpdate) => {
    try {
      if (shouldUpdate()) setLoading(true);

      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointment")
        .select(`
          appointment_id,
          tutor_id,
          user_id,
          subject,
          topic,
          date,
          start_time,
          end_time,
          number_of_tutees,
          status,
          tutor:users!appointment_tutor_id_fkey(name),
          student:users!appointment_user_id_fkey(name)
        `)
        .order("date", { ascending: false });
      if (appointmentError) throw appointmentError;

      const { data: evaluationData, error: evaluationError } = await supabase
        .from("evaluation")
        .select(
          [
            "appointment_id",
            "tutor_id",
            "user_id",
            "presentation_clarity",
            "drills_sufficiency",
            "patience_enthusiasm",
            "study_skills_development",
            "positive_impact",
            "lav_environment",
            "lav_scheduling",
            "lav_support",
            "lav_book_again",
            "lav_value",
          ].join(", ")
        );
      if (evaluationError) throw evaluationError;

      const tutorIds = Array.from(
        new Set((appointmentData || []).map((appointment) => appointment.tutor_id).filter(Boolean))
      );
      if (tutorIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profile")
          .select("user_id, profile_image")
          .in("user_id", tutorIds);

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        const profileMap = {};
        (profileData || []).forEach((profile) => {
          profileMap[profile.user_id] = profile.profile_image || "";
        });
        if (shouldUpdate()) setTutorProfiles(profileMap);
      } else if (shouldUpdate()) {
        setTutorProfiles({});
      }

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedule")
        .select("schedule_id, day, start_time, end_time, profile:profile_id(user_id, user:users(name))")
        .order("day", { ascending: true })
        .order("start_time", { ascending: true });
      if (scheduleError && scheduleError.code !== "PGRST116") throw scheduleError;

      const scheduleEntries =
        scheduleData?.map((slot) => ({
          id: slot.schedule_id,
          day: slot.day,
          start_time: slot.start_time,
          end_time: slot.end_time,
          tutor_id: slot.profile?.user_id || "unknown",
          tutor_name: slot.profile?.user?.name || "Unknown Tutor",
        })) || [];

      if (!shouldUpdate()) return;
      setAppointments(appointmentData || []);
      setEvaluations(evaluationData || []);
      setSchedules(scheduleEntries);

      const { data: landingData, error: landingError } = await supabase
        .from("landing")
        .select("home_image")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (landingError && landingError.code !== "PGRST116") {
        throw landingError;
      }
      if (shouldUpdate()) setLandingImage(landingData?.[0]?.home_image || "");
    } catch (error) {
      console.error(error);
      if (shouldUpdate()) toast.error("Unable to load reports data");
    } finally {
      if (shouldUpdate()) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchData(() => active);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment" },
        () => fetchData(() => true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evaluation" },
        () => fetchData(() => true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule" },
        () => fetchData(() => true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "landing" },
        () => fetchData(() => true)
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchData]);

  const normalizeDate = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatDate = (value) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const toDateInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  };

  const resetRangeToMonth = () => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(0, 0, 0, 0);
    setRangeStart(start);
    setRangeEnd(end);
  };

  const appointmentsById = useMemo(() => {
    const map = new Map();
    appointments.forEach((appointment) => {
      map.set(appointment.appointment_id, appointment);
    });
    return map;
  }, [appointments]);

  const periodRange = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    const start = normalizeDate(rangeStart);
    const endInclusive = normalizeDate(rangeEnd);
    const endExclusive = new Date(endInclusive);
    endExclusive.setDate(endExclusive.getDate() + 1);
    return {
      label: `${formatDate(start)} - ${formatDate(endInclusive)}`,
      start,
      end: endExclusive,
      type: "range",
      startRaw: start,
      endRaw: endInclusive,
    };
  }, [rangeStart, rangeEnd]);

  const selectedYearRange = useMemo(() => {
    if (!periodRange) return null;
    const year = periodRange.start.getFullYear();
    return {
      start: new Date(year, 0, 1),
      end: new Date(year + 1, 0, 1),
    };
  }, [periodRange]);

  const comparisonRange = useMemo(() => {
    if (!periodRange) return null;
    if (periodRange.type === "year") {
      const prevYear = periodRange.start.getFullYear() - 1;
      return {
        start: new Date(prevYear, 0, 1),
        end: new Date(prevYear + 1, 0, 1),
      };
    }
    const prevMonth = new Date(periodRange.start);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    return {
      start: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1),
      end: new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1),
    };
  }, [periodRange]);

  const comparisonLabel = useMemo(() => {
    if (!comparisonRange) return "Previous period";
    const isYear = periodRange?.type === "year";
    return comparisonRange.start.toLocaleDateString(
      "en-US",
      isYear ? { year: "numeric" } : { month: "short", year: "numeric" }
    );
  }, [comparisonRange, periodRange]);

  const pdfRange = useMemo(() => {
    if (!periodRange) return null;
    return {
      label: periodRange.label,
      start: periodRange.start,
      end: periodRange.end,
    };
  }, [periodRange]);

  const evaluationsInPeriod = useMemo(() => {
    if (!periodRange) return [];
    return evaluations.filter((evaluation) => {
      const appointment = appointmentsById.get(evaluation.appointment_id);
      if (!appointment || !appointment.date) return false;
      const date = normalizeDate(appointment.date);
      return date >= periodRange.start && date < periodRange.end;
    });
  }, [evaluations, appointmentsById, periodRange]);

  const evaluationsInYear = useMemo(() => {
    if (!selectedYearRange) return [];
    return evaluations.filter((evaluation) => {
      const appointment = appointmentsById.get(evaluation.appointment_id);
      if (!appointment || !appointment.date) return false;
      const date = normalizeDate(appointment.date);
      return date >= selectedYearRange.start && date < selectedYearRange.end;
    });
  }, [evaluations, appointmentsById, selectedYearRange]);

  const periodRangeLabel = useMemo(() => {
    if (!periodRange) return "Select Period";
    return periodRange.label;
  }, [periodRange]);

  const rangeKey = useMemo(() => {
    if (!periodRange) return "custom-range";
    const startKey = toDateInputValue(periodRange.startRaw || periodRange.start);
    const endKey = toDateInputValue(periodRange.endRaw || periodRange.end);
    return `${startKey}_to_${endKey}`;
  }, [periodRange]);

  const formatTime = (value) =>
    new Date(`2000-01-01T${value}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const computeLavStats = (items = []) => {
    const totals = lavRatingFields.reduce(
      (acc, field) => ({
        ...acc,
        [field.key]: { sum: 0, count: 0 },
      }),
      {}
    );

    items.forEach((evaluation) => {
      lavRatingFields.forEach((field) => {
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

    lavRatingFields.forEach((field) => {
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

  const weekInfo = (date) => {
    const newDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = newDate.getUTCDay() || 7;
    newDate.setUTCDate(newDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(newDate.getUTCFullYear(), 0, 1));
    return Math.ceil(((newDate - yearStart) / 86400000 + 1) / 7);
  };

  const tutorStats = useMemo(() => {
    const stats = {};
    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    const thisWeek = weekInfo(today);

    appointments
      .filter((apt) => isFinishedStatus(apt.status))
      .forEach((appointment) => {
        const tutorId = appointment.tutor_id || "unknown";
        if (!stats[tutorId]) {
          stats[tutorId] = {
            tutorId,
            name: appointment.tutor?.name || "Unknown Tutor",
            total: 0,
            totalTutees: 0,
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            monthly: {},
            monthlyHours: {},
            history: [],
            totalHours: 0,
          };
        }

        const entry = stats[tutorId];
        entry.total += 1;
        const tuteesCount =
          appointment.number_of_tutees && !Number.isNaN(Number(appointment.number_of_tutees))
            ? Number(appointment.number_of_tutees)
            : 1;
        entry.totalTutees = (entry.totalTutees || 0) + tuteesCount;

        const sessionDate = new Date(appointment.date);
        const monthKey = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        entry.monthly[monthKey] = (entry.monthly[monthKey] || 0) + 1;
        const durationMinutes =
          (new Date(`2000-01-01T${appointment.end_time}`) -
            new Date(`2000-01-01T${appointment.start_time}`)) /
          60000;
        const durationHours = Math.max(durationMinutes / 60, 0);
        entry.totalHours = (entry.totalHours || 0) + durationHours;
        entry.monthlyHours[monthKey] =
          (entry.monthlyHours[monthKey] || 0) + durationHours;

        entry.history.push({
          appointment_id: appointment.appointment_id,
          student: appointment.student?.name || "Unknown",
          subject: appointment.subject || "Untitled Session",
          date: appointment.date,
          time: `${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}`,
        });

        if (appointment.date === todayKey) {
          entry.today += 1;
        }

        if (sessionDate.getFullYear() === thisYear && sessionDate.getMonth() === thisMonth) {
          entry.thisMonth += 1;
        }

        const sessionWeek = weekInfo(sessionDate);
        if (sessionWeek === thisWeek && sessionDate.getFullYear() === thisYear) {
          entry.thisWeek += 1;
        }
      });

    Object.values(stats).forEach((entry) => {
      entry.history.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    return stats;
  }, [appointments]);

  const buildTutorEvaluationStats = useCallback(
    (items) => {
      const map = {};

      items.forEach((evaluation) => {
        const tutorId = evaluation.tutor_id || "unknown";
        if (!map[tutorId]) {
          map[tutorId] = {
            tutorId,
            name:
              appointments.find((apt) => apt.tutor_id === tutorId)?.tutor?.name ||
              "Unknown Tutor",
            overallSum: 0,
            overallCount: 0,
            fields: tutorRatingFields.reduce(
              (acc, field) => ({
                ...acc,
                [field.key]: { sum: 0, count: 0 },
              }),
              {}
            ),
          };
        }

        const entry = map[tutorId];

        tutorRatingFields.forEach((field) => {
          const value = Number(evaluation[field.key]);
          if (!Number.isNaN(value)) {
            entry.fields[field.key].sum += value;
            entry.fields[field.key].count += 1;
            entry.overallSum += value;
            entry.overallCount += 1;
          }
        });
      });

      return map;
    },
    [appointments, tutorRatingFields]
  );

  const tutorEvaluationStats = useMemo(
    () => buildTutorEvaluationStats(evaluationsInPeriod),
    [buildTutorEvaluationStats, evaluationsInPeriod]
  );

  const schedulesByTutor = useMemo(() => {
    const grouped = {};
    schedules.forEach((slot) => {
      if (!grouped[slot.tutor_id]) {
        grouped[slot.tutor_id] = {
          name: slot.tutor_name,
          slots: [],
        };
      }
      grouped[slot.tutor_id].slots.push(slot);
    });
    return grouped;
  }, [schedules]);

  const lavStatsPeriod = useMemo(
    () => computeLavStats(evaluationsInPeriod),
    [evaluationsInPeriod]
  );
  const lavStatsYear = useMemo(() => computeLavStats(evaluationsInYear), [evaluationsInYear]);

  const appointmentsInPeriod = useMemo(() => {
    if (!periodRange) return [];
    return appointments.filter((appointment) => {
      if (!appointment.date) return false;
      const date = normalizeDate(appointment.date);
      return date >= periodRange.start && date < periodRange.end;
    });
  }, [appointments, periodRange]);

  const completedAppointmentsInPeriod = useMemo(
    () => appointmentsInPeriod.filter((apt) => isFinishedStatus(apt.status)),
    [appointmentsInPeriod]
  );

  const appointmentsInPdfRange = useMemo(() => {
    if (!pdfRange) return [];
    return appointments.filter((appointment) => {
      if (!appointment.date) return false;
      const date = normalizeDate(appointment.date);
      return date >= pdfRange.start && date < pdfRange.end;
    });
  }, [appointments, pdfRange]);

  const evaluationsInPdfRange = useMemo(() => {
    if (!pdfRange) return [];
    return evaluations.filter((evaluation) => {
      const appointment = appointmentsById.get(evaluation.appointment_id);
      if (!appointment?.date) return false;
      const date = normalizeDate(appointment.date);
      return date >= pdfRange.start && date < pdfRange.end;
    });
  }, [appointmentsById, evaluations, pdfRange]);

  const completedAppointmentsInPdfRange = useMemo(
    () => appointmentsInPdfRange.filter((apt) => isFinishedStatus(apt.status)),
    [appointmentsInPdfRange]
  );

  const tutorEvaluationStatsPdf = useMemo(
    () => buildTutorEvaluationStats(evaluationsInPdfRange),
    [buildTutorEvaluationStats, evaluationsInPdfRange]
  );

  const totalHoursTeach = useMemo(() => {
    return completedAppointmentsInPeriod.reduce((sum, appointment) => {
      const minutes =
        (new Date(`2000-01-01T${appointment.end_time}`) -
          new Date(`2000-01-01T${appointment.start_time}`)) /
        60000;
      return sum + Math.max(minutes / 60, 0);
    }, 0);
  }, [completedAppointmentsInPeriod]);

  const totalSessionsBooked = appointmentsInPeriod.length;
  const totalSessionsCompleted = completedAppointmentsInPeriod.length;
  const totalTuteesServed = completedAppointmentsInPeriod.reduce((sum, appointment) => {
    const count =
      appointment.number_of_tutees && !Number.isNaN(Number(appointment.number_of_tutees))
        ? Number(appointment.number_of_tutees)
        : 1;
    return sum + count;
  }, 0);

  const pdfTotalSessionsBooked = appointmentsInPdfRange.length;
  const pdfTotalSessionsCompleted = completedAppointmentsInPdfRange.length;
  const pdfTotalTuteesServed = completedAppointmentsInPdfRange.reduce((sum, appointment) => {
    const count =
      appointment.number_of_tutees && !Number.isNaN(Number(appointment.number_of_tutees))
        ? Number(appointment.number_of_tutees)
        : 1;
    return sum + count;
  }, 0);
  const pdfTotalHoursTeach = useMemo(() => {
    return completedAppointmentsInPdfRange.reduce((sum, appointment) => {
      const minutes =
        (new Date(`2000-01-01T${appointment.end_time}`) -
          new Date(`2000-01-01T${appointment.start_time}`)) /
        60000;
      return sum + Math.max(minutes / 60, 0);
    }, 0);
  }, [completedAppointmentsInPdfRange]);

  const cancelledSessions = appointmentsInPeriod.filter(
    (appointment) => appointment.status === "cancelled"
  ).length;
  const cancellationRate = totalSessionsBooked
    ? (cancelledSessions / totalSessionsBooked) * 100
    : 0;

  const comparisonCompletedCount = useMemo(() => {
    if (!comparisonRange) return null;
    return appointments.filter((appointment) => {
      if (!isFinishedStatus(appointment.status) || !appointment.date) return false;
      const date = normalizeDate(appointment.date);
      return date >= comparisonRange.start && date < comparisonRange.end;
    }).length;
  }, [appointments, comparisonRange]);

  const growthRate =
    comparisonCompletedCount === null
      ? null
      : comparisonCompletedCount === 0
      ? totalSessionsCompleted > 0
        ? 100
        : 0
      : ((totalSessionsCompleted - comparisonCompletedCount) / comparisonCompletedCount) * 100;

  const tutorEntries = Object.values(tutorStats);
  const tutorSummaryEntries = Object.values(tutorEvaluationStats);

  const displayPeriodLabel = periodRange?.label || "Current Period";
  const preparedDateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const tutorAggregate = tutorSummaryEntries.reduce(
    (acc, entry) => ({
      sum: acc.sum + (entry.overallSum || 0),
      count: acc.count + (entry.overallCount || 0),
    }),
    { sum: 0, count: 0 }
  );
  const overallTutorSatisfaction = tutorAggregate.count
    ? tutorAggregate.sum / tutorAggregate.count
    : null;
  const tuteeSatisfaction = lavStatsPeriod.overallAverage;
  const averageSatisfactionDisplay = overallTutorSatisfaction
    ? `${overallTutorSatisfaction.toFixed(2)} / 5`
    : "- / 5";
  const summaryMetrics = [
    {
      label: "Sessions Completed",
      value: `${totalSessionsCompleted}`,
      detail: displayPeriodLabel,
      icon: "SC",
      progress: Math.min(100, (totalSessionsCompleted / 20) * 100),
      color: "bg-blue-100 text-blue-700",
      accent: "#3b82f6",
    },
    {
      label: "Teaching Hours",
      value: `${totalHoursTeach.toFixed(1)} hrs`,
      detail: "Confirmed sessions only",
      icon: "HR",
      progress: Math.min(100, (totalHoursTeach / 40) * 100),
      color: "bg-emerald-100 text-emerald-700",
      accent: "#10b981",
    },
    {
      label: "Tutees Served",
      value: `${totalTuteesServed}`,
      detail: "Counting groups",
      icon: "TS",
      progress: Math.min(100, (totalTuteesServed / 30) * 100),
      color: "bg-purple-100 text-purple-700",
      accent: "#8b5cf6",
    },
    {
      label: "Avg. Satisfaction",
      value: averageSatisfactionDisplay,
      detail: "Tutor evaluations",
      icon: "AR",
      progress: overallTutorSatisfaction ? (overallTutorSatisfaction / 5) * 100 : 0,
      color: "bg-pink-100 text-pink-700",
      accent: "#ec4899",
    },
  ];

  const tutorMonthlyPerformance = useMemo(() => {
    const aggregate = {};
    appointmentsInPeriod.forEach((appointment) => {
      const tutorId = appointment.tutor_id || "unknown";
      if (!aggregate[tutorId]) {
        const ratingEntry = tutorEvaluationStats[tutorId];
        aggregate[tutorId] = {
          tutorId,
          name: appointment.tutor?.name || "Unknown Tutor",
          sessions: 0,
          hours: 0,
          totalTutees: 0,
          averageRating:
            ratingEntry && ratingEntry.overallCount
              ? ratingEntry.overallSum / ratingEntry.overallCount
              : null,
        };
      }
      if (isFinishedStatus(appointment.status)) {
        const minutes =
          (new Date(`2000-01-01T${appointment.end_time}`) -
            new Date(`2000-01-01T${appointment.start_time}`)) /
          60000;
        const appointmentTutees =
          appointment.number_of_tutees && !Number.isNaN(Number(appointment.number_of_tutees))
            ? Number(appointment.number_of_tutees)
            : 1;
        aggregate[tutorId].sessions += 1;
        aggregate[tutorId].hours += Math.max(minutes / 60, 0);
        aggregate[tutorId].totalTutees += appointmentTutees;
      }
    });
    return Object.values(aggregate)
      .filter((entry) => entry.sessions > 0 || entry.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [appointmentsInPeriod, tutorEvaluationStats]);

  const pdfTutorMonthlyPerformance = useMemo(() => {
    const aggregate = {};
    appointmentsInPdfRange.forEach((appointment) => {
      const tutorId = appointment.tutor_id || "unknown";
      if (!aggregate[tutorId]) {
        const ratingEntry = tutorEvaluationStatsPdf[tutorId];
        aggregate[tutorId] = {
          tutorId,
          name: appointment.tutor?.name || "Unknown Tutor",
          sessions: 0,
          hours: 0,
          totalTutees: 0,
          averageRating:
            ratingEntry && ratingEntry.overallCount
              ? ratingEntry.overallSum / ratingEntry.overallCount
              : null,
        };
      }
      if (isFinishedStatus(appointment.status)) {
        const minutes =
          (new Date(`2000-01-01T${appointment.end_time}`) -
            new Date(`2000-01-01T${appointment.start_time}`)) /
          60000;
        const appointmentTutees =
          appointment.number_of_tutees && !Number.isNaN(Number(appointment.number_of_tutees))
            ? Number(appointment.number_of_tutees)
            : 1;
        aggregate[tutorId].sessions += 1;
        aggregate[tutorId].hours += Math.max(minutes / 60, 0);
        aggregate[tutorId].totalTutees += appointmentTutees;
      }
    });
    return Object.values(aggregate)
      .filter((entry) => entry.sessions > 0 || entry.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [appointmentsInPdfRange, tutorEvaluationStatsPdf]);

  const maxTutorHours = tutorMonthlyPerformance.reduce(
    (max, entry) => Math.max(max, entry.hours),
    0
  );

  const handleMonthlyExport = useCallback(() => {
    if (monthlyExporting) return;
    if (loading) {
      toast("Reports are still loading.");
      return;
    }
    try {
      setMonthlyExporting(true);
      if (tutorMonthlyPerformance.length === 0) {
        toast("No data to export for this period.");
        setMonthlyExporting(false);
        return;
      }

      const rows = [["Tutor", "Sessions", "Tutees Served", "Hours", "Avg Rating"]];
      tutorMonthlyPerformance.forEach((entry) => {
        rows.push([
          entry.name,
          entry.sessions,
          entry.totalTutees,
          entry.hours.toFixed(2),
          entry.averageRating ? entry.averageRating.toFixed(2) : "-",
        ]);
      });

      const csvContent = rows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tutor-report-${rangeKey}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("Unable to generate CSV");
    } finally {
      setMonthlyExporting(false);
    }
  }, [loading, monthlyExporting, rangeKey, tutorMonthlyPerformance]);

  const handlePrintMonthlyReport = useCallback(() => {
    const resolvedLogo =
      landingImage && !landingImage.startsWith("http")
        ? new URL(landingImage, window.location.origin).href
        : landingImage || "";
    const periodOverall = lavStatsPeriod?.overallAverage ?? null;
    const yearOverall = lavStatsYear?.overallAverage ?? null;
    const lavPeriodOverallDisplay =
      periodOverall !== null ? `${periodOverall.toFixed(2)} / 5` : "- / 5";
    const lavYearOverallDisplay =
      yearOverall !== null ? `${yearOverall.toFixed(2)} / 5` : "- / 5";

    const pdfSummaryHtml = `
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="#2563eb" stroke-width="2" />
              <path d="M12 7v6l4 2" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <p class="summary-label">Total Hours Taught</p>
          <p class="summary-value">${escapeHtml(`${pdfTotalHoursTeach.toFixed(1)} hrs`)}</p>
        </div>
        <div class="summary-card">
          <div class="summary-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="#16a34a" stroke-width="2" />
              <path d="M8 12l3 3 5-6" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="summary-label">Sessions Completed</p>
          <p class="summary-value">${escapeHtml(`${pdfTotalSessionsCompleted}`)}</p>
        </div>
        <div class="summary-card">
          <div class="summary-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="#6366f1" stroke-width="2" />
              <path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <p class="summary-label">Sessions Booked</p>
          <p class="summary-value">${escapeHtml(`${pdfTotalSessionsBooked}`)}</p>
        </div>
        <div class="summary-card">
          <div class="summary-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3" fill="none" stroke="#8b5cf6" stroke-width="2" />
              <path d="M5 20c1.6-3.6 11.4-3.6 14 0" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <p class="summary-label">Tutees Served</p>
          <p class="summary-value">${escapeHtml(`${pdfTotalTuteesServed}`)}</p>
        </div>
        <div class="summary-card">
          <div class="summary-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 19V9M10 19V5M15 19V12M20 19V7" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <p class="summary-label">Overall Average</p>
          <p class="summary-value">${escapeHtml(averageSatisfactionDisplay)}</p>
        </div>
      </div>
    `;

    const performanceRowsHtml =
      pdfTutorMonthlyPerformance
        .map(
        (entry) => `
          <tr>
            <td>${escapeHtml(entry.name)}</td>
            <td>${entry.sessions}</td>
            <td>${entry.totalTutees}</td>
            <td>${entry.hours.toFixed(1)} hrs</td>
            <td>${entry.averageRating ? entry.averageRating.toFixed(2) : "-"}</td>
          </tr>
        `
        )
        .join("") ||
      `<tr><td colspan="5">No tutor performance data for ${escapeHtml(
        pdfRange?.label || displayPeriodLabel
      )}.</td></tr>`;

    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>LAV Period Report</title>
          <style>
            body {
              font-family: 'Inter', Arial, sans-serif;
              margin: 0;
              background: #f8fafc;
              color: #0f172a;
            }
            .container {
              padding: 32px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 24px;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .header-logo {
              width: 72px;
              height: 72px;
              border-radius: 16px;
              object-fit: contain;
              border: 1px solid #e2e8f0;
              background: #fff;
              padding: 8px;
            }
            .title {
              font-size: 24px;
              margin: 0;
              color: #0f172a;
            }
            .subtitle {
              margin: 4px 0 0;
              color: #475569;
              font-size: 14px;
            }
            .badge {
              background: #eff6ff;
              padding: 6px 12px;
              border-radius: 999px;
              color: #2563eb;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
            }
            .section-title {
              font-size: 18px;
              color: #0f172a;
              margin: 24px 0 12px;
            }
            .table-holder {
              border-radius: 18px;
              overflow: hidden;
              background: #fff;
              box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 0;
              background: transparent;
            }
            th, td {
              padding: 12px 16px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 13px;
              text-align: center;
            }
            th {
              background: #eef2ff;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 600;
              color: #475569;
            }
            tr:last-child td {
              border-bottom: none;
            }
            .note {
              font-size: 12px;
              color: #94a3b8;
              margin-top: 12px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 10px;
              margin: 20px 0 10px;
            }
            .summary-card {
              background: #fff;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px 14px;
              box-shadow: 0 6px 12px rgba(15, 23, 42, 0.05);
            }
            .summary-icon {
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 6px;
            }
            .summary-icon svg {
              width: 22px;
              height: 22px;
            }
            .summary-label {
              font-size: 11px;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              color: #64748b;
              margin: 0 0 4px;
            }
            .summary-value {
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
            <div class="header-left">
              ${
                resolvedLogo
                  ? `<img src="${resolvedLogo}" class="header-logo" alt="LAV logo" />`
                  : '<div class="header-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;color:#94a3b8;">LAV</div>'
              }
              <div>
                <div class="badge">Learning Assistance Volunteer</div>
                <h1 class="title">Monthly Performance Report</h1>
                <p class="subtitle">Reporting period: ${escapeHtml(pdfRange?.label || displayPeriodLabel)}</p>
              </div>
            </div>
            <div class="subtitle">Generated on ${escapeHtml(preparedDateLabel)}</div>
          </div>

            <h2 class="section-title" style="margin-bottom:8px;">Summary (${escapeHtml(
              pdfRange?.label || displayPeriodLabel
            )})</h2>
            ${pdfSummaryHtml}

            <h2 class="section-title" style="margin-bottom:8px;">Tutor Performance (${escapeHtml(
              pdfRange?.label || displayPeriodLabel
            )})</h2>
            <div class="table-holder">
              <table>
                <thead>
                  <tr>
                    <th>Tutor</th>
                  <th>Sessions</th>
                  <th>Total Tutees Served</th>
                  <th>Total Hours</th>
                  <th>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                ${performanceRowsHtml}
              </tbody>
            </div>
            <p class="note">This report includes only sessions marked as completed for the selected month.</p>
          </div>
        </body>
      </html>
    `;

    const reportWindow = window.open("", "_blank", "width=900,height=650");
    if (!reportWindow) {
      toast.error("Please allow pop-ups to print the report.");
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(docHtml);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }, [
    landingImage,
    summaryMetrics,
    tutorMonthlyPerformance,
    displayPeriodLabel,
    preparedDateLabel,
    comparisonLabel,
    lavStatsPeriod,
    lavStatsYear,
    selectedYearRange,
    averageSatisfactionDisplay,
    pdfRange,
    pdfTutorMonthlyPerformance,
    pdfTotalHoursTeach,
    pdfTotalSessionsCompleted,
    pdfTotalSessionsBooked,
    pdfTotalTuteesServed,
  ]);

  const topTutorsByHours = useMemo(() => {
    if (tutorMonthlyPerformance.length === 0) return [];
    const maxHours = Math.max(...tutorMonthlyPerformance.map((entry) => entry.hours));
    return tutorMonthlyPerformance.filter((entry) => entry.hours === maxHours);
  }, [tutorMonthlyPerformance]);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold text-gray-700">Reports</h1>
        <p className="text-gray-500 mt-2 text-sm">Loading analytics...</p>
      </div>
    );
  }

  return (
      <div className="min-h-screen p-4 md:p-8 bg-[#eef2f7]">
        <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-200 px-3 py-5 md:px-5 md:py-7 space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#2b8a6f] font-semibold">
                LAV
              </p>
              <h1 className="text-3xl font-bold text-gray-800">Performance Reports</h1>
              <p className="text-sm text-gray-500">Overview of completed sessions and feedback.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((prev) => !prev)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition flex items-center gap-2"
                  type="button"
                >
                  <FaDownload className="text-sm" />
                  {monthlyExporting ? "Preparing..." : "Export"}
                </button>
                {showExportMenu && (
                  <div
                    className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white shadow-lg z-10"
                    onMouseLeave={() => setShowExportMenu(false)}
                  >
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm ${
                        monthlyExporting
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      disabled={monthlyExporting}
                      onClick={() => {
                        setShowExportMenu(false);
                        handleMonthlyExport();
                      }}
                    >
                      Export to CSV
                    </button>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm ${
                        monthlyExporting
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      disabled={monthlyExporting}
                      onClick={() => {
                        setShowExportMenu(false);
                        handlePrintMonthlyReport();
                      }}
                    >
                      Export to PDF
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handlePrintMonthlyReport}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition flex items-center gap-2"
              >
                <FaPrint className="text-sm" />
                Print
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 flex items-center gap-2"
                onClick={() => setShowRangePicker((prev) => !prev)}
              >
                <FaRegCalendarAlt className="text-sm" />
                {periodRangeLabel}
              </button>
            </div>
          </div>
          {topTutorsByHours.length > 0 && (
            <p className="text-sm text-gray-600">
              Top tutor by teaching time:{" "}
              <span className="font-semibold text-blue-600">
                {topTutorsByHours
                  .map((entry) => capitalizeWords(entry.name))
                  .join(", ")}{" "}
                ({topTutorsByHours[0].hours.toFixed(1)} hrs)
              </span>
            </p>
          )}
          {showRangePicker && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <label className="text-xs font-semibold text-gray-600">
                Start
                <input
                  type="date"
                  className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400"
                  value={toDateInputValue(rangeStart)}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    const next = new Date(`${value}T00:00:00`);
                    if (Number.isNaN(next.getTime())) return;
                    setRangeStart(next);
                    if (rangeEnd && next > rangeEnd) {
                      setRangeEnd(next);
                    }
                  }}
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                End
                <input
                  type="date"
                  className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400"
                  value={toDateInputValue(rangeEnd)}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    const next = new Date(`${value}T00:00:00`);
                    if (Number.isNaN(next.getTime())) return;
                    setRangeEnd(next);
                    if (rangeStart && next < rangeStart) {
                      setRangeStart(next);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition"
                onClick={resetRangeToMonth}
              >
                Reset Month
              </button>
            </div>
          )}
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryMetrics.map((metric) => (
            <div
              key={metric.label}
              className="relative rounded-2xl border border-gray-200 border-t-4 p-5 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
              style={{ borderTopColor: metric.accent }}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${metric.color} text-base`}
              >
                {metric.icon}
              </div>
              <p className="mt-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {metric.label}
              </p>
              <p className="text-2xl font-bold text-gray-800">{metric.value}</p>
              <p className="text-xs text-gray-500">{metric.detail}</p>
              <div className="mt-4 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${metric.progress ?? 0}%`, backgroundColor: metric.accent }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Tutor Performance</h2>
              <p className="text-sm text-gray-500">
                Sessions, tutees, total hours, and average rating per tutor.
              </p>
              <p className="text-xs text-gray-400">
                Updated {new Date().toLocaleString("en-US")}
              </p>
            </div>
            <div className="overflow-x-auto sm:overflow-visible max-w-full overscroll-x-contain touch-pan-x">
              <table className="w-full text-sm min-w-[520px] sm:min-w-0">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3">Tutor Name</th>
                    <th className="text-center px-4 py-3">Sessions</th>
                    <th className="text-center px-4 py-3">Tutees</th>
                    <th className="text-center px-4 py-3">Total Hours</th>
                    <th className="text-center px-4 py-3">Avg Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {tutorMonthlyPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500 py-5">
                        No completed sessions were logged for {displayPeriodLabel}.
                      </td>
                    </tr>
                  ) : (
                    tutorMonthlyPerformance.map((entry) => (
                        <tr key={entry.tutorId} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium text-gray-800">
                            <div className="flex items-center gap-3">
                              {tutorProfiles[entry.tutorId] ? (
                                <img
                                  src={tutorProfiles[entry.tutorId]}
                                  alt={entry.name}
                                  className="w-9 h-9 rounded-full object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-[#dfecff] text-[#132c91] flex items-center justify-center font-semibold">
                                  {(entry.name || "?").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span>{entry.name}</span>
                            </div>
                          </td>
                        <td className="px-4 py-3 text-center">{entry.sessions}</td>
                        <td className="px-4 py-3 text-center">{entry.totalTutees}</td>
                        <td className="px-4 py-3 text-center font-semibold text-blue-600">
                          {entry.hours.toFixed(1)} hrs
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700">
                          {entry.averageRating ? entry.averageRating.toFixed(2) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">LAV Environment Satisfaction</h2>
              <p className="text-sm text-gray-500">Average ratings for {displayPeriodLabel}.</p>
            </div>
            <div className="p-4">
              {evaluations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No LAV feedback has been submitted yet.
                </p>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 overflow-x-auto sm:overflow-visible overscroll-x-contain touch-pan-x">
                  <div className="flex items-end justify-between gap-3 min-w-[520px] sm:min-w-0">
                    {lavRatingFields.map((field, index) => {
                      const avg = lavStatsPeriod.averages[field.key];
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
                      {lavStatsPeriod.overallAverage !== null
                        ? lavStatsPeriod.overallAverage.toFixed(2)
                        : "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Reports;
