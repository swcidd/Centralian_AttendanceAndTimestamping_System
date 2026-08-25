const TrackingFilters = () => {
  return (
    <div className="flex gap-4">
      <select className="border-tan text-navy focus:border-orange focus:ring-orange/20 rounded-lg border bg-white px-4 py-2.5 outline-none focus:ring-2">
        <option value="" disabled>
          Course
        </option>
        <option>CS101</option>
        <option>IT201</option>
      </select>
      <select className="border-tan text-navy focus:border-orange focus:ring-orange/20 rounded-lg border bg-white px-4 py-2.5 outline-none focus:ring-2">
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
