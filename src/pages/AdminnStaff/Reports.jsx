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

  const handleMonthlyExport = () => {
    if (monthlyExporting) return;
    try {
      setMonthlyExporting(true);
      const rows = [["Tutor", "Month", "Completed Sessions"]];
      Object.values(tutorStats).forEach((entry) => {
        Object.keys(entry.monthly)
          .sort()
          .forEach((monthKey) => {
            rows.push([entry.name, monthKey, entry.monthly[monthKey]]);
          });
      });

      if (rows.length === 1) {
        toast("No data to export yet.");
        setMonthlyExporting(false);
        return;
      }

      const csvContent = rows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "tutor-monthly-report.csv");
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

    evaluations.forEach((evaluation) => {
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
  }, [evaluations, appointments]);

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

    evaluations.forEach((evaluation) => {
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
  }, [evaluations]);

  const tutorEntries = Object.values(tutorStats);
  const tutorSummaryEntries = Object.values(tutorEvaluationStats);

  const reportDate = new Date();
  const currentMonthKey = `${reportDate.getFullYear()}-${String(
    reportDate.getMonth() + 1
  ).padStart(2, "0")}`;
  const currentMonthLabel = reportDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const preparedDateLabel = reportDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const monthlyCompletedAppointments = appointments.filter((apt) => {
    if (apt.status !== "completed" || !apt.date) return false;
    const appointmentDate = new Date(apt.date);
    return (
      appointmentDate.getFullYear() === reportDate.getFullYear() &&
      appointmentDate.getMonth() === reportDate.getMonth()
    );
  });

  const monthlySessions = monthlyCompletedAppointments.length;
  const monthlyHoursTotal = monthlyCompletedAppointments.reduce((total, apt) => {
    const minutes =
      (new Date(`2000-01-01T${apt.end_time}`) - new Date(`2000-01-01T${apt.start_time}`)) /
      60000;
    return total + Math.max(minutes / 60, 0);
  }, 0);

  const activeTutorsMonth = tutorEntries.filter(
    (entry) => (entry.monthly?.[currentMonthKey] || 0) > 0
  ).length;

  const monthlyTuteeIds = new Set(
    monthlyCompletedAppointments.map((apt) => apt.user_id).filter(Boolean)
  );
  const activeTuteesMonth = monthlyTuteeIds.size;

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

  const summaryMetrics = [
    {
      label: "Sessions Conducted",
      value: `${monthlySessions}`,
      detail: currentMonthLabel,
      icon: "SC",
      progress: Math.min(100, (monthlySessions / 20) * 100),
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Total Hours of Tutoring",
      value: `${monthlyHoursTotal.toFixed(1)} hrs`,
      detail: "Logged teaching time this month",
      icon: "HR",
      progress: Math.min(100, (monthlyHoursTotal / 40) * 100),
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Active Tutors",
      value: `${activeTutorsMonth}`,
      detail: "Tutors with confirmed sessions",
      icon: "AT",
      progress:
        tutorEntries.length > 0
          ? Math.min(100, (activeTutorsMonth / tutorEntries.length) * 100)
          : 0,
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "Active Tutees",
      value: `${activeTuteesMonth}`,
      detail: "Tutees served this month",
      icon: "TT",
      progress: Math.min(100, (activeTuteesMonth / 30) * 100),
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Tutor Satisfaction",
      value: overallTutorSatisfaction ? `${overallTutorSatisfaction.toFixed(2)} / 5` : "- / 5",
      detail: "Average evaluation from tutees",
      icon: "TS",
      progress: overallTutorSatisfaction ? (overallTutorSatisfaction / 5) * 100 : 0,
      color: "bg-pink-100 text-pink-700",
    },
    {
      label: "Tutee Satisfaction",
      value: tuteeSatisfaction ? `${tuteeSatisfaction.toFixed(2)} / 5` : "- / 5",
      detail: "LAV facility & service rating",
      icon: "LS",
      progress: tuteeSatisfaction ? (tuteeSatisfaction / 5) * 100 : 0,
      color: "bg-indigo-100 text-indigo-700",
    },
  ];

  const tutorMonthlyPerformance = tutorEntries
    .map((entry) => ({
      tutorId: entry.tutorId,
      name: entry.name,
      sessions: entry.monthly?.[currentMonthKey] || 0,
      hours: entry.monthlyHours?.[currentMonthKey] || 0,
    }))
    .filter((entry) => entry.sessions > 0 || entry.hours > 0)
    .sort((a, b) => b.hours - a.hours);

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

    const monthlyRowsHtml =
      tutorEntries
        .flatMap((entry) => {
          const monthKeys = Object.keys(entry.monthly || {}).sort();
          if (monthKeys.length === 0) {
            return [
              `<tr>
                <td>${escapeHtml(entry.name)}</td>
                <td>-</td>
                <td>0</td>
              </tr>`,
            ];
          }
          return monthKeys.map(
            (key) => `
              <tr>
                <td>${escapeHtml(entry.name)}</td>
                <td>${escapeHtml(key)}</td>
                <td>${entry.monthly?.[key] || 0}</td>
              </tr>`
          );
        })
        .join("") || `<tr><td colspan="3">No monthly data available.</td></tr>`;

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
      `<tr><td colspan="3">No tutor performance data for ${escapeHtml(currentMonthLabel)}.</td></tr>`;

    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>LAV Monthly Report</title>
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
                  <p class="subtitle">Month of ${escapeHtml(currentMonthLabel)}</p>
                </div>
              </div>
              <div class="subtitle">Generated on ${escapeHtml(preparedDateLabel)}</div>
            </div>

            <h2 class="section-title">Key Metrics</h2>
            <div class="metric-grid">
              ${metricCardsHtml}
            </div>

            <h2 class="section-title">Monthly Breakdown per Tutor</h2>
            <table>
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Month</th>
                  <th>Completed Sessions</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyRowsHtml}
              </tbody>
            </table>

            <h2 class="section-title">Tutor Performance (${escapeHtml(currentMonthLabel)})</h2>
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
            <p class="note">This report includes only sessions marked as completed.</p>
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
    tutorEntries,
    tutorMonthlyPerformance,
    currentMonthLabel,
    preparedDateLabel,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold text-gray-700">Reports</h1>
        <p className="text-gray-500 mt-2 text-sm">Loading analytics...</p>
      </div>
    );
  }

  const topTutorByHours = tutorEntries
    .filter((entry) => entry.totalHours)
    .sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0))[0];

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
              {topTutorByHours.name} ({topTutorByHours.totalHours.toFixed(1)} hrs)
            </span>
          </p>
        )}
      </header>

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
              <p className="text-sm text-gray-500">Month of {currentMonthLabel}</p>
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
          <h2 className="text-lg font-semibold text-gray-800">Monthly Breakdown</h2>
          <p className="text-sm text-gray-500 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <span>Completed sessions grouped by month per tutor.</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePrintMonthlyReport}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-blue-500 transition"
              >
                Download PDF
              </button>
              <button
                onClick={() => handleMonthlyExport()}
                className="rounded-lg border border-blue-500 text-blue-600 px-3 py-1 text-xs font-semibold hover:bg-blue-50 transition"
                disabled={monthlyExporting}
              >
                {monthlyExporting ? "Preparing…" : "Download CSV"}
              </button>
            </div>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
          {tutorEntries.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-5">
              No data to display.
            </div>
          ) : (
            tutorEntries.map((entry) => (
              <div key={entry.tutorId} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                <h3 className="font-semibold text-gray-800 mb-2">{entry.name}</h3>
                <div className="space-y-1">
                  {Object.keys(entry.monthly)
                    .sort()
                    .map((monthKey) => (
                      <p key={monthKey} className="flex justify-between text-sm text-gray-600">
                        <span>{monthKey}</span>
                        <span className="font-semibold text-gray-800">{entry.monthly[monthKey]}</span>
                      </p>
                    ))}
                  {Object.keys(entry.monthly).length === 0 && (
                    <p className="text-sm text-gray-400">No completed sessions recorded.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Rating Averages (LAV)</h2>
          <p className="text-sm text-gray-500">
            Aggregate feedback on the tutoring venue, scheduling experience, and overall service quality.
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
            Per-tutor averages for each evaluation question (anonymous comments remain hidden).
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
            Tutor Performance — {currentMonthLabel}
          </h2>
          <p className="text-sm text-gray-500">
            Total hours and completed sessions recorded per tutor for this month.
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
                    No completed sessions were logged for {currentMonthLabel}.
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
