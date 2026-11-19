-- =====================================================================
--  02_logic.sql -- triggers, functions, procedures, views   (run as SLMS)
-- =====================================================================
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

-- =====================================================================
--  1. SURROGATE-KEY TRIGGERS  (11g has no IDENTITY columns)
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_department_bi  BEFORE INSERT ON department  FOR EACH ROW
BEGIN IF :NEW.dept_id IS NULL THEN :NEW.dept_id := seq_department.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_civilian_bi    BEFORE INSERT ON civilian    FOR EACH ROW
BEGIN IF :NEW.citizen_id IS NULL THEN :NEW.citizen_id := seq_civilian.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_zone_bi        BEFORE INSERT ON zone        FOR EACH ROW
BEGIN IF :NEW.zone_id IS NULL THEN :NEW.zone_id := seq_zone.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_feeder_bi      BEFORE INSERT ON feeder_pillar FOR EACH ROW
BEGIN IF :NEW.cabinet_id IS NULL THEN :NEW.cabinet_id := seq_feeder.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_streetlight_bi BEFORE INSERT ON streetlight FOR EACH ROW
BEGIN IF :NEW.pole_id IS NULL THEN :NEW.pole_id := seq_streetlight.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_sensor_bi      BEFORE INSERT ON sensor      FOR EACH ROW
BEGIN IF :NEW.sensor_id IS NULL THEN :NEW.sensor_id := seq_sensor.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_part_bi        BEFORE INSERT ON spare_parts FOR EACH ROW
BEGIN IF :NEW.part_id IS NULL THEN :NEW.part_id := seq_part.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_billing_bi     BEFORE INSERT ON billing     FOR EACH ROW
BEGIN IF :NEW.billing_id IS NULL THEN :NEW.billing_id := seq_billing.NEXTVAL; END IF; END;
/

-- =====================================================================
--  2. BUSINESS-RULE TRIGGERS
-- =====================================================================

-- Employee must be >= 18 at joining (CHECK constraints cannot do date maths vs. SYSDATE)
CREATE OR REPLACE TRIGGER trg_employee_biu
BEFORE INSERT OR UPDATE ON employee FOR EACH ROW
BEGIN
  IF :NEW.emp_id IS NULL THEN :NEW.emp_id := seq_employee.NEXTVAL; END IF;
  IF MONTHS_BETWEEN(:NEW.date_of_joining, :NEW.date_of_birth) < 216 THEN
    RAISE_APPLICATION_ERROR(-20001, 'Employee must be at least 18 years old on the date of joining.');
  END IF;
  IF :NEW.date_of_joining > TRUNC(SYSDATE) + 365 THEN
    RAISE_APPLICATION_ERROR(-20002, 'Date of joining cannot be more than a year in the future.');
  END IF;
END;
/

-- A streetlight must be powered by a feeder pillar in the SAME zone
CREATE OR REPLACE TRIGGER trg_streetlight_biu
BEFORE INSERT OR UPDATE OF zone_id, cabinet_id ON streetlight FOR EACH ROW
DECLARE
  v_zone feeder_pillar.zone_id%TYPE;
BEGIN
  SELECT zone_id INTO v_zone FROM feeder_pillar WHERE cabinet_id = :NEW.cabinet_id;
  IF v_zone <> :NEW.zone_id THEN
    RAISE_APPLICATION_ERROR(-20003, 'Feeder pillar ' || :NEW.cabinet_id || ' is in zone ' || v_zone ||
                                    ', not zone ' || :NEW.zone_id || '.');
  END IF;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20004, 'Feeder pillar ' || :NEW.cabinet_id || ' does not exist.');
END;
/

-- A sensor must be deployed in the zone of the pole it is mounted on (zone auto-derived if omitted)
CREATE OR REPLACE TRIGGER trg_sensor_biu
BEFORE INSERT OR UPDATE OF zone_id, pole_id ON sensor FOR EACH ROW
DECLARE
  v_zone streetlight.zone_id%TYPE;
BEGIN
  SELECT zone_id INTO v_zone FROM streetlight WHERE pole_id = :NEW.pole_id;
  IF :NEW.zone_id IS NULL THEN
    :NEW.zone_id := v_zone;
  ELSIF :NEW.zone_id <> v_zone THEN
    RAISE_APPLICATION_ERROR(-20005, 'Sensor zone must match the zone of streetlight ' || :NEW.pole_id || '.');
  END IF;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20006, 'Streetlight ' || :NEW.pole_id || ' does not exist.');
