# Currency Conversion Rates Feature - Setup Instructions

## Overview
Feature #175 adds the ability to configure currency conversion rates per user. This allows users to convert between different currencies in reports.

## What Was Implemented

### 1. Database Schema
**File**: `src/db/schema.ts`
- Added `currencyRates` table definition
- Fields: id, user_id, from_currency, to_currency, rate, created_at, updated_at
- Unique constraint on (user_id, from_currency, to_currency)

### 2. API Endpoint
**File**: `app/api/currency-rates/route.ts`
- **GET** `/api/currency-rates` - Fetch all rates for authenticated user
- **POST** `/api/currency-rates` - Create or update a conversion rate
- **DELETE** `/api/currency-rates` - Delete a conversion rate
- All endpoints require authentication
- All queries filter by user_id for data isolation

### 3. User Interface
**File**: `app/settings/page.tsx`
- New "מטבעות" (Currencies) tab in settings
- Form to add conversion rates (from currency, to currency, rate)
- List of existing rates with delete functionality
- Full Hebrew RTL support

## Manual Setup Required

### Step 1: Create the Database Table

Run the SQL migration script:

```bash
# Using psql
psql -U clockbill -d clockbill -f scripts/migrate-currency-rates.sql

# Or run the SQL directly in your database client:
```

**SQL Script Location**: `scripts/migrate-currency-rates.sql`

The script creates:
- `currency_rates` table with proper constraints
- Indexes for performance
- Privileges for the clockbill user

### Step 2: Verify the Table

```sql
SELECT * FROM currency_rates;
```

Should return an empty result set (no error).

## How to Use

1. Navigate to `/settings` in the application
2. Click on the "מטבעות" (Currencies) tab
3. Add conversion rates:
   - Select source currency (e.g., USD)
   - Select target currency (e.g., ILS)
   - Enter conversion rate (e.g., 3.5 means 1 USD = 3.5 ILS)
   - Click "שמור שער" (Save Rate)

## Example Use Cases

### Example 1: USD to ILS
- From: USD ($)
- To: ILS (₪)
- Rate: 3.5
- Meaning: 1 US Dollar = 3.5 Israeli Shekels

### Example 2: BTC to USD
- From: BTC (₿)
- To: USD ($)
- Rate: 45000
- Meaning: 1 Bitcoin = 45,000 US Dollars

## Testing Checklist

- [ ] Table created successfully (no SQL errors)
- [ ] API returns 401 for unauthenticated requests
- [ ] GET /api/currency-rates returns user's rates only
- [ ] POST creates new rate
- [ ] POST updates existing rate (same from/to currencies)
- [ ] DELETE removes rate and verifies ownership
- [ ] UI shows currencies tab in settings
- [ ] Form validates input (no negative rates, from != to)
- [ ] Hebrew text displays correctly with RTL
- [ ] Rates persist across page refreshes

## Notes

- Rates are stored per-user (multi-tenant isolation)
- Same user can only have one rate per currency pair (enforced by unique constraint)
- The `rate` field represents: (amount in to_currency) = (amount in from_currency) × rate
- All currency codes are standardized (ILS, USD, USDT, BTC, ETH)
