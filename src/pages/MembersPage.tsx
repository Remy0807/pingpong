import { useEffect, useMemo, useState } from "react";
import { usePortal } from "../context/PortalContext";
import { getPortalGroup, type PortalGroupDetails } from "../lib/api";

function roleLabel(role: "owner" | "member") {
  return role === "owner" ? "Beheerder" : "Lid";
}

export function MembersPage() {
  const { activeGroup } = usePortal();
  const [details, setDetails] = useState<PortalGroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeGroup) {
      setDetails(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    getPortalGroup(activeGroup.id)
      .then(setDetails)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Kon groepsleden niet laden.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeGroup]);

  const memberCount = useMemo(() => details?.members.length ?? 0, [details]);

  if (!activeGroup) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
        <h2 className="text-2xl font-semibold text-white">Leden</h2>
        <p className="mt-2 text-sm text-slate-400">
          Selecteer eerst een groep om de leden en rollen te bekijken.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-axoft-200">
          Groepsleden
        </p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{activeGroup.name}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {memberCount} {memberCount === 1 ? "lid" : "leden"} in deze groep.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Jouw rol
            </p>
            <p className="mt-1 font-semibold text-white">
              {details ? roleLabel(details.viewerRole) : "Laden..."}
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
          Groepsleden laden...
        </section>
      ) : error ? (
        <section className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-sm text-rose-100">
          {error}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {details?.members.map((member) => (
            <article
              key={member.uid}
              className="rounded-3xl border border-white/10 bg-slate-950/50 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-white">
                    {member.displayName ?? member.email ?? member.uid}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                    {roleLabel(member.role)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    member.role === "owner"
                      ? "bg-axoft-500 text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200"
                  }`}
                >
                  {member.role === "owner" ? "Beheerder" : "Lid"}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p className="truncate">
                  <span className="text-slate-500">E-mail:</span>{" "}
                  {member.email ?? "Niet beschikbaar"}
                </p>
                <p>
                  <span className="text-slate-500">Joined:</span>{" "}
                  {new Date(member.joinedAt).toLocaleDateString("nl-NL", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
