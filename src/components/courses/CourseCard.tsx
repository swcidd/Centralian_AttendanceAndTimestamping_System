import type { CourseSection } from "../../types/types";

interface CourseCardProps {
  sections: CourseSection[];
  name: string;
  instructor: string;
  deviceMac: string | null;
  roomName: string | null;
  onOpen: () => void;
  onDelete: () => void;
}

const CourseCard = ({
  sections,
  name,
  instructor,
  deviceMac,
  roomName,
  onOpen,
  onDelete,
}: CourseCardProps) => {
  return (
    <div
      onClick={onOpen}
      className="border-tan group relative cursor-pointer rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="bg-orange/10 text-orange rounded-full px-2 py-0.5 text-xs font-medium">
            {sections.length} {sections.length === 1 ? "stub" : "stubs"}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${name}`}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      <h3 className="text-navy mt-2 text-lg font-semibold">{name}</h3>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-navy font-medium">Instructor</p>
          <p className="text-navy/60 mt-1">{instructor}</p>
        </div>

        <div>
          <p className="text-navy font-medium">Terminal</p>
          <p className="text-navy/60 mt-1">
            {deviceMac ? (
              <>
                {roomName ?? "Assigned"}
                <span className="text-navy/40">
                  {" "}
                  · <span className="font-mono text-xs">{deviceMac}</span>
                </span>
              </>
            ) : (
              "No terminal assigned"
            )}
          </p>
        </div>
      </div>

      <p className="text-navy/40 mt-4 text-xs font-medium group-hover:text-orange">
        Click to manage stubcodes &rarr;
      </p>
    </div>
  );
};

export default CourseCard;
