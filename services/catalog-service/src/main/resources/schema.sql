CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subtitle TEXT,
  price_cents BIGINT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'guitar'
);
