interface ActivityCardProps {
  id: number;
  date: string;
  present: number;
  absent: number;
  late: number;
  onClick: (id: number) => void;
}

const ActivityCard = ({
  id,
  date,
  present,
  absent,
  late,
  onClick,
}: ActivityCardProps) => {
  return (
    <div
      onClick={() => onClick(id)}
      className="w-full rounded-xl border bg-white p-5 text-left shadow-sm transition hover:scale-105"
    >
      <div className="flex flex-col space-y-3">
        <h3 className="border-b-2 border-gray-500 pb-2 text-lg font-semibold">
          {date}
        </h3>

        <div className="flex gap-4 text-sm">
          <span className="text-green-600">Present: {present}</span>

          <span className="text-yellow-500">Late: {late}</span>

          <span className="text-red-600">Absent: {absent}</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
