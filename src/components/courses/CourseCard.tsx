import { CgClose } from "react-icons/cg";
import type { CourseSection, CourseType } from "../../types/types";
import { sectionKey, sectionLabel } from "../../lib/utils/section";

interface CourseCardProps {
  sections: CourseSection[];
  name: string;
  schedule: string;
  instructor: string;
  deviceMac: string | null;
  roomName: string | null;
  onAddStub: () => void;
  onDeleteStub: (section: CourseSection) => void;
  onAssign: () => void;
  onDelete: () => void;
}

const TYPE_LABEL: Record<CourseType, string> = {
  lect: "Lecture",
  lab: "Laboratory",
};

const CourseCard = ({
  sections,
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
          {sections.map((section) => (
            <span
              key={sectionKey(section)}
              title={TYPE_LABEL[section.type]}
              className="bg-orange/10 text-orange inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium"
            >
              {section.code}
              <span className="text-orange/70 font-sans text-[10px] font-semibold uppercase">
                {section.type}
              </span>
              <button
                type="button"
                onClick={() => onDeleteStub(section)}
                aria-label={`Delete stubcode ${sectionLabel(section)}`}
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
