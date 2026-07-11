-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "fulfillment" TEXT,
ADD COLUMN     "uberDeliveryId" TEXT,
ADD COLUMN     "uberTrackingUrl" TEXT;
