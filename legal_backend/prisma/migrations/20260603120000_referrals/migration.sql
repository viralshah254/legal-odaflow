-- Referral program: ReferralCode, Referral, UserDeviceFingerprint

CREATE TABLE "ReferralCode" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

ALTER TABLE "ReferralCode"
    ADD CONSTRAINT "ReferralCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Referral" (
    "id"                          TEXT NOT NULL,
    "referrerUserId"              TEXT NOT NULL,
    "refereeUserId"               TEXT NOT NULL,
    "referralCode"                TEXT NOT NULL,
    "status"                      TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason"             TEXT,
    "refereeDeviceFingerprintHash" TEXT,
    "refereeSignupIp"             TEXT,
    "subscriptionId"              TEXT,
    "subscribedAt"                TIMESTAMP(3),
    "rewardedAt"                  TIMESTAMP(3),
    "referrerRewardCredits"       INTEGER,
    "refereeDiscountApplied"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_refereeUserId_key" ON "Referral"("refereeUserId");
CREATE INDEX "Referral_referrerUserId_idx" ON "Referral"("referrerUserId");
CREATE INDEX "Referral_status_idx" ON "Referral"("status");
CREATE INDEX "Referral_referralCode_idx" ON "Referral"("referralCode");
CREATE INDEX "Referral_createdAt_idx" ON "Referral"("createdAt");

ALTER TABLE "Referral"
    ADD CONSTRAINT "Referral_referrerUserId_fkey"
    FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Referral"
    ADD CONSTRAINT "Referral_refereeUserId_fkey"
    FOREIGN KEY ("refereeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Referral"
    ADD CONSTRAINT "Referral_referralCode_fkey"
    FOREIGN KEY ("referralCode") REFERENCES "ReferralCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserDeviceFingerprint" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "source"          TEXT NOT NULL,
    "lastSeenAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDeviceFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDeviceFingerprint_userId_fingerprintHash_key"
    ON "UserDeviceFingerprint"("userId", "fingerprintHash");
CREATE INDEX "UserDeviceFingerprint_fingerprintHash_idx" ON "UserDeviceFingerprint"("fingerprintHash");
CREATE INDEX "UserDeviceFingerprint_userId_idx" ON "UserDeviceFingerprint"("userId");

ALTER TABLE "UserDeviceFingerprint"
    ADD CONSTRAINT "UserDeviceFingerprint_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
