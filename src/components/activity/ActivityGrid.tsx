import { Activity } from "../../types/types";
import ActivityCard from "./ActivityCard";

interface ActivityGridProps {
  activities: Activity[];
  onActivitySelect: (id: string) => void;
}

const ActivityGrid = ({ activities, onActivitySelect }: ActivityGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
