import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkline } from "../components/Sparkline";
import { useAppData } from "../context/AppDataContext";
import { usePortal } from "../context/PortalContext";

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
});

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function DashboardCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function MatchMiniList({
  title,
  items,
  emptyText,
  moreTo,
}: {
  title: string;
  items: Array<{
    id: string | number;
    title: string;
    subtitle: string;
    score: string;
    won?: boolean;
  }>;
  emptyText: string;
  moreTo: string;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Resultaten
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
        </div>
        <Link
          to={moreTo}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
        >
          Meer
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-xs text-slate-400">{item.subtitle}</p>
              </div>
              <div
                className={`text-sm font-semibold ${
                  item.won == null
                    ? "text-white"
                    : item.won
                      ? "text-emerald-300"
                      : "text-rose-300"
                }`}
              >
                {item.score}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { players, matches, doublesMatches, accountOverview, groupMembers } =
    useAppData();
  const { user, activeGroup, selectGroup } = usePortal();

  const currentPlayer = useMemo(
    () => players.find((entry) => entry.player.uid === user?.uid) ?? null,
    [players, user?.uid],
  );

  const overviewHistory = accountOverview?.monthlyHistory ?? [];
  const overviewTotals = accountOverview?.totals ?? null;
  const overviewCurrentMonth =
    accountOverview?.currentMonth ?? overviewHistory.at(-1) ?? null;
  const overviewMatchSeries = useMemo(
    () => overviewHistory.map((month) => month.matches),
    [overviewHistory],
  );
  const personalSingles = useMemo(() => {
    if (!activeGroup || !currentPlayer) {
      return [];
    }

    return [...matches]
      .filter(
        (match) =>
          match.playerOneId === currentPlayer.player.id ||
          match.playerTwoId === currentPlayer.player.id,
      )
      .sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
      )
      .slice(0, 3);
  }, [activeGroup, currentPlayer, matches]);

  const personalDoubles = useMemo(() => {
    if (!activeGroup || !currentPlayer) {
      return [];
    }

    return [...doublesMatches]
      .filter((match) =>
        [
          match.teamOnePlayerAId,
          match.teamOnePlayerBId,
          match.teamTwoPlayerAId,
          match.teamTwoPlayerBId,
        ].includes(currentPlayer.player.id),
      )
      .sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
      )
      .slice(0, 3);
  }, [activeGroup, currentPlayer, doublesMatches]);

  const recentActivity = useMemo(() => {
    if (activeGroup) {
      return [];
    }

    return accountOverview?.recentMatches.slice(0, 5) ?? [];
  }, [accountOverview?.recentMatches, activeGroup]);

  const groupSummaries = accountOverview?.groupSummaries ?? [];

  if (!activeGroup && !accountOverview) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
          Dashboard
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          Overzicht laden...
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          Even geduld, we halen je accountgegevens op.
        </p>
      </div>
    );
  }

  if (!activeGroup && accountOverview) {
    return (
      <div className="space-y-8">
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
            <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
              Mijn account
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Goed om je weer te zien,{" "}
              {accountOverview.user.displayName ??
                accountOverview.user.email ??
                "speler"}.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Dit is je persoonlijke overzicht over alle groepen. De focus ligt
              op je totale vorm, je maand en je recente activiteit.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
            <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
              Maandtrend
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Laatste maanden
            </h3>
            <Sparkline values={overviewMatchSeries} className="mt-5 h-12 w-full" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {overviewHistory.slice(-3).map((month) => (
                <div
                  key={month.key}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-3"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {month.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {month.matches} matches
                  </p>
                  <p className="text-xs text-slate-400">
                    {month.wins} winst • {month.losses} verlies
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            label="Matches"
            value={overviewTotals?.matches ?? 0}
            detail={
              overviewCurrentMonth
                ? `${overviewCurrentMonth.label} actief`
                : "Geen data"
            }
          />
          <DashboardCard
            label="Winrate"
            value={overviewTotals ? `${Math.round(overviewTotals.winRate * 100)}%` : "—"}
            detail="Over al je groepen"
          />
          <DashboardCard
            label="Punten saldo"
            value={
              overviewTotals
                ? formatSigned(overviewTotals.pointsFor - overviewTotals.pointsAgainst)
                : "—"
            }
            detail="Voor minus tegen"
          />
          <DashboardCard
            label="Groepen"
            value={overviewTotals?.groupsPlayed ?? 0}
            detail="Waar je actief bent"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
                  Mijn groepen
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Waar je nu in speelt
                </h3>
              </div>
              <Link
                to="/members"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
              >
                Groepsbeheer
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {groupSummaries.length ? (
                groupSummaries.map((groupSummary) => (
                  <div
                    key={groupSummary.group.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {groupSummary.group.name}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {groupSummary.role === "owner" ? "Beheerder" : "Lid"} ·{" "}
                          {groupSummary.group.memberCount} leden
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void selectGroup(groupSummary.group.id)}
                        className="rounded-full bg-axoft-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                      >
                        Openen
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl bg-slate-950/50 p-3">
                        <p className="text-xs text-slate-400">Matches</p>
                        <p className="text-white">{groupSummary.matches}</p>
                      </div>
                      <div className="rounded-xl bg-slate-950/50 p-3">
                        <p className="text-xs text-slate-400">Win%</p>
                        <p className="text-white">
                          {groupSummary.matches
                            ? `${Math.round((groupSummary.wins / groupSummary.matches) * 100)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-950/50 p-3">
                        <p className="text-xs text-slate-400">Laatste</p>
                        <p className="truncate text-white">
                          {groupSummary.lastPlayedAt
                            ? dateFormatter.format(new Date(groupSummary.lastPlayedAt))
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                  Nog geen groepen gekoppeld. Maak of join een groep via de
                  sidebar.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
                  Recente activiteit
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Laatste potjes
                </h3>
              </div>
              <Link
                to="/matches"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
              >
                Wedstrijden
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {recentActivity.length ? (
                recentActivity.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-white">{match.title}</p>
                      <p className="text-xs text-slate-400">
                        {match.groupName} ·{" "}
                        {dateFormatter.format(new Date(match.playedAt))}
                      </p>
                    </div>
                    <div className={`font-semibold ${match.won ? "text-emerald-300" : "text-rose-300"}`}>
                      {match.scored}-{match.conceded}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                  Nog geen activiteit om te tonen.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const currentPlayerMatchTitle = currentPlayer ? currentPlayer.player.name : "Jouw account";
  const currentPlayerWinRate = currentPlayer ? `${Math.round(currentPlayer.winRate * 100)}%` : "—";
  const currentPlayerStreak = currentPlayer ? currentPlayer.currentStreak : 0;
  const currentPlayerBalance = currentPlayer
    ? formatSigned(currentPlayer.pointDifferential)
    : "—";

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Mijn groep
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">
            {activeGroup.name}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Hier zie je alleen de snelle samenvatting van de geselecteerde
            groep. Voor standen en seizoenen ga je naar de aparte standenpagina.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Snelle acties
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              to="/matches"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
            >
              Wedstrijden
            </Link>
            <Link
              to="/standings"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
            >
              Standen
            </Link>
            <Link
              to="/doubles"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
            >
              2v2
            </Link>
            <Link
              to="/members"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
            >
              Groepsbeheer
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Winrate"
          value={currentPlayerWinRate}
          detail={`${currentPlayerMatchTitle} in deze groep`}
        />
        <DashboardCard
          label="Streak"
          value={currentPlayer ? currentPlayerStreak : "—"}
          detail="Achter elkaar gewonnen"
        />
        <DashboardCard
          label="Saldo"
          value={currentPlayerBalance}
          detail="Punten voor minus tegen"
        />
        <DashboardCard
          label="Leden"
          value={groupMembers.length}
          detail="In de geselecteerde groep"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <MatchMiniList
          title="1v1"
          moreTo="/matches"
          emptyText="Nog geen 1v1-potjes gevonden voor deze groep."
          items={personalSingles.map((match) => {
            const isPlayerOne = match.playerOneId === currentPlayer?.player.id;
            const opponent = isPlayerOne ? match.playerTwo : match.playerOne;
            const scored = isPlayerOne ? match.playerOnePoints : match.playerTwoPoints;
            const conceded = isPlayerOne
              ? match.playerTwoPoints
              : match.playerOnePoints;
            return {
              id: match.id,
              title: `Tegen ${opponent.name}`,
              subtitle: `${match.season?.name ?? "Seizoen onbekend"} · ${dateFormatter.format(
                new Date(match.playedAt),
              )}`,
              score: `${scored}-${conceded}`,
              won: match.winnerId === currentPlayer?.player.id,
            };
          })}
        />
        <MatchMiniList
          title="2v2"
          moreTo="/doubles"
          emptyText="Nog geen 2v2-potjes gevonden voor deze groep."
          items={personalDoubles.map((match) => {
            const teamOneNames = [match.teamOnePlayerA.name, match.teamOnePlayerB.name];
            const teamTwoNames = [match.teamTwoPlayerA.name, match.teamTwoPlayerB.name];
            const isTeamOne = [
              match.teamOnePlayerAId,
              match.teamOnePlayerBId,
            ].includes(currentPlayer?.player.id ?? -1);
            const scored = isTeamOne ? match.teamOnePoints : match.teamTwoPoints;
            const conceded = isTeamOne ? match.teamTwoPoints : match.teamOnePoints;
            return {
              id: match.id,
              title: `${teamOneNames.join(" + ")} vs ${teamTwoNames.join(" + ")}`,
              subtitle: `${match.season?.name ?? "Seizoen onbekend"} · ${dateFormatter.format(
                new Date(match.playedAt),
              )}`,
              score: `${scored}-${conceded}`,
              won: match.winnerTeam === (isTeamOne ? 1 : 2),
            };
          })}
        />
      </section>
    </div>
  );
}
