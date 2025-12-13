import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";

const ratingFields = [
  { key: "presentation_clarity", label: "Presentation" },
  { key: "drills_sufficiency", label: "Drills" },
  { key: "patience_enthusiasm", label: "Patience" },
  { key: "study_skills_development", label: "Study Skills" },
  { key: "positive_impact", label: "Impact" },
];

const Reports = () => {
  const [appointments, setAppointments] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthlyExporting, setMonthlyExporting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointment")
        .select(`
          appointment_id,
          tutor_id,
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
          "appointment_id, tutor_id, user_id, presentation_clarity, drills_sufficiency, patience_enthusiasm, study_skills_development, positive_impact"
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
            history: [],
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
        entry.totalHours = (entry.totalHours || 0) + Math.max(durationMinutes / 60, 0);

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

  const ratingStats = useMemo(() => {
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
          fields: ratingFields.reduce(
            (acc, field) => ({
              ...acc,
              [field.key]: { sum: 0, count: 0 },
            }),
            {}
          ),
        };
      }

      const entry = map[tutorId];

      ratingFields.forEach((field) => {
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

  const evaluationRecords = useMemo(() => {
    return evaluations.map((evaluation) => {
      const ratings = ratingFields
        .map((field) => Number(evaluation[field.key]))
        .filter((value) => !Number.isNaN(value));
      return {
        id: `${evaluation.tutor_id}-${evaluation.user_id}-${evaluation.appointment_id || Math.random()}`,
        tutor: appointments.find((apt) => apt.tutor_id === evaluation.tutor_id)?.tutor?.name || "Unknown Tutor",
        studentId: evaluation.user_id,
        overall: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : "—",
        ratings: ratingFields.map((field) => ({
          key: field.key,
          value: Number(evaluation[field.key]) || null,
        })),
      };
    });
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

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold text-gray-700">Reports</h1>
        <p className="text-gray-500 mt-2 text-sm">Loading analytics…</p>
      </div>
    );
  }

  const tutorEntries = Object.values(tutorStats);
  const ratingEntries = Object.values(ratingStats);
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
                      {entry.totalHours ? entry.totalHours.toFixed(1) : "—"}
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
                onClick={() => window.print()}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-blue-500 transition"
              >
                Print
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
          <h2 className="text-lg font-semibold text-gray-800">Rating Averages</h2>
          <p className="text-sm text-gray-500"></p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Tutor</th>
                <th className="text-center px-4 py-3">Overall</th>
                {ratingFields.map((field) => (
                  <th key={field.key} className="text-center px-4 py-3">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ratingEntries.length === 0 ? (
                <tr>
                  <td colSpan={ratingFields.length + 2} className="text-center text-gray-500 py-5">
                    No evaluations yet.
                  </td>
                </tr>
              ) : (
                ratingEntries.map((entry) => (
                  <tr key={entry.tutorId} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{entry.name}</td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {entry.overallCount ? (entry.overallSum / entry.overallCount).toFixed(2) : "—"}
                    </td>
                    {ratingFields.map((field) => {
                      const stat = entry.fields[field.key];
                      return (
                        <td key={field.key} className="px-4 py-3 text-center">
                          {stat.count ? (stat.sum / stat.count).toFixed(1) : "—"}
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
          <p className="text-sm text-gray-500">Individual submissions without private comments.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Tutor</th>
                <th className="text-left px-4 py-3">Student ID</th>
                <th className="text-center px-4 py-3">Overall</th>
                {ratingFields.map((field) => (
                  <th key={field.key} className="text-center px-4 py-3">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evaluationRecords.length === 0 ? (
                <tr>
                  <td colSpan={ratingFields.length + 3} className="text-center text-gray-500 py-5">
                    No evaluations submitted.
                  </td>
                </tr>
              ) : (
                evaluationRecords.map((record) => (
                  <tr key={record.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{record.tutor}</td>
                    <td className="px-4 py-3 text-gray-600">{record.studentId || "Unknown"}</td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {record.overall}
                    </td>
                    {record.ratings.map((rating) => (
                      <td key={rating.key} className="px-4 py-3 text-center">
                        {rating.value ? rating.value.toFixed(1) : "—"}
                      </td>
                    ))}
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