END;
/

-- Complaint ID, and "resolves": linking a complaint to a work order puts the
-- ticket in step with that work order; unlinking reopens it.
CREATE OR REPLACE TRIGGER trg_complaint_biu
BEFORE INSERT OR UPDATE OF work_order_id ON complaint FOR EACH ROW
DECLARE
  v_wo_status work_order.status%TYPE;
BEGIN
  IF INSERTING AND :NEW.complaint_id IS NULL THEN :NEW.complaint_id := seq_complaint.NEXTVAL; END IF;

  IF :NEW.work_order_id IS NOT NULL
     AND (INSERTING OR :OLD.work_order_id IS NULL OR :OLD.work_order_id <> :NEW.work_order_id)
     AND :NEW.ticket_status NOT IN ('CLOSED','REJECTED') THEN
    SELECT status INTO v_wo_status FROM work_order WHERE work_order_id = :NEW.work_order_id;
    IF v_wo_status = 'CANCELLED' THEN
      RAISE_APPLICATION_ERROR(-20023, 'Work order ' || :NEW.work_order_id || ' is cancelled; link the complaint to an active one.');
    END IF;
    :NEW.ticket_status := CASE v_wo_status WHEN 'COMPLETED'   THEN 'RESOLVED'
                                           WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
                                           ELSE 'ASSIGNED' END;
  ELSIF UPDATING AND :NEW.work_order_id IS NULL AND :OLD.work_order_id IS NOT NULL
        AND :NEW.ticket_status IN ('ASSIGNED','IN_PROGRESS') THEN
    :NEW.ticket_status := 'OPEN';
  END IF;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20024, 'Work order ' || :NEW.work_order_id || ' does not exist.');
END;
/
CREATE OR REPLACE TRIGGER trg_complaint_ai
AFTER INSERT ON complaint FOR EACH ROW
BEGIN
  IF :NEW.issue_category <> 'OTHER' THEN
    UPDATE streetlight SET current_status = 'FAULTY'
     WHERE pole_id = :NEW.pole_id AND current_status = 'FUNCTIONAL';
  END IF;
END;
/

-- Work order: id, zone derivation, completion timestamp bookkeeping
CREATE OR REPLACE TRIGGER trg_work_order_biu
BEFORE INSERT OR UPDATE ON work_order FOR EACH ROW
BEGIN
  IF INSERTING AND :NEW.work_order_id IS NULL THEN
    :NEW.work_order_id := seq_work_order.NEXTVAL;
  END IF;
  IF :NEW.zone_id IS NULL AND :NEW.pole_id IS NOT NULL THEN
    SELECT zone_id INTO :NEW.zone_id FROM streetlight WHERE pole_id = :NEW.pole_id;
  END IF;
  IF :NEW.status = 'COMPLETED' AND :NEW.completion_timestamp IS NULL THEN
    :NEW.completion_timestamp := SYSTIMESTAMP;
  ELSIF :NEW.status <> 'COMPLETED' THEN
    :NEW.completion_timestamp := NULL;
  END IF;
END;
/

-- Work order status cascades to the streetlight and to EVERY complaint it resolves (1:N)
CREATE OR REPLACE TRIGGER trg_work_order_aiu
AFTER INSERT OR UPDATE OF status ON work_order FOR EACH ROW
BEGIN
  IF :NEW.status = 'IN_PROGRESS' THEN
    UPDATE streetlight SET current_status = 'UNDER_MAINTENANCE'
     WHERE pole_id = :NEW.pole_id AND current_status <> 'DECOMMISSIONED';
    UPDATE complaint SET ticket_status = 'IN_PROGRESS'
     WHERE work_order_id = :NEW.work_order_id AND ticket_status IN ('OPEN','ASSIGNED');

  ELSIF :NEW.status = 'ASSIGNED' THEN
    UPDATE complaint SET ticket_status = 'ASSIGNED'
     WHERE work_order_id = :NEW.work_order_id AND ticket_status = 'OPEN';

  ELSIF :NEW.status = 'COMPLETED' THEN
    UPDATE streetlight
       SET current_status     = 'FUNCTIONAL',
           last_serviced_date = GREATEST(NVL(last_serviced_date, installation_date),
                                         TRUNC(CAST(:NEW.completion_timestamp AS DATE)))
     WHERE pole_id = :NEW.pole_id AND current_status <> 'DECOMMISSIONED';
    UPDATE complaint SET ticket_status = 'RESOLVED'
     WHERE work_order_id = :NEW.work_order_id AND ticket_status NOT IN ('CLOSED','REJECTED');

  ELSIF :NEW.status = 'CANCELLED' THEN
    -- unlink so the complaints can be dispatched again (trg_complaint_biu reopens them)
    UPDATE complaint SET work_order_id = NULL
     WHERE work_order_id = :NEW.work_order_id AND ticket_status IN ('ASSIGNED','IN_PROGRESS');
  END IF;
