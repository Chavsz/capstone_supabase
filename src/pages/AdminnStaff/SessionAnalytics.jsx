import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { useDataSync } from "../../contexts/DataSyncContext";
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
  if (total === null || total === undefined || total === "") return `${score}/-`;
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tutorRows, setTutorRows] = useState([]);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [chartTutor, setChartTutor] = useState(null);
  const [chartPage, setChartPage] = useState(1);
  const [notesModal, setNotesModal] = useState(null);
  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawPage, setRawPage] = useState(1);
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

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
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
      if (!hasLoaded) setHasLoaded(true);
    } catch (err) {
      console.error("Error loading session analytics:", err.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(!hasLoaded);
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


  const selectedSessions = useMemo(() => {
    const baseTutor = selectedTutor || chartTutor;
    if (!baseTutor) return [];
    const sessions =
      activeSubject === "All"
        ? baseTutor.sessions
        : baseTutor.sessions.filter((session) => session.subject === activeSubject);
    return [...sessions].sort(compareSessionsByDate);
  }, [selectedTutor, chartTutor, activeSubject]);

  const chartTotalPages = Math.max(1, Math.ceil(selectedSessions.length / 10));
  const chartPageSafe = Math.min(Math.max(chartPage, 1), chartTotalPages);
  const chartSessions = selectedSessions.slice(
    (chartPageSafe - 1) * 10,
    chartPageSafe * 10
  );

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
                  <span className="text-green-600 font-bold">
                    {rawSessions.length}
                  </span>{" "}
                  Sessions Test Result (Raw)
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
                  const subjectSessions =
                    activeSubject === "All"
                      ? row.sessions
                      : row.sessions.filter((session) => session.subject === activeSubject);
                  const chartData = subjectSessions.slice(-6).map((session, idx) => ({
                    name: idx + 1,
                    pre: Number(session.pre_test_score) || 0,
                    post: Number(session.post_test_score) || 0,
                  }));
                  return (
                    <div
                      key={row.tutor_id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
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
                          <div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              {row.effectiveHasScores && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                  #{rankMap[row.tutor_id]}
                                </span>
                              )}
                              {activeSubject === "All" && row.tutor_subject && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  {row.tutor_subject}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-semibold text-gray-800">
                              {row.tutor_name}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {row.effectiveSessions} sessions | Total Mastery:{" "}
                              <span className="font-semibold text-green-600">
                                {formatPercent(row.effectiveAverageGain)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="w-40 rounded-lg border border-gray-200 bg-gray-50 p-2">
                          <div className="h-[72px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <Line
                                  type="monotone"
                                  dataKey="pre"
                                  stroke="#94a3b8"
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="post"
                                  stroke="#0ea5e9"
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-2 flex items-center justify-end text-[11px] text-gray-500">
                            <button
                              type="button"
                              onClick={() => {
                                setChartTutor(row);
                                setChartPage(1);
                              }}
                              className="font-semibold text-blue-600 hover:text-blue-800"
                            >
                              View chart
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{row.effectiveLastSession?.date || "-"}</span>
                          <span>
                            {row.effectiveLastSession?.start_time
                              ? row.effectiveLastSession.start_time.slice(0, 5)
                              : ""}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {row.effectiveLastSession?.subject || "No session at the moment"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {row.effectiveLastSession?.topic || "-"}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p>
                              Pre:{" "}
                              {formatScoreWithTotal(
                                row.effectiveLastSession?.pre_test_score,
                                row.effectiveLastSession?.pre_test_total
                              )}
                            </p>
                            <p>
                              Post:{" "}
                              {formatScoreWithTotal(
                                row.effectiveLastSession?.post_test_score,
                                row.effectiveLastSession?.post_test_total
                              )}
                            </p>
                            <p className="text-green-600 font-semibold">+0.0%</p>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setNotesModal({
                                tutor_name: row.tutor_name,
                                subject: row.effectiveLastSession?.subject || "-",
                                topic: row.effectiveLastSession?.topic || "-",
                                notes: row.effectiveLastSession?.tutor_notes || "",
                              })
                            }
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                          >
                            View notes
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTutor(row)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            View all sessions
                          </button>
                        </div>
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
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      {selectedTutor.tutor_image ? (
                        <img
                          src={selectedTutor.tutor_image}
                          alt={selectedTutor.tutor_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-blue-700 font-bold">
                          {(selectedTutor.tutor_name || "T").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-800">
                        {selectedTutor.tutor_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {activeSubject === "All" ? "All subjects" : activeSubject} sessions
                      </p>
                    </div>
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
                        <th className="text-center px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSessions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
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
                                {session.subject || "-"}
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
                    <span className="text-green-600 font-semibold">
                      {rawSessions.length}
                    </span>{" "}
                    Sessions Test Result (Raw)
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
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">
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

          {chartTutor && (
            <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/30 px-4">
              <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">
                      {chartTutor.tutor_name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {activeSubject === "All" ? "All subjects" : activeSubject} comparison
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChartTutor(null)}
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
                        data={chartSessions.map((session, idx) => ({
                          name: `Session ${(chartPageSafe - 1) * 10 + idx + 1}`,
                          pre: Number(session.pre_test_score) || 0,
                          post: Number(session.post_test_score) || 0,
                          mastery: computeImprovement(
                            session.pre_test_score,
                            session.post_test_score,
                            session.pre_test_total
                          ) || 0,
                        }))}
                        margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="pre" fill="#9ca3af" name="Pre-Test" />
                        <Bar dataKey="post" fill="#0ea5e9" name="Post-Test" />
                        <Line
                          type="monotone"
                          dataKey="mastery"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          name="Mastery"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {chartTotalPages > 1 && (
                    <div className="mt-4 flex items-center justify-end gap-2 text-sm text-gray-600">
                      <button
                        type="button"
                        className={`px-3 py-1 rounded border ${
                          chartPageSafe === 1
                            ? "text-gray-400 border-gray-200 cursor-not-allowed"
                            : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
                        }`}
                        disabled={chartPageSafe === 1}
                        onClick={() => setChartPage((prev) => Math.max(prev - 1, 1))}
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-500">
                        Page {chartPageSafe} of {chartTotalPages}
                      </span>
                      <button
                        type="button"
                        className={`px-3 py-1 rounded border ${
                          chartPageSafe === chartTotalPages
                            ? "text-gray-400 border-gray-200 cursor-not-allowed"
                            : "text-[#6b5b2e] border-[#d9c98a] hover:border-[#181718]"
                        }`}
                        disabled={chartPageSafe === chartTotalPages}
                        onClick={() => setChartPage((prev) => Math.min(prev + 1, chartTotalPages))}
                      >
                        Next
                      </button>
                    </div>
                  )}
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

