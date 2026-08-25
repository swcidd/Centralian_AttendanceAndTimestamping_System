import { Link, useNavigate } from "react-router-dom";

const Signup = () => {
  const navigate = useNavigate();

  const handleSignup = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Temporary navigation while signup/authentication is not implemented
    navigate("/login");
  };

  return (
    <div className="bg-cream min-h-screen flex flex-col">
      <header className="border-tan bg-orange px-4 py-2">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Centralian Attendance & Timestamping System
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="border-tan w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-navy mb-5 text-center text-2xl font-bold">
            Sign Up
          </h2>

          <form onSubmit={handleSignup} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="First name"
                className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
              />

              <input
                type="text"
                placeholder="Last name"
                className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
              />
            </div>

            <input
              type="email"
              placeholder="School Email"
              className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
            />

            <input
              type="password"
              placeholder="Password"
              className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
            />

            <button
              type="submit"
              className="border-tan bg-cream text-navy hover:bg-tan rounded-md border px-5 py-2 text-sm font-medium"
            >
              Signup
            </button>

            <div>
              <Link
                to="/login"
                className="text-navy/60 hover:text-orange text-xs"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Signup;