END;
/

-- ---------------------------------------------------------------------
--  Accounts: logs_into / registers_on / accesses (1:1, total participation)
-- ---------------------------------------------------------------------
-- A login may be owned by one row only, in the table matching its user_type.
CREATE OR REPLACE PROCEDURE sp_assert_login (p_username IN VARCHAR2, p_type IN VARCHAR2) AS
  v_type homepage.user_type%TYPE;
BEGIN
  IF p_username IS NULL THEN RETURN; END IF;   -- NOT NULL constraint reports it
  SELECT user_type INTO v_type FROM homepage WHERE username = p_username;
  IF v_type <> p_type THEN
    RAISE_APPLICATION_ERROR(-20008, 'Login ' || p_username || ' is a ' || v_type || ' account, not ' || p_type || '.');
  END IF;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20009, 'Login ' || p_username || ' does not exist; create it first.');
END;
/
CREATE OR REPLACE TRIGGER trg_employee_login BEFORE INSERT OR UPDATE OF username ON employee FOR EACH ROW
BEGIN sp_assert_login(:NEW.username, 'EMPLOYEE'); END;
/
CREATE OR REPLACE TRIGGER trg_civilian_login BEFORE INSERT OR UPDATE OF username ON civilian FOR EACH ROW
BEGIN sp_assert_login(:NEW.username, 'CIVILIAN'); END;
/
CREATE OR REPLACE TRIGGER trg_company_login  BEFORE INSERT OR UPDATE OF username ON company  FOR EACH ROW
BEGIN sp_assert_login(:NEW.username, 'COMPANY'); END;
/

-- Deleting an employee / civilian / company also deletes its login.
-- Compound triggers collect the usernames per row and delete them once the
-- statement is done (so the FK from the owner no longer blocks the delete).
CREATE OR REPLACE TRIGGER trg_employee_drop_login FOR DELETE ON employee COMPOUND TRIGGER
  TYPE t_names IS TABLE OF homepage.username%TYPE;
  g_names t_names := t_names();
  AFTER EACH ROW IS BEGIN g_names.EXTEND; g_names(g_names.LAST) := :OLD.username; END AFTER EACH ROW;
  AFTER STATEMENT IS BEGIN
    FORALL i IN 1 .. g_names.COUNT DELETE FROM homepage WHERE username = g_names(i);
  END AFTER STATEMENT;
END;
/
CREATE OR REPLACE TRIGGER trg_civilian_drop_login FOR DELETE ON civilian COMPOUND TRIGGER
  TYPE t_names IS TABLE OF homepage.username%TYPE;
  g_names t_names := t_names();
  AFTER EACH ROW IS BEGIN g_names.EXTEND; g_names(g_names.LAST) := :OLD.username; END AFTER EACH ROW;
  AFTER STATEMENT IS BEGIN
    FORALL i IN 1 .. g_names.COUNT DELETE FROM homepage WHERE username = g_names(i);
  END AFTER STATEMENT;
END;
/
CREATE OR REPLACE TRIGGER trg_company_drop_login FOR DELETE ON company COMPOUND TRIGGER
  TYPE t_names IS TABLE OF homepage.username%TYPE;
  g_names t_names := t_names();
  AFTER EACH ROW IS BEGIN g_names.EXTEND; g_names(g_names.LAST) := :OLD.username; END AFTER EACH ROW;
  AFTER STATEMENT IS BEGIN
    FORALL i IN 1 .. g_names.COUNT DELETE FROM homepage WHERE username = g_names(i);
  END AFTER STATEMENT;
END;
/

