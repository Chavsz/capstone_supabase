import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";

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
  const [loading, setLoading] = useState(true);
  const [monthlyExporting, setMonthlyExporting] = useState(false);
  const [landingImage, setLandingImage] = useState("");
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchData = async () => {
    try {
      setLoading(true);

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
      setLandingImage(landingData?.[0]?.home_image || "");
    } catch (error) {
      console.error(error);
      toast.error("Unable to load reports data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const appointmentsById = useMemo(() => {
    const map = new Map();
    appointments.forEach((appointment) => {
      map.set(appointment.appointment_id, appointment);
    });
    return map;
  }, [appointments]);

  const periodOptions = useMemo(() => {
    const optionMap = new Map();
    appointments.forEach((appointment) => {
      if (!appointment.date) return;
      const date = new Date(appointment.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      if (!optionMap.has(key)) {
        optionMap.set(key, {
          key,
          label: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          type: "month",
          year,
          month,
        });
      }
    });

    if (optionMap.size === 0) {
      const now = new Date();
      const fallbackKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      optionMap.set(fallbackKey, {
        key: fallbackKey,
        label: now.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        type: "month",
        year: now.getFullYear(),
        month: now.getMonth(),
      });
    }

    const options = Array.from(optionMap.values()).sort(
      (a, b) => new Date(b.year, b.month, 1) - new Date(a.year, a.month, 1)
    );

    const currentYear = new Date().getFullYear();
    options.push({
      key: `${currentYear - 1}-year`,
      label: `${currentYear - 1}`,
      type: "year",
      year: currentYear - 1,
    });

    return options;
  }, [appointments]);

  useEffect(() => {
    if (periodOptions.length === 0) return;
    if (!periodOptions.some((option) => option.key === selectedPeriodKey)) {
      setSelectedPeriodKey(periodOptions[0].key);
    }
  }, [periodOptions, selectedPeriodKey]);

  const selectedPeriod = useMemo(() => {
    if (periodOptions.length === 0) return null;
    return periodOptions.find((option) => option.key === selectedPeriodKey) || periodOptions[0];
  }, [periodOptions, selectedPeriodKey]);

  const periodRange = useMemo(() => {
    if (!selectedPeriod) return null;
    if (selectedPeriod.type === "year") {
      return {
        label: selectedPeriod.label,
        start: new Date(selectedPeriod.year, 0, 1),
        end: new Date(selectedPeriod.year + 1, 0, 1),
        type: "year",
      };
    }
    return {
      label: selectedPeriod.label,
      start: new Date(selectedPeriod.year, selectedPeriod.month, 1),
      end: new Date(selectedPeriod.year, selectedPeriod.month + 1, 1),
      type: "month",
      year: selectedPeriod.year,
      month: selectedPeriod.month,
    };
  }, [selectedPeriod]);

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

  const formatDate = (value) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (value) =>
    new Date(`2000-01-01T${value}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

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
      .filter((apt) => apt.status === "completed")
      .forEach((appointment) => {
        const tutorId = appointment.tutor_id || "unknown";
        if (!stats[tutorId]) {
          stats[tutorId] = {
            tutorId,
            name: appointment.tutor?.name || "Unknown Tutor",
            total: 0,
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

  const tutorEvaluationStats = useMemo(() => {
    const map = {};

    evaluationsInPeriod.forEach((evaluation) => {
      const tutorId = evaluation.tutor_id || "unknown";
      if (!map[tutorId]) {
        map[tutorId] = {
          tutorId,
          name:
            appointments.find((apt) => apt.tutor_id === tutorId)?.tutor?.name || "Unknown Tutor",
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
  }, [evaluationsInPeriod, appointments]);

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

  const lavStats = useMemo(() => {
    const totals = lavRatingFields.reduce(
      (acc, field) => ({
        ...acc,
        [field.key]: { sum: 0, count: 0 },
      }),
      {}
    );

    evaluationsInPeriod.forEach((evaluation) => {
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
  }, [evaluationsInPeriod]);

  const appointmentsInPeriod = useMemo(() => {
    if (!periodRange) return [];
    return appointments.filter((appointment) => {
      if (!appointment.date) return false;
      const date = new Date(appointment.date);
      return date >= periodRange.start && date < periodRange.end;
    });
  }, [appointments, periodRange]);

  const completedAppointmentsInPeriod = useMemo(
    () => appointmentsInPeriod.filter((apt) => apt.status === "completed"),
    [appointmentsInPeriod]
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
  const tuteesServed = completedAppointmentsInPeriod.reduce((set, appointment) => {
    if (appointment.user_id) set.add(appointment.user_id);
    return set;
  }, new Set()).size;
  const cancelledSessions = appointmentsInPeriod.filter(
    (appointment) => appointment.status === "cancelled"
  ).length;
  const cancellationRate = totalSessionsBooked
    ? (cancelledSessions / totalSessionsBooked) * 100
    : 0;

  const comparisonCompletedCount = useMemo(() => {
    if (!comparisonRange) return null;
    return appointments.filter((appointment) => {
      if (appointment.status !== "completed" || !appointment.date) return false;
      const date = new Date(appointment.date);
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
  const tuteeSatisfaction = lavStats.overallAverage;
  const averageSatisfactionDisplay = overallTutorSatisfaction
    ? `${overallTutorSatisfaction.toFixed(2)} / 5`
    : "- / 5";
  const growthDisplay =
    growthRate === null
      ? "-"
      : `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`;

  const summaryMetrics = [
    {
      label: "Sessions Completed",
      value: `${totalSessionsCompleted}`,
      detail: displayPeriodLabel,
      icon: "SC",
      progress: Math.min(100, (totalSessionsCompleted / 20) * 100),
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Teaching Hours",
      value: `${totalHoursTeach.toFixed(1)} hrs`,
      detail: "Confirmed sessions only",
      icon: "HR",
      progress: Math.min(100, (totalHoursTeach / 40) * 100),
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Tutees Served",
      value: `${tuteesServed}`,
      detail: "Unique students",
      icon: "TS",
      progress: Math.min(100, (tuteesServed / 30) * 100),
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "Sessions Booked",
      value: `${totalSessionsBooked}`,
      detail: "All statuses",
      icon: "SB",
      progress: Math.min(100, (totalSessionsBooked / 40) * 100),
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Avg. Satisfaction",
      value: averageSatisfactionDisplay,
      detail: "Tutor evaluations",
      icon: "AR",
      progress: overallTutorSatisfaction ? (overallTutorSatisfaction / 5) * 100 : 0,
      color: "bg-pink-100 text-pink-700",
    },
    {
      label: "Cancellation Rate",
      value: `${cancellationRate.toFixed(1)}%`,
      detail: "Cancelled vs booked",
      icon: "CR",
      progress: Math.min(100, cancellationRate),
      color: "bg-red-100 text-red-700",
    },
    {
      label: "Growth vs Prev",
      value: growthDisplay,
      detail: comparisonLabel || "Previous period",
      icon: "GR",
      progress: Math.min(100, Math.abs(growthRate || 0)),
      color: "bg-indigo-100 text-indigo-700",
    },
  ];

  const tutorMonthlyPerformance = useMemo(() => {
    const aggregate = {};
    appointmentsInPeriod.forEach((appointment) => {
      const tutorId = appointment.tutor_id || "unknown";
      if (!aggregate[tutorId]) {
        aggregate[tutorId] = {
          tutorId,
          name: appointment.tutor?.name || "Unknown Tutor",
          sessions: 0,
          hours: 0,
        };
      }
      if (appointment.status === "completed") {
        const minutes =
          (new Date(`2000-01-01T${appointment.end_time}`) -
            new Date(`2000-01-01T${appointment.start_time}`)) /
          60000;
        aggregate[tutorId].sessions += 1;
        aggregate[tutorId].hours += Math.max(minutes / 60, 0);
      }
    });
    return Object.values(aggregate)
      .filter((entry) => entry.sessions > 0 || entry.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [appointmentsInPeriod]);

  const maxTutorHours = tutorMonthlyPerformance.reduce(
    (max, entry) => Math.max(max, entry.hours),
    0
  );

  const heroStats = [
    {
      key: "hours",
      label: "Total Hours Taught",
      value: `${totalHoursTeach.toFixed(1)} hrs`,
      helper: displayPeriodLabel,
    },
    {
      key: "completed",
      label: "Sessions Completed",
      value: `${totalSessionsCompleted}`,
      helper: "Confirmed sessions",
    },
    {
      key: "tutees",
      label: "Tutees Served",
      value: `${tuteesServed}`,
      helper: "Unique students",
    },
    {
      key: "booked",
      label: "Sessions Booked",
      value: `${totalSessionsBooked}`,
      helper: "All booking statuses",
    },
    {
      key: "rating",
      label: "Avg. Satisfaction",
      value: averageSatisfactionDisplay,
      helper: "Tutor evaluations",
    },
    {
      key: "cancellation",
      label: "Cancellation Rate",
      value: `${cancellationRate.toFixed(1)}%`,
      helper: "Cancelled vs booked",
    },
    {
      key: "growth",
      label: "Growth vs Last Period",
      value: growthDisplay,
      helper: comparisonLabel || "Previous period",
    },
  ];

  const handleMonthlyExport = useCallback(() => {
    if (monthlyExporting) return;
    try {
      setMonthlyExporting(true);
      if (tutorMonthlyPerformance.length === 0) {
        toast("No data to export for this period.");
        setMonthlyExporting(false);
        return;
      }

      const rows = [["Tutor", "Sessions", "Hours"]];
      tutorMonthlyPerformance.forEach((entry) => {
        rows.push([entry.name, entry.sessions, entry.hours.toFixed(2)]);
      });

      const csvContent = rows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tutor-report-${selectedPeriodKey}.csv`);
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
  }, [monthlyExporting, tutorMonthlyPerformance, selectedPeriodKey]);

  const handlePrintMonthlyReport = useCallback(() => {
    const resolvedLogo =
      landingImage && !landingImage.startsWith("http")
        ? new URL(landingImage, window.location.origin).href
        : landingImage;

    const metricCardsHtml = summaryMetrics
      .map(
        (metric) => `
        <div class="metric-card">
          <div class="metric-icon">${escapeHtml(metric.icon)}</div>
          <p class="metric-label">${escapeHtml(metric.label)}</p>
          <p class="metric-value">${escapeHtml(metric.value)}</p>
          <p class="metric-detail">${escapeHtml(metric.detail)}</p>
          <div class="metric-progress">
            <div class="metric-progress-bar" style="width:${metric.progress ?? 0}%;"></div>
          </div>
        </div>`
      )
      .join("");

    const performanceRowsHtml =
      tutorMonthlyPerformance
        .map(
          (entry) => `
          <tr>
            <td>${escapeHtml(entry.name)}</td>
            <td>${entry.sessions}</td>
            <td>${entry.hours.toFixed(1)} hrs</td>
          </tr>
        `
        )
        .join("") ||
      `<tr><td colspan="3">No tutor performance data for ${escapeHtml(displayPeriodLabel)}.</td></tr>`;

    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>LAV Period Report</title>
          <style>
            @page { margin: 25mm; }
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
              margin-bottom: 32px;
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
            .metric-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 16px;
            }
            .metric-card {
              background: #fff;
              border-radius: 18px;
              border: 1px solid #e2e8f0;
              padding: 16px;
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
            }
            .metric-icon {
              width: 38px;
              height: 38px;
              border-radius: 12px;
              background: #eff6ff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              font-weight: 600;
              color: #1d4ed8;
            }
            .metric-label {
              margin: 12px 0 0;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #94a3b8;
            }
            .metric-value {
              margin: 4px 0 0;
              font-size: 24px;
              font-weight: 700;
              color: #0f172a;
            }
            .metric-detail {
              margin: 0;
              font-size: 12px;
              color: #64748b;
            }
            .metric-progress {
              margin-top: 14px;
              height: 6px;
              background: #e2e8f0;
              border-radius: 999px;
              overflow: hidden;
            }
            .metric-progress-bar {
              height: 6px;
              background: linear-gradient(90deg, #2563eb, #7c3aed);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              background: #fff;
              border-radius: 16px;
              overflow: hidden;
            }
            th, td {
              padding: 12px 16px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 13px;
            }
            th {
              background: #f1f5f9;
              text-align: left;
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
              margin-top: 8px;
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
                  <p class="subtitle">Reporting period: ${escapeHtml(displayPeriodLabel)}</p>
                </div>
              </div>
              <div class="subtitle">Generated on ${escapeHtml(preparedDateLabel)}</div>
            </div>

            <h2 class="section-title">Key Metrics</h2>
            <div class="metric-grid">
              ${metricCardsHtml}
            </div>

            <h2 class="section-title">Tutor Performance (${escapeHtml(displayPeriodLabel)})</h2>
            <table>
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Sessions</th>
                  <th>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                ${performanceRowsHtml}
              </tbody>
            </table>
            <p class="note">This report includes only sessions marked as completed. Compared with ${escapeHtml(comparisonLabel || "previous period")}.</p>
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
  ]);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold text-gray-700">Reports</h1>
        <p className="text-gray-500 mt-2 text-sm">Loading analytics...</p>
      </div>
    );
  }

  const topTutorByHours =
    tutorMonthlyPerformance.length > 0 ? tutorMonthlyPerformance[0] : null;

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-8 bg-gray-50">
      <header>
        <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
        <p className="text-sm text-gray-500">
          Overview of completed sessions, tutor schedules, and evaluation summaries.
        </p>
        {topTutorByHours && (
          <p className="mt-2 text-sm text-gray-600">
            Top tutor by teaching time:{" "}
            <span className="font-semibold text-blue-600">
              {topTutorByHours.name} ({topTutorByHours.hours.toFixed(1)} hrs)
            </span>
          </p>
        )}
      </header>


      <div className="print:hidden space-y-4 mb-6 mt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">Reporting Period</p>
            <p className="text-xl font-semibold text-gray-900">{displayPeriodLabel}</p>
            <p className="text-xs text-gray-500">
              Compared with {comparisonLabel || "previous period"}.
            </p>
          </div>
          <div className="flex justify-end">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {periodOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setSelectedPeriodKey(option.key)}
                  className={`px-4 py-2 rounded-full border text-sm whitespace-nowrap transition-colors ${
                    selectedPeriodKey === option.key
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {heroStats.map((stat) => (
            <div
              key={stat.key}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1"
            >
              <p className="text-xs uppercase tracking-widest text-gray-500">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.helper}</p>
            </div>
          ))}
        </div>
      </div>


      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {landingImage ? (
              <img
                src={landingImage}
                alt="Learning Assistance Volunteer"
                className="w-16 h-16 object-contain rounded-lg border border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                Logo
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">
                Learning Assistance Volunteer
              </p>
              <h2 className="text-2xl font-bold text-gray-800">
                Learning Assistance Volunteer Monthly Report
              </h2>
              <p className="text-sm text-gray-500">Period: {displayPeriodLabel}</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Prepared on <span className="font-semibold text-gray-700">{preparedDateLabel}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Key Metrics</h3>
            <p className="text-sm text-gray-500">Performance Summary</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summaryMetrics.map((metric) => (
              <div
                key={metric.label}
                className="relative rounded-2xl border border-gray-200 p-5 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
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
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${metric.progress ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Completed Sessions</h2>
          <p className="text-sm text-gray-500">
            Daily, weekly, and monthly counts per tutor (status = completed).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Tutor</th>
                <th className="text-center px-4 py-3">Today</th>
                  <th className="text-center px-4 py-3">This Week</th>
                  <th className="text-center px-4 py-3">This Month</th>
                  <th className="text-center px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">Total Hours</th>
                </tr>
              </thead>
              <tbody>
              {tutorEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-5">
                    No completed sessions recorded.
                  </td>
                </tr>
              ) : (
                tutorEntries.map((entry) => (
                  <tr key={entry.tutorId} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{entry.name}</td>
                    <td className="px-4 py-3 text-center">{entry.today}</td>
                    <td className="px-4 py-3 text-center">{entry.thisWeek}</td>
                    <td className="px-4 py-3 text-center">{entry.thisMonth}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">{entry.total}</td>
                    <td className="px-4 py-3 text-center">
                      {entry.totalHours ? entry.totalHours.toFixed(1) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Performance Breakdown</h2>
              <p className="text-sm text-gray-500">
                Confirmed sessions recorded for {displayPeriodLabel}. Switch periods above to explore trends.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePrintMonthlyReport}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-blue-500 transition"
              >
                Download PDF
              </button>
              <button
                onClick={handleMonthlyExport}
                className="rounded-lg border border-blue-500 text-blue-600 px-3 py-1 text-xs font-semibold hover:bg-blue-50 transition"
                disabled={monthlyExporting}
              >
                {monthlyExporting ? "Preparing..." : "Download CSV"}
              </button>
            </div>
          </div>
        </div>
        <div className="p-4">
          {tutorMonthlyPerformance.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p>No confirmed sessions recorded for {displayPeriodLabel}.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tutorMonthlyPerformance.map((entry, index) => {
                const progress = maxTutorHours
                  ? Math.round((entry.hours / maxTutorHours) * 100)
                  : 0;
                return (
                  <div
                    key={entry.tutorId}
                    className="rounded-2xl border border-gray-200 p-4 bg-gray-50 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800">{entry.name}</h3>
                      <span className="text-xs font-semibold text-blue-600">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-gray-900">{entry.hours.toFixed(1)} hrs</p>
                      <p className="text-sm text-gray-500">Sessions: {entry.sessions}</p>
                    </div>
                    <div className="h-1.5 bg-white rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Rating Averages (LAV)</h2>
          <p className="text-sm text-gray-500">
            Aggregate feedback on the tutoring venue, scheduling experience, and overall service quality for {displayPeriodLabel}.
          </p>
        </div>
        <div className="p-4">
          {evaluations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No LAV feedback has been submitted yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lavRatingFields.map((field) => (
                <div key={field.key} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {field.label}
                  </p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">
                    {lavStats.averages[field.key] !== null
                      ? lavStats.averages[field.key].toFixed(2)
                      : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Average rating</p>
                </div>
              ))}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col justify-center">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  Overall Average
                </p>
                <p className="text-4xl font-bold text-blue-700 mt-2">
                  {lavStats.overallAverage !== null ? lavStats.overallAverage.toFixed(2) : "-"}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Combined LAV score across all submissions
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Tutor Schedules</h2>
          <p className="text-sm text-gray-500">All published availability per tutor.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
          {Object.keys(schedulesByTutor).length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-5">
              No schedules recorded.
            </div>
          ) : (
            Object.entries(schedulesByTutor).map(([tutorId, group]) => (
              <div key={tutorId} className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                {group.slots.length === 0 ? (
                  <p className="text-sm text-gray-400">No slots published.</p>
                ) : (
                  group.slots.map((slot) => (
                    <p
                      key={slot.id}
                      className="flex justify-between text-sm text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2"
                    >
                      <span className="font-medium">{slot.day}</span>
                      <span>
                        {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                      </span>
                    </p>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Evaluation Records</h2>
          <p className="text-sm text-gray-500">
            Per-tutor averages for each evaluation question during {displayPeriodLabel} (anonymous comments remain hidden).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Tutor</th>
                <th className="text-center px-4 py-3">Overall</th>
                {tutorRatingFields.map((field) => (
                  <th key={field.key} className="text-center px-4 py-3">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tutorSummaryEntries.length === 0 ? (
                <tr>
                  <td colSpan={tutorRatingFields.length + 2} className="text-center text-gray-500 py-5">
                    No tutor evaluations submitted.
                  </td>
                </tr>
              ) : (
                tutorSummaryEntries.map((entry) => (
                  <tr key={entry.tutorId} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{entry.name}</td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {entry.overallCount ? (entry.overallSum / entry.overallCount).toFixed(2) : "-"}
                    </td>
                    {tutorRatingFields.map((field) => {
                      const stat = entry.fields[field.key];
                      return (
                        <td key={field.key} className="px-4 py-3 text-center">
                          {stat.count ? (stat.sum / stat.count).toFixed(1) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Tutor Performance — {displayPeriodLabel}
          </h2>
          <p className="text-sm text-gray-500">
            Total hours and completed sessions recorded per tutor for {displayPeriodLabel}.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Tutor</th>
                <th className="text-center px-4 py-3">Sessions</th>
                <th className="text-center px-4 py-3">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {tutorMonthlyPerformance.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 py-5">
                    No completed sessions were logged for {displayPeriodLabel}.
                  </td>
                </tr>
              ) : (
                tutorMonthlyPerformance.map((entry) => (
                  <tr key={entry.tutorId} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{entry.name}</td>
                    <td className="px-4 py-3 text-center">{entry.sessions}</td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {entry.hours.toFixed(1)} hrs
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Reports;
