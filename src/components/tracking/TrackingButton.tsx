import { useEffect, useState } from "react";

import {
  closeSession,
  getActiveSession,
  startSession,
} from "../../services/sessionsApi";
import type { Course } from "../../types/types";

interface TrackingButtonProps {
  course: Course | null;
}

const TrackingButton = ({ course }: TrackingButtonProps) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!course) return;

    getActiveSession(course.stub)
      .then((session) => setSessionId(session?.sessionId ?? null))
      .catch(() => setSessionId(null));
  }, [course]);

  const handleClick = async () => {
    if (!course) return;
    setError(null);
    setIsBusy(true);

    try {
      if (sessionId) {
        await closeSession(sessionId);
        setSessionId(null);
      } else {
        if (!course.deviceMac) {
          setError("This course has no terminal assigned yet.");
          return;
        }
        await startSession(course.stub, course.deviceMac);
        const session = await getActiveSession(course.stub);
        setSessionId(session?.sessionId ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={!course || isBusy}
        className="bg-orange rounded-lg px-5 py-2.5 font-medium text-white shadow-sm transition hover:brightness-95 active:scale-90 disabled:opacity-60"
      >
        {sessionId ? "Stop Scanning" : "Start Scanning"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default TrackingButton;
