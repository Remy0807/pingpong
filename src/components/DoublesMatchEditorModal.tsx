import { useCallback } from "react";
import type { DoublesMatch, PlayerStats } from "../types";
import type { DoublesMatchPayload } from "../lib/api";
import {
  DoublesMatchForm,
  type DoublesMatchFormValues,
} from "./DoublesMatchForm";
import { Modal } from "./Modal";

type DoublesMatchEditorModalProps = {
  match: DoublesMatch | null;
  open: boolean;
  players: PlayerStats[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (id: number, payload: DoublesMatchPayload) => Promise<void> | void;
};

export function DoublesMatchEditorModal({
  match,
  open,
  players,
  loading,
  onClose,
  onSubmit,
}: DoublesMatchEditorModalProps) {
  const handleSubmit = useCallback(
    async (values: DoublesMatchFormValues) => {
      if (!match) {
        return;
      }

      await onSubmit(match.id, values);
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
      title="2v2 aanpassen"
      description="Corrigeer teams, score of datum. Het doubles leaderboard werkt direct bij."
      size="lg"
    >
      <DoublesMatchForm
        players={players}
        loading={loading}
        onSubmit={handleSubmit}
        submitLabel="2v2 bijwerken"
        showHeader={false}
        className="flex flex-col gap-5"
        initialValues={{
          teamOnePlayerAId: match.teamOnePlayerAId,
          teamOnePlayerBId: match.teamOnePlayerBId,
          teamTwoPlayerAId: match.teamTwoPlayerAId,
          teamTwoPlayerBId: match.teamTwoPlayerBId,
          teamOnePoints: match.teamOnePoints,
          teamTwoPoints: match.teamTwoPoints,
          playedAt: match.playedAt,
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
