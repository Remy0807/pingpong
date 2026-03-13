-- CreateTable
CREATE TABLE "DoublesMatch" (
    "id" SERIAL NOT NULL,
    "teamOnePlayerAId" INTEGER NOT NULL,
    "teamOnePlayerBId" INTEGER NOT NULL,
    "teamTwoPlayerAId" INTEGER NOT NULL,
    "teamTwoPlayerBId" INTEGER NOT NULL,
    "teamOnePoints" INTEGER NOT NULL,
    "teamTwoPoints" INTEGER NOT NULL,
    "winnerTeam" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seasonId" INTEGER,

    CONSTRAINT "DoublesMatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DoublesMatch" ADD CONSTRAINT "DoublesMatch_teamOnePlayerAId_fkey" FOREIGN KEY ("teamOnePlayerAId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoublesMatch" ADD CONSTRAINT "DoublesMatch_teamOnePlayerBId_fkey" FOREIGN KEY ("teamOnePlayerBId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoublesMatch" ADD CONSTRAINT "DoublesMatch_teamTwoPlayerAId_fkey" FOREIGN KEY ("teamTwoPlayerAId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoublesMatch" ADD CONSTRAINT "DoublesMatch_teamTwoPlayerBId_fkey" FOREIGN KEY ("teamTwoPlayerBId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoublesMatch" ADD CONSTRAINT "DoublesMatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
