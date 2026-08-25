interface CourseCardProps {
  stub: number;
  name: string;
  schedule: string;
  instructor: string;
}

const CourseCard = ({ stub, name, schedule, instructor }: CourseCardProps) => {
  return (
    <div className="border-tan transiton rounded-xl border bg-white p-5 shadow-sm hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center">
        <p className="text-orange text-sm font-medium">Stub: {stub}</p>
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
