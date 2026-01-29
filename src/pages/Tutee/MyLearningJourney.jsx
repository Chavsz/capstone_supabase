import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { useDataSync } from "../../contexts/DataSyncContext";

const formatImprovement = (preScore, postScore) => {
  const pre = Number(preScore);
  const post = Number(postScore);
  if (Number.isNaN(pre) || Number.isNaN(post) || pre === 0) {
    if (post > 0 && pre === 0) return 100;
    return null;
  }
  return ((post - pre) / pre) * 100;
};

const MyLearningJourney = () => {
  const { version } = useDataSync();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [notesModal, setNotesModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("tutor");

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
          tutor:users!appointment_tutor_id_fkey(name)
        `
        )
        .eq("user_id", session.user.id)
        .in("status", ["awaiting_feedback", "completed"]);

      if (error) throw error;

      const appointmentList = appointments || [];
      const appointmentIds = appointmentList.map((item) => item.appointment_id);

      let evaluationMap = {};
      if (appointmentIds.length) {
        const { data: evaluations, error: evalError } = await supabase
          .from("evaluation")
          .select("appointment_id, pre_test_score, post_test_score, tutor_notes")
          .in("appointment_id", appointmentIds);
        if (evalError) throw evalError;
        evaluationMap = (evaluations || []).reduce((acc, item) => {
          acc[item.appointment_id] = item;
          return acc;
        }, {});
      }

      const merged = appointmentList.map((appointment) => {
        const evaluation = evaluationMap[appointment.appointment_id] || {};
        return {
          appointment_id: appointment.appointment_id,
          tutor_name: appointment.tutor?.name || "Unknown",
          subject: appointment.subject || "-",
          topic: appointment.topic || "-",
          pre_test_score: evaluation.pre_test_score ?? null,
          post_test_score: evaluation.post_test_score ?? null,
          tutor_notes: evaluation.tutor_notes ?? "",
        };
      });

      setRows(merged);
    } catch (err) {
      console.error("Error loading learning journey:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [version]);

  const filteredRows = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => {
      const haystack = `${row.tutor_name} ${row.subject} ${row.topic} ${row.tutor_notes || ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      if (sortKey === "course") return a.subject.localeCompare(b.subject);
      if (sortKey === "topic") return a.topic.localeCompare(b.topic);
      if (sortKey === "improvement") {
        const aImp = formatImprovement(a.pre_test_score, a.post_test_score);
        const bImp = formatImprovement(b.pre_test_score, b.post_test_score);
        if (aImp == null && bImp == null) return 0;
        if (aImp == null) return 1;
        if (bImp == null) return -1;
        return bImp - aImp;
      }
      return a.tutor_name.localeCompare(b.tutor_name);
    });
    return list;
  }, [filteredRows, sortKey]);

  return (
    <div className="min-h-screen px-6 py-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#181718]">My Learning Journey</h1>
        <p className="text-sm text-gray-500">
          Track your pre/post test scores and improvement per tutor.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tutor, course, topic, or notes"
          className="w-full sm:max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Sort by</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="tutor">Tutor</option>
            <option value="course">Course</option>
            <option value="topic">Topic</option>
            <option value="improvement">Avg Improvement</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading journey...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1.2fr_0.9fr_1fr_0.8fr_0.9fr_0.9fr_140px] gap-2 px-4 py-3 text-xs font-semibold uppercase text-gray-500 bg-gray-50">
            <span>Tutor</span>
            <span>Course</span>
            <span>Topic</span>
            <span>Pre Test</span>
            <span>Post Test</span>
            <span>Avg Improvement</span>
            <span className="text-right">Tutor Notes</span>
          </div>
          {sortedRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No records yet.
            </div>
          ) : (
            sortedRows.map((row) => {
              const improvement = formatImprovement(
                row.pre_test_score,
                row.post_test_score
              );
              return (
                <div
                  key={row.appointment_id}
                  className="grid grid-cols-[1.2fr_0.9fr_1fr_0.8fr_0.9fr_0.9fr_140px] gap-2 px-4 py-3 text-sm text-gray-700 border-t border-gray-100 items-center"
                >
                  <span className="font-semibold text-gray-800">
                    {row.tutor_name}
                  </span>
                  <span>{row.subject}</span>
                  <span>{row.topic}</span>
                  <span>{row.pre_test_score ?? "-"}</span>
                  <span>{row.post_test_score ?? "-"}</span>
                  <span
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
                  </span>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setNotesModal(row)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {notesModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Tutor Notes</h3>
              <button
                type="button"
                onClick={() => setNotesModal(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close notes"
              >
                ×
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {notesModal.tutor_name} · {notesModal.subject} · {notesModal.topic}
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
    </div>
  );
};

export default MyLearningJourney;
