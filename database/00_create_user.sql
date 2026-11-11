-- =====================================================================
--  00_create_user.sql   (run as SYSDBA:  sqlplus / as sysdba @00_create_user.sql)
--  Creates the dedicated application schema SLMS.
--  Re-runnable: drops the user (and every object it owns) first.
-- =====================================================================
WHENEVER SQLERROR CONTINUE
DROP USER slms CASCADE;
WHENEVER SQLERROR EXIT FAILURE

CREATE USER slms IDENTIFIED BY slms_dev_2026
  DEFAULT TABLESPACE users
  TEMPORARY TABLESPACE temp
  QUOTA UNLIMITED ON users;

GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE,
      CREATE PROCEDURE, CREATE TRIGGER, CREATE SYNONYM TO slms;

PROMPT User SLMS created.
EXIT
