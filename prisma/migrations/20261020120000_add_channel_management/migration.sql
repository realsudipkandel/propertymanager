-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('DIRECT', 'MOCK_AIRBNB', 'MOCK_BOOKING_COM', 'MOCK_VRBO');

-- CreateEnum
CREATE TYPE "ChannelConnectionStatus" AS ENUM ('AUTHORIZING', 'MAPPING_REQUIRED', 'ACTIVE', 'DEGRADED', 'ACTION_REQUIRED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ChannelSyncMode" AS ENUM ('FULL_SYNC', 'ARI_ONLY', 'RESERVATIONS_ONLY');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('INQUIRY', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT');

-- CreateTable
CREATE TABLE "channel_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'AUTHORIZING',
    "capabilities" JSONB NOT NULL,
    "credentialReference" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "externalListingId" TEXT NOT NULL,
    "syncMode" "ChannelSyncMode" NOT NULL DEFAULT 'ARI_ONLY',
    "markupBps" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "basePricePence" INTEGER NOT NULL,
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "externalReservationId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "guests" INTEGER NOT NULL,
    "accommodationPence" INTEGER NOT NULL,
    "cleaningPence" INTEGER NOT NULL DEFAULT 0,
    "otherPence" INTEGER NOT NULL DEFAULT 0,
    "grossPence" INTEGER NOT NULL,
    "commissionPence" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "bookingId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_night_locks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reservationId" TEXT NOT NULL,

    CONSTRAINT "reservation_night_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_accounts_tenantId_organizationId_idx" ON "channel_accounts"("tenantId", "organizationId");

-- CreateIndex
CREATE INDEX "listing_mappings_tenantId_organizationId_propertyId_idx" ON "listing_mappings"("tenantId", "organizationId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_mappings_channelAccountId_externalListingId_key" ON "listing_mappings"("channelAccountId", "externalListingId");

-- CreateIndex
CREATE INDEX "daily_rates_tenantId_organizationId_idx" ON "daily_rates"("tenantId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_rates_propertyId_date_key" ON "daily_rates"("propertyId", "date");

-- CreateIndex
CREATE INDEX "reservations_tenantId_organizationId_propertyId_idx" ON "reservations"("tenantId", "organizationId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_organizationId_provider_externalReservationId_key" ON "reservations"("organizationId", "provider", "externalReservationId");

-- CreateIndex
CREATE INDEX "reservation_night_locks_organizationId_idx" ON "reservation_night_locks"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_night_locks_propertyId_date_key" ON "reservation_night_locks"("propertyId", "date");

-- CreateIndex
CREATE INDEX "sync_events_tenantId_organizationId_createdAt_idx" ON "sync_events"("tenantId", "organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sync_events_organizationId_provider_externalEventId_key" ON "sync_events"("organizationId", "provider", "externalEventId");

-- AddForeignKey
ALTER TABLE "channel_accounts" ADD CONSTRAINT "channel_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_mappings" ADD CONSTRAINT "listing_mappings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_mappings" ADD CONSTRAINT "listing_mappings_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_mappings" ADD CONSTRAINT "listing_mappings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_rates" ADD CONSTRAINT "daily_rates_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_night_locks" ADD CONSTRAINT "reservation_night_locks_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

