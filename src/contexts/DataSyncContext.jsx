import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase-client";

const DataSyncContext = createContext(null);

const TABLES = [
  "announcement",
  "appointment",
  "evaluation",
  "event",
  "landing",
  "notification",
  "profile",
  "schedule",
  "student_profile",
  "tutor_unavailable_days",
  "users",
];

const UPDATE_DEBOUNCE_MS = 300;
const POLL_INTERVAL_MS = 60000;

export const DataSyncProvider = ({ children }) => {
  const [version, setVersion] = useState(0);
  const [tableVersions, setTableVersions] = useState({});
  const [errors, setErrors] = useState([]);
  const queueRef = useRef(new Set());
  const timerRef = useRef(null);

  const applyUpdates = useCallback((tables) => {
    if (!tables || tables.length === 0) return;
    setVersion((prev) => prev + 1);
    setTableVersions((prev) => {
      const next = { ...prev };
      tables.forEach((table) => {
        next[table] = (next[table] || 0) + 1;
      });
      return next;
    });
  }, []);

  const flushUpdates = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const tables = Array.from(queueRef.current);
    queueRef.current.clear();
    applyUpdates(tables);
  }, [applyUpdates]);

  const checkForUpdates = useCallback(
    (tables = TABLES) => {
      applyUpdates(tables);
    },
    [applyUpdates]
  );

  const scheduleUpdate = useCallback(
    (table) => {
      queueRef.current.add(table);
      if (!timerRef.current) {
        timerRef.current = setTimeout(flushUpdates, UPDATE_DEBOUNCE_MS);
      }
    },
    [flushUpdates]
  );

  useEffect(() => {
    const channel = supabase.channel("global-data-sync");
    TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleUpdate(table)
      );
    });
    channel.subscribe();

    return () => {
      channel.unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleUpdate]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkForUpdates();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [checkForUpdates]);

  const reportError = useCallback((key, message, retry) => {
    setErrors((prev) => {
      const existingIndex = prev.findIndex((item) => item.key === key);
      const nextItem = {
        key,
        message,
        retry,
        timestamp: Date.now(),
      };
      if (existingIndex === -1) {
        return [nextItem, ...prev];
      }
      const next = [...prev];
      next[existingIndex] = nextItem;
      return next;
    });
  }, []);

  const clearError = useCallback((key) => {
    setErrors((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const retryError = useCallback(
    (key) => {
      const target = errors.find((item) => item.key === key);
      if (target?.retry) {
        target.retry();
      }
    },
    [errors]
  );

  const value = useMemo(
    () => ({
      version,
      tableVersions,
      errors,
      reportError,
      clearError,
      retryError,
      checkForUpdates,
    }),
    [version, tableVersions, errors, reportError, clearError, retryError, checkForUpdates]
  );

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
};

export const useDataSync = () => {
  const context = useContext(DataSyncContext);
  if (!context) {
    throw new Error("useDataSync must be used within a DataSyncProvider.");
  }
  return context;
};

export const DataSyncErrorBanner = () => {
  const { errors, retryError, clearError } = useDataSync();
  if (errors.length === 0) return null;
  const error = errors[0];

  return (
    <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <span>
        {error.message}{" "}
        <span className="text-[11px] text-red-500 ml-2">
          Updated {new Date(error.timestamp).toLocaleTimeString("en-US")}
        </span>
      </span>
      <div className="flex gap-2">
        {error.retry && (
          <button
            type="button"
            onClick={() => retryError(error.key)}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={() => clearError(error.key)}
          className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
