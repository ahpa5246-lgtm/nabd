// Set these two PUBLIC values only after creating a Supabase project and applying
// supabase/migrations/20261017_secure_multitenant.sql.
// The publishable / sb_publishable_ key is not secret. NEVER put a service-role,
// sb_secret_ or database-password value in this file or frontend source.
export const CLOUD_CONFIG = Object.freeze({
  url: '',
  publishableKey: ''
});
