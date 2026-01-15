import { useCallback, useRef, useState } from "react";
import { toast } from "react-hot-toast";

const DEFAULT_ERROR_MESSAGE = "Action failed. Please try again.";

const useActionGuard = () => {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async (action, errorMessage, options = {}) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      return await action();
    } catch (err) {
      console.error(err);
      toast.error(errorMessage || DEFAULT_ERROR_MESSAGE);
      if (options.rethrow) {
        throw err;
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy };
};

export default useActionGuard;
