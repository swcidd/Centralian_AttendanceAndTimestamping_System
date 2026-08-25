interface StudentTrackRowProps {
  studentName: string;
  studentId: string;
  present: number;
  late: number;
  absent: number;
  onClick: () => void;
}

const StudentTrackRow = ({
  studentName,
  studentId,
  present,
  late,
  absent,
  onClick,
}: StudentTrackRowProps) => {
  return (
    <tr
      onClick={onClick}
      className="border-tan hover:bg-cream cursor-pointer border-b transition-colors last:border-b-0"
    >
      <td className="text-navy/70 px-4 py-3 text-sm">{studentId}</td>

      <td className="text-navy px-4 py-3 text-sm font-medium">{studentName}</td>

      <td className="px-4 py-3">
        <div className="grid grid-cols-3 gap-2 text-sm font-medium">
          <span className="text-center rounded-full bg-green-100 py-1 text-green-700">
            {present} ✓
          </span>

          <span className="text-center bg-orange/10 text-orange rounded-full py-1">
            {late} !
          </span>

          <span className="text-center rounded-full bg-red-100 py-1 text-red-700">
            {absent} ✕
          </span>
        </div>
      </td>
    </tr>
  );
};

export default StudentTrackRow;
