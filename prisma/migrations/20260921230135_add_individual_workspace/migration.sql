-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('PERSONAL', 'INDIVIDUAL');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'INDIVIDUAL';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "type" "TenantType" NOT NULL DEFAULT 'PERSONAL';