-- Spare-part inventory: consuming parts on a work order debits stock (and refunds on delete)
CREATE OR REPLACE TRIGGER trg_work_order_part_stock
BEFORE INSERT OR UPDATE OR DELETE ON work_order_part FOR EACH ROW
DECLARE
  PROCEDURE debit(p_part NUMBER, p_qty NUMBER) IS
  BEGIN
    UPDATE spare_parts SET quantity_in_stock = quantity_in_stock - p_qty
     WHERE part_id = p_part AND quantity_in_stock >= p_qty;
    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20010, 'Insufficient stock for part ' || p_part || ' (need ' || p_qty || ').');
    END IF;
  END;
  PROCEDURE credit(p_part NUMBER, p_qty NUMBER) IS
  BEGIN
    UPDATE spare_parts SET quantity_in_stock = quantity_in_stock + p_qty WHERE part_id = p_part;
  END;
BEGIN
  IF INSERTING THEN
    debit(:NEW.part_id, :NEW.quantity_used);
  ELSIF DELETING THEN
    credit(:OLD.part_id, :OLD.quantity_used);
  ELSE
    credit(:OLD.part_id, :OLD.quantity_used);
    debit(:NEW.part_id, :NEW.quantity_used);
  END IF;
END;
/

-- =====================================================================
--  3. FUNCTIONS
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_years_since(p_date DATE) RETURN NUMBER IS  -- not DETERMINISTIC: depends on SYSDATE
BEGIN
  RETURN FLOOR(MONTHS_BETWEEN(TRUNC(SYSDATE), p_date) / 12);
END;
/

CREATE OR REPLACE FUNCTION fn_work_order_parts_cost(p_work_order_id NUMBER) RETURN NUMBER IS
  v_cost NUMBER;
BEGIN
  SELECT NVL(SUM(wop.quantity_used * sp.unit_price), 0) INTO v_cost
    FROM work_order_part wop JOIN spare_parts sp ON sp.part_id = wop.part_id
   WHERE wop.work_order_id = p_work_order_id;
  RETURN v_cost;
END;
/

CREATE OR REPLACE FUNCTION fn_zone_energy_cost(p_zone_id NUMBER, p_from DATE, p_to DATE) RETURN NUMBER IS
  v_cost NUMBER;
BEGIN
  SELECT NVL(SUM(el.cost_inr), 0) INTO v_cost
    FROM energy_log el JOIN streetlight sl ON sl.pole_id = el.pole_id
   WHERE sl.zone_id = p_zone_id AND el.reading_date BETWEEN p_from AND p_to;
  RETURN v_cost;
END;
/

-- =====================================================================
--  4. PROCEDURES  (multi-step operations kept atomic in the database)
-- =====================================================================

-- Raise a work order from a citizen complaint. "resolves" is 1:N, so the new
-- work order also picks up every other OPEN, unlinked complaint on the same pole.
CREATE OR REPLACE PROCEDURE sp_complaint_to_work_order (
  p_complaint_id  IN  NUMBER,
  p_emp_id        IN  NUMBER,
  p_license_no    IN  VARCHAR2,
  p_work_type     IN  VARCHAR2,
  p_work_order_id OUT NUMBER,
  p_linked        OUT NUMBER      -- how many complaints the new work order resolves
) AS
  v_pole   complaint.pole_id%TYPE;
  v_status complaint.ticket_status%TYPE;
  v_wo     complaint.work_order_id%TYPE;
BEGIN
  SELECT pole_id, ticket_status, work_order_id INTO v_pole, v_status, v_wo
    FROM complaint WHERE complaint_id = p_complaint_id FOR UPDATE;

  IF v_status IN ('RESOLVED','CLOSED','REJECTED') THEN
    RAISE_APPLICATION_ERROR(-20020, 'Complaint ' || p_complaint_id || ' is already ' || v_status || '.');
  END IF;
  IF v_wo IS NOT NULL THEN
    RAISE_APPLICATION_ERROR(-20021, 'Complaint ' || p_complaint_id || ' is already linked to work order ' || v_wo || '.');
  END IF;
  IF p_emp_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20025, 'Choose an employee: every work order must be assigned to one (assigned_to).');
  END IF;
  IF v_pole IS NULL THEN
    RAISE_APPLICATION_ERROR(-20026, 'Complaint ' || p_complaint_id || ' names no streetlight; create a work order for its zone and link it manually.');
  END IF;

  INSERT INTO work_order (work_type, status, pole_id, emp_id, license_no)
  VALUES (NVL(p_work_type, 'REPAIR'), 'ASSIGNED', v_pole, p_emp_id, p_license_no)
  RETURNING work_order_id INTO p_work_order_id;

  -- trg_complaint_biu sets each linked ticket to ASSIGNED
  UPDATE complaint
     SET work_order_id = p_work_order_id,
         handled_by    = NVL(handled_by, p_emp_id)
   WHERE complaint_id = p_complaint_id
      OR (pole_id = v_pole AND work_order_id IS NULL AND ticket_status = 'OPEN');
  p_linked := SQL%ROWCOUNT;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20022, 'Complaint ' || p_complaint_id || ' not found.');
