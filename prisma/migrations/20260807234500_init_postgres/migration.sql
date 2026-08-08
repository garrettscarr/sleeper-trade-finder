-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "sleeperLeagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "scoringType" TEXT NOT NULL DEFAULT '1QB',
    "inviteCode" TEXT NOT NULL,
    "adminCode" TEXT NOT NULL,
    "baselineSource" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "sleeperRosterId" INTEGER NOT NULL,
    "sleeperOwnerId" TEXT,
    "displayName" TEXT NOT NULL,
    "teamName" TEXT,
    "avatar" TEXT,
    "playerIds" TEXT NOT NULL DEFAULT '[]',
    "claimedLabel" TEXT,
    "claimToken" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sleeperPlayerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "position" TEXT,
    "nflTeam" TEXT,
    "status" TEXT,
    "age" INTEGER,
    "yearsExp" INTEGER,
    "searchName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineValue" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BaselineValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalValue" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "tier" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "rosterId" INTEGER NOT NULL,
    "originalRosterId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselinePickValue" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "pickId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BaselinePickValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalPickValue" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "pickId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "tier" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalPickValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_sleeperLeagueId_key" ON "League"("sleeperLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "League_adminCode_key" ON "League"("adminCode");

-- CreateIndex
CREATE UNIQUE INDEX "Team_claimToken_key" ON "Team"("claimToken");

-- CreateIndex
CREATE UNIQUE INDEX "Team_leagueId_sleeperRosterId_key" ON "Team"("leagueId", "sleeperRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sleeperPlayerId_key" ON "Player"("sleeperPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineValue_leagueId_playerId_key" ON "BaselineValue"("leagueId", "playerId");

-- CreateIndex
CREATE INDEX "PersonalValue_leagueId_teamId_idx" ON "PersonalValue"("leagueId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalValue_teamId_playerId_key" ON "PersonalValue"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_leagueId_season_round_originalRosterId_key" ON "DraftPick"("leagueId", "season", "round", "originalRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselinePickValue_leagueId_pickId_key" ON "BaselinePickValue"("leagueId", "pickId");

-- CreateIndex
CREATE INDEX "PersonalPickValue_leagueId_teamId_idx" ON "PersonalPickValue"("leagueId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalPickValue_teamId_pickId_key" ON "PersonalPickValue"("teamId", "pickId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineValue" ADD CONSTRAINT "BaselineValue_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineValue" ADD CONSTRAINT "BaselineValue_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalValue" ADD CONSTRAINT "PersonalValue_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalValue" ADD CONSTRAINT "PersonalValue_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselinePickValue" ADD CONSTRAINT "BaselinePickValue_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselinePickValue" ADD CONSTRAINT "BaselinePickValue_pickId_fkey" FOREIGN KEY ("pickId") REFERENCES "DraftPick"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPickValue" ADD CONSTRAINT "PersonalPickValue_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPickValue" ADD CONSTRAINT "PersonalPickValue_pickId_fkey" FOREIGN KEY ("pickId") REFERENCES "DraftPick"("id") ON DELETE CASCADE ON UPDATE CASCADE;
