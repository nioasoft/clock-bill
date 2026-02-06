-- Migration: Create currency_rates table
-- Description: Stores currency conversion rates per user

-- Create the table
CREATE TABLE IF NOT EXISTS currency_rates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, from_currency, to_currency)
);

-- Grant privileges
GRANT ALL PRIVILEGES ON TABLE currency_rates TO clockbill;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_currency_rates_user_id ON currency_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_rates_currencies ON currency_rates(from_currency, to_currency);

COMMENT ON TABLE currency_rates IS 'Currency conversion rates for multi-currency support';
COMMENT ON COLUMN currency_rates.user_id IS 'User who owns this conversion rate';
COMMENT ON COLUMN currency_rates.from_currency IS 'Source currency code (e.g., USD)';
COMMENT ON COLUMN currency_rates.to_currency IS 'Target currency code (e.g., ILS)';
COMMENT ON COLUMN currency_rates.rate IS 'Conversion rate: multiply amount in from_currency by this rate to get to_currency amount';