END;
/

-- Record an energy reading for a pole; allocates the weak-entity partial key safely
CREATE OR REPLACE PROCEDURE sp_record_energy (
  p_pole_id        IN  NUMBER,
  p_reading_date   IN  DATE,
  p_units_consumed IN  NUMBER,
  p_tariff_inr     IN  NUMBER DEFAULT 7.50,
  p_log_number     OUT NUMBER
) AS
  v_dummy NUMBER;
BEGIN
  -- serialise log_number allocation per pole
  SELECT pole_id INTO v_dummy FROM streetlight WHERE pole_id = p_pole_id FOR UPDATE;
  SELECT NVL(MAX(log_number), 0) + 1 INTO p_log_number FROM energy_log WHERE pole_id = p_pole_id;
  INSERT INTO energy_log (pole_id, log_number, reading_date, units_consumed, cost_inr)
  VALUES (p_pole_id, p_log_number, TRUNC(p_reading_date), p_units_consumed,
          ROUND(p_units_consumed * p_tariff_inr, 2));
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20030, 'Streetlight ' || p_pole_id || ' not found.');
END;
/

-- =====================================================================
--  5. VIEWS  (derived attributes + denormalised read models for the API)
-- =====================================================================
CREATE OR REPLACE VIEW v_employee AS
SELECT e.emp_id, e.first_name, e.middle_name, e.last_name,
       e.first_name || NVL2(e.middle_name, ' ' || e.middle_name, '') || ' ' || e.last_name AS full_name,
       e.date_of_birth, e.date_of_joining, e.role, e.aadhar_id, e.shift_type, e.salary,
       e.street, e.city, e.state, e.pincode, e.dept_id, d.dept_name, e.username,
       fn_years_since(e.date_of_birth)                                  AS age,             -- derived
       ROUND(MONTHS_BETWEEN(TRUNC(SYSDATE), e.date_of_joining) / 12, 1)  AS work_experience, -- derived
       (SELECT LISTAGG(email, ', ') WITHIN GROUP (ORDER BY email)
          FROM employee_email x WHERE x.emp_id = e.emp_id)              AS emails,
       (SELECT LISTAGG(phone_number, ', ') WITHIN GROUP (ORDER BY phone_number)
          FROM employee_phone x WHERE x.emp_id = e.emp_id)              AS phones
  FROM employee e JOIN department d ON d.dept_id = e.dept_id;

CREATE OR REPLACE VIEW v_department AS
SELECT d.dept_id, d.dept_name, d.dept_type,
       (SELECT COUNT(*) FROM employee e WHERE e.dept_id = d.dept_id)            AS employee_count,
       (SELECT NVL(SUM(salary), 0) FROM employee e WHERE e.dept_id = d.dept_id) AS monthly_payroll
  FROM department d;

CREATE OR REPLACE VIEW v_civilian AS
SELECT c.citizen_id, c.first_name, c.middle_name, c.last_name,
       c.first_name || NVL2(c.middle_name, ' ' || c.middle_name, '') || ' ' || c.last_name AS full_name,
       c.street, c.city, c.state, c.pincode, c.username,
       (SELECT LISTAGG(email, ', ') WITHIN GROUP (ORDER BY email)
          FROM civilian_email x WHERE x.citizen_id = c.citizen_id)              AS emails,
       (SELECT LISTAGG(phone_number, ', ') WITHIN GROUP (ORDER BY phone_number)
          FROM civilian_phone x WHERE x.citizen_id = c.citizen_id)              AS phones,
       (SELECT COUNT(*) FROM complaint x WHERE x.citizen_id = c.citizen_id)     AS complaint_count
  FROM civilian c;

