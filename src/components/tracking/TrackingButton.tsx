import { useState } from "react";

import {
  closeSession,
  getActiveSession,
  startSession,
  type ActiveSession,
  type SessionMode,
} from "../../services/sessionsApi";
import { getErrorMessage } from "../../lib/errors";
import type { Course } from "../../types/types";

interface TrackingButtonProps {
  course: Course | null;
  activeSession: ActiveSession | null;
  onSessionChange: (session: ActiveSession | null) => void;
}

const TrackingButton = ({
  course,
  activeSession,
  onSessionChange,
}: TrackingButtonProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setMode] = useState<SessionMode>("ACTIVE_ATTENDANCE");

  const handleClick = async () => {
    if (!course) return;
    setError(null);
    setIsBusy(true);

    try {
      if (activeSession) {
        await closeSession(activeSession.sessionId);
        onSessionChange(null);
      } else {
        if (!course.deviceMac) {
          setError("This course has no terminal assigned yet.");
          return;
        }
        await startSession(course.stub, course.deviceMac, mode);
        const session = await getActiveSession(course.stub);
        onSessionChange(session);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {activeSession ? (
          <span className="text-navy/60 text-sm font-medium">
            {activeSession.status === "REGISTRATION"
              ? "Registration Mode"
              : "Scanning"}
          </span>
        ) : (
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as SessionMode)}
            disabled={isBusy}
            className="border-tan text-navy focus:border-orange focus:ring-orange/20 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
          >
            <option value="ACTIVE_ATTENDANCE">Start Scanning</option>
            <option value="REGISTRATION">Start Registration</option>
          </select>
        )}
        <button
          onClick={handleClick}
          disabled={!course || isBusy}
          className="bg-orange rounded-lg px-5 py-2.5 font-medium text-white shadow-sm transition hover:brightness-95 active:scale-90 disabled:opacity-60"
        >
          {activeSession ? "Stop" : "Start"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default TrackingButton;
