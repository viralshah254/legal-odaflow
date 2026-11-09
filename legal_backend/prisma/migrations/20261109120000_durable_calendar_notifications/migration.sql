-- No historical notifications are queued and no existing event receives an
-- unsolicited reminder. New server-created events opt in explicitly.
ALTER TABLE "CalendarEvent" ADD COLUMN "reminderMinutes" INTEGER;
ALTER TABLE "CalendarEvent" ADD COLUMN "reminderAt" TIMESTAMP(3);
CREATE INDEX "CalendarEvent_reminderAt_idx" ON "CalendarEvent"("reminderAt");
CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "lastErrorClass" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_key" ON "NotificationDelivery"("notificationId");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
