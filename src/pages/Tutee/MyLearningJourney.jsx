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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("tutor");
  const [expandedTutors, setExpandedTutors] = useState(() => new Set());

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
          .select("appointment_id, pre_test_score, post_test_score, tutor_notes")
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
          tutor_notes: evaluation.tutor_notes ?? "",
        });
      });

      const result = Array.from(grouped.values()).map((tutor) => {
        const sessions = [...tutor.sessions].sort((a, b) =>
          String(a.date).localeCompare(String(b.date))
        );
        return { ...tutor, sessions };
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

  const sortedTutors = useMemo(() => {
    const list = [...filteredTutors];
    list.sort((a, b) => {
      if (sortKey === "sessions") return b.sessions.length - a.sessions.length;
      if (sortKey === "improvement") {
        const avg = (sessions) => {
          const values = sessions
            .map((s) => formatImprovement(s.pre_test_score, s.post_test_score))
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

  const visibleSessions = (sessions, expanded) => {
    if (sessions.length <= 4 || expanded) return sessions;
    const firstTwo = sessions.slice(0, 2);
    const lastTwo = sessions.slice(-2);
    return [...firstTwo, ...lastTwo];
  };

  return (
    <div className="min-h-screen px-6 py-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#181718]">My Learning Journey</h1>
        <p className="text-sm text-gray-500">
          Track your sessions by tutor with score improvements and notes.
        </p>
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
          {sortedTutors.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              No records yet.
            </div>
          ) : (
            sortedTutors.map((tutor) => {
              const expanded = expandedTutors.has(tutor.tutor_id);
              const sessions = visibleSessions(tutor.sessions, expanded);
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

                  <div className="mt-4 space-y-2">
                    {sessions.map((session) => {
                      const improvement = formatImprovement(
                        session.pre_test_score,
                        session.post_test_score
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
                              <p>Pre: {session.pre_test_score ?? "-"}</p>
                              <p>Post: {session.post_test_score ?? "-"}</p>
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
                    })}
                  </div>

                  {tutor.sessions.length > 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedTutors((prev) => {
                          const next = new Set(prev);
                          if (next.has(tutor.tutor_id)) {
                            next.delete(tutor.tutor_id);
                          } else {
                            next.add(tutor.tutor_id);
                          }
                          return next;
                        });
                      }}
                      className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {expanded ? "View less" : "View more"}
                    </button>
                  )}
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
    </div>
  );
};

export default MyLearningJourney;
