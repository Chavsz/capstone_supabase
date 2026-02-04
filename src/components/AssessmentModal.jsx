import React, { useEffect, useMemo, useState } from "react";
import LoadingButton from "./LoadingButton";

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? "" : parsed;
};

const computeImprovement = (preScore, postScore, preTotal) => {
  const pre = Number(preScore);
  const post = Number(postScore);
  const total = Number(preTotal);
  if (Number.isNaN(pre) || Number.isNaN(post)) return null;
  if (Number.isFinite(total) && total > 0) {
    return ((post - pre) / total) * 100;
  }
  if (pre <= 0) return post > 0 ? 100 : 0;
  return ((post - pre) / pre) * 100;
};

const isInvalidScoreTotal = (score, total) => {
  if (!Number.isFinite(score) || !Number.isFinite(total)) return true;
  return total < score;
};

const AssessmentModal = ({
  isOpen,
  onClose,
  onSubmit,
  onLater,
  appointment,
  defaultValues = {},
  isBusy = false,
  title = "Session Assessment: Pre & Post Test Scores",
}) => {
  const [preScore, setPreScore] = useState("");
  const [postScore, setPostScore] = useState("");
  const [preTotal, setPreTotal] = useState(10);
  const [postTotal, setPostTotal] = useState(10);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPreScore(toNumber(defaultValues.preScore));
    setPostScore(toNumber(defaultValues.postScore));
    setPreTotal(defaultValues.preTotal || 10);
    setPostTotal(defaultValues.postTotal || 10);
    setNotes(defaultValues.notes || "");
    setError("");
  }, [defaultValues, isOpen]);

  const improvement = useMemo(
    () => computeImprovement(preScore, postScore, preTotal),
    [preScore, postScore, preTotal]
  );
  const prePercent =
    preScore !== "" && preTotal
      ? Math.min((Number(preScore) / Number(preTotal)) * 100, 100)
      : null;
  const postPercent =
    postScore !== "" && postTotal
      ? Math.min((Number(postScore) / Number(postTotal)) * 100, 100)
      : null;
  const totalOptions = [5, 10, 15, 20, 25, 30];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">
              Tutee: {appointment?.student_name || "Unknown"}{" "}
              <span className="ml-2 text-gray-400">|</span>{" "}
              Topic: {appointment?.topic || appointment?.subject || "N/A"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close assessment modal"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <label className="text-xs font-semibold text-gray-600">
              Pre-Test Score
            </label>
            <input
              type="number"
              min="0"
              value={preScore}
              onChange={(e) => setPreScore(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 6"
              disabled={isBusy}
            />
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span>/ Total Items</span>
              <input
                type="number"
                min="1"
                list="total-options"
                value={preTotal}
                onChange={(e) => setPreTotal(toNumber(e.target.value))}
                className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                disabled={isBusy}
              />
              {prePercent !== null && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                  {Math.round(prePercent)}%
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <label className="text-xs font-semibold text-gray-600">
              Post-Test Score
            </label>
            <input
              type="number"
              min="0"
              value={postScore}
              onChange={(e) => setPostScore(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 9"
              disabled={isBusy}
            />
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span>/ Total Items</span>
              <input
                type="number"
                min="1"
                list="total-options"
                value={postTotal}
                onChange={(e) => setPostTotal(toNumber(e.target.value))}
                className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                disabled={isBusy}
              />
              {postPercent !== null && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                  {Math.round(postPercent)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {improvement !== null && (
          <div className="mt-3 text-xs text-gray-500">
            Avg. Improvement:{" "}
            <span
              className={`font-semibold ${
                improvement >= 0 ? "text-green-600" : "text-orange-600"
              }`}
            >
              {improvement >= 0 ? "↑" : "↓"} {Math.abs(improvement).toFixed(1)}%
            </span>
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-600">
            Tutor Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Share brief notes about the session..."
            disabled={isBusy}
          />
        </div>

        <datalist id="total-options">
          {totalOptions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <LoadingButton
            type="button"
            onClick={() => {
              setError("");
              if (onLater) onLater();
            }}
            disabled={isBusy}
            className="w-full sm:w-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
          >
            Put Later
          </LoadingButton>
          <LoadingButton
            type="button"
            onClick={async () => {
              const pre = Number(preScore);
              const post = Number(postScore);
              const preTotalValue = Number(preTotal);
              const postTotalValue = Number(postTotal);
              if (
                preScore === "" ||
                postScore === "" ||
                preTotal === "" ||
                postTotal === ""
              ) {
                setError("Please fill in all score fields before submitting.");
                return;
              }
              if (
                Number.isNaN(pre) ||
                Number.isNaN(post) ||
                Number.isNaN(preTotalValue) ||
                Number.isNaN(postTotalValue)
              ) {
                setError("Please enter valid scores before submitting.");
                return;
              }
              if (isInvalidScoreTotal(pre, preTotalValue)) {
                setError("Pre-test total must be equal to or greater than the pre-test score.");
                return;
              }
              if (isInvalidScoreTotal(post, postTotalValue)) {
                setError("Post-test total must be equal to or greater than the post-test score.");
                return;
              }
              setError("");
              const result = onSubmit?.({
                preScore: pre,
                postScore: post,
                preTotal: preTotalValue,
                postTotal: postTotalValue,
                notes: notes.trim() || null,
              });
              await Promise.resolve(result);
              onClose?.();
            }}
            isLoading={isBusy}
            loadingText="Submitting..."
            className="w-full sm:w-auto rounded-lg bg-[#132c91] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f1f6b]"
          >
            Submit Scores
          </LoadingButton>
        </div>
      </div>
    </div>
  );
};

export default AssessmentModal;
