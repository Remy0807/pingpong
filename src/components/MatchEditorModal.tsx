import { useCallback } from "react";
import type { Match, PlayerStats } from "../types";
import type { MatchPayload } from "../lib/api";
import { MatchForm, type MatchFormValues } from "./MatchForm";
import { Modal } from "./Modal";

type MatchEditorModalProps = {
  match: Match | null;
  open: boolean;
  players: PlayerStats[];
  playerOptions?: Array<{
    value: number;
    label: string;
  }>;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (id: number, payload: MatchPayload) => Promise<void> | void;
};

export function MatchEditorModal({
  match,
  open,
  players,
  playerOptions,
  loading,
  onClose,
  onSubmit
}: MatchEditorModalProps) {
  const handleSubmit = useCallback(
    async (values: MatchFormValues) => {
      if (!match) {
        return;
      }
      await onSubmit(match.id, {
        playerOneId: values.playerOneId,
        playerTwoId: values.playerTwoId,
        playerOnePoints: values.playerOnePoints,
        playerTwoPoints: values.playerTwoPoints,
        playedAt: values.playedAt
      });
      onClose();
    },
    [match, onClose, onSubmit]
  );

  if (!open || !match) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Wedstrijd aanpassen"
      description="Corrigeer spelers, scores of datum. Statistieken werken automatisch bij."
      size="lg"
    >
      <MatchForm
        players={players}
        playerOptions={playerOptions}
        loading={loading}
        onSubmit={handleSubmit}
        submitLabel="Wedstrijd bijwerken"
        showHeader={false}
        className="flex flex-col gap-5"
        initialValues={{
          playerOneId: match.playerOneId,
          playerTwoId: match.playerTwoId,
          playerOnePoints: match.playerOnePoints,
          playerTwoPoints: match.playerTwoPoints,
          playedAt: match.playedAt
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
