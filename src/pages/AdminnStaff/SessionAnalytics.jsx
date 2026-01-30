import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { useDataSync } from "../../contexts/DataSyncContext";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatPercent = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "0%";

const computeImprovement = (pre, post) => {
  const preNum = Number(pre);
  const postNum = Number(post);
  if (Number.isNaN(preNum) || Number.isNaN(postNum)) return null;
  if (preNum === 0) return postNum > 0 ? 100 : 0;
  return ((postNum - preNum) / preNum) * 100;
};

const SessionAnalytics = () => {
  const { version } = useDataSync();
  const [loading, setLoading] = useState(true);
  const [tutorRows, setTutorRows] = useState([]);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [detailOrder, setDetailOrder] = useState("first");
  const [activeSubject, setActiveSubject] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 4;

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: evaluations, error } = await supabase
        .from("evaluation")
        .select(
          "evaluation_id, appointment_id, tutor_id, pre_test_score, post_test_score, created_at"
        )
        .order("created_at", { ascending: true });

      if (error) throw error;

      const tutorIds = Array.from(
        new Set((evaluations || []).map((item) => item.tutor_id).filter(Boolean))
      );
      const appointmentIds = Array.from(
        new Set((evaluations || []).map((item) => item.appointment_id).filter(Boolean))
      );

      let tutorMap = {};
      if (tutorIds.length) {
        const { data: tutors, error: tutorError } = await supabase
          .from("users")
          .select("user_id, name")
          .in("user_id", tutorIds);
        if (tutorError && tutorError.code !== "PGRST116") throw tutorError;
        tutorMap = (tutors || []).reduce((acc, item) => {
          acc[item.user_id] = item.name || "Unknown";
          return acc;
        }, {});
      }

      let appointmentMetaMap = {};
      if (appointmentIds.length) {
        const { data: appointments, error: appointmentError } = await supabase
          .from("appointment")
          .select("appointment_id, subject, date")
          .in("appointment_id", appointmentIds);
        if (appointmentError && appointmentError.code !== "PGRST116") throw appointmentError;
        appointmentMetaMap = (appointments || []).reduce((acc, item) => {
          acc[item.appointment_id] = {
            subject: item.subject || "Unknown",
            date: item.date || null,
          };
          return acc;
        }, {});
      }

      const grouped = new Map();
      (evaluations || []).forEach((item) => {
        const tutorId = item.tutor_id || "unknown";
        if (!grouped.has(tutorId)) {
          grouped.set(tutorId, {
            tutor_id: tutorId,
            tutor_name: tutorMap[tutorId] || "Unknown",
            sessions: [],
          });
        }
        const meta = appointmentMetaMap[item.appointment_id] || {};
        grouped.get(tutorId).sessions.push({
          ...item,
          subject: meta.subject || "Unknown",
          date: meta.date || null,
        });
      });

      const rows = Array.from(grouped.values()).map((tutor) => {
        const sortedSessions = [...tutor.sessions].sort((a, b) =>
          String(a.date || "").localeCompare(String(b.date || ""))
        );
        const improvements = tutor.sessions
          .map((session) =>
            computeImprovement(session.pre_test_score, session.post_test_score)
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
      if (!selectedTutor && rows.length) {
        setSelectedTutor(rows[0]);
      } else if (selectedTutor) {
        const next = rows.find((row) => row.tutor_id === selectedTutor.tutor_id);
        setSelectedTutor(next || rows[0] || null);
      }
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

  const subjects = useMemo(() => {
    const set = new Set(["all"]);
    tutorRows.forEach((row) => {
      row.sessions.forEach((session) => {
        set.add(session.subject || "Unknown");
      });
    });
    return Array.from(set);
  }, [tutorRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSubject]);

  const filteredLeaderboard = useMemo(() => {
    const withStats = leaderboard.map((row) => {
      const subjectSessions =
        activeSubject === "all"
          ? row.sessions
          : row.sessions.filter((session) => session.subject === activeSubject);
      const improvements = subjectSessions
        .map((session) =>
          computeImprovement(session.pre_test_score, session.post_test_score)
        )
        .filter((value) => value !== null);
      const averageGain =
        improvements.length > 0
          ? improvements.reduce((sum, value) => sum + value, 0) /
            improvements.length
          : 0;
      return {
        ...row,
        effectiveSessions: subjectSessions.length,
        effectiveAverageGain: averageGain,
        effectiveLastSession: subjectSessions[subjectSessions.length - 1] || null,
      };
    });
    const filtered = activeSubject === "all"
      ? withStats
      : withStats.filter((row) => row.effectiveSessions > 0);
    filtered.sort((a, b) => b.effectiveAverageGain - a.effectiveAverageGain);
    return filtered;
  }, [leaderboard, activeSubject]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaderboard.length / cardsPerPage));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const pagedLeaderboard = filteredLeaderboard.slice(
    (currentPageSafe - 1) * cardsPerPage,
    currentPageSafe * cardsPerPage
  );

  const chartData = useMemo(() => {
    if (!selectedTutor) return [];
    const sessions = detailOrder === "last"
      ? [...selectedTutor.sessions].slice().reverse()
      : selectedTutor.sessions;
    return sessions.map((session, index) => ({
      name: `Session ${index + 1}`,
      pre: Number(session.pre_test_score) || 0,
      post: Number(session.post_test_score) || 0,
    }));
  }, [selectedTutor, detailOrder]);

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
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              ADMIN: TUTOR EFFECTIVENESS LEADERBOARD
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {subjects.map((subject) => (
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
            <div className="space-y-3">
              {pagedLeaderboard.length === 0 ? (
                <div className="text-sm text-gray-500">No evaluation data yet.</div>
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
                  return (
                    <div
                      key={row.tutor_id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="text-xs font-semibold text-gray-500 w-6">
                        {((currentPageSafe - 1) * cardsPerPage) + index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                          <span className="flex items-center gap-2">
                            {row.tutor_name}
                            {activeSubject === "all" && lastSession?.subject && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                {lastSession.subject}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            {row.effectiveSessions} sessions
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-gray-200">
                          <div
                            className={`h-2 rounded-full ${barColor}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Last session:{" "}
                          {lastSession
                            ? `${lastSession.subject} (Pre ${lastSession.pre_test_score ?? "-"} / Post ${lastSession.post_test_score ?? "-"})`
                            : "None"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 w-12 text-right">
                        {formatPercent(row.effectiveAverageGain)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTutor(row);
                          setDetailOrder("first");
                        }}
                        className="text-xs font-semibold px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:text-gray-700"
                      >
                        View Details
                      </button>
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
              <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700">
                      ADMIN: DETAILED IMPACT ANALYSIS
                    </h2>
                    <p className="text-xs text-gray-500">
                      {selectedTutor.tutor_name}: Pre vs. Post Comparison
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTutor(null)}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Close details"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Order</span>
                  <select
                    value={detailOrder}
                    onChange={(e) => setDetailOrder(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="first">First → Last</option>
                    <option value="last">Last → First</option>
                  </select>
                </div>

                <div className="mt-4">
                  {chartData.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      No sessions available for this tutor.
                    </div>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="pre" fill="#9ca3af" name="Pre-Test" />
                          <Bar dataKey="post" fill="#0ea5e9" name="Post-Test" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
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
        </div>
      )}
    </div>
  );
};

export default SessionAnalytics;
