import { Link, useNavigate } from "react-router-dom";
import { CgProfile } from "react-icons/cg";

const Login = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Temporary navigation while authentication is not implemented
    navigate("/tracking");
  };

  return (
    <div className="bg-cream min-h-screen flex flex-col">
      <header className="border-tan bg-orange px-4 py-2">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Centralian Attendance & Timestamping System
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="border-tan w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex justify-center">
            <CgProfile className="text-navy/70 text-8xl" />
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
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

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                className="bg-orange flex-1 rounded-md px-3 py-2 text-sm font-medium text-white hover:brightness-95"
              >
                Login
              </button>

              <Link
                to="/signup"
                className="border-tan bg-cream text-navy hover:bg-tan flex-1 rounded-md border px-3 py-2 text-center text-sm font-medium"
              >
                Signup
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Login;
