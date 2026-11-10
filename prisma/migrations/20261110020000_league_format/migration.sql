-- AlterTable
ALTER TABLE "League" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'dynasty';
ALTER TABLE "League" ADD COLUMN "picksTradeable" BOOLEAN;
