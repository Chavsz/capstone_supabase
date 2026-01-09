import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { FaComment, FaRegCalendarAlt } from "react-icons/fa";

const lavRatingFields = [
  { key: "lav_environment", label: "Environment" },
  { key: "lav_scheduling", label: "Scheduling" },
  { key: "lav_support", label: "Support" },
  { key: "lav_book_again", label: "Book Again" },
  { key: "lav_value", label: "Value for Time" },
];

const shuffle = (items) => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const computeLavStats = (items = []) => {
  const totals = lavRatingFields.reduce(
    (acc, field) => ({
      ...acc,
      [field.key]: { sum: 0, count: 0 },
    }),
    {}
  );

  items.forEach((evaluation) => {
    lavRatingFields.forEach((field) => {
      const value = Number(evaluation[field.key]);
      if (!Number.isNaN(value)) {
        totals[field.key].sum += value;
        totals[field.key].count += 1;
      }
    });
  });

  let overallSum = 0;
  let overallCount = 0;
  const averages = {};

  lavRatingFields.forEach((field) => {
    const { sum, count } = totals[field.key];
    averages[field.key] = count ? sum / count : null;
    overallSum += sum;
    overallCount += count;
  });

  return {
    averages,
    overallAverage: overallCount ? overallSum / overallCount : null,
  };
};

const normalizeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState([]);
  const [comments, setComments] = useState([]);

  const rangeStart = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const rangeEnd = useMemo(() => {
    const end = new Date();
    end.setDate(1);
    end.setMonth(end.getMonth() + 1);
    end.setHours(0, 0, 0, 0);
    return end;
  }, []);

  const displayPeriodLabel = useMemo(() => {
    const startLabel = rangeStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const endDisplay = new Date(rangeEnd);
    endDisplay.setDate(endDisplay.getDate() - 1);
    const endLabel = endDisplay.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startLabel} - ${endLabel}`;
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    let active = true;

    const fetchEvaluations = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          if (active) {
            setEvaluations([]);
            setComments([]);
          }
          return;
        }

        const { data, error } = await supabase
          .from("evaluation")
          .select(
            [
              "evaluation_id",
              "tutor_comment",
              "created_at",
              "appointment_id",
              "lav_environment",
              "lav_scheduling",
              "lav_support",
              "lav_book_again",
              "lav_value",
              "appointment:appointment_id(user_id)",
            ].join(", ")
          )
          .eq("tutor_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const evaluationsData = data || [];

        const filteredComments = evaluationsData
          .filter((item) => item.tutor_comment && item.tutor_comment.trim() !== "")
          .map((item) => ({
            id: item.evaluation_id,
            comment: item.tutor_comment.trim(),
            tuteeId: item.appointment?.user_id || "anonymous",
          }));

        if (!active) return;
        setEvaluations(evaluationsData);
        setComments(shuffle(filteredComments));
      } catch (err) {
        console.error("Unable to load reports:", err.message);
        if (active) {
          setEvaluations([]);
          setComments([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchEvaluations();

    return () => {
      active = false;
    };
  }, []);

  const maskedNames = useMemo(() => {
    const map = new Map();
    let counter = 1;
    comments.forEach((item) => {
      if (!map.has(item.tuteeId)) {
        map.set(item.tuteeId, `Tutee ${counter}`);
        counter += 1;
      }
    });
    return map;
  }, [comments]);

  const evaluationsInPeriod = useMemo(() => {
    return evaluations.filter((evaluation) => {
      if (!evaluation.created_at) return false;
      const date = normalizeDate(evaluation.created_at);
      if (!date) return false;
      return date >= rangeStart && date < rangeEnd;
    });
  }, [evaluations, rangeStart, rangeEnd]);

  const lavStatsPeriod = useMemo(
    () => computeLavStats(evaluationsInPeriod),
    [evaluationsInPeriod]
  );

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#eef2f7]">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#2b8a6f] font-semibold">
                LAV
              </p>
              <h1 className="text-3xl font-bold text-gray-800">Performance Reports</h1>
              <p className="text-sm text-gray-500">
                Overview of completed sessions and feedback.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
              <FaRegCalendarAlt className="text-sm" />
              {displayPeriodLabel}
            </div>
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-gray-200 shadow-md">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">LAV Environment Satisfaction</h2>
            <p className="text-sm text-gray-500">
              Average ratings for {displayPeriodLabel}.
            </p>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading feedback...</p>
            ) : evaluationsInPeriod.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No LAV feedback has been submitted yet.
              </p>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-end justify-between gap-3">
                  {lavRatingFields.map((field, index) => {
                    const avg = lavStatsPeriod.averages[field.key];
                    const height = avg ? Math.round((avg / 5) * 120) : 0;
                    const barColors = [
                      "#f6d110",
                      "#ed5f1e",
                      "#e7b0f8",
                      "#bad381",
                      "#ffe5b6",
                    ];
                    const barColor = barColors[index % barColors.length];
                    return (
                      <div key={field.key} className="flex flex-col items-center gap-2 flex-1">
                        <span className="text-xs font-semibold text-gray-600">
                          {avg !== null ? avg.toFixed(1) : "-"}
                        </span>
                        <div className="w-8 h-32 rounded-full bg-white border border-gray-200 flex items-end overflow-hidden">
                          <div
                            className="w-full transition-all"
                            style={{ height: `${height}px`, backgroundColor: barColor }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500 text-center leading-tight">
                          {field.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-[#2fb592] bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Overall Average
                  </p>
                  <p className="text-xl font-bold text-[#2fb592]">
                    {lavStatsPeriod.overallAverage !== null
                      ? lavStatsPeriod.overallAverage.toFixed(2)
                      : "-"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <FaComment />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Tutee Comments</h2>
              <p className="text-sm text-gray-500">
                Anonymous feedback from completed sessions.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-500">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-500">
              No comments available yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {comments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-blue-600">
                      {maskedNames.get(item.tuteeId) || "Tutee"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.comment}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Reports;
