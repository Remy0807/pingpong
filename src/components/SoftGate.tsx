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
  getPortalGroup,
  joinPortalGroup,
  leavePortalGroup,
  removePortalGroupMember,
  updatePortalGroup,
  type PortalGroupDetails,
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
  const [portalMode, setPortalMode] = useState<"hub" | "app">("hub");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [portalSession, setPortalSession] = useState<PortalSession | null>(null);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<PortalGroupDetails | null>(null);
  const [groupDetailsLoading, setGroupDetailsLoading] = useState(false);
  const [groupDetailsSaving, setGroupDetailsSaving] = useState(false);
  const [removingMemberUid, setRemovingMemberUid] = useState<string | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authTokenReady, setAuthTokenReady] = useState(false);
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
      "";
    setSelectedGroupId(nextGroupId);
  };

  useEffect(() => {
    if (!selectedGroupId || !portalSession) {
      setSelectedGroupDetails(null);
      setGroupNameDraft("");
      setJoinCodeDraft("");
      return;
    }

    const membership = portalSession.memberships.find(
      (entry) => entry.groupId === selectedGroupId
    );
    if (!membership) {
      setSelectedGroupDetails(null);
      setGroupNameDraft("");
      setJoinCodeDraft("");
      return;
    }

    let cancelled = false;
    setGroupDetailsLoading(true);
    getPortalGroup(selectedGroupId)
      .then((details) => {
        if (cancelled) {
          return;
        }
        setSelectedGroupDetails(details);
        setGroupNameDraft(details.group.name);
        setJoinCodeDraft(details.joinCode ?? "");
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        setSelectedGroupDetails(null);
        setGroupNameDraft("");
        setJoinCodeDraft("");
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Kon groepsbeheer niet laden."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setGroupDetailsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [portalSession, selectedGroupId]);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
      setAuthReady(false);
      setAuthTokenReady(false);
      setError(null);

      try {
        if (!user) {
          setAuthToken(null);
          setPortalSession(null);
          setSelectedGroupId("");
          setActiveGroupId(null);
          setPortalMode("hub");
          localStorage.removeItem("pp_active_group_id");
          setAuthReady(true);
          setAuthTokenReady(true);
          return;
        }

        const token = await user.getIdToken();
        setAuthToken(token);
        setPortalMode("app");
        setActiveGroupId(null);
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
        setAuthTokenReady(true);
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

  const handleSaveGroup = async () => {
    if (!selectedGroupId) {
      setError("Selecteer eerst een groep.");
      return;
    }

    setGroupDetailsSaving(true);
    setError(null);
    try {
      await updatePortalGroup(selectedGroupId, {
        name: groupNameDraft.trim(),
        joinCode: joinCodeDraft.trim(),
      });
      await refreshSession();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Groepsbeheer opslaan mislukt."
      );
    } finally {
      setGroupDetailsSaving(false);
    }
  };

  const generateJoinCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const segment = Array.from({ length: 5 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
    return `PING-${segment}`;
  };

  const handleRegenerateJoinCode = async () => {
    if (!selectedGroupId) {
      setError("Selecteer eerst een groep.");
      return;
    }

    const nextCode = generateJoinCode();
    setJoinCodeDraft(nextCode);
    setGroupDetailsSaving(true);
    setError(null);
    try {
      await updatePortalGroup(selectedGroupId, {
        joinCode: nextCode,
      });
      await refreshSession();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Geheime code vernieuwen mislukt."
      );
    } finally {
      setGroupDetailsSaving(false);
    }
  };

  const handleCopyJoinCode = async () => {
    if (!joinCodeDraft) {
      return;
    }

    try {
      await navigator.clipboard.writeText(joinCodeDraft);
    } catch {
      setError("Kopiëren naar klembord mislukt.");
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!selectedGroupId) {
      return;
    }

    setRemovingMemberUid(uid);
    setError(null);
    try {
      await removePortalGroupMember(selectedGroupId, uid);
      await refreshSession();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Lid verwijderen mislukt."
      );
    } finally {
      setRemovingMemberUid(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroupId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await leavePortalGroup(selectedGroupId);
      await refreshSession();
      setPortalMode("hub");
      setActiveGroupId(null);
      localStorage.removeItem("pp_active_group_id");
    } catch (leaveError) {
      setError(
        leaveError instanceof Error
          ? leaveError.message
          : "Groep verlaten mislukt."
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
      setPortalMode("hub");
      localStorage.removeItem("pp_active_group_id");
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : "Uitloggen mislukt."
      );
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(
    portalMode === "app" && authReady && authTokenReady && portalSession
  );

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

  const contextValue: PortalContextValue = {
    portalMode,
    ready,
    user: portalSession?.user ?? null,
    groups: portalSession?.groups ?? [],
    memberships: portalSession?.memberships ?? [],
    activeGroupId: activeGroupId ?? null,
    activeGroup,
    logout: handleLogout,
    refreshSession,
    createGroup: async (payload) => {
      const result = await createPortalGroup(payload);
      await refreshSession();
      setSelectedGroupId(result.group.id);
      localStorage.setItem("pp_active_group_id", result.group.id);
      return result;
    },
    joinGroup: async (payload) => {
      const result = await joinPortalGroup(payload);
      await refreshSession();
      setSelectedGroupId(result.group.id);
      localStorage.setItem("pp_active_group_id", result.group.id);
      return result;
    },
    selectGroup: async (groupId) => {
      setSelectedGroupId(groupId);
      localStorage.setItem("pp_active_group_id", groupId);
      await refreshSession();
    },
    selectOverall: async () => {
      setSelectedGroupId("");
      setActiveGroupId(null);
      localStorage.removeItem("pp_active_group_id");
      await refreshSession();
    },
    enterGroup: async (groupId) => {
      if (
        !portalSession?.memberships.some(
          (membership) => membership.groupId === groupId
        )
      ) {
        setError("Je hebt geen toegang tot deze groep.");
        return;
      }
      setSelectedGroupId(groupId);
      setActiveGroupId(groupId);
      localStorage.setItem("pp_active_group_id", groupId);
      setPortalMode("app");
      await refreshSession();
    },
    goToGroupHub: async () => {
      setActiveGroupId(null);
      setSelectedGroupId("");
      localStorage.removeItem("pp_active_group_id");
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
          <div className="mx-auto w-full max-w-6xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-axoft-200">
                  Groepen
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Kies, maak of open een groep
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

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
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
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleJoinGroup}
                        disabled={busy}
                        className="flex-1 rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                      >
                        {busy ? "Bezig..." : "Groep joinen"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedGroupId) {
                            setError("Selecteer eerst een groep.");
                            return;
                          }
                          await contextValue.enterGroup(selectedGroupId);
                        }}
                        disabled={busy || !selectedGroupId}
                        className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-60"
                      >
                        Openen
                      </button>
                    </div>
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

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Groepen
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(portalSession.groups[0]?.id ?? "");
                        setGroupMode("join");
                      }}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                    >
                      Vernieuwen
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {portalSession.groups.length ? (
                      portalSession.groups.map((group) => {
                        const isJoined = portalSession.memberships.some(
                          (membership) => membership.groupId === group.id
                        );
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => {
                              setSelectedGroupId(group.id);
                              setGroupMode(isJoined ? "join" : "create");
                            }}
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              selectedGroupId === group.id
                                ? "border-axoft-400 bg-axoft-500/10 text-white"
                                : "border-white/10 text-slate-200 hover:border-white/20"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span>{group.name}</span>
                              <span className="text-xs text-slate-400">
                                {isJoined ? "Lid" : "Nog niet gekoppeld"} · {group.memberCount} leden
                              </span>
                            </div>
                            {isJoined ? (
                              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                                Lid
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                                Joinen
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-400">
                        Nog geen groepen gevonden.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Groepsbeheer
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {selectedGroupDetails?.group.name ?? "Selecteer een groep"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedGroupDetails
                          ? `${selectedGroupDetails.group.memberCount} leden · ${
                              selectedGroupDetails.viewerRole === "owner"
                                ? "jij bent eigenaar"
                                : "je bent lid"
                            }`
                          : "Kies een groep om beheeropties, leden en code te zien."}
                      </p>
                    </div>
                    {selectedGroupDetails?.viewerRole === "owner" ? (
                      <span className="rounded-full bg-axoft-500/15 px-3 py-1 text-xs font-semibold text-axoft-100">
                        Eigenaar
                      </span>
                    ) : selectedGroupDetails ? (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                        Lid
                      </span>
                    ) : null}
                  </div>

                  {selectedGroupDetails ? (
                    <div className="mt-4 space-y-4">
                      {selectedGroupDetails.viewerRole === "owner" ? (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                          <label className="block text-xs uppercase tracking-[0.25em] text-slate-400">
                            Groepsnaam
                          </label>
                          <input
                            type="text"
                            value={groupNameDraft}
                            onChange={(e) => setGroupNameDraft(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                          />
                          <label className="block text-xs uppercase tracking-[0.25em] text-slate-400">
                            Geheime code
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              type="text"
                              value={joinCodeDraft}
                              onChange={(e) => setJoinCodeDraft(e.target.value)}
                              className="flex-1 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                            />
                            <button
                              type="button"
                              onClick={handleCopyJoinCode}
                              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                            >
                              Kopieer
                            </button>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={handleSaveGroup}
                              disabled={groupDetailsSaving}
                              className="flex-1 rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                            >
                              {groupDetailsSaving ? "Opslaan..." : "Wijzigingen opslaan"}
                            </button>
                            <button
                              type="button"
                              onClick={handleRegenerateJoinCode}
                              disabled={groupDetailsSaving}
                              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-60"
                            >
                              Nieuwe code
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                          Alleen de eigenaar kan groepsnaam en code aanpassen.
                        </div>
                      )}

                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                              Leden
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              {groupDetailsLoading
                                ? "Leden laden..."
                                : `${selectedGroupDetails.members.length} ingeschreven`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedGroupId) {
                                return;
                              }
                              await contextValue.enterGroup(selectedGroupId);
                            }}
                            disabled={busy}
                            className="rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                          >
                            Dashboard openen
                          </button>
                        </div>

                        <div className="mt-4 space-y-2">
                          {selectedGroupDetails.members.map((member) => (
                            <div
                              key={member.uid}
                              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm"
                            >
                              <div>
                                <p className="font-medium text-white">
                                  {member.displayName ?? member.email ?? member.uid}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {member.role === "owner" ? "Eigenaar" : "Lid"} ·{" "}
                                  {new Date(member.joinedAt).toLocaleDateString("nl-NL", {
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </p>
                              </div>
                              {selectedGroupDetails.viewerRole === "owner" &&
                              member.role !== "owner" ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.uid)}
                                  disabled={removingMemberUid === member.uid}
                                  className="rounded-full border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:opacity-60"
                                >
                                  {removingMemberUid === member.uid ? "..." : "Verwijder"}
                                </button>
                              ) : (
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                                  {member.role === "owner" ? "Eigenaar" : "Lid"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={async () => {
                            const targetGroupId =
                              selectedGroupId ||
                              portalSession.memberships[0]?.groupId ||
                              "";
                            if (!targetGroupId) {
                              setError("Selecteer eerst een groep.");
                              return;
                            }
                            await contextValue.enterGroup(targetGroupId);
                          }}
                          disabled={busy}
                          className="flex-1 rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                        >
                          Dashboard openen
                        </button>
                        <button
                          type="button"
                          onClick={() => setPortalMode("hub")}
                          className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                        >
                          In hub blijven
                        </button>
                        {selectedGroupDetails.viewerRole === "member" ? (
                          <button
                            type="button"
                            onClick={handleLeaveGroup}
                            disabled={busy}
                            className="rounded-2xl border border-rose-400/40 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:opacity-60"
                          >
                            Groep verlaten
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      Selecteer een groep links om groepsbeheer te openen.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalProvider>
  );
}

export default SoftGate;
