import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import AssessmentModal from "../../components/AssessmentModal";
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

const MyTutees = () => {
  const { version } = useDataSync();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notesDrawer, setNotesDrawer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("tutee");

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
          user_id: appointment.user_id,
          tutor_id: appointment.tutor_id,
          student_name: appointment.student?.name || "Unknown",
          subject: appointment.subject || "-",
          topic: appointment.topic || "-",
          pre_test_score: evaluation.pre_test_score ?? null,
          post_test_score: evaluation.post_test_score ?? null,
          tutor_notes: evaluation.tutor_notes ?? "",
        };
      });

      setRows(merged);
    } catch (err) {
      console.error("Error loading tutees:", err.message);
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
      const haystack = `${row.student_name} ${row.subject} ${row.topic} ${row.tutor_notes || ""}`.toLowerCase();
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
      return a.student_name.localeCompare(b.student_name);
    });
    return list;
  }, [filteredRows, sortKey]);

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

  return (
    <div className="min-h-screen px-6 py-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#181718]">My Tutees</h1>
        <p className="text-sm text-gray-500">
          Track pre/post test scores and improvement per tutee.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tutee, course, topic, or notes"
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
            <option value="course">Course</option>
            <option value="topic">Topic</option>
            <option value="improvement">Avg Improvement</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading tutees...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1.2fr_0.9fr_1fr_0.8fr_0.9fr_0.9fr_1.1fr_140px] gap-2 px-4 py-3 text-xs font-semibold uppercase text-gray-500 bg-gray-50">
            <span>Tutee</span>
            <span>Course</span>
            <span>Topic</span>
            <span>Pre Test</span>
            <span>Post Test</span>
            <span>Avg Improvement</span>
            <span>Tutor Notes</span>
            <span className="text-right">Actions</span>
          </div>
          {sortedRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No tutees yet. End a session to add scores.
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
                  className="grid grid-cols-[1.2fr_0.9fr_1fr_0.8fr_0.9fr_0.9fr_1.1fr_140px] gap-2 px-4 py-3 text-sm text-gray-700 border-t border-gray-100 items-center"
                >
                  <span className="font-semibold text-gray-800">
                    {row.student_name}
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
                  <span className="text-xs text-gray-500 line-clamp-2">
                    {row.tutor_notes ? row.tutor_notes : "â€”"}
                  </span>
                  <div className="text-right flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {row.pre_test_score == null && row.post_test_score == null
                        ? "Add scores"
                        : "Edit scores"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotesDrawer(row)}
                      className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                    >
                      View notes
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <AssessmentModal
        isOpen={Boolean(selected)}
        appointment={selected}
        isBusy={isSaving}
        defaultValues={{
          preScore: selected?.pre_test_score ?? "",
          postScore: selected?.post_test_score ?? "",
          notes: selected?.tutor_notes ?? "",
        }}
        onClose={() => setSelected(null)}
        onSubmit={handleSaveScores}
        onLater={() => setSelected(null)}
      />

      {notesDrawer && (
        <div className="fixed inset-0 z-[70] flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setNotesDrawer(null)}
          />
          <div className="ml-auto h-full w-full max-w-sm bg-white shadow-2xl border-l border-gray-200 p-5 relative">
            <button
              type="button"
              onClick={() => setNotesDrawer(null)}
              className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
              aria-label="Close notes drawer"
            >
              ×
            </button>
            <h3 className="text-lg font-bold text-gray-800">Tutor Notes</h3>
            <p className="mt-2 text-xs text-gray-500">
              {notesDrawer.student_name} · {notesDrawer.subject} · {notesDrawer.topic}
            </p>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {notesDrawer.tutor_notes
                ? notesDrawer.tutor_notes
                : "No notes provided yet."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTutees;
