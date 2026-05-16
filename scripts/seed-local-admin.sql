-- Local/dev admin seed. Password: 123

INSERT INTO users (
  id,
  first_name,
  last_name,
  email,
  password_hash,
  webrole,
  is_active,
  is_email_verified,
  auth_provider,
  created_at,
  updated_at
)
VALUES (
  'master-admin-user',
  'Master',
  'Admin',
  'admin@waahtickets.local',
  'pbkdf2$100000$bfzgFSXHrjuJsUEvODTFZw==$ojIFcJ0P0fUkmSo1Vht49xW0cE0juSn95JiQaxGy42o=',
  'Admin',
  1,
  1,
  'password',
  datetime('now'),
  datetime('now')
)
ON CONFLICT(email) DO UPDATE SET
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  password_hash = excluded.password_hash,
  webrole = excluded.webrole,
  is_active = 1,
  is_email_verified = 1,
  auth_provider = 'password',
  updated_at = datetime('now');

INSERT OR IGNORE INTO user_web_roles (id, user_id, web_role_id, created_at)
SELECT 'master-admin-role-link', id, 'role-admin', datetime('now')
FROM users
WHERE lower(email) = 'admin@waahtickets.local';
