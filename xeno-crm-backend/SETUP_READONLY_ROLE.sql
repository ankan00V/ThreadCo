-- Least-privilege role for the public SQL console.
--
-- The console on /workbench lets a reviewer run their own SELECT against the
-- live dataset. The application-level checks in app/sqlguard.py are a
-- convenience for producing good error messages; THIS is the control that
-- actually constrains a caller. Run it once as the database owner.

CREATE ROLE threadco_readonly LOGIN PASSWORD 'replace-me';

GRANT CONNECT ON DATABASE neondb TO threadco_readonly;
GRANT USAGE   ON SCHEMA public   TO threadco_readonly;
GRANT SELECT  ON ALL TABLES IN SCHEMA public TO threadco_readonly;

-- Tables created later are covered too, without revisiting this file.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO threadco_readonly;

-- No object creation, ever.
REVOKE CREATE ON SCHEMA public FROM threadco_readonly;

-- Set on the ROLE, so they apply to every session regardless of how it connects
-- and cannot be forgotten by application code.
ALTER ROLE threadco_readonly SET default_transaction_read_only = on;
ALTER ROLE threadco_readonly SET statement_timeout = '4s';
ALTER ROLE threadco_readonly SET idle_in_transaction_session_timeout = '10s';

-- Verify (each of these should fail):
--   DELETE FROM customers WHERE false;   -> read-only transaction
--   CREATE TABLE probe (i int);          -> read-only transaction
--   SELECT pg_sleep(9);                  -> statement timeout after 4s
