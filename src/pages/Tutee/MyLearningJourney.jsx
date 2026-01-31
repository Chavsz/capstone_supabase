import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
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

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const MyLearningJourney = () => {
  const { version } = useDataSync();
  const [loading, setLoading] = useState(true);
  const [tutors, setTutors] = useState([]);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("tutor");
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 4;

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
          tutor:users!appointment_tutor_id_fkey(name)
        `
        )
        .eq("user_id", session.user.id)
        .in("status", ["awaiting_feedback", "completed"])
        .order("date", { ascending: true });

      if (error) throw error;

      const appointmentList = appointments || [];
      const appointmentIds = appointmentList.map((item) => item.appointment_id);
      const tutorIds = Array.from(
        new Set(appointmentList.map((item) => item.tutor_id).filter(Boolean))
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
      if (tutorIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profile")
          .select("user_id, subject, specialization, profile_image")
          .in("user_id", tutorIds);
        if (profileError && profileError.code !== "PGRST116") throw profileError;
        profileMap = (profiles || []).reduce((acc, item) => {
          acc[item.user_id] = item;
          return acc;
        }, {});
      }

      const grouped = new Map();

      appointmentList.forEach((appointment) => {
        const evaluation = evaluationMap[appointment.appointment_id] || {};
        const tutorId = appointment.tutor_id || "unknown";
        if (!grouped.has(tutorId)) {
          const profile = profileMap[tutorId] || {};
          grouped.set(tutorId, {
            tutor_id: tutorId,
            tutor_name: appointment.tutor?.name || "Unknown",
            tutor_subject: profile.subject || "Subject not set",
            tutor_specialization: profile.specialization || "",
            tutor_image: profile.profile_image || "",
            sessions: [],
          });
        }
        grouped.get(tutorId).sessions.push({
          appointment_id: appointment.appointment_id,
          subject: appointment.subject || "-",
          topic: appointment.topic || "-",
          date: appointment.date || "",
          start_time: appointment.start_time || "",
          pre_test_score: evaluation.pre_test_score ?? null,
          post_test_score: evaluation.post_test_score ?? null,
          pre_test_total: evaluation.pre_test_total ?? null,
          post_test_total: evaluation.post_test_total ?? null,
          tutor_notes: evaluation.tutor_notes ?? "",
        });
      });

      const result = Array.from(grouped.values()).map((tutor) => {
        const sessions = [...tutor.sessions].sort((a, b) =>
          String(a.date).localeCompare(String(b.date))
        );
        const lastSession = sessions[sessions.length - 1] || null;
        return { ...tutor, sessions, lastSession };
      });

      setTutors(result);
    } catch (err) {
      console.error("Error loading learning journey:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [version]);

  const filteredTutors = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return tutors;
    return tutors.filter((tutor) => {
      const sessionText = tutor.sessions
        .map((session) => `${session.subject} ${session.topic} ${session.tutor_notes || ""}`)
        .join(" ")
        .toLowerCase();
      const haystack = `${tutor.tutor_name} ${tutor.tutor_subject} ${tutor.tutor_specialization} ${sessionText}`;
      return haystack.includes(normalized);
    });
  }, [tutors, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortKey]);

  const sortedTutors = useMemo(() => {
    const list = [...filteredTutors];
    list.sort((a, b) => {
      if (sortKey === "sessions") return b.sessions.length - a.sessions.length;
      if (sortKey === "improvement") {
        const avg = (sessions) => {
          const values = sessions
            .map((s) =>
              formatImprovement(s.pre_test_score, s.post_test_score, s.pre_test_total)
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
      return a.tutor_name.localeCompare(b.tutor_name);
    });
    return list;
  }, [filteredTutors, sortKey]);
  
  const totalPages = Math.max(1, Math.ceil(sortedTutors.length / cardsPerPage));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const pagedTutors = sortedTutors.slice(
    (currentPageSafe - 1) * cardsPerPage,
    currentPageSafe * cardsPerPage
  );
  const rawSessions = useMemo(() => {
    const items = [];
    tutors.forEach((tutor) => {
      (tutor.sessions || []).forEach((session) => {
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
          tutor_name: tutor.tutor_name,
        });
      });
    });
    return items.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  }, [tutors, rawMonth]);
  const rawTotalPages = Math.max(1, Math.ceil(rawSessions.length / 6));
  const rawPageSafe = Math.min(Math.max(rawPage, 1), rawTotalPages);
  const rawPagedSessions = rawSessions.slice((rawPageSafe - 1) * 6, rawPageSafe * 6);

  return (
    <div className="min-h-screen px-6 py-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#181718]">My Learning Journey</h1>
        <p className="text-sm text-gray-500">
          Track your sessions by tutor with score improvements and notes.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 min-h-[calc(100vh-260px)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            MY LEARNING JOURNEY
          </h2>
          <div className="flex flex-wrap items-center gap-3">
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
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              {rawSessions.length} Sessions Test Result (Raw)
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutor, subject, or session details"
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
              <option value="sessions">Session Count</option>
              <option value="improvement">Avg Improvement</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading journey...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pagedTutors.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No records yet.
              </div>
            ) : (
              pagedTutors.map((tutor) => {
                const session = tutor.lastSession;
                if (!session) return null;
                return (
                  <div
                    key={tutor.tutor_id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      {tutor.tutor_image ? (
                        <img
                          src={tutor.tutor_image}
                          alt={tutor.tutor_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-blue-700 font-bold">
                          {(tutor.tutor_name || "T").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base font-semibold text-gray-800">
                        {tutor.tutor_name}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {tutor.tutor_subject}
                        {tutor.tutor_specialization
                          ? ` - ${tutor.tutor_specialization}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      <span className="text-sm font-semibold text-gray-800">
                        {tutor.sessions.length}
                      </span>{" "}
                      sessions
                    </div>
                  </div>

                  <div className="mt-4">
                    {(() => {
                      const improvement = formatImprovement(
                        session.pre_test_score,
                        session.post_test_score,
                        session.pre_test_total
                      );
                      return (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{formatDate(session.date)}</span>
                            <span>{session.start_time ? session.start_time.slice(0, 5) : ""}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {session.subject}
                              </p>
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
                          <div className="mt-2 text-right">
                            <button
                              type="button"
                              onClick={() => setNotesModal({ ...session, tutor_name: tutor.tutor_name })}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                              View tutor notes
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSessionsModal(tutor)}
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

      {sessionsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl border border-gray-200 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">All Sessions</h3>
                <p className="text-xs text-gray-500">
                  {sessionsModal.tutor_name} · {sessionsModal.tutor_subject}
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
                      <span>{formatDate(session.date)}</span>
                      <span>{session.start_time ? session.start_time.slice(0, 5) : ""}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">
                          {session.subject}
                        </p>
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
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => setNotesModal({ ...session, tutor_name: sessionsModal.tutor_name })}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View tutor notes
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
                            {session.tutor_name || "Unknown"}
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
    </div>
  );
};

export default MyLearningJourney;
