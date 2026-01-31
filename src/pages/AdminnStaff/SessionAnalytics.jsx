import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { useDataSync } from "../../contexts/DataSyncContext";
import LoadingButton from "../../components/LoadingButton";

const formatPercent = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "0%";

const computeImprovement = (pre, post, preTotal) => {
  const preNum = Number(pre);
  const postNum = Number(post);
  const totalNum = Number(preTotal);
  if (Number.isNaN(preNum) || Number.isNaN(postNum)) return null;
  if (Number.isFinite(totalNum) && totalNum > 0) {
    return ((postNum - preNum) / totalNum) * 100;
  }
  if (preNum === 0) return postNum > 0 ? 100 : 0;
  return ((postNum - preNum) / preNum) * 100;
};

const formatScoreWithTotal = (score, total) => {
  if (score === null || score === undefined || score === "") return "-";
  if (total === null || total === undefined || total === "") return `${score}`;
  return `${score}/${total}`;
};

const compareSessionsByDate = (a, b) => {
  const dateA = a?.date ? new Date(a.date) : null;
  const dateB = b?.date ? new Date(b.date) : null;
  if (dateA && dateB && !Number.isNaN(dateA.getTime()) && !Number.isNaN(dateB.getTime())) {
    return dateA - dateB;
  }
  const createdA = a?.created_at ? new Date(a.created_at) : null;
  const createdB = b?.created_at ? new Date(b.created_at) : null;
  if (createdA && createdB && !Number.isNaN(createdA.getTime()) && !Number.isNaN(createdB.getTime())) {
    return createdA - createdB;
  }
  return String(a?.date || "").localeCompare(String(b?.date || ""));
};

