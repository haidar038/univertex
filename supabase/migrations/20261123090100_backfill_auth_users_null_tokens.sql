-- Normalisasi baris auth.users lama hasil admin_import_class_users yang
-- confirmation_token / recovery_token-nya NULL (1560 baris di staging,
-- 2026-11-23). Tanpa ini, POST /token gagal 500:
--   Scan error on column index 3, name "confirmation_token":
--   converting NULL to string is unsupported
--
-- Idempotent. Hanya mengisi kolom token; tidak menyentuh email, password,
-- metadata, status konfirmasi, atau role.

UPDATE auth.users
SET confirmation_token        = COALESCE(confirmation_token, ''),
    recovery_token            = COALESCE(recovery_token, ''),
    email_change_token_new    = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token    = COALESCE(reauthentication_token, ''),
    phone_change_token        = COALESCE(phone_change_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL
   OR phone_change_token IS NULL;
