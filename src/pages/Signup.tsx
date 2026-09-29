import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const Signup = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const schoolId = formData.get("schoolId") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          school_id: schoolId,
        },
      },
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Email confirmation is on by default, so signUp() won't return a live
    // session until the instructor confirms — send them to Login either way.
    navigate(data.session ? "/courses" : "/login");
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
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="firstName"
                required
                placeholder="First name"
                className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
              />

              <input
                type="text"
                name="lastName"
                required
                placeholder="Last name"
                className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
              />
            </div>

            <input
              type="text"
              name="schoolId"
              required
              placeholder="School ID"
              className="border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
            />

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

            <button
              type="submit"
              disabled={isSubmitting}
              className="border-tan bg-cream text-navy hover:bg-tan rounded-md border px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {isSubmitting ? "Signing up..." : "Signup"}
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
