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
        grouped.get(tutorId).sessions.push(item);
      });

      const rows = Array.from(grouped.values()).map((tutor) => {
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
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <div className="text-sm text-gray-500">No evaluation data yet.</div>
              ) : (
                leaderboard.map((row) => {
                  const percentage = Math.min(Math.max(row.averageGain, 0), 100);
                  const barColor =
                    percentage >= 70
                      ? "bg-green-500"
                      : percentage >= 40
                        ? "bg-yellow-400"
                        : "bg-red-400";
                  return (
                    <div
                      key={row.tutor_id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                          <span>{row.tutor_name}</span>
                          <span className="text-xs text-gray-500">
                            {row.totalSessions} sessions
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-gray-200">
                          <div
                            className={`h-2 rounded-full ${barColor}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 w-12 text-right">
                        {formatPercent(row.averageGain)}
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
