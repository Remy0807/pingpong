export type BadgeId =
  | "in-form"
  | "perfect-month"
  | "dominance"
  | "marathoner"
  | "win-machine"
  | "clean-sheet"
  | "points-collector";

export type BadgeCategory = "Reeks" | "Seizoen" | "Momentum" | "Legend";

export type BadgeDefinition = {
  id: BadgeId;
  label: string;
  description: string;
  category: BadgeCategory;
};

export type PlayerBadge = BadgeDefinition & {
  earnedAt?: string;
};

export const badgeCatalog: Record<BadgeId, BadgeDefinition> = {
  "in-form": {
    id: "in-form",
    label: "In vorm",
    description: "Actieve winstreak van minimaal drie wedstrijden.",
    category: "Momentum",
  },
  "perfect-month": {
    id: "perfect-month",
    label: "Perfecte maand",
    description:
      "Minstens drie wedstrijden gespeeld en geen enkele verloren in het huidige seizoen.",
    category: "Seizoen",
  },
  dominance: {
    id: "dominance",
    label: "Dominantie",
    description:
      "Ten minste vijf wedstrijden gespeeld en 75% daarvan gewonnen in het seizoen.",
    category: "Seizoen",
  },
  marathoner: {
    id: "marathoner",
    label: "Marathonspeler",
    description: "Tien of meer wedstrijden in hetzelfde seizoen gespeeld.",
    category: "Seizoen",
  },
  "win-machine": {
    id: "win-machine",
    label: "Winmachine",
    description: "Een winstreak van vijf of meer op enig moment bereikt.",
    category: "Legend",
  },
  "clean-sheet": {
    id: "clean-sheet",
    label: "Clean sheet",
    description:
      "Een wedstrijd gewonnen waarbij de tegenstander maximaal vijf punten scoorde.",
    category: "Momentum",
  },
  "points-collector": {
    id: "points-collector",
    label: "Puntentijger",
    description:
      "Meer dan 250 punten gescoord in totaal gedurende het seizoen.",
    category: "Seizoen",
  },
};

export const badgeList = Object.values(badgeCatalog);

export const getBadgeDefinition = (id: BadgeId) => badgeCatalog[id];

export const createPlayerBadge = (
  id: BadgeId,
  earnedAt?: Date
): PlayerBadge | undefined => {
  const definition = getBadgeDefinition(id);
  if (!definition) {
    return undefined;
  }
  return {
    ...definition,
    earnedAt: earnedAt ? earnedAt.toISOString() : undefined,
  };
};
