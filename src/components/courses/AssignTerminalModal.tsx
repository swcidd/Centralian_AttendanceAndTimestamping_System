import { useEffect, useState } from "react";

import { assignDevice, fetchDevices, type DeviceInfo } from "../../services/coursesApi";
import { getErrorMessage } from "../../lib/errors";
import type { Course } from "../../types/types";

interface AssignTerminalModalProps {
  course: Course;
  onClose: () => void;
  onAssigned: () => void;
}

const inputClass =
  "border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2";

// Standard EUI-48 format, e.g. B4:3A:45:A1:1D:0C (matches the MAC the
// firmware prints and POSTs as its device identity).
const MAC_PATTERN = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

const AssignTerminalModal = ({ course, onClose, onAssigned }: AssignTerminalModalProps) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [deviceMac, setDeviceMac] = useState(course.deviceMac ?? "");
  const [roomName, setRoomName] = useState(course.roomName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDevices()
      .then(setDevices)
      // Non-fatal: the modal still works with typed MACs.
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
      await assignDevice(course.stub, mac || null, room || null);
      onAssigned();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update terminal."));
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
        className="animate-scale-in w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-navy mb-1 text-xl font-bold">Assign Terminal</h2>
        <p className="text-navy/60 mb-4 text-sm">
          {course.name} ({course.stub})
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div>
            <label className="text-navy mb-1 block text-xs font-medium">
              Device MAC
            </label>
            <input
              type="text"
              value={deviceMac}
              onChange={(e) => setDeviceMac(e.target.value)}
              placeholder="B4:3A:45:A1:1D:0C"
              list="registered-terminals"
              className={inputClass}
            />
            <datalist id="registered-terminals">
              {devices.map((device) => (
                <option key={device.deviceMac} value={device.deviceMac}>
                  {device.roomName}
                </option>
              ))}
            </datalist>
            {devices.length > 0 && (
              <p className="text-navy/50 mt-1 text-xs">
                Or pick a registered terminal:{" "}
                {devices.map((d) => d.roomName).join(", ")}
              </p>
            )}
            {course.deviceMac && (
              <p className="text-navy/50 mt-1 text-xs">
                Current: {course.deviceMac}
                {course.roomName ? ` (${course.roomName})` : ""}
              </p>
            )}
          </div>

          <div>
            <label className="text-navy mb-1 block text-xs font-medium">
              Room Name
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room 205"
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {course.deviceMac ? (
              <button
                type="button"
                onClick={() => {
                  setDeviceMac("");
                  setRoomName("");
                }}
                disabled={isSubmitting}
                className="text-xs font-medium text-red-600 transition hover:underline"
              >
                Unassign terminal
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTerminalModal;