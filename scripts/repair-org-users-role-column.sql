-- One-time repair for databases that drifted and missed organization_users.role.
-- Run against the affected database only.
ALTER TABLE organization_users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';

-- Defensive backfill in case any row ends up null/empty.
UPDATE organization_users
SET role = 'admin'
WHERE role IS NULL OR trim(role) = '';
