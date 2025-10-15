import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

type AuthMode = "login" | "register";

const defaultLoginState = {
  usernameOrEmail: "",
  password: ""
};

const defaultRegisterState = {
  username: "",
  email: "",
  password: ""
};

export function AuthPage() {
  const { login, register, authError, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginForm, setLoginForm] = useState(defaultLoginState);
  const [registerForm, setRegisterForm] = useState(defaultRegisterState);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
    clearError();
  }, [mode, clearError]);

  const errorToDisplay = useMemo(() => formError ?? authError, [authError, formError]);

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const { usernameOrEmail, password } = loginForm;

    const payload =
      usernameOrEmail.includes("@")
        ? { email: usernameOrEmail.trim(), password }
        : { username: usernameOrEmail.trim(), password };

    try {
      await login(payload);
      setLoginForm(defaultLoginState);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Inloggen mislukt.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const username = registerForm.username.trim();
    const email = registerForm.email.trim();
    const password = registerForm.password;

    if (username.length < 3) {
      setFormError("Gebruikersnaam heeft minimaal 3 tekens nodig.");
      setSubmitting(false);
      return;
    }

    if (password.length < 8) {
      setFormError("Kies een wachtwoord van minstens 8 tekens.");
      setSubmitting(false);
      return;
    }

    try {
      await register({ username, email: email || undefined, password });
      setRegisterForm(defaultRegisterState);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Registreren mislukt.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-axoft-500/10 backdrop-blur">
        <header className="mb-8 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-axoft-200">Axoft Pingpong</p>
          <h1 className="text-2xl font-semibold text-white">
            {mode === "login" ? "Welkom terug" : "Account aanmaken"}
          </h1>
          <p className="text-sm text-slate-400">
            {mode === "login"
              ? "Log in om potjes vast te leggen, vrienden toe te voegen en groepen te beheren."
              : "Vul je gegevens in en betreed de ranglijsten."}
          </p>
        </header>

        {errorToDisplay ? (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorToDisplay}
          </div>
        ) : null}

        {mode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Gebruikersnaam of e-mail
              </label>
              <input
                type="text"
                value={loginForm.usernameOrEmail}
                onChange={(event) =>
                  setLoginForm((state) => ({ ...state, usernameOrEmail: event.target.value }))
                }
                autoComplete="username"
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
                placeholder="bijv. remy"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Wachtwoord</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((state) => ({ ...state, password: event.target.value }))
                }
                autoComplete="current-password"
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/50"
            >
              {submitting ? "Bezig met inloggen..." : "Inloggen"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Gebruikersnaam</label>
              <input
                type="text"
                value={registerForm.username}
                onChange={(event) =>
                  setRegisterForm((state) => ({ ...state, username: event.target.value }))
                }
                autoComplete="username"
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
                placeholder="bijv. pingpongmaster"
                required
                minLength={3}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                E-mailadres <span className="text-slate-500">(optioneel)</span>
              </label>
              <input
                type="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((state) => ({ ...state, email: event.target.value }))
                }
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
                placeholder="remy@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Wachtwoord</label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((state) => ({ ...state, password: event.target.value }))
                }
                autoComplete="new-password"
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
                placeholder="Minimaal 8 tekens"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/50"
            >
              {submitting ? "Account wordt aangemaakt..." : "Account aanmaken"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-400">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => setMode("register")}
              className="font-medium text-axoft-200 transition hover:text-axoft-100 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
            >
              Nog geen account? Registreer nu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-medium text-axoft-200 transition hover:text-axoft-100 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
            >
              Al een account? Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
