-- Add foreign key constraints for cancellation reviewer user references
ALTER TABLE "cancellation_requests"
  ADD CONSTRAINT "cancellation_requests_sellerReviewedById_fkey"
  FOREIGN KEY ("sellerReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cancellation_requests"
  ADD CONSTRAINT "cancellation_requests_financeReviewedById_fkey"
  FOREIGN KEY ("financeReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cancellation_requests"
  ADD CONSTRAINT "cancellation_requests_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
