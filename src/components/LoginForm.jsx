import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const adminEmail = "unclescoffee@gmail.com";
  const adminPassword = "123456";

  const handleLogin = (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (email === adminEmail && password === adminPassword) {
      setSuccess("Welcome to Uncle's Coffee!");
      setTimeout(() => navigate("/menu"), 1000);
    } else {
      setError("Invalid credentials. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10 text-espresso">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-latte text-2xl"
          >
            <img
                src="/logo.png"
                alt="Uncle's Coffee Logo"
                className="
                  h-10
                  w-10
                  object-contain
                  sm:h-12
                  sm:w-12
                "
              />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-caramel">
            Uncle&apos;s Coffee
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Admin Dashboard
          </h1>
        </header>

        <section className="rounded-2xl border border-latte bg-white p-6 shadow-xl sm:p-8">
          <h2 className="mb-6 text-center text-xl font-semibold">
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-sm font-medium text-espresso"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-latte bg-cream px-4 py-3 text-espresso placeholder:text-espresso/50 focus:border-caramel focus:outline-none focus:ring-2 focus:ring-caramel/30"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-sm font-medium text-espresso"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-lg border border-latte bg-cream px-4 py-3 pr-12 text-espresso placeholder:text-espresso/50 focus:border-caramel focus:outline-none focus:ring-2 focus:ring-caramel/30"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-caramel transition hover:text-caramelHover"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-error">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="text-sm font-medium text-success">
                {success}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-caramel px-4 py-3 font-semibold text-white transition-colors hover:bg-caramelHover focus:outline-none focus:ring-2 focus:ring-caramel focus:ring-offset-2"
            >
              Login
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default Login;