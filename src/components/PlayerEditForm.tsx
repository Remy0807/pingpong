import { useState } from "react";

type PlayerEditFormProps = {
  initialName: string;
  onSubmit: (name: string) => Promise<void> | void;
  loading?: boolean;
  onCancel?: () => void;
};

const MAX_NAME_LENGTH = 40;

export function PlayerEditForm({ initialName, onSubmit, loading, onCancel }: PlayerEditFormProps) {
  const [name, setName] = useState(initialName);
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
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="player-edit-name" className="block text-sm font-medium text-slate-200">
          Naam
        </label>
        <input
          id="player-edit-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-2.5 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
        />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
          >
            Annuleren
          </button>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-axoft-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
        >
          {loading ? "Opslaan..." : "Wijziging opslaan"}
        </button>
      </div>
    </form>
  );
}
