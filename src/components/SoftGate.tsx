import { useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth } from "../lib/firebaseClient";
import {
  createPortalGroup,
  getPortalSession,
  joinPortalGroup,
  type PortalSession,
} from "../lib/api";
import { setActiveGroupId, setAuthToken } from "../lib/sessionStore";
import {
  PortalProvider,
  type PortalContextValue,
} from "../context/PortalContext";

type AuthMode = "login" | "register";
type GroupMode = "create" | "join";

function buildFriendlyName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Nieuwe gebruiker";
}

export function SoftGate({ children }: { children: React.ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [groupMode, setGroupMode] = useState<GroupMode>("join");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [portalSession, setPortalSession] = useState<PortalSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const emailRef = useRef<HTMLInputElement>(null);

  const activeGroupId = useMemo(() => {
    if (!portalSession) {
      return null;
    }

    return (
      portalSession.activeGroupId ??
      (selectedGroupId || localStorage.getItem("pp_active_group_id"))
    );
  }, [portalSession, selectedGroupId]);

  const activeGroup = useMemo(() => {
    if (!portalSession || !activeGroupId) {
      return null;
    }
    return portalSession.groups.find((group) => group.id === activeGroupId) ?? null;
  }, [activeGroupId, portalSession]);

  const refreshSession = async () => {
    const session = await getPortalSession();
    setPortalSession(session);
    const storedGroupId = localStorage.getItem("pp_active_group_id");
    const nextGroupId =
      (storedGroupId &&
        session.groups.some((group) => group.id === storedGroupId) &&
        storedGroupId) ||
      session.activeGroupId ||
      session.groups[0]?.id ||
      "";
    setSelectedGroupId(nextGroupId);
    if (nextGroupId) {
      setActiveGroupId(nextGroupId);
      localStorage.setItem("pp_active_group_id", nextGroupId);
    } else {
      setActiveGroupId(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
      setAuthReady(false);
      setError(null);

      try {
        if (!user) {
          setAuthToken(null);
          setPortalSession(null);
          setSelectedGroupId("");
          setActiveGroupId(null);
          localStorage.removeItem("pp_active_group_id");
          setAuthReady(true);
          return;
        }

        const token = await user.getIdToken();
        setAuthToken(token);
        await refreshSession();
        if (!displayName && user.displayName) {
          setDisplayName(user.displayName);
        }
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Kon sessie niet laden."
        );
      } finally {
        setAuthReady(true);
        setRestoring(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || authMode !== "login") {
      return;
    }
    emailRef.current?.focus();
  }, [authMode, authReady]);

  useEffect(() => {
    if (ready) {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      return;
    }

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [ready]);

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Inloggen mislukt."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        authEmail.trim(),
        authPassword
      );
      const nextDisplayName = displayName.trim() || buildFriendlyName(authEmail);
      await updateProfile(userCredential.user, {
        displayName: nextDisplayName,
      });
      await userCredential.user.getIdToken(true);
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Account aanmaken mislukt."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, authEmail.trim());
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Wachtwoordherstel mislukt."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGroup = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createPortalGroup({
        name: groupName.trim(),
        joinCode: joinCode.trim(),
      });
      setSelectedGroupId(result.group.id);
      setActiveGroupId(result.group.id);
      localStorage.setItem("pp_active_group_id", result.group.id);
      await refreshSession();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Groep maken mislukt."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!selectedGroupId) {
      setError("Kies eerst een groep.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await joinPortalGroup({
        groupId: selectedGroupId,
        joinCode: joinCode.trim(),
      });
      setSelectedGroupId(result.group.id);
      setActiveGroupId(result.group.id);
      localStorage.setItem("pp_active_group_id", result.group.id);
      await refreshSession();
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : "Groep joinen mislukt."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut(firebaseAuth);
      setAuthToken(null);
      setPortalSession(null);
      setSelectedGroupId("");
      setActiveGroupId(null);
      localStorage.removeItem("pp_active_group_id");
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : "Uitloggen mislukt."
      );
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(authReady && portalSession && activeGroupId && activeGroup);

  const contextValue: PortalContextValue = {
    ready,
    user: portalSession?.user ?? null,
    groups: portalSession?.groups ?? [],
    memberships: portalSession?.memberships ?? [],
    activeGroupId: activeGroupId ?? null,
    activeGroup,
    logout: handleLogout,
    refreshSession,
    createGroup: async (payload) => {
      await createPortalGroup(payload);
      await refreshSession();
    },
    joinGroup: async (payload) => {
      await joinPortalGroup(payload);
      await refreshSession();
    },
    selectGroup: async (groupId) => {
      setSelectedGroupId(groupId);
      setActiveGroupId(groupId);
      localStorage.setItem("pp_active_group_id", groupId);
      await refreshSession();
    },
    session: portalSession,
  };

  if (restoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
          Sessie laden...
        </p>
      </div>
    );
  }

  return (
    <PortalProvider value={contextValue}>
      {ready ? (
        children
      ) : !portalSession ? (
        <div className="fixed inset-0 overflow-hidden bg-slate-950 p-3 text-slate-100 sm:p-4 lg:p-6">
          <div className="mx-auto grid h-full w-full max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl lg:grid-cols-2">
            <div className="relative min-h-[220px] lg:min-h-full">
              <img
                src="/brand/pingpong-login-hero.png"
                alt="Pingpong tafel met bat en bal"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(2,6,23,0.12)_0%,rgba(2,6,23,0.35)_52%,rgba(2,6,23,0.78)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.18),transparent_35%)]" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 lg:p-10">
                <p className="text-xs uppercase tracking-[0.6em] text-axoft-100/80">
                  PingPong Scores
                </p>
                <h1 className="mt-3 max-w-lg text-2xl font-semibold leading-tight text-white sm:text-4xl xl:text-5xl">
                  Houd de tafelcompetitie strak, snel en overzichtelijk.
                </h1>
              </div>
            </div>

            <div className="flex h-full items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-10">
              <div className="w-full max-w-md">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-axoft-200">
                      PingPong Scores
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {authMode === "login" ? "Inloggen" : "Account maken"}
                    </h2>
                  </div>
                  <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                    <button
                      type="button"
                      onClick={() => setAuthMode("login")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        authMode === "login"
                          ? "bg-axoft-500 text-slate-950"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      Inloggen
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("register")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        authMode === "register"
                          ? "bg-axoft-500 text-slate-950"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      Account
                    </button>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-inner shadow-black/20 backdrop-blur">
                  <input
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="E-mailadres"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                  />
                  <input
                    type="password"
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Wachtwoord"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                  />
                  {authMode === "register" ? (
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Naam"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                    />
                  ) : null}
                  {error ? (
                    <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={authMode === "login" ? handleLogin : handleRegister}
                      disabled={busy}
                      className="flex-1 rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                    >
                      {busy ? "Bezig..." : authMode === "login" ? "Inloggen" : "Account maken"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={busy}
                      className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-60"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-axoft-200">
                  Groepen
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Maak of kies een groep
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Ingelogd als {portalSession.user.displayName ?? portalSession.user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={busy}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-60"
              >
                Uitloggen
              </button>
            </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <div className="inline-flex rounded-full border border-white/10 bg-slate-900/80 p-1">
                  <button
                    type="button"
                    onClick={() => setGroupMode("join")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      groupMode === "join"
                        ? "bg-axoft-500 text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Bestaande groep
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupMode("create")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      groupMode === "create"
                        ? "bg-axoft-500 text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Nieuwe groep
                  </button>
                </div>

                {groupMode === "join" ? (
                  <div className="mt-4 space-y-3">
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-axoft-400"
                    >
                      <option value="">Selecteer een groep</option>
                      {portalSession.groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Geheime code"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                    />
                    <button
                      type="button"
                      onClick={handleJoinGroup}
                      disabled={busy}
                      className="w-full rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                    >
                      {busy ? "Bezig..." : "Groep joinen"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Groepsnaam"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                    />
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Geheime code"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                    />
                    <button
                      type="button"
                      onClick={handleCreateGroup}
                      disabled={busy}
                      className="w-full rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                    >
                      {busy ? "Bezig..." : "Groep maken"}
                    </button>
                  </div>
                )}

                {error ? (
                  <p className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Jouw groepen
                </p>
                <div className="mt-4 space-y-2">
                  {portalSession.groups.length ? (
                    portalSession.groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setGroupMode("join");
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          selectedGroupId === group.id
                            ? "border-axoft-400 bg-axoft-500/10 text-white"
                            : "border-white/10 text-slate-200 hover:border-white/20"
                        }`}
                      >
                        <span>{group.name}</span>
                        <span className="text-xs text-slate-400">
                          {group.memberCount} leden
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      Nog geen groepen gevonden.
                    </p>
                  )}
                </div>
                {activeGroup ? (
                  <p className="mt-4 text-sm text-slate-300">
                    Actief: <span className="text-white">{activeGroup.name}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalProvider>
  );
}

export default SoftGate;
