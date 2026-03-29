-- CreateEnum
CREATE TYPE "PaidBy" AS ENUM ('PERSONAL', 'COMPANY');

-- AlterTable
ALTER TABLE "approval_steps" ADD COLUMN     "is_required" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "approval_workflows" ADD COLUMN     "is_manager_approver" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'United States',
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "company_currency" VARCHAR(3),
ADD COLUMN     "converted_amount" DECIMAL(12,2),
ADD COLUMN     "exchange_rate" DECIMAL(16,8),
ADD COLUMN     "paid_by" "PaidBy" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "title" TEXT;
