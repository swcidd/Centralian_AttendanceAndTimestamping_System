import { useEffect, useState } from "react";

import { fetchDevices, type DeviceInfo } from "../../services/coursesApi";
import { getErrorMessage } from "../../lib/errors";
import type { CourseSection } from "../../types/types";

interface EditStubcodeModalProps {
  section: CourseSection;
  onSave: (section: CourseSection, schedule: ScheduleInput, terminal: TerminalInput) => Promise<void>;
  onClose: () => void;
}

export interface ScheduleInput {
  daysOfWeek: string;
  startTime: string;
  endTime: string;
  lateAfterMinutes: number;
  absentAfterMinutes: number;
}

export interface TerminalInput {
  deviceMac: string | null;
  roomName: string | null;
}

const inputClass =
  "border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2";

// Standard EUI-48 format, e.g. B4:3A:45:A1:1D:0C
const MAC_PATTERN = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

const EditStubcodeModal = ({
  section,
  onSave,
  onClose,
}: EditStubcodeModalProps) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState("MWF");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [lateAfterMinutes, setLateAfterMinutes] = useState(15);
  const [absentAfterMinutes, setAbsentAfterMinutes] = useState(30);
  const [deviceMac, setDeviceMac] = useState(section.deviceMac ?? "");
  const [roomName, setRoomName] = useState(section.roomName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const mac = deviceMac.trim().toUpperCase();
    const room = roomName.trim();

    if (mac && !MAC_PATTERN.test(mac)) {
      setError("Enter a valid MAC address like B4:3A:45:A1:1D:0C.");
      return;
    }
    if (mac && !room) {
      setError("Room name is required when assigning a terminal.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(
        section,
        {
          daysOfWeek,
          startTime,
          endTime,
          lateAfterMinutes,
          absentAfterMinutes,
        },
        { deviceMac: mac || null, roomName: room || null }
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save stubcode."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-navy mb-1 text-xl font-bold">
          Edit Stubcode {section.code}
        </h2>
        <p className="text-navy/60 mb-4 text-sm">
          Schedule and terminal are anchored to this stubcode, not the course.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={daysOfWeek}
              onChange={(e) => setDaysOfWeek(e.target.value)}
              placeholder="Days (e.g. MWF)"
              className={inputClass}
              aria-label="Days of week"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
                aria-label="Start time"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
                aria-label="End time"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-navy mb-1 block text-xs font-medium">
                Late after (minutes)
              </span>
              <input
                type="number"
                value={lateAfterMinutes}
                onChange={(e) => setLateAfterMinutes(Number(e.target.value))}
                min={0}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-navy mb-1 block text-xs font-medium">
                Absent after (minutes)
              </span>
              <input
                type="number"
                value={absentAfterMinutes}
                onChange={(e) => setAbsentAfterMinutes(Number(e.target.value))}
                min={0}
                className={inputClass}
              />
            </label>
          </div>

          <div className="pt-2">
            <p className="text-navy/60 mb-2 text-xs font-medium">
              Terminal (optional — can be assigned later)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  value={deviceMac}
                  onChange={(e) => setDeviceMac(e.target.value)}
                  placeholder="Device MAC"
                  list="edit-stubcode-terminals"
                  className={inputClass}
                />
                <datalist id="edit-stubcode-terminals">
                  {devices.map((device) => (
                    <option key={device.deviceMac} value={device.deviceMac}>
                      {device.roomName}
                    </option>
                  ))}
                </datalist>
                {deviceMac && (
                  <p className="text-navy/50 mt-1 text-xs">
                    {MAC_PATTERN.test(deviceMac.toUpperCase())
                      ? "Valid MAC format."
                      : "Expected format: B4:3A:45:A1:1D:0C."}
                  </p>
                )}
              </div>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room Name"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-tan text-navy rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-orange rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStubcodeModal;
