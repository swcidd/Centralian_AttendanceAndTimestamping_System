import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CgProfile } from "react-icons/cg";
import { supabase } from "../lib/supabase";

const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate("/courses");
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
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <input
              type="email"
              name="email"
              required
              placeholder="School Email"
              className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
            />

            <input
              type="password"
              name="password"
              required
              placeholder="Password"
              className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
            />

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange flex-1 rounded-md px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
              >
                {isSubmitting ? "Logging in..." : "Login"}
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
