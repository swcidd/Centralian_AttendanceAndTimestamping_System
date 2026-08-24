const TrackingFilters = () => {
  return (
    <div className="flex gap-4">
      <select className="appearance-none rounded border bg-white px-4 py-2">
        <option value="" disabled>
          Course
        </option>
        <option>CS101</option>
        <option>IT201</option>
      </select>
      <select className="appearance-none rounded border bg-white px-4 py-2">
        <option value="" disabled>
          Stub Code
        </option>
        <option>Stub 1</option>
        <option>Stub 2</option>
      </select>
    </div>
  );
};

export default TrackingFilters;
