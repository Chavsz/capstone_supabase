import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase-client";
import { FaComment } from "react-icons/fa";
import { useDataSync } from "../../contexts/DataSyncContext";

const shuffle = (items) => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const MAX_COMMENT_LENGTH = 150;

const Comments = () => {
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [comments, setComments] = useState([]);
  const { reportError, clearError } = useDataSync();

  useEffect(() => {
    let active = true;

    const fetchComments = async () => {
      try {
        if (!hasLoaded) setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          if (active) setComments([]);
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
              "appointment:appointment_id(subject, topic, date, start_time, end_time, user_id, student:users!appointment_user_id_fkey(name))",
            ].join(", ")
          )
          .eq("tutor_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const filtered = (data || [])
          .filter((item) => item.tutor_comment && item.tutor_comment.trim() !== "")
          .map((item) => ({
            id: item.evaluation_id,
            comment: item.tutor_comment.trim().slice(0, MAX_COMMENT_LENGTH),
            tuteeId: item.appointment?.user_id || "anonymous",
          }));

        if (!active) return;
        setComments(shuffle(filtered));
        clearError("tutor-comments");
      } catch (err) {
        console.error("Unable to load comments:", err.message);
        if (active) {
          setComments([]);
          reportError("tutor-comments", "Unable to load tutee comments.", () =>
            fetchComments()
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          if (!hasLoaded) setHasLoaded(true);
        }
      }
    };

    fetchComments();

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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <FaComment />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tutee Comments</h1>
            <p className="text-sm text-gray-500">
              Anonymous feedback from completed sessions.
            </p>
          </div>
        </header>

        {loading && !hasLoaded ? (
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
                  <span className="text-[11px] text-gray-400">
                    {item.comment.length}/{MAX_COMMENT_LENGTH}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
                  {item.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Comments;
