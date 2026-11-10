-- AlterTable
ALTER TABLE "PersonalValue" ADD COLUMN "userSet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PersonalPickValue" ADD COLUMN "userSet" BOOLEAN NOT NULL DEFAULT false;

-- Ratings that no longer match the market were changed by the manager; keep them.
UPDATE "PersonalValue" pv
SET "userSet" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "BaselineValue" bv
  WHERE bv."leagueId" = pv."leagueId"
    AND bv."playerId" = pv."playerId"
    AND bv."value" = pv."value"
);

UPDATE "PersonalPickValue" pp
SET "userSet" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "BaselinePickValue" bp
  WHERE bp."leagueId" = pp."leagueId"
    AND bp."pickId" = pp."pickId"
    AND bp."value" = pp."value"
);
