-- Security/performance indexes identified in security audit

CREATE INDEX IF NOT EXISTS "payments_orderId_idx" ON "payments"("orderId");

CREATE INDEX IF NOT EXISTS "User_resetToken_idx" ON "users"("resetToken");

CREATE INDEX IF NOT EXISTS "gdpr_consent_logs_userId_idx" ON "gdpr_consent_logs"("userId");
