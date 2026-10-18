-- CreateTable
CREATE TABLE "UserDraftStyle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sampleDocuments" JSONB NOT NULL DEFAULT '[]',
    "styleProfile" TEXT,
    "styleKeywords" TEXT[],
    "avoidPatterns" TEXT[],
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "styleVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDraftStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDraftStyle_userId_key" ON "UserDraftStyle"("userId");

-- AddForeignKey
ALTER TABLE "UserDraftStyle" ADD CONSTRAINT "UserDraftStyle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