CREATE OR REPLACE VIEW v_company AS
SELECT c.license_no, c.company_name, c.contractor_name, c.gst_no, c.class_rating,
       c.street, c.city, c.state, c.pincode, c.username,
       (SELECT LISTAGG(phone_no, ', ') WITHIN GROUP (ORDER BY phone_no)
          FROM company_phone x WHERE x.license_no = c.license_no)                          AS phones,
       (SELECT COUNT(*) FROM work_order w WHERE w.license_no = c.license_no)               AS work_order_count,
       (SELECT COUNT(*) FROM work_order w WHERE w.license_no = c.license_no
                                            AND w.status NOT IN ('COMPLETED','CANCELLED'))  AS open_work_orders
  FROM company c;

CREATE OR REPLACE VIEW v_zone AS
SELECT z.zone_id, z.zone_name, z.city_region, z.emp_id,
       e.first_name || ' ' || e.last_name AS supervisor_name,
       (SELECT COUNT(*) FROM streetlight s WHERE s.zone_id = z.zone_id)                                  AS total_lights,
       (SELECT COUNT(*) FROM streetlight s WHERE s.zone_id = z.zone_id AND s.current_status = 'FUNCTIONAL') AS functional_lights,
       (SELECT COUNT(*) FROM streetlight s WHERE s.zone_id = z.zone_id AND s.current_status = 'FAULTY')     AS faulty_lights,
       (SELECT COUNT(*) FROM feeder_pillar f WHERE f.zone_id = z.zone_id)                                AS feeder_count,
       (SELECT COUNT(*) FROM sensor x WHERE x.zone_id = z.zone_id)                                       AS sensor_count
  FROM zone z LEFT JOIN employee e ON e.emp_id = z.emp_id;

CREATE OR REPLACE VIEW v_feeder_pillar AS
SELECT f.cabinet_id, f.installation_date, f.operational_status, f.power_rating_kva, f.zone_id, z.zone_name,
       (SELECT COUNT(*) FROM streetlight s WHERE s.cabinet_id = f.cabinet_id)                     AS lights_powered,
       (SELECT NVL(SUM(wattage), 0) / 1000 FROM streetlight s
         WHERE s.cabinet_id = f.cabinet_id AND s.current_status <> 'DECOMMISSIONED')              AS connected_load_kw,
       ROUND((SELECT NVL(SUM(wattage), 0) / 1000 FROM streetlight s
               WHERE s.cabinet_id = f.cabinet_id AND s.current_status <> 'DECOMMISSIONED')
             / (f.power_rating_kva * 0.9) * 100, 1)                                               AS load_percent  -- pf 0.9
  FROM feeder_pillar f JOIN zone z ON z.zone_id = f.zone_id;

CREATE OR REPLACE VIEW v_streetlight AS
SELECT s.pole_id, s.current_status, s.lamp_type, s.wattage, s.dimming_support,
       s.latitude, s.longitude, s.installation_date, s.last_serviced_date,
       s.zone_id, z.zone_name, s.cabinet_id,
       fn_years_since(s.installation_date)                                                 AS age_years, -- derived
       (SELECT COUNT(*) FROM sensor x WHERE x.pole_id = s.pole_id)                         AS sensor_count,
       (SELECT COUNT(*) FROM complaint c WHERE c.pole_id = s.pole_id
                                           AND c.ticket_status NOT IN ('RESOLVED','CLOSED','REJECTED')) AS open_complaints
  FROM streetlight s JOIN zone z ON z.zone_id = s.zone_id;

CREATE OR REPLACE VIEW v_sensor AS
SELECT x.sensor_id, x.sensor_type, x.manufacturer, x.status, x.last_reading_value, x.last_reading_time,
       x.zone_id, z.zone_name, x.pole_id
  FROM sensor x JOIN zone z ON z.zone_id = x.zone_id;

CREATE OR REPLACE VIEW v_energy_log AS
SELECT el.pole_id, el.log_number, el.reading_date, el.units_consumed, el.cost_inr,
       s.zone_id, z.zone_name, s.lamp_type, s.wattage
  FROM energy_log el
  JOIN streetlight s ON s.pole_id = el.pole_id
  JOIN zone z        ON z.zone_id = s.zone_id;

