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
      className="border-tan w-full cursor-pointer rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex flex-col gap-4">
        <h3 className="border-tan text-navy border-b pb-3 text-lg font-semibold">
          {date}
        </h3>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
            Present: {present}
          </span>

          <span className="text-orange rounded-full bg-orange/10 px-3 py-1 font-medium">
            Late: {late}
          </span>

          <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
            Absent: {absent}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
