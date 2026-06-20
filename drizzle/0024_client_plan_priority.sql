-- Switchable "keep active" pointer for the client-count plan cap.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS plan_priority_at timestamp;
