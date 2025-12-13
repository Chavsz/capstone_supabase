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
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [loading, setLoading] = useState(true);

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
            mode_of_session,
            tutor:users!appointment_tutor_id_fkey(name),
            student:users!appointment_user_id_fkey(name)
          `)
        .eq("status", "completed")
        .order("date", { ascending: false });
      if (appointmentError) throw appointmentError;
      setAppointments(appointmentData || []);

      const { data: evaluationData, error: evalError } = await supabase
        .from("evaluation")
        .select(
          "appointment_id, tutor_id, user_id, presentation_clarity, drills_sufficiency, patience_enthusiasm, study_skills_development, positive_impact"
        );
      if (evalError) throw evalError;
      setEvaluations(evaluationData || []);

      const { data: profileData, error: profileError } = await supabase
        .from("profile")
        .select("profile_id, user_id, users(name)")
        .order("user_id");
      if (profileError && profileError.code !== "PGRST116") throw profileError;

      const tutorProfileMap = {};
      const profileIds = [];
      (profileData || []).forEach((profile) => {
        if (!profile.profile_id) return;
        profileIds.push(profile.profile_id);
        tutorProfileMap[profile.profile_id] = {
          tutorId: profile.user_id,
          tutorName: profile.users?.name || "Unknown Tutor",
        };
      });

      let scheduleRecords = [];
      if (profileIds.length) {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from("schedule")
          .select("schedule_id, profile_id, day, start_time, end_time")
          .in("profile_id", profileIds)
          .order("day", { ascending: true })
          .order("start_time", { ascending: true });

        if (scheduleError && scheduleError.code !== "PGRST116") throw scheduleError;

        scheduleRecords = (scheduleData || []).map((slot) => ({
          ...slot,
          tutorId: tutorProfileMap[slot.profile_id]?.tutorId || null,
          tutorName: tutorProfileMap[slot.profile_id]?.tutorName || "Unknown Tutor",
        }));
      }

      setScheduleEntries(scheduleRecords);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const weekInfo = (date) => {
    const newDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = newDate.getUTCDay() || 7;
    newDate.setUTCDate(newDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(newDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((newDate - yearStart) / 86400000 + 1) / 7);
    return { year: newDate.getUTCFullYear(), week: weekNo };
  };

  const tutorNameMap = useMemo(() => {
    const map = {};
    appointments.forEach((appointment) => {
      if (appointment.tutor_id) {
        map[appointment.tutor_id] = appointment.tutor?.name || "Unknown Tutor";
      }
    });
    scheduleEntries.forEach((slot) => {
      if (slot.tutorId && slot.tutorName) {
        map[slot.tutorId] = slot.tutorName;
      }
    });
    return map;
  }, [appointments, scheduleEntries]);

  const tutorStats = useMemo(() => {
    const stats = {};
    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentWeek = weekInfo(today);

    appointments.forEach((appointment) => {
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
      const monthKey = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}`;
      entry.monthly[monthKey] = (entry.monthly[monthKey] || 0) + 1;

      entry.history.push({
        appointment_id: appointment.appointment_id,
        student: appointment.student?.name || "Unknown",
        subject: appointment.subject || "Untitled Session",
        date: appointment.date,
        time: `${appointment.start_time?.slice(0, 5)} - ${appointment.end_time?.slice(0, 5)}`,
      });

      if (appointment.date === todayKey) {
        entry.today += 1;
      }

      if (sessionDate.getFullYear() === currentYear && sessionDate.getMonth() === currentMonth) {
        entry.thisMonth += 1;
      }

      const sessionWeek = weekInfo(sessionDate);
      if (sessionWeek.year === currentWeek.year && sessionWeek.week === currentWeek.week) {
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
          name: "Unknown Tutor",
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

    Object.keys(map).forEach((tutorId) => {
      map[tutorId].name = tutorNameMap[tutorId] || "Unknown Tutor";
    });

    return map;
  }, [evaluations, tutorNameMap]);

  const evaluationRecords = useMemo(() => {
    return evaluations.map((evaluation) => {
      const values = ratingFields
        .map((field) => Number(evaluation[field.key]))
        .filter((value) => !Number.isNaN(value));
      const overall = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return {
        id: `${evaluation.tutor_id}-${evaluation.user_id}-${evaluation.appointment_id || Math.random()}`,
        tutorName: tutorNameMap[evaluation.tutor_id] || "Unknown Tutor",
        studentId: evaluation.user_id,
        overall,
        fields: ratingFields.map((field) => ({
          key: field.key,
          value: Number(evaluation[field.key]) || null,
        })),
      };
    });
  }, [evaluations, tutorNameMap]);

  const scheduleByTutor = useMemo(() => {
    const dayOrder = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 7,
    };
    const groups = {};
    scheduleEntries.forEach((slot) => {
      if (!slot.tutorId) return;
      if (!groups[slot.tutorId]) {
        groups[slot.tutorId] = {
          name: slot.tutorName || "Unknown Tutor",
          slots: [],
        };
      }
      groups[slot.tutorId].slots.push(slot);
    });

    Object.values(groups).forEach((group) => {
      group.slots.sort((a, b) => {
        const dayDiff = (dayOrder[a.day] || 10) - (dayOrder[b.day] || 10);
        if (dayDiff !== 0) return dayDiff;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
    });

    return groups;
  }, [scheduleEntries]);

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

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gray-50 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Analytics</p>
        <h1 className="text-3xl font-bold text-gray-800">Tutor Performance Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          Automatically generated insights based on completed sessions and anonymous evaluations.
        </p>
      </header>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Completed Sessions Overview</h2>
          <p className="text-xs text-gray-400 uppercase">Monthly / Weekly / Daily</p>
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
              </tr>
            </thead>
            <tbody>
              {tutorEntries.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-gray-500 py-6">
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
          <p className="text-sm text-gray-500">Completed sessions grouped per month by tutor.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
          {tutorEntries.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-6">
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
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Rating Averages</h2>
            <p className="text-sm text-gray-500">
              Derived from submitted evaluations. Anonymous comments stay hidden.
            </p>
          </div>
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
                  <td colSpan={7} className="text-center text-gray-500 py-6">
                    No evaluations have been submitted yet.
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
                      const fieldStat = entry.fields[field.key];
                      return (
                        <td key={field.key} className="px-4 py-3 text-center">
                          {fieldStat.count ? (fieldStat.sum / fieldStat.count).toFixed(1) : "—"}
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
          <h2 className="text-lg font-semibold text-gray-800">Teaching History</h2>
          <p className="text-sm text-gray-500">
            Quick look at how many sessions each tutor has handled and recent learners.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
          {tutorEntries.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-6">
              No completed sessions available.
            </div>
          ) : (
            tutorEntries.map((entry) => (
              <div key={entry.tutorId} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase text-gray-400 tracking-wide">Tutor</p>
                    <h3 className="text-lg font-semibold text-gray-800">{entry.name}</h3>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    {entry.total} session{entry.total === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-3">
                  {entry.history.slice(0, 4).map((session) => (
                    <div
                      key={session.appointment_id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                    >
                      <p className="text-sm font-medium text-gray-700">{session.subject}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(session.date)} · {session.time}
                      </p>
                      <p className="text-xs text-gray-400">Student: {session.student}</p>
                    </div>
                  ))}
                  {entry.history.length === 0 && (
                    <p className="text-sm text-gray-400">No completed sessions yet.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Tutor Schedules</h2>
          <p className="text-sm text-gray-500">
            Full availability roster per tutor for administrative planning.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
          {Object.keys(scheduleByTutor).length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-6">
              No schedules recorded.
            </div>
          ) : (
            Object.entries(scheduleByTutor).map(([tutorId, data]) => (
              <div key={tutorId} className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">{data.name}</h3>
                {data.slots.length === 0 ? (
                  <p className="text-sm text-gray-400">No published schedule.</p>
                ) : (
                  <div className="space-y-2">
                    {data.slots.map((slot) => (
                      <div
                        key={slot.schedule_id}
                        className="flex justify-between text-sm text-gray-600 bg-white rounded-lg border border-gray-100 px-3 py-2"
                      >
                        <span className="font-medium">{slot.day}</span>
                        <span>
                          {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Evaluation Records</h2>
            <p className="text-sm text-gray-500">
              Each tutee submission, excluding private comments.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Tutor</th>
                <th className="text-left px-4 py-3">Submitted By (ID)</th>
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
                  <td colSpan={ratingFields.length + 3} className="text-center text-gray-500 py-6">
                    No evaluations submitted yet.
                  </td>
                </tr>
              ) : (
                evaluationRecords.map((record) => (
                  <tr key={record.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{record.tutorName}</td>
                    <td className="px-4 py-3 text-gray-600">{record.studentId || "Unknown"}</td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {record.overall ? record.overall.toFixed(2) : "—"}
                    </td>
                    {record.fields.map((field) => (
                      <td key={field.key} className="px-4 py-3 text-center">
                        {field.value ? field.value.toFixed(1) : "—"}
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
