import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { useDataSync } from "../../contexts/DataSyncContext";

const formatPercent = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "0%";

const computeImprovement = (pre, post) => {
  const preNum = Number(pre);
  const postNum = Number(post);
  if (Number.isNaN(preNum) || Number.isNaN(postNum)) return null;
  if (preNum === 0) return postNum > 0 ? 100 : 0;
  return ((postNum - preNum) / preNum) * 100;
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
  const [activeSubject, setActiveSubject] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
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
      const { data: evaluations, error } = await supabase
        .from("evaluation")
        .select(
          "evaluation_id, appointment_id, tutor_id, pre_test_score, post_test_score, tutor_notes, created_at"
        )
        .order("created_at", { ascending: true });

      if (error) throw error;

      const { data: tutors, error: tutorError } = await supabase
        .from("users")
        .select("user_id, name")
        .eq("role", "tutor");
      if (tutorError && tutorError.code !== "PGRST116") throw tutorError;

      const tutorIds = Array.from(
        new Set((tutors || []).map((item) => item.user_id).filter(Boolean))
      );
      const appointmentIds = Array.from(
        new Set((evaluations || []).map((item) => item.appointment_id).filter(Boolean))
      );

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

      let appointmentMetaMap = {};
      if (appointmentIds.length) {
        const { data: appointments, error: appointmentError } = await supabase
          .from("appointment")
          .select(
            `
            appointment_id,
            user_id,
            subject,
            topic,
            date,
            student:users!appointment_user_id_fkey(name)
          `
          )
          .in("appointment_id", appointmentIds);
        if (appointmentError && appointmentError.code !== "PGRST116") throw appointmentError;
        appointmentMetaMap = (appointments || []).reduce((acc, item) => {
          acc[item.appointment_id] = {
            user_id: item.user_id || "",
            subject: item.subject || "Unknown",
            topic: item.topic || "-",
            date: item.date || null,
            student_name: item.student?.name || "Unknown",
          };
          return acc;
        }, {});
      }

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
      (evaluations || []).forEach((item) => {
        const tutorId = item.tutor_id || "unknown";
        if (!grouped.has(tutorId)) {
          grouped.set(tutorId, {
            tutor_id: tutorId,
            tutor_name: tutorMap[tutorId] || "Unknown",
            tutor_image: profileMap[tutorId]?.profile_image || "",
            tutor_subject: profileMap[tutorId]?.subject || "",
            sessions: [],
          });
        }
        const meta = appointmentMetaMap[item.appointment_id] || {};
        grouped.get(tutorId).sessions.push({
          ...item,
          appointment_id: item.appointment_id,
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
    } catch (err) {
      console.error("Error loading session analytics:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [version]);

  useEffect(() => {
    if (!selectedTutor) return;
    const updated = tutorRows.find((row) => row.tutor_id === selectedTutor.tutor_id);
    if (updated) {
      setSelectedTutor(updated);
    } else {
      setSelectedTutor(null);
    }
  }, [tutorRows, selectedTutor]);

  const leaderboard = useMemo(() => {
    return [...tutorRows].sort((a, b) => b.averageGain - a.averageGain);
  }, [tutorRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSubject]);

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
        effectiveLastSession:
          sortedSubjectSessions[sortedSubjectSessions.length - 1] || null,
      };
    });
    const sorted = [...withStats].sort((a, b) => b.effectiveAverageGain - a.effectiveAverageGain);
    return sorted;
  }, [leaderboard, activeSubject]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaderboard.length / cardsPerPage));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStartIndex = (currentPageSafe - 1) * cardsPerPage;
  const pagedLeaderboard = filteredLeaderboard.slice(
    pageStartIndex,
    currentPageSafe * cardsPerPage
  );

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
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              ADMIN: TUTOR EFFECTIVENESS LEADERBOARD
            </h2>
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
                  return (
                    <div
                      key={row.tutor_id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400">
                            #{pageStartIndex + index + 1}
                          </span>
                          {row.tutor_image ? (
                            <img
                              src={row.tutor_image}
                              alt={row.tutor_name}
                              className="h-7 w-7 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-500">
                              {row.tutor_name?.charAt(0) || "T"}
                            </div>
                          )}
                          {row.tutor_name}
                          {activeSubject === "All" && (row.tutor_subject || lastSession?.subject) && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {row.tutor_subject || lastSession?.subject}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">
                          {row.effectiveSessions} sessions
                        </span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${barColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {formatPercent(row.effectiveAverageGain)} avg gain
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Last session:{" "}
                        {lastSession
                          ? `${lastSession.subject} (Pre ${lastSession.pre_test_score ?? "-"} / Post ${lastSession.post_test_score ?? "-"})`
                          : "No session at the moment"}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedTutor(row)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          View sessions
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
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm min-w-[640px] sm:min-w-0">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Subject</th>
                          <th className="text-left px-4 py-3">Topic</th>
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
                              session.post_test_score
                            );
                            return (
                              <tr
                                key={session.appointment_id || session.evaluation_id}
                                className="border-t border-gray-100"
                              >
                                <td className="px-4 py-3 text-left text-gray-600">
                                  {session.date || "-"}
                                </td>
                                <td className="px-4 py-3 text-left text-gray-700">
                                  {session.subject}
                                </td>
                                <td className="px-4 py-3 text-left text-gray-600">
                                  {session.topic || "-"}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                  {session.pre_test_score ?? "-"}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                  {session.post_test_score ?? "-"}
                                </td>
                                <td
                                  className={`px-4 py-3 text-center text-sm font-semibold ${
                                    improvement === null
                                      ? "text-gray-400"
                                      : improvement >= 0
                                        ? "text-green-600"
                                        : "text-orange-600"
                                  }`}
                                >
                                  {improvement === null
                                    ? "-"
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

        </div>
      )}
    </div>
  );
};

export default SessionAnalytics;

