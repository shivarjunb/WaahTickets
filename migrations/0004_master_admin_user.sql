PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (
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
    'pbkdf2$100000$LYknBpNkdtgOvLdVNl93hA==$aLAD1F/xJlji/Ut3QUc9+rtMrZCUVFqfgxECBqKd1WY=',
    'Admin',
    1,
    1,
    'password',
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO user_web_roles (id, user_id, web_role_id, created_at)
VALUES ('master-admin-role-link', 'master-admin-user', 'role-admin', datetime('now'));
