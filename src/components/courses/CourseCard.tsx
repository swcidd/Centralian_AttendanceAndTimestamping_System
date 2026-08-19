interface CourseCardProps {
  stub: number;
  name: string;
  schedule: string;
  instructor: string;
};

const CourseCard = ({
  stub,
  name,
  schedule,
  instructor,
}: CourseCardProps) => {
  return (
    <div
    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

      <p className="text-sm font-medium text-gray-500">
        Stub: {stub}
      </p>

      <h3 className="mt-1 text-lg font-semibold text-gray-800">
        {name}
      </h3>

      <div className="mt-4 space-y-2 text-sm text-gray-600">

        <p>
          <span className="font-medium">Schedule:</span>{" "}
          {schedule}
        </p>

        <p>
          <span className="font-medium">Instructor:</span>{" "}
          {instructor}
        </p>

      </div>

    </div>
  );
};

export default CourseCard;