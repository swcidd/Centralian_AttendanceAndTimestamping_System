import { CgClose } from "react-icons/cg";

interface CourseCardProps {
  stubs: string[];
  name: string;
  schedule: string;
  instructor: string;
  deviceMac: string | null;
  roomName: string | null;
  onAddStub: () => void;
  onDeleteStub: (stub: string) => void;
  onAssign: () => void;
  onDelete: () => void;
}

const CourseCard = ({
  stubs,
  name,
  schedule,
  instructor,
  deviceMac,
  roomName,
  onAddStub,
  onDeleteStub,
  onAssign,
  onDelete,
}: CourseCardProps) => {
  return (
    <div className="border-tan transition rounded-xl border bg-white p-5 shadow-sm hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-orange text-sm font-medium">Stubs:</span>
          {stubs.map((stub) => (
            <span
              key={stub}
              className="bg-orange/10 text-orange inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium"
            >
              {stub}
              <button
                type="button"
                onClick={() => onDeleteStub(stub)}
                aria-label={`Delete stubcode ${stub}`}
                title="Delete stubcode"
                className="text-orange/60 transition hover:text-red-600"
              >
                <CgClose className="text-[10px]" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onAddStub}
            aria-label={`Add stubcode to ${name}`}
            title="Add stubcode"
            className="border-orange/40 text-orange hover:bg-orange/5 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium transition"
          >
            +
          </button>
        </div>
        <button
          onClick={onDelete}
          aria-label={`Delete ${name}`}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      <h3 className="text-navy mt-2 text-lg font-semibold">{name}</h3>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-navy font-medium">Schedule</p>

          <p className="text-navy/60 mt-1">{schedule}</p>
        </div>

        <div>
          <p className="text-navy font-medium">Instructor</p>

          <p className="text-navy/60 mt-1">{instructor}</p>
        </div>

        <div>
          <p className="text-navy font-medium">Terminal</p>

          {deviceMac ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-navy/60">
                {roomName ?? "Assigned"}
                <span className="text-navy/40">
                  {" "}
                  · <span className="font-mono text-xs">{deviceMac}</span>
                </span>
              </p>
              <button
                onClick={onAssign}
                className="text-orange text-xs font-medium transition hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-navy/40">No terminal assigned</p>
              <button
                onClick={onAssign}
                className="bg-orange rounded-md px-2.5 py-1 text-xs font-medium text-white transition hover:brightness-95"
              >
                Assign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
