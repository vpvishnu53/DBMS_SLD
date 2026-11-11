-- 99_verify.sql -- sanity report after setup (run as SLMS)
SET PAGESIZE 100 LINESIZE 160 FEEDBACK OFF
COLUMN object_type FORMAT A12
COLUMN status FORMAT A8

PROMPT == Invalid objects (should be none) ==
SELECT object_name, object_type, status FROM user_objects WHERE status <> 'VALID';

PROMPT == Row counts ==
SELECT 'department' t, COUNT(*) n FROM department UNION ALL
SELECT 'employee',      COUNT(*) FROM employee      UNION ALL
SELECT 'civilian',      COUNT(*) FROM civilian      UNION ALL
SELECT 'company',       COUNT(*) FROM company       UNION ALL
SELECT 'homepage',      COUNT(*) FROM homepage      UNION ALL
SELECT 'zone',          COUNT(*) FROM zone          UNION ALL
SELECT 'feeder_pillar', COUNT(*) FROM feeder_pillar UNION ALL
SELECT 'streetlight',   COUNT(*) FROM streetlight   UNION ALL
SELECT 'sensor',        COUNT(*) FROM sensor        UNION ALL
SELECT 'energy_log',    COUNT(*) FROM energy_log    UNION ALL
SELECT 'complaint',     COUNT(*) FROM complaint     UNION ALL
SELECT 'work_order',    COUNT(*) FROM work_order    UNION ALL
SELECT 'spare_parts',   COUNT(*) FROM spare_parts   UNION ALL
SELECT 'billing',       COUNT(*) FROM billing;

PROMPT == Streetlight status (after triggers) ==
SELECT current_status, COUNT(*) n FROM streetlight GROUP BY current_status ORDER BY 1;
PROMPT == Complaint status (after triggers) ==
SELECT ticket_status, COUNT(*) n FROM complaint GROUP BY ticket_status ORDER BY 1;
EXIT
