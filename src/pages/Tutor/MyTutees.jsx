import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../../supabase-client";
import AssessmentModal from "../../components/AssessmentModal";
import LoadingButton from "../../components/LoadingButton";
import { useDataSync } from "../../contexts/DataSyncContext";

const formatImprovement = (preScore, postScore, preTotal) => {
  const pre = Number(preScore);
  const post = Number(postScore);
  const total = Number(preTotal);
  if (Number.isNaN(pre) || Number.isNaN(post)) return null;
  if (Number.isFinite(total) && total > 0) {
    return ((post - pre) / total) * 100;
  }
  if (pre === 0) {
    if (post > 0) return 100;
    return null;
  }
  return ((post - pre) / pre) * 100;
};

const formatScoreWithTotal = (score, total) => {
  if (score === null || score === undefined || score === "") return "-";
  if (total === null || total === undefined || total === "") return `${score}`;
  return `${score}/${total}`;
};

const formatPercent = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "0.0%";

const MyTutees = () => {
  const { version } = useDataSync();
  const [loading, setLoading] = useState(true);
  const [tutees, setTutees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notesModal, setNotesModal] = useState(null);
  const [sessionsModal, setSessionsModal] = useState(null);
  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawPage, setRawPage] = useState(1);
  const [rawMonth, setRawMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
  const [editScoreSession, setEditScoreSession] = useState(null);
  const [editScores, setEditScores] = useState({
    preScore: "",
    postScore: "",
    preTotal: "",
    postTotal: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [chartTutee, setChartTutee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [sortKey, setSortKey] = useState("tutee");
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = isMobile ? 2 : 4;

  const loadRows = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: appointments, error } = await supabase
        .from("appointment")
        .select(
          `
          appointment_id,
          user_id,
          tutor_id,
          subject,
          topic,
          status,
          date,
          start_time,
          end_time,
          student:users!appointment_user_id_fkey(name)
        `
        )
        .eq("tutor_id", session.user.id)
        .in("status", ["awaiting_feedback", "completed"]);

      if (error) throw error;

      const appointmentList = appointments || [];
      const appointmentIds = appointmentList.map((item) => item.appointment_id);
      const tuteeIds = Array.from(
        new Set(appointmentList.map((item) => item.user_id).filter(Boolean))
      );

      let evaluationMap = {};
      if (appointmentIds.length) {
        const { data: evaluations, error: evalError } = await supabase
          .from("evaluation")
          .select(
            "appointment_id, pre_test_score, post_test_score, pre_test_total, post_test_total, tutor_notes"
          )
          .in("appointment_id", appointmentIds);
        if (evalError) throw evalError;
        evaluationMap = (evaluations || []).reduce((acc, item) => {
          acc[item.appointment_id] = item;
          return acc;
        }, {});
      }

      let profileMap = {};
      if (tuteeIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("student_profile")
          .select("user_id, program, college, year_level, profile_image")
          .in("user_id", tuteeIds);
        if (profileError && profileError.code !== "PGRST116") throw profileError;
        profileMap = (profiles || []).reduce((acc, item) => {
          acc[item.user_id] = item;
          return acc;
        }, {});
      }

      const grouped = new Map();
      appointmentList.forEach((appointment) => {
        const evaluation = evaluationMap[appointment.appointment_id] || {};
        const tuteeId = appointment.user_id || "unknown";
        if (!grouped.has(tuteeId)) {
          const profile = profileMap[tuteeId] || {};
          grouped.set(tuteeId, {
            tutee_id: tuteeId,
            tutee_name: appointment.student?.name || "Unknown",
            tutee_program: profile.program || "Program not set",
            tutee_profile_image: profile.profile_image || "",
            sessions: [],
          });
        }
        grouped.get(tuteeId).sessions.push({
          appointment_id: appointment.appointment_id,
          user_id: appointment.user_id,
          tutor_id: appointment.tutor_id,
          subject: appointment.subject || "-",
          topic: appointment.topic || "-",
          date: appointment.date || "",
          start_time: appointment.start_time || "",
          end_time: appointment.end_time || "",
          pre_test_score: evaluation.pre_test_score ?? null,
          post_test_score: evaluation.post_test_score ?? null,
          pre_test_total: evaluation.pre_test_total ?? null,
          post_test_total: evaluation.post_test_total ?? null,
          tutor_notes: evaluation.tutor_notes ?? "",
        });
      });

      const result = Array.from(grouped.values()).map((tutee) => {
        const sessions = [...tutee.sessions].sort((a, b) =>
          String(a.date).localeCompare(String(b.date))
        );
        const lastSession = sessions[sessions.length - 1] || null;
        return { ...tutee, sessions, lastSession };
      });

      setTutees(result);
    } catch (err) {
      console.error("Error loading tutees:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [version]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 639px)");
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const filteredRows = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return tutees;
    return tutees.filter((tutee) => {
      const sessionText = tutee.sessions
        .map((session) => `${session.subject} ${session.topic} ${session.tutor_notes || ""}`)
        .join(" ")
        .toLowerCase();
      const haystack = `${tutee.tutee_name} ${tutee.tutee_program} ${sessionText}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [tutees, searchQuery]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      if (sortKey === "course") return String(a.tutee_program).localeCompare(String(b.tutee_program));
      if (sortKey === "improvement") {
        const avg = (sessions) => {
          const values = sessions
            .map((session) =>
              formatImprovement(
                session.pre_test_score,
                session.post_test_score,
                session.pre_test_total
              )
            )
            .filter((value) => value !== null);
          if (!values.length) return null;
          return values.reduce((sum, value) => sum + value, 0) / values.length;
        };
        const aAvg = avg(a.sessions);
        const bAvg = avg(b.sessions);
        if (aAvg == null && bAvg == null) return 0;
        if (aAvg == null) return 1;
        if (bAvg == null) return -1;
        return bAvg - aAvg;
      }
      return a.tutee_name.localeCompare(b.tutee_name);
    });
    return list;
  }, [filteredRows, sortKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / cardsPerPage));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const pagedTutees = sortedRows.slice(
    (currentPageSafe - 1) * cardsPerPage,
    currentPageSafe * cardsPerPage
  );
  const allSessions = useMemo(() => {
    const items = [];
    tutees.forEach((tutee) => {
      (tutee.sessions || []).forEach((session) => items.push(session));
    });
    return items.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  }, [tutees]);
  const masteryValues = allSessions
    .map((session) =>
      formatImprovement(
        session.pre_test_score,
        session.post_test_score,
        session.pre_test_total
      )
    )
    .filter((value) => value !== null);
  const totalMastery =
    masteryValues.length > 0
      ? masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length
      : 0;
  const rawSessions = useMemo(() => {
    const items = [];
    tutees.forEach((tutee) => {
      (tutee.sessions || []).forEach((session) => {
        if (rawMonth) {
          if (!session.date) return;
          const dateValue = new Date(session.date);
          if (Number.isNaN(dateValue.getTime())) return;
          const monthValue = `${dateValue.getFullYear()}-${String(
            dateValue.getMonth() + 1
          ).padStart(2, "0")}`;
          if (monthValue !== rawMonth) return;
        }
        items.push({
          ...session,
          tutee_name: tutee.tutee_name,
        });
      });
    });
    return items.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  }, [tutees, rawMonth]);
  const rawTotalPages = Math.max(1, Math.ceil(rawSessions.length / 6));
  const rawPageSafe = Math.min(Math.max(rawPage, 1), rawTotalPages);
  const rawPagedSessions = rawSessions.slice((rawPageSafe - 1) * 6, rawPageSafe * 6);

  const handleSaveScores = async (values) => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: existing, error: existingError } = await supabase
        .from("evaluation")
        .select("evaluation_id")
        .eq("appointment_id", selected.appointment_id)
        .maybeSingle();

      if (existingError && existingError.code !== "PGRST116") {
        throw existingError;
      }

      const payload = {
        pre_test_score: values.preScore,
        post_test_score: values.postScore,
        pre_test_total: values.preTotal,
        post_test_total: values.postTotal,
        tutor_notes: values.notes,
      };

      if (existing?.evaluation_id) {
        const { error: updateError } = await supabase
          .from("evaluation")
          .update(payload)
          .eq("evaluation_id", existing.evaluation_id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("evaluation")
          .insert([
            {
              appointment_id: selected.appointment_id,
              tutor_id: session.user.id,
              user_id: selected.user_id,
              ...payload,
            },
          ]);
        if (insertError) throw insertError;
      }

      await loadRows();
      setSelected(null);
    } catch (err) {
      console.error("Error saving scores:", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditScores = (session) => {
    if (!session) return;
    setEditScores({
      preScore: session.pre_test_score ?? "",
      postScore: session.post_test_score ?? "",
      preTotal: session.pre_test_total ?? "",
      postTotal: session.post_test_total ?? "",
    });
    setEditScoreSession(session);
  };

  const saveRawScores = async () => {
    if (!editScoreSession) return;
    setEditSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const preScore = Number(editScores.preScore);
      const postScore = Number(editScores.postScore);
      const preTotal = Number(editScores.preTotal);
      const postTotal = Number(editScores.postTotal);
      if (Number.isNaN(preScore) || Number.isNaN(postScore)) {
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from("evaluation")
        .select("evaluation_id")
        .eq("appointment_id", editScoreSession.appointment_id)
        .maybeSingle();
      if (existingError && existingError.code !== "PGRST116") throw existingError;

      const payload = {
        pre_test_score: preScore,
        post_test_score: postScore,
        pre_test_total: Number.isNaN(preTotal) ? null : preTotal,
        post_test_total: Number.isNaN(postTotal) ? null : postTotal,
      };

      if (existing?.evaluation_id) {
        const { error: updateError } = await supabase
          .from("evaluation")
          .update(payload)
          .eq("evaluation_id", existing.evaluation_id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("evaluation")
          .insert([
            {
              appointment_id: editScoreSession.appointment_id,
              tutor_id: editScoreSession.tutor_id,
              user_id: editScoreSession.user_id,
              ...payload,
            },
          ]);
        if (insertError) throw insertError;
      }

      await loadRows();
      setEditScoreSession(null);
    } catch (err) {
      console.error("Error saving scores:", err.message);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 py-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#181718]">My Tutees</h1>
        <p className="text-sm text-gray-500">
          Track pre/post test scores and improvement per tutee.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 min-h-0 sm:min-h-[calc(100vh-260px)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              MY TUTEES
            </h2>
            <p className="text-xs text-gray-500">
              Total Sessions: {allSessions.length} | Total Mastery:{" "}
              <span className="font-semibold text-green-600">
                {formatPercent(totalMastery)}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 sm:hidden">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Month</span>
              <input
                type="month"
                value={rawMonth}
                onChange={(e) => setRawMonth(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setRawPage(1);
                setRawModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
            >
              <span className="text-green-600 font-bold">
                {rawSessions.length}
              </span>
              View Sessions Test Result (Raw)
            </button>
          </div>
          <div className="hidden sm:flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Month</span>
              <input
                type="month"
                value={rawMonth}
                onChange={(e) => setRawMonth(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setRawPage(1);
                setRawModalOpen(true);
              }}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
            >
              <span className="text-green-600 font-bold">
                {rawSessions.length}
              </span>{" "}
              Sessions Test Result (Raw)
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutee, program, or session details"
            className="w-full sm:max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
            >
              <option value="tutee">Tutee</option>
              <option value="course">Program</option>
              <option value="improvement">Avg Improvement</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading tutees...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pagedTutees.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No tutees yet. End a session to add scores.
              </div>
            ) : (
              pagedTutees.map((tutee) => {
                const session = tutee.lastSession;
                if (!session) return null;
                const improvement = formatImprovement(
                  session.pre_test_score,
                  session.post_test_score,
                  session.pre_test_total
                );
                const tuteeMasteryValues = tutee.sessions
                  .map((item) =>
                    formatImprovement(
                      item.pre_test_score,
                      item.post_test_score,
                      item.pre_test_total
                    )
                  )
                  .filter((value) => value !== null);
                const tuteeMastery =
                  tuteeMasteryValues.length > 0
                    ? tuteeMasteryValues.reduce((sum, value) => sum + value, 0) /
                      tuteeMasteryValues.length
                    : 0;
                return (
                  <div
                    key={tutee.tutee_id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      {tutee.tutee_profile_image ? (
                        <img
                          src={tutee.tutee_profile_image}
                          alt={tutee.tutee_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-blue-700 font-bold">
                          {(tutee.tutee_name || "T").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base font-semibold text-gray-800">
                        {tutee.tutee_name}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {tutee.tutee_program}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tutee.sessions.length} sessions
                      </p>
                    </div>
                    <div className="w-full sm:w-40 rounded-lg border border-gray-200 bg-gray-50 p-2 sm:mt-0">
                      <div className="h-[72px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={tutee.sessions.slice(-10).map((item, idx) => ({
                              name: idx + 1,
                              pre: Number(item.pre_test_score) || 0,
                              post: Number(item.post_test_score) || 0,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="post"
                              name="Post-Test"
                              stroke="#0ea5e9"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="pre"
                              name="Pre-Test"
                              stroke="#94a3b8"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChartTutee(tutee)}
                        className="mt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View chart
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{session.date || "-"}</span>
                      <span>{session.start_time ? session.start_time.slice(0, 5) : ""}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{session.subject}</p>
                        <p className="text-xs text-gray-500">{session.topic}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p>
                          Pre:{" "}
                          {formatScoreWithTotal(
                            session.pre_test_score,
                            session.pre_test_total
                          )}
                        </p>
                        <p>
                          Post:{" "}
                          {formatScoreWithTotal(
                            session.post_test_score,
                            session.post_test_total
                          )}
                        </p>
                        <p
                          className={`font-semibold ${
                            improvement === null
                              ? "text-gray-400"
                              : improvement >= 0
                                ? "text-green-600"
                                : "text-orange-600"
                          }`}
                        >
                          {improvement === null
                            ? "-"
                            : `${improvement >= 0 ? "↑" : "↓"} ${Math.abs(improvement).toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelected({
                            ...session,
                            student_name: tutee.tutee_name,
                          })
                        }
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {session.pre_test_score == null && session.post_test_score == null
                          ? "Add scores"
                          : "Edit scores"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotesModal({ ...session, student_name: tutee.tutee_name })}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                      >
                        View notes
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSessionsModal(tutee)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      View all sessions
                    </button>
                  </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm text-gray-600">
            <button
              type="button"
              className={`px-3 py-1 rounded border ${
                currentPageSafe === 1
                  ? "text-gray-400 border-gray-200 cursor-not-allowed"
                  : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
              }`}
              disabled={currentPageSafe === 1}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {currentPageSafe} of {totalPages}
            </span>
            <button
              type="button"
              className={`px-3 py-1 rounded border ${
                currentPageSafe === totalPages
                  ? "text-gray-400 border-gray-200 cursor-not-allowed"
                  : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
              }`}
              disabled={currentPageSafe === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <AssessmentModal
        isOpen={Boolean(selected)}
        appointment={selected}
        isBusy={isSaving}
        defaultValues={{
          preScore: selected?.pre_test_score ?? "",
          postScore: selected?.post_test_score ?? "",
          preTotal: selected?.pre_test_total ?? "",
          postTotal: selected?.post_test_total ?? "",
          notes: selected?.tutor_notes ?? "",
        }}
        onClose={() => setSelected(null)}
        onSubmit={handleSaveScores}
        onLater={() => setSelected(null)}
      />

      {notesModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Tutor Notes</h3>
              <button
                type="button"
                onClick={() => setNotesModal(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close notes"
              >
                x
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {notesModal.student_name} - {notesModal.subject} - {notesModal.topic}
            </p>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {notesModal.tutor_notes
                ? notesModal.tutor_notes
                : "No notes provided yet."}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setNotesModal(null)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {chartTutee && (
        <div className="fixed inset-0 z-[75] flex items-start sm:items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  {chartTutee.tutee_name}
                </h3>
                <p className="text-xs text-gray-500">Last 10 sessions</p>
              </div>
              <button
                type="button"
                onClick={() => setChartTutee(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close chart"
              >
                x
              </button>
            </div>

            <div className="mt-5">
              <div className="relative mt-4 h-[260px] rounded-lg border border-gray-200 bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartTutee.sessions.slice(-10).map((item, idx) => ({
                      name: idx + 1,
                      pre: Number(item.pre_test_score) || 0,
                      post: Number(item.post_test_score) || 0,
                      preTotal: item.pre_test_total ?? "-",
                      postTotal: item.post_test_total ?? "-",
                      mastery:
                        formatImprovement(
                          item.pre_test_score,
                          item.post_test_score,
                          item.pre_test_total
                        ) || 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Legend />
                    <Tooltip />
                    <Bar dataKey="post" name="Post-Test" fill="#0ea5e9" />
                    <Bar dataKey="pre" name="Pre-Test" fill="#94a3b8" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {sessionsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl border border-gray-200 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">All Sessions</h3>
                <p className="text-xs text-gray-500">
                  {sessionsModal.tutee_name} - {sessionsModal.tutee_program}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSessionsModal(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close sessions"
              >
                x
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {sessionsModal.sessions.map((session) => {
                const improvement = formatImprovement(
                  session.pre_test_score,
                  session.post_test_score,
                  session.pre_test_total
                );
                return (
                  <div
                    key={session.appointment_id}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{session.date || "-"}</span>
                      <span>{session.start_time ? session.start_time.slice(0, 5) : ""}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{session.subject}</p>
                        <p className="text-xs text-gray-500">{session.topic}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p>
                          Pre:{" "}
                          {formatScoreWithTotal(
                            session.pre_test_score,
                            session.pre_test_total
                          )}
                        </p>
                        <p>
                          Post:{" "}
                          {formatScoreWithTotal(
                            session.post_test_score,
                            session.post_test_total
                          )}
                        </p>
                        <p
                          className={`font-semibold ${
                            improvement === null
                              ? "text-gray-400"
                              : improvement >= 0
                                ? "text-green-600"
                                : "text-orange-600"
                          }`}
                        >
                          {improvement === null
                            ? "-"
                            : `${improvement >= 0 ? "↑" : "↓"} ${Math.abs(improvement).toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelected({
                            ...session,
                            student_name: sessionsModal.tutee_name,
                          })
                        }
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {session.pre_test_score == null && session.post_test_score == null
                          ? "Add scores"
                          : "Edit scores"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setNotesModal({ ...session, student_name: sessionsModal.tutee_name })
                        }
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                      >
                        View notes
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSessionsModal(null)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {rawModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl border border-gray-200 max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-bold text-gray-800">
                  <span className="text-green-600 font-semibold">
                    {rawSessions.length}
                  </span>{" "}
                  Sessions Test Result (Raw)
                </h3>
              <button
                type="button"
                onClick={() => setRawModalOpen(false)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                aria-label="Close raw sessions"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[720px] sm:min-w-0">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Tutee</th>
                    <th className="text-left px-4 py-3">Subject</th>
                    <th className="text-left px-4 py-3">Specialization</th>
                    <th className="text-center px-4 py-3">Pre</th>
                    <th className="text-center px-4 py-3">Post</th>
                    <th className="text-center px-4 py-3">Avg Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {rawPagedSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        No sessions available.
                      </td>
                    </tr>
                  ) : (
                    rawPagedSessions.map((session) => {
                      const improvement = formatImprovement(
                        session.pre_test_score,
                        session.post_test_score,
                        session.pre_test_total
                      );
                      return (
                        <tr
                          key={session.appointment_id}
                          className="border-t border-gray-100"
                        >
                          <td className="px-4 py-3 text-left text-gray-600">
                            {session.date || "-"}
                          </td>
                          <td className="px-4 py-3 text-left text-gray-700">
                            {session.tutee_name || "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-left text-gray-700">
                            {session.subject || "-"}
                          </td>
                          <td className="px-4 py-3 text-left text-gray-600">
                            {session.topic || "-"}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            <button
                              type="button"
                              onClick={() => openEditScores(session)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                              {formatScoreWithTotal(
                                session.pre_test_score,
                                session.pre_test_total
                              ) === "-" ? (
                                <span className="inline-block h-4 w-6 rounded border border-gray-300 bg-white" />
                              ) : (
                                formatScoreWithTotal(
                                  session.pre_test_score,
                                  session.pre_test_total
                                )
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            <button
                              type="button"
                              onClick={() => openEditScores(session)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                              {formatScoreWithTotal(
                                session.post_test_score,
                                session.post_test_total
                              ) === "-" ? (
                                <span className="inline-block h-4 w-6 rounded border border-gray-300 bg-white" />
                              ) : (
                                formatScoreWithTotal(
                                  session.post_test_score,
                                  session.post_test_total
                                )
                              )}
                            </button>
                          </td>
                          <td
                            className={`px-4 py-3 text-center text-sm font-semibold ${
                              improvement === null || improvement >= 0
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}
                          >
                            {improvement === null
                              ? "+0.0%"
                              : `${improvement >= 0 ? "+" : "-"}${Math.abs(improvement).toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {rawTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm text-gray-600">
                <button
                  type="button"
                  className={`px-3 py-1 rounded border ${
                    rawPageSafe === 1
                      ? "text-gray-400 border-gray-200 cursor-not-allowed"
                      : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
                  }`}
                  disabled={rawPageSafe === 1}
                  onClick={() => setRawPage((prev) => Math.max(prev - 1, 1))}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {rawPageSafe} of {rawTotalPages}
                </span>
                <button
                  type="button"
                  className={`px-3 py-1 rounded border ${
                    rawPageSafe === rawTotalPages
                      ? "text-gray-400 border-gray-200 cursor-not-allowed"
                      : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
                  }`}
                  disabled={rawPageSafe === rawTotalPages}
                  onClick={() => setRawPage((prev) => Math.min(prev + 1, rawTotalPages))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {editScoreSession && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Update Scores</h3>
              <button
                type="button"
                onClick={() => setEditScoreSession(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close edit scores"
              >
                x
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {editScoreSession.tutee_name || "Tutee"} - {editScoreSession.subject}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Pre-Test</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={editScores.preScore}
                    onChange={(e) =>
                      setEditScores((prev) => ({ ...prev, preScore: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Score"
                    disabled={editSaving}
                  />
                  <input
                    type="number"
                    min="0"
                    value={editScores.preTotal}
                    onChange={(e) =>
                      setEditScores((prev) => ({ ...prev, preTotal: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Total"
                    disabled={editSaving}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Post-Test</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={editScores.postScore}
                    onChange={(e) =>
                      setEditScores((prev) => ({ ...prev, postScore: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Score"
                    disabled={editSaving}
                  />
                  <input
                    type="number"
                    min="0"
                    value={editScores.postTotal}
                    onChange={(e) =>
                      setEditScores((prev) => ({ ...prev, postTotal: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Total"
                    disabled={editSaving}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <LoadingButton
                type="button"
                onClick={() => setEditScoreSession(null)}
                disabled={editSaving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={saveRawScores}
                isLoading={editSaving}
                loadingText="Saving..."
                className="rounded-lg bg-[#132c91] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f1f6b]"
              >
                Save
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTutees;