const SessionAnalytics = () => {
  const { version } = useDataSync();
  const [loading, setLoading] = useState(true);
  const [tutorRows, setTutorRows] = useState([]);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [notesModal, setNotesModal] = useState(null);
  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawPage, setRawPage] = useState(1);
  const [editScoreSession, setEditScoreSession] = useState(null);
  const [editScores, setEditScores] = useState({
    preScore: "",
    postScore: "",
    preTotal: "",
    postTotal: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
  const [activeSubject, setActiveSubject] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("rank");
  const cardsPerPage = 4;
  const subjectTabs = [
    "All",
    "Programming",
    "Chemistry",
    "Physics",
    "Calculus and Statistics",
    "Psychology and Language",
    "Engineering",
    "Accountancy and Economics",
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: tutors, error: tutorError } = await supabase
        .from("users")
        .select("user_id, name")
        .eq("role", "tutor");
      if (tutorError && tutorError.code !== "PGRST116") throw tutorError;

      const tutorIds = Array.from(
        new Set((tutors || []).map((item) => item.user_id).filter(Boolean))
      );
      let appointmentList = [];
      if (tutorIds.length) {
        const { data: appointments, error: appointmentError } = await supabase
          .from("appointment")
          .select(
            `
            appointment_id,
            tutor_id,
            user_id,
            subject,
            topic,
            date,
            status,
            student:users!appointment_user_id_fkey(name)
          `
          )
          .in("tutor_id", tutorIds);
        if (appointmentError && appointmentError.code !== "PGRST116") throw appointmentError;
        appointmentList = (appointments || []).filter((appointment) =>
          ["completed", "awaiting_feedback"].includes(appointment.status)
        );
      }

      const appointmentIds = Array.from(
        new Set(appointmentList.map((item) => item.appointment_id).filter(Boolean))
      );

      let evaluationMap = {};
      if (appointmentIds.length) {
        const { data: evaluations, error: evaluationError } = await supabase
          .from("evaluation")
          .select(
            "evaluation_id, appointment_id, tutor_id, pre_test_score, post_test_score, pre_test_total, post_test_total, tutor_notes, created_at"
          )
          .in("appointment_id", appointmentIds);
        if (evaluationError && evaluationError.code !== "PGRST116") throw evaluationError;
        evaluationMap = (evaluations || []).reduce((acc, item) => {
          acc[item.appointment_id] = item;
          return acc;
        }, {});
      }

      let tutorMap = {};
      tutorMap = (tutors || []).reduce((acc, item) => {
        acc[item.user_id] = item.name || "Unknown";
        return acc;
      }, {});

      let profileMap = {};
      if (tutorIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profile")
          .select("user_id, profile_image, subject")
          .in("user_id", tutorIds);
        if (profileError && profileError.code !== "PGRST116") throw profileError;
        profileMap = (profiles || []).reduce((acc, item) => {
          acc[item.user_id] = {
            profile_image: item.profile_image || "",
            subject: item.subject || "",
          };
          return acc;
        }, {});
      }

      const appointmentMetaMap = appointmentList.reduce((acc, item) => {
        acc[item.appointment_id] = {
          user_id: item.user_id || "",
          subject: item.subject || "Unknown",
          topic: item.topic || "-",
          date: item.date || null,
          student_name: item.student?.name || "Unknown",
        };
        return acc;
      }, {});

      const grouped = new Map();
      tutorIds.forEach((tutorId) => {
        grouped.set(tutorId, {
          tutor_id: tutorId,
          tutor_name: tutorMap[tutorId] || "Unknown",
          tutor_image: profileMap[tutorId]?.profile_image || "",
          tutor_subject: profileMap[tutorId]?.subject || "",
          sessions: [],
        });
      });
      appointmentList.forEach((appointment) => {
        const tutorId = appointment.tutor_id || "unknown";
        if (!grouped.has(tutorId)) {
          grouped.set(tutorId, {
            tutor_id: tutorId,
            tutor_name: tutorMap[tutorId] || "Unknown",
            tutor_image: profileMap[tutorId]?.profile_image || "",
            tutor_subject: profileMap[tutorId]?.subject || "",
            sessions: [],
          });
        }
        const meta = appointmentMetaMap[appointment.appointment_id] || {};
        const evaluation = evaluationMap[appointment.appointment_id] || {};
        grouped.get(tutorId).sessions.push({
          ...evaluation,
          appointment_id: appointment.appointment_id,
          tutor_id: appointment.tutor_id,
          user_id: meta.user_id,
          subject: meta.subject || "Unknown",
          topic: meta.topic || "-",
          date: meta.date || null,
          student_name: meta.student_name || "Unknown",
        });
      });

      const rows = Array.from(grouped.values()).map((tutor) => {
        const sortedSessions = [...tutor.sessions].sort(compareSessionsByDate);
        const improvements = tutor.sessions
          .map((session) =>
            computeImprovement(
              session.pre_test_score,
              session.post_test_score,
              session.pre_test_total
            )
          )
          .filter((value) => value !== null);
        const averageGain =
          improvements.length > 0
            ? improvements.reduce((sum, value) => sum + value, 0) /
              improvements.length
            : 0;
        return {
          ...tutor,
          sessions: sortedSessions,
          totalSessions: tutor.sessions.length,
          averageGain,
        };
      });

      setTutorRows(rows);
    } catch (err) {
      console.error("Error loading session analytics:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [version]);

  const leaderboard = useMemo(() => {
    return [...tutorRows].sort((a, b) => b.averageGain - a.averageGain);
  }, [tutorRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSubject, searchQuery, sortKey]);

  const filteredLeaderboard = useMemo(() => {
    const scopedRows =
      activeSubject === "All"
        ? leaderboard
        : leaderboard.filter((row) => row.tutor_subject === activeSubject);
    const withStats = scopedRows.map((row) => {
      const subjectSessions =
        activeSubject === "All"
          ? row.sessions
          : row.sessions.filter((session) => session.subject === activeSubject);
      const sortedSubjectSessions = [...subjectSessions].sort(compareSessionsByDate);
      const improvements = subjectSessions
        .map((session) =>
          computeImprovement(
            session.pre_test_score,
            session.post_test_score,
            session.pre_test_total
          )
        )
        .filter((value) => value !== null);
      const hasScores = subjectSessions.some((session) => {
        const pre = Number(session.pre_test_score);
        const post = Number(session.post_test_score);
        return Number.isFinite(pre) && Number.isFinite(post);
      });
      const averageGain =
        improvements.length > 0
          ? improvements.reduce((sum, value) => sum + value, 0) /
            improvements.length
          : 0;
      return {
        ...row,
        effectiveSessions: subjectSessions.length,
        effectiveAverageGain: averageGain,
        effectiveHasScores: hasScores,
        effectiveLastSession:
          sortedSubjectSessions[sortedSubjectSessions.length - 1] || null,
      };
    });
    const sorted = [...withStats].sort((a, b) => b.effectiveAverageGain - a.effectiveAverageGain);
    const normalized = searchQuery.trim().toLowerCase();
    const searched = normalized
      ? sorted.filter((row) => {
          const sessionText = (activeSubject === "All"
            ? row.sessions
            : row.sessions.filter((session) => session.subject === activeSubject))
            .map(
              (session) =>
                `${session.subject} ${session.topic || ""} ${session.tutor_notes || ""} ${
                  session.student_name || ""
                }`
            )
            .join(" ")
            .toLowerCase();
          const haystack = `${row.tutor_name} ${row.tutor_subject || ""} ${sessionText}`.toLowerCase();
          return haystack.includes(normalized);
        })
      : sorted;
    const sortedByKey = [...searched];
    sortedByKey.sort((a, b) => {
      if (sortKey === "tutor") return a.tutor_name.localeCompare(b.tutor_name);
      if (sortKey === "sessions") return b.effectiveSessions - a.effectiveSessions;
      if (sortKey === "avg") return b.effectiveAverageGain - a.effectiveAverageGain;
      return b.effectiveAverageGain - a.effectiveAverageGain;
    });
    return sortedByKey;
  }, [leaderboard, activeSubject, searchQuery, sortKey]);

  const rankMap = useMemo(() => {
    const ranked = [...filteredLeaderboard]
      .filter((row) => row.effectiveHasScores)
      .sort((a, b) => b.effectiveAverageGain - a.effectiveAverageGain);
    const map = {};
    let currentRank = 0;
    let lastGain = null;
    ranked.forEach((row, index) => {
      if (lastGain === null || row.effectiveAverageGain !== lastGain) {
        currentRank = index + 1;
        lastGain = row.effectiveAverageGain;
      }
      map[row.tutor_id] = currentRank;
    });
    return map;
  }, [filteredLeaderboard]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaderboard.length / cardsPerPage));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStartIndex = (currentPageSafe - 1) * cardsPerPage;
  const pagedLeaderboard = filteredLeaderboard.slice(
    pageStartIndex,
    currentPageSafe * cardsPerPage
  );

  const rawSessions = useMemo(() => {
    const items = [];
    tutorRows.forEach((tutor) => {
      (tutor.sessions || []).forEach((session) => {
        if (activeSubject !== "All" && session.subject !== activeSubject) return;
        if (selectedMonth) {
          if (!session.date) return;
          const dateValue = new Date(session.date);
          if (Number.isNaN(dateValue.getTime())) return;
          const monthValue = `${dateValue.getFullYear()}-${String(
            dateValue.getMonth() + 1
          ).padStart(2, "0")}`;
          if (monthValue !== selectedMonth) return;
        }
        items.push({
          ...session,
          tutor_name: tutor.tutor_name,
        });
      });
    });
    return items.sort(compareSessionsByDate);
  }, [tutorRows, activeSubject, selectedMonth]);

  const rawTotalPages = Math.max(1, Math.ceil(rawSessions.length / 6));
  const rawPageSafe = Math.min(Math.max(rawPage, 1), rawTotalPages);
  const rawPagedSessions = rawSessions.slice((rawPageSafe - 1) * 6, rawPageSafe * 6);

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

      await loadData();
      setEditScoreSession(null);
    } catch (err) {
      console.error("Error saving scores:", err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const selectedSessions = useMemo(() => {
    if (!selectedTutor) return [];
    const sessions =
      activeSubject === "All"
        ? selectedTutor.sessions
        : selectedTutor.sessions.filter((session) => session.subject === activeSubject);
    return [...sessions].sort(compareSessionsByDate);
  }, [selectedTutor, activeSubject]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-[20px] md:text-[24px] font-bold text-gray-600">
          Session Analytics
        </h1>
        <p className="text-sm text-gray-500">
          Track tutor effectiveness using pre- and post-test scores.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading analytics...</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 min-h-[calc(100vh-260px)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                ADMIN: TUTOR EFFECTIVENESS LEADERBOARD
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Month</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRawPage(1);
                    setRawModalOpen(true);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  {rawSessions.length} Sessions Test Result (Raw)
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {subjectTabs.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => setActiveSubject(subject)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    activeSubject === subject
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tutor or tutee"
                className="w-full sm:max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Sort by</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="rank">Rank</option>
                  <option value="tutor">Tutor</option>
                  <option value="sessions">Sessions</option>
                  <option value="avg">Avg Gain</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {pagedLeaderboard.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                  No tutors available.
                </div>
              ) : (
                pagedLeaderboard.map((row, index) => {
                  const percentage = Math.min(Math.max(row.effectiveAverageGain, 0), 100);
                  const barColor =
                    percentage >= 70
                      ? "bg-green-500"
                      : percentage >= 40
                        ? "bg-yellow-400"
                        : "bg-red-400";
                  const lastSession = row.effectiveLastSession;
                  const lastImprovement = lastSession
                    ? computeImprovement(
                        lastSession.pre_test_score,
                        lastSession.post_test_score,
                        lastSession.pre_test_total
                      )
                    : null;
                  return (
                    <div
                      key={row.tutor_id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                          {row.tutor_image ? (
                            <img
                              src={row.tutor_image}
                              alt={row.tutor_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-blue-700 font-bold">
                              {(row.tutor_name || "T").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {row.effectiveHasScores && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                #{rankMap[row.tutor_id]}
                              </span>
                            )}
                            {activeSubject === "All" && (row.tutor_subject || lastSession?.subject) && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                {row.tutor_subject || lastSession?.subject}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-gray-800">
                            {row.tutor_name}
                          </h3>
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          <span className="text-sm font-semibold text-gray-800">
                            {row.effectiveSessions}
                          </span>{" "}
                          sessions
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{lastSession?.date || "-"}</span>
                          <span>{formatPercent(row.effectiveAverageGain)} avg gain</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {lastSession?.subject || "No session at the moment"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {lastSession?.topic || "-"}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p>
                              Pre:{" "}
                              {formatScoreWithTotal(
                                lastSession?.pre_test_score,
                                lastSession?.pre_test_total
                              )}
                            </p>
                            <p>
                              Post:{" "}
                              {formatScoreWithTotal(
                                lastSession?.post_test_score,
                                lastSession?.post_test_total
                              )}
                            </p>
                            <p
                              className={`font-semibold ${
                                lastImprovement === null || lastImprovement >= 0
                                  ? "text-green-600"
                                  : "text-orange-600"
                              }`}
                            >
                              {lastImprovement === null
                                ? "+0.0%"
                                : `${lastImprovement >= 0 ? "+" : "-"}${Math.abs(lastImprovement).toFixed(1)}%`}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setNotesModal({
                                tutor_name: row.tutor_name,
                                subject: lastSession?.subject || "-",
                                topic: lastSession?.topic || "-",
                                notes: lastSession?.tutor_notes || "",
                              })
                            }
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                          >
                            View notes
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedTutor(row)}
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
          </div>
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

          {selectedTutor && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
              <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl border border-gray-200 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {selectedTutor.tutor_name} Sessions
                    </h3>
                    <p className="text-xs text-gray-500">
                      {activeSubject === "All" ? "All subjects" : activeSubject}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTutor(null)}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Close sessions"
                  >
                    x
                  </button>
                </div>

                <div className="mt-4">
                  <div className="rounded-lg border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px] sm:min-w-0">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Tutee</th>
                          <th className="text-left px-4 py-3">Subject</th>
                          <th className="text-left px-4 py-3">Specialization</th>
                          <th className="text-center px-4 py-3">Pre</th>
                          <th className="text-center px-4 py-3">Post</th>
                          <th className="text-center px-4 py-3">Avg Gain</th>
                          <th className="text-center px-4 py-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSessions.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-6 text-center text-sm text-gray-500"
                            >
                              No sessions available for this tutor.
                            </td>
                          </tr>
                        ) : (
                          selectedSessions.map((session) => {
                            const improvement = computeImprovement(
                              session.pre_test_score,
                              session.post_test_score,
                              session.pre_test_total
                            );
                            return (
                              <tr
                                key={session.appointment_id || session.evaluation_id}
                                className="border-t border-gray-100"
                              >
                                <td className="px-4 py-3 text-left text-gray-600">
                                  {session.date || "-"}
                                </td>
                                <td className="px-4 py-3 text-left text-gray-600">
                                  {session.student_name || "Unknown"}
                                </td>
                                <td className="px-4 py-3 text-left text-gray-700">
                                  {session.subject}
                                </td>
                                <td className="px-4 py-3 text-left text-gray-600">
                                  {session.topic || "-"}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                  {formatScoreWithTotal(
                                    session.pre_test_score,
                                    session.pre_test_total
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                  {formatScoreWithTotal(
                                    session.post_test_score,
                                    session.post_test_total
                                  )}
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
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNotesModal({
                                        tutor_name: selectedTutor.tutor_name,
                                        subject: session.subject,
                                        topic: session.topic,
                                        notes: session.tutor_notes || "",
                                      })
                                    }
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTutor(null)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

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
                  {notesModal.tutor_name} - {notesModal.subject} - {notesModal.topic}
                </p>
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {notesModal.notes ? notesModal.notes : "No notes provided yet."}
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

          {rawModalOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4">
              <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl border border-gray-200 max-h-[85vh] overflow-y-auto">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-gray-800">
                    {rawSessions.length} Sessions Test Result (Raw)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRawModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Close raw sessions"
                  >
                    x
                  </button>
                </div>

                <div className="mt-4 rounded-lg border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px] sm:min-w-0">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Tutor</th>
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
                            colSpan={8}
                            className="px-4 py-6 text-center text-sm text-gray-500"
                          >
                            No sessions available.
                          </td>
                        </tr>
                      ) : (
                        rawPagedSessions.map((session) => {
                          const improvement = computeImprovement(
                            session.pre_test_score,
                            session.post_test_score,
                            session.pre_test_total
                          );
                          return (
                            <tr
                              key={session.evaluation_id || session.appointment_id}
                              className="border-t border-gray-100"
                            >
                              <td className="px-4 py-3 text-left text-gray-600">
                                {session.date || "-"}
                              </td>
                              <td className="px-4 py-3 text-left text-gray-700">
                                {session.tutor_name || "Unknown"}
                              </td>
                              <td className="px-4 py-3 text-left text-gray-600">
                                {session.student_name || "Unknown"}
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
                  {editScoreSession.tutor_name || "Tutor"} - {editScoreSession.subject}
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
      )}
    </div>
  );
};

export default SessionAnalytics;