CREATE OR REPLACE VIEW v_complaint AS
SELECT c.complaint_id, c.issue_category, c.description, c.ticket_status, c.reported_timestamp,
       c.citizen_id, cv.first_name || ' ' || cv.last_name AS citizen_name,
       c.pole_id, s.zone_id, z.zone_name, s.current_status AS light_status,
       c.handled_by,
       CASE WHEN e.emp_id IS NOT NULL THEN e.first_name || ' ' || e.last_name END AS handler_name,
       c.work_order_id, w.status AS work_order_status
  FROM complaint c
  JOIN civilian cv          ON cv.citizen_id = c.citizen_id
  LEFT JOIN streetlight s   ON s.pole_id = c.pole_id          -- receives is optional (0..1)
  LEFT JOIN zone z          ON z.zone_id = s.zone_id
  LEFT JOIN employee e      ON e.emp_id = c.handled_by
  LEFT JOIN work_order w    ON w.work_order_id = c.work_order_id;

CREATE OR REPLACE VIEW v_work_order AS
SELECT w.work_order_id, w.work_type, w.status, w.resolution_notes,
       w.created_timestamp, w.completion_timestamp,
       CASE WHEN w.completion_timestamp IS NOT NULL THEN
         ROUND((CAST(w.completion_timestamp AS DATE) - CAST(w.created_timestamp AS DATE)) * 24, 2)
       END                                                    AS resolution_hours,  -- derived
       w.zone_id, z.zone_name, w.pole_id,
       w.emp_id, e.first_name || ' ' || e.last_name           AS employee_name,
       w.license_no, co.company_name,
       (SELECT COUNT(*) FROM complaint c WHERE c.work_order_id = w.work_order_id)   AS complaints_resolved,
       fn_work_order_parts_cost(w.work_order_id)              AS parts_cost,
       (SELECT b.billing_id FROM billing b WHERE b.work_order_id = w.work_order_id) AS billing_id
  FROM work_order w
  JOIN zone z          ON z.zone_id = w.zone_id
  JOIN employee e      ON e.emp_id = w.emp_id
  LEFT JOIN company co ON co.license_no = w.license_no;

CREATE OR REPLACE VIEW v_work_order_part AS
SELECT wop.work_order_id, wop.part_id, sp.part_name, wop.quantity_used, sp.unit_price,
       wop.quantity_used * sp.unit_price AS line_cost
  FROM work_order_part wop JOIN spare_parts sp ON sp.part_id = wop.part_id;

CREATE OR REPLACE VIEW v_spare_parts AS
SELECT p.part_id, p.part_name, p.unit_price, p.quantity_in_stock,
       p.unit_price * p.quantity_in_stock AS total_cost,   -- derived (inventory value)
       CASE WHEN p.quantity_in_stock = 0 THEN 'OUT_OF_STOCK'
            WHEN p.quantity_in_stock < 10 THEN 'LOW'
            ELSE 'OK' END                 AS stock_level,
       (SELECT NVL(SUM(quantity_used), 0) FROM work_order_part w WHERE w.part_id = p.part_id) AS total_used
  FROM spare_parts p;

CREATE OR REPLACE VIEW v_billing AS
SELECT b.billing_id, b.work_order_id, b.payment_id, b.payment_type, b.receipt_no,
       b.budget_sanctioned, b.actually_spent, b.billing_amount,
       b.budget_sanctioned - b.actually_spent      AS budget_variance,
       w.work_type, w.status AS work_order_status, w.zone_id, w.license_no, co.company_name,
       fn_work_order_parts_cost(w.work_order_id)    AS parts_cost
  FROM billing b
  JOIN work_order w    ON w.work_order_id = b.work_order_id
  LEFT JOIN company co ON co.license_no = w.license_no;

CREATE OR REPLACE VIEW v_homepage AS
SELECT h.username, h.user_type, e.emp_id, c.citizen_id, co.license_no, h.is_active,
       h.created_at, h.last_login_at,
       CASE h.user_type
         WHEN 'EMPLOYEE' THEN e.first_name || ' ' || e.last_name
         WHEN 'CIVILIAN' THEN c.first_name || ' ' || c.last_name
         ELSE co.company_name
       END                                          AS display_name,
       e.role                                       AS employee_role
  FROM homepage h
  LEFT JOIN employee e  ON e.username = h.username
  LEFT JOIN civilian c  ON c.username = h.username
  LEFT JOIN company co  ON co.username = h.username;

PROMPT Logic layer created.
EXIT
