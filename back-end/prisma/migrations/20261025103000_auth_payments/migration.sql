ALTER TABLE users ADD COLUMN name text NOT NULL DEFAULT 'Participante',
  ADD COLUMN google_subject text UNIQUE,
  ADD COLUMN terms_accepted_at timestamptz(3);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_email_normalized;
ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK (
  email = lower(email) AND email = btrim(email) AND char_length(email) BETWEEN 3 AND 254
  AND (password_hash IS NULL OR char_length(password_hash) > 0)
  AND (password_hash IS NOT NULL OR google_subject IS NOT NULL)
  AND char_length(btrim(name)) BETWEEN 1 AND 100
);
CREATE TABLE oauth_states (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  code_verifier text NOT NULL,
  nonce text NOT NULL,
  return_to text,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  session_hash text,
  expires_at timestamptz(3) NOT NULL
);
CREATE INDEX oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX oauth_states_user ON oauth_states(user_id);
CREATE TABLE test_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  brand text NOT NULL DEFAULT 'Visa' CHECK (brand = 'Visa'),
  last4 text NOT NULL DEFAULT '4242' CHECK (last4 = '4242'),
  expiry_month integer NOT NULL DEFAULT 12 CHECK (expiry_month = 12),
  expiry_year integer NOT NULL DEFAULT 2034 CHECK (expiry_year = 2034)
);
ALTER TABLE wallet_entries ADD COLUMN method text CHECK (method IN ('PIX', 'CARD')),
  ADD COLUMN card_last4 text CHECK (card_last4 IS NULL OR card_last4 = '4242');
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_method CHECK (
  (method IS NULL AND card_last4 IS NULL) OR
  (method IS NOT NULL AND kind = 'DEPOSIT' AND ((method = 'PIX' AND card_last4 IS NULL) OR (method = 'CARD' AND card_last4 IS NOT NULL)))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_states, test_cards TO auction_app;
