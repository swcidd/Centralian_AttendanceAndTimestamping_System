import ActivityCard from "./ActivityCard";

export type Activity = {
  id: number;
  date: string;
  present: number;
  absent: number;
  late: number;
};

interface ActivityGridProps {
  activities: Activity[];
  onActivitySelect: (id: number) => void;
}

const ActivityGrid = ({ activities, onActivitySelect }: ActivityGridProps) => {
  return (
    <div className="grid grid-cols-2 gap-8">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          id={activity.id}
          date={activity.date}
          present={activity.present}
          absent={activity.absent}
          late={activity.late}
          onClick={onActivitySelect}
        />
      ))}
    </div>
  );
};

export default ActivityGrid;
