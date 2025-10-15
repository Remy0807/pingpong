import { useState } from "react";

type PlayerFormProps = {
  onCreate: (name: string) => Promise<void> | void;
  loading?: boolean;
  title?: string;
  description?: string;
  showHeader?: boolean;
  className?: string;
};

const MAX_NAME_LENGTH = 40;

export function PlayerForm({
  onCreate,
  loading,
  title = "Speler toevoegen",
  description = "Voeg collega's toe zodat hun resultaten automatisch worden bijgehouden.",
  showHeader = true,
  className
}: PlayerFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Voer een naam in.");
      return;
    }

    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Naam is te lang (max ${MAX_NAME_LENGTH} tekens).`);
      return;
    }

    try {
      setError(null);
      await onCreate(trimmed);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={className ?? "glass-card rounded-xl p-6 space-y-4"}
    >
      {showHeader ? (
        <header className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-axoft-300">Nieuw</span>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? <p className="text-sm text-slate-400">{description}</p> : null}
        </header>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="player-name" className="block text-sm font-medium text-slate-200">
          Naam
        </label>
        <input
          id="player-name"
          name="name"
          autoComplete="off"
          placeholder="Bijvoorbeeld: Remy"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
        />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
      >
        {loading ? "Opslaan..." : "Speler opslaan"}
      </button>
    </form>
  );
}
