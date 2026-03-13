-- Reassign matches from duplicate season rows to the canonical season.
WITH ranked AS (
  SELECT
    id,
    "startDate",
    "endDate",
    MIN(id) OVER (PARTITION BY "startDate", "endDate") AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY "startDate", "endDate" ORDER BY id) AS rn
  FROM "Season"
),
dups AS (
  SELECT id AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE "Match" AS m
SET "seasonId" = d.keep_id
FROM dups d
WHERE m."seasonId" = d.duplicate_id;

-- Preserve a champion on the canonical row if one of the duplicates had it.
WITH grouped AS (
  SELECT
    MIN(id) AS keep_id,
    MAX("championId") FILTER (WHERE "championId" IS NOT NULL) AS champion_id,
    "startDate",
    "endDate"
  FROM "Season"
  GROUP BY "startDate", "endDate"
)
UPDATE "Season" AS s
SET "championId" = g.champion_id
FROM grouped g
WHERE s.id = g.keep_id
  AND s."championId" IS NULL
  AND g.champion_id IS NOT NULL;

-- Delete duplicates, keep the lowest ID per season window.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "startDate", "endDate" ORDER BY id) AS rn
  FROM "Season"
)
DELETE FROM "Season" AS s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Prevent duplicate seasons for the same month window.
CREATE UNIQUE INDEX "Season_startDate_endDate_key"
ON "Season"("startDate", "endDate");
