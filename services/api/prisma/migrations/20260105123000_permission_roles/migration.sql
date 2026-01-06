-- Create table for custom permission-roles
CREATE TABLE IF NOT EXISTS "permission_roles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permission_roles_name_key" ON "permission_roles"("name");

-- Add optional link from users -> permission_roles
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissionRoleId" TEXT;

-- Foreign key (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_permissionRoleId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_permissionRoleId_fkey"
      FOREIGN KEY ("permissionRoleId") REFERENCES "permission_roles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_permissionRoleId_idx" ON "users"("permissionRoleId");


