interface CourseCardProps {
  stub: string;
  name: string;
  schedule: string;
  instructor: string;
  onDelete: () => void;
}

const CourseCard = ({ stub, name, schedule, instructor, onDelete }: CourseCardProps) => {
  return (
    <div className="border-tan transiton rounded-xl border bg-white p-5 shadow-sm hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-orange text-sm font-medium">Stub: {stub}</p>
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
      </div>
    </div>
  );
};

export default CourseCard;
