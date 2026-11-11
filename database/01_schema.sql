-- =====================================================================
--  01_schema.sql  -- Smart Streetlight Management System (SLMS)
--  Target: Oracle Database 11g XE (11.2)   Run as: SLMS
--
--  ER -> relational mapping notes
--   * Composite attrs (Name, Address, Location) are flattened to columns.
--   * Multivalued attrs (email, phone_number, phone_no) -> child tables.
--   * Derived attrs (age, work_experience, age_years, resolution_hours,
--     total_cost) are NOT stored; they are computed in views (02_logic.sql).
--     11g virtual columns cannot reference SYSDATE, hence views.
--   * HOMEPAGE is the login/account entity: exactly one of
--     emp_id / citizen_id / license_no is set (exclusive arc).
--   * ENERGY_LOG is a WEAK entity identified by (pole_id, log_number).
--   * WORK_ORDER "uses" SPARE_PARTS is M:N -> WORK_ORDER_PART.
--   * 11g has no IDENTITY columns -> sequences + BEFORE INSERT triggers.
-- =====================================================================
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

-- ---------- idempotent teardown -------------------------------------
BEGIN
  FOR t IN (SELECT table_name FROM user_tables) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE "' || t.table_name || '" CASCADE CONSTRAINTS PURGE';
  END LOOP;
  FOR s IN (SELECT sequence_name FROM user_sequences) LOOP
    EXECUTE IMMEDIATE 'DROP SEQUENCE "' || s.sequence_name || '"';
  END LOOP;
END;
/

-- ---------- sequences -----------------------------------------------
CREATE SEQUENCE seq_department  START WITH 10   INCREMENT BY 10 NOCACHE;
CREATE SEQUENCE seq_employee    START WITH 1001 NOCACHE;
CREATE SEQUENCE seq_civilian    START WITH 5001 NOCACHE;
CREATE SEQUENCE seq_zone        START WITH 1    NOCACHE;
CREATE SEQUENCE seq_feeder      START WITH 101  NOCACHE;
CREATE SEQUENCE seq_streetlight START WITH 10001 NOCACHE;
CREATE SEQUENCE seq_sensor      START WITH 7001 NOCACHE;
CREATE SEQUENCE seq_complaint   START WITH 90001 NOCACHE;
CREATE SEQUENCE seq_work_order  START WITH 30001 NOCACHE;
CREATE SEQUENCE seq_part        START WITH 501  NOCACHE;
CREATE SEQUENCE seq_billing     START WITH 60001 NOCACHE;

-- =====================================================================
--  ORGANISATION
-- =====================================================================
CREATE TABLE department (
  dept_id    NUMBER(6)     CONSTRAINT pk_department PRIMARY KEY,
  dept_name  VARCHAR2(100) NOT NULL CONSTRAINT uq_department_name UNIQUE,
  dept_type  VARCHAR2(30)  NOT NULL
             CONSTRAINT ck_department_type CHECK (dept_type IN
               ('ADMINISTRATION','OPERATIONS','MAINTENANCE','FINANCE','IT','CUSTOMER_SERVICE'))
);

CREATE TABLE employee (
  emp_id          NUMBER(8)     CONSTRAINT pk_employee PRIMARY KEY,
  first_name      VARCHAR2(50)  NOT NULL,
  middle_name     VARCHAR2(50),
  last_name       VARCHAR2(50)  NOT NULL,
  date_of_birth   DATE          NOT NULL,
  date_of_joining DATE          DEFAULT TRUNC(SYSDATE) NOT NULL,
  role            VARCHAR2(30)  NOT NULL
                  CONSTRAINT ck_employee_role CHECK (role IN
                    ('ADMIN','ZONE_SUPERVISOR','ENGINEER','TECHNICIAN','ACCOUNTANT','SUPPORT_AGENT')),
  aadhar_id       CHAR(12)      NOT NULL CONSTRAINT uq_employee_aadhar UNIQUE
                  CONSTRAINT ck_employee_aadhar CHECK (REGEXP_LIKE(aadhar_id, '^[2-9][0-9]{11}$')),
  shift_type      VARCHAR2(12)  DEFAULT 'MORNING' NOT NULL
                  CONSTRAINT ck_employee_shift CHECK (shift_type IN ('MORNING','EVENING','NIGHT','ROTATIONAL')),
  salary          NUMBER(10,2)  NOT NULL CONSTRAINT ck_employee_salary CHECK (salary > 0),
  street          VARCHAR2(120),
  city            VARCHAR2(60),
  state           VARCHAR2(60),
  pincode         CHAR(6)       CONSTRAINT ck_employee_pincode CHECK (REGEXP_LIKE(pincode, '^[1-9][0-9]{5}$')),
  dept_id         NUMBER(6)     NOT NULL
                  CONSTRAINT fk_employee_dept REFERENCES department(dept_id),          -- employs (N:1)
  CONSTRAINT ck_employee_dates CHECK (date_of_joining > date_of_birth)
);

CREATE TABLE employee_email (
  emp_id NUMBER(8)     NOT NULL CONSTRAINT fk_emp_email_emp REFERENCES employee(emp_id) ON DELETE CASCADE,
  email  VARCHAR2(120) NOT NULL CONSTRAINT ck_emp_email CHECK (REGEXP_LIKE(email, '^[^@ ]+@[^@ ]+\.[^@ ]+$')),
  CONSTRAINT pk_employee_email PRIMARY KEY (emp_id, email),
  CONSTRAINT uq_employee_email UNIQUE (email)
);

CREATE TABLE employee_phone (
  emp_id       NUMBER(8)    NOT NULL CONSTRAINT fk_emp_phone_emp REFERENCES employee(emp_id) ON DELETE CASCADE,
  phone_number VARCHAR2(15) NOT NULL CONSTRAINT ck_emp_phone CHECK (REGEXP_LIKE(phone_number, '^\+?[0-9]{10,14}$')),
  CONSTRAINT pk_employee_phone PRIMARY KEY (emp_id, phone_number)
);

-- =====================================================================
--  CITIZENS & CONTRACTORS
-- =====================================================================
CREATE TABLE civilian (
  citizen_id  NUMBER(8)    CONSTRAINT pk_civilian PRIMARY KEY,
  first_name  VARCHAR2(50) NOT NULL,
  middle_name VARCHAR2(50),
  last_name   VARCHAR2(50) NOT NULL,
  street      VARCHAR2(120),
  city        VARCHAR2(60),
  state       VARCHAR2(60),
  pincode     CHAR(6)      CONSTRAINT ck_civilian_pincode CHECK (REGEXP_LIKE(pincode, '^[1-9][0-9]{5}$'))
);

CREATE TABLE civilian_email (
  citizen_id NUMBER(8)     NOT NULL CONSTRAINT fk_civ_email_civ REFERENCES civilian(citizen_id) ON DELETE CASCADE,
  email      VARCHAR2(120) NOT NULL CONSTRAINT ck_civ_email CHECK (REGEXP_LIKE(email, '^[^@ ]+@[^@ ]+\.[^@ ]+$')),
  CONSTRAINT pk_civilian_email PRIMARY KEY (citizen_id, email),
  CONSTRAINT uq_civilian_email UNIQUE (email)
);

CREATE TABLE civilian_phone (
  citizen_id   NUMBER(8)    NOT NULL CONSTRAINT fk_civ_phone_civ REFERENCES civilian(citizen_id) ON DELETE CASCADE,
  phone_number VARCHAR2(15) NOT NULL CONSTRAINT ck_civ_phone CHECK (REGEXP_LIKE(phone_number, '^\+?[0-9]{10,14}$')),
  CONSTRAINT pk_civilian_phone PRIMARY KEY (citizen_id, phone_number)
);

CREATE TABLE company (
  license_no      VARCHAR2(20)  CONSTRAINT pk_company PRIMARY KEY,
  company_name    VARCHAR2(120) NOT NULL,
  contractor_name VARCHAR2(100) NOT NULL,
  gst_no          CHAR(15)      NOT NULL CONSTRAINT uq_company_gst UNIQUE
                  CONSTRAINT ck_company_gst CHECK (REGEXP_LIKE(gst_no, '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')),
  class_rating    VARCHAR2(10)  NOT NULL
                  CONSTRAINT ck_company_class CHECK (class_rating IN ('CLASS_I','CLASS_II','CLASS_III','CLASS_IV')),
  street          VARCHAR2(120),
  city            VARCHAR2(60),
  state           VARCHAR2(60),
  pincode         CHAR(6)       CONSTRAINT ck_company_pincode CHECK (REGEXP_LIKE(pincode, '^[1-9][0-9]{5}$'))
);

CREATE TABLE company_phone (
  license_no VARCHAR2(20) NOT NULL CONSTRAINT fk_comp_phone_comp REFERENCES company(license_no) ON DELETE CASCADE,
  phone_no   VARCHAR2(15) NOT NULL CONSTRAINT ck_comp_phone CHECK (REGEXP_LIKE(phone_no, '^\+?[0-9]{10,14}$')),
  CONSTRAINT pk_company_phone PRIMARY KEY (license_no, phone_no)
);

-- HOMEPAGE: logs_into (EMPLOYEE 1:0..1), registers_on (CIVILIAN 1:0..1), accesses (COMPANY 1:0..1)
CREATE TABLE homepage (
  username      VARCHAR2(40)  CONSTRAINT pk_homepage PRIMARY KEY
                CONSTRAINT ck_homepage_username CHECK (REGEXP_LIKE(username, '^[a-z0-9_.]{3,40}$')),
  password      VARCHAR2(100) NOT NULL,           -- bcrypt hash, never plaintext
  user_type     VARCHAR2(10)  NOT NULL CONSTRAINT ck_homepage_type CHECK (user_type IN ('EMPLOYEE','CIVILIAN','COMPANY')),
  emp_id        NUMBER(8)     CONSTRAINT fk_homepage_emp  REFERENCES employee(emp_id)     ON DELETE CASCADE,
  citizen_id    NUMBER(8)     CONSTRAINT fk_homepage_civ  REFERENCES civilian(citizen_id) ON DELETE CASCADE,
  license_no    VARCHAR2(20)  CONSTRAINT fk_homepage_comp REFERENCES company(license_no)  ON DELETE CASCADE,
  is_active     CHAR(1)       DEFAULT 'Y' NOT NULL CONSTRAINT ck_homepage_active CHECK (is_active IN ('Y','N')),
  created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  last_login_at TIMESTAMP,
  CONSTRAINT uq_homepage_emp  UNIQUE (emp_id),
  CONSTRAINT uq_homepage_civ  UNIQUE (citizen_id),
  CONSTRAINT uq_homepage_comp UNIQUE (license_no),
  CONSTRAINT ck_homepage_arc CHECK (
       (user_type = 'EMPLOYEE' AND emp_id IS NOT NULL AND citizen_id IS NULL AND license_no IS NULL)
    OR (user_type = 'CIVILIAN' AND citizen_id IS NOT NULL AND emp_id IS NULL AND license_no IS NULL)
    OR (user_type = 'COMPANY'  AND license_no IS NOT NULL AND emp_id IS NULL AND citizen_id IS NULL))
);

-- =====================================================================
--  INFRASTRUCTURE
-- =====================================================================
CREATE TABLE zone (
  zone_id     NUMBER(6)    CONSTRAINT pk_zone PRIMARY KEY,
  zone_name   VARCHAR2(80) NOT NULL CONSTRAINT uq_zone_name UNIQUE,
  city_region VARCHAR2(80) NOT NULL,
  emp_id      NUMBER(8)    CONSTRAINT fk_zone_supervisor REFERENCES employee(emp_id) ON DELETE SET NULL  -- supervises
);

CREATE TABLE feeder_pillar (
  cabinet_id         NUMBER(6)    CONSTRAINT pk_feeder_pillar PRIMARY KEY,
  installation_date  DATE         NOT NULL,
  operational_status VARCHAR2(20) DEFAULT 'OPERATIONAL' NOT NULL
                     CONSTRAINT ck_feeder_status CHECK (operational_status IN ('OPERATIONAL','FAULT','MAINTENANCE','OFFLINE')),
  power_rating_kva   NUMBER(6,2)  NOT NULL CONSTRAINT ck_feeder_kva CHECK (power_rating_kva > 0),
  zone_id            NUMBER(6)    NOT NULL CONSTRAINT fk_feeder_zone REFERENCES zone(zone_id)          -- contains
);

CREATE TABLE streetlight (
  pole_id            NUMBER(8)    CONSTRAINT pk_streetlight PRIMARY KEY,
  current_status     VARCHAR2(20) DEFAULT 'FUNCTIONAL' NOT NULL
                     CONSTRAINT ck_light_status CHECK (current_status IN ('FUNCTIONAL','FAULTY','UNDER_MAINTENANCE','DECOMMISSIONED')),
  lamp_type          VARCHAR2(20) NOT NULL
                     CONSTRAINT ck_light_lamp CHECK (lamp_type IN ('LED','SODIUM_VAPOUR','METAL_HALIDE','CFL','SOLAR_LED')),
  wattage            NUMBER(5)    NOT NULL CONSTRAINT ck_light_wattage CHECK (wattage BETWEEN 5 AND 1000),
  dimming_support    CHAR(1)      DEFAULT 'N' NOT NULL CONSTRAINT ck_light_dimming CHECK (dimming_support IN ('Y','N')),
  latitude           NUMBER(9,6)  NOT NULL CONSTRAINT ck_light_lat CHECK (latitude  BETWEEN -90  AND 90),
  longitude          NUMBER(9,6)  NOT NULL CONSTRAINT ck_light_lng CHECK (longitude BETWEEN -180 AND 180),
  installation_date  DATE         NOT NULL,
  last_serviced_date DATE,
  zone_id            NUMBER(6)    NOT NULL CONSTRAINT fk_light_zone   REFERENCES zone(zone_id),               -- located_in
  cabinet_id         NUMBER(6)    NOT NULL CONSTRAINT fk_light_feeder REFERENCES feeder_pillar(cabinet_id),   -- powers
  CONSTRAINT ck_light_service CHECK (last_serviced_date IS NULL OR last_serviced_date >= installation_date)
);

CREATE TABLE sensor (
  sensor_id          NUMBER(8)    CONSTRAINT pk_sensor PRIMARY KEY,
  sensor_type        VARCHAR2(20) NOT NULL
                     CONSTRAINT ck_sensor_type CHECK (sensor_type IN ('LDR','MOTION','CURRENT','VOLTAGE','TEMPERATURE','AIR_QUALITY')),
  manufacturer       VARCHAR2(80),
  status             VARCHAR2(12) DEFAULT 'ACTIVE' NOT NULL
                     CONSTRAINT ck_sensor_status CHECK (status IN ('ACTIVE','INACTIVE','FAULTY')),
  last_reading_value NUMBER(10,3),
  last_reading_time  TIMESTAMP,
  zone_id            NUMBER(6)    NOT NULL CONSTRAINT fk_sensor_zone  REFERENCES zone(zone_id),                         -- deployed_in
  pole_id            NUMBER(8)    NOT NULL CONSTRAINT fk_sensor_light REFERENCES streetlight(pole_id) ON DELETE CASCADE  -- has
);

-- Weak entity: identified by owner STREETLIGHT + partial key log_number (records)
CREATE TABLE energy_log (
  pole_id        NUMBER(8)    NOT NULL CONSTRAINT fk_energy_light REFERENCES streetlight(pole_id) ON DELETE CASCADE,
  log_number     NUMBER(6)    NOT NULL,
  reading_date   DATE         NOT NULL,
  units_consumed NUMBER(10,3) NOT NULL CONSTRAINT ck_energy_units CHECK (units_consumed >= 0),
  cost_inr       NUMBER(10,2) NOT NULL CONSTRAINT ck_energy_cost  CHECK (cost_inr >= 0),
  CONSTRAINT pk_energy_log PRIMARY KEY (pole_id, log_number),
  CONSTRAINT uq_energy_log_day UNIQUE (pole_id, reading_date)
);

-- =====================================================================
--  OPERATIONS
-- =====================================================================
CREATE TABLE complaint (
  complaint_id       NUMBER(8)     CONSTRAINT pk_complaint PRIMARY KEY,
  issue_category     VARCHAR2(20)  NOT NULL
                     CONSTRAINT ck_complaint_cat CHECK (issue_category IN
                       ('LIGHT_OUT','FLICKERING','DAY_BURNING','DAMAGED_POLE','EXPOSED_WIRING','OTHER')),
  description        VARCHAR2(1000) NOT NULL,
  ticket_status      VARCHAR2(12)  DEFAULT 'OPEN' NOT NULL
                     CONSTRAINT ck_complaint_status CHECK (ticket_status IN
                       ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED')),
  reported_timestamp TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  citizen_id         NUMBER(8)     NOT NULL CONSTRAINT fk_complaint_civ   REFERENCES civilian(citizen_id),            -- submits
  pole_id            NUMBER(8)     NOT NULL CONSTRAINT fk_complaint_light REFERENCES streetlight(pole_id),            -- receives
  handled_by         NUMBER(8)     CONSTRAINT fk_complaint_emp REFERENCES employee(emp_id) ON DELETE SET NULL          -- handles
);

CREATE TABLE spare_parts (
  part_id           NUMBER(6)     CONSTRAINT pk_spare_parts PRIMARY KEY,
  part_name         VARCHAR2(100) NOT NULL CONSTRAINT uq_spare_parts_name UNIQUE,
  unit_price        NUMBER(10,2)  NOT NULL CONSTRAINT ck_part_price CHECK (unit_price >= 0),
  quantity_in_stock NUMBER(8)     DEFAULT 0 NOT NULL CONSTRAINT ck_part_stock CHECK (quantity_in_stock >= 0)
);

CREATE TABLE work_order (
  work_order_id        NUMBER(8)     CONSTRAINT pk_work_order PRIMARY KEY,
  work_type            VARCHAR2(20)  NOT NULL
                       CONSTRAINT ck_wo_type CHECK (work_type IN
                         ('REPAIR','REPLACEMENT','INSTALLATION','INSPECTION','PREVENTIVE','UPGRADE')),
  status               VARCHAR2(12)  DEFAULT 'PENDING' NOT NULL
                       CONSTRAINT ck_wo_status CHECK (status IN ('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  resolution_notes     VARCHAR2(1000),
  created_timestamp    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  completion_timestamp TIMESTAMP,
  zone_id              NUMBER(6)     NOT NULL CONSTRAINT fk_wo_zone    REFERENCES zone(zone_id),                         -- scheduled_in
  pole_id              NUMBER(8)     CONSTRAINT fk_wo_light   REFERENCES streetlight(pole_id),                           -- requires
  complaint_id         NUMBER(8)     CONSTRAINT fk_wo_complaint REFERENCES complaint(complaint_id),                      -- resolves
  emp_id               NUMBER(8)     CONSTRAINT fk_wo_emp     REFERENCES employee(emp_id) ON DELETE SET NULL,            -- assigned_to
  license_no           VARCHAR2(20)  CONSTRAINT fk_wo_company REFERENCES company(license_no),                            -- executes
  CONSTRAINT ck_wo_completion CHECK (completion_timestamp IS NULL OR completion_timestamp >= created_timestamp),
  CONSTRAINT ck_wo_completed_ts CHECK (status <> 'COMPLETED' OR completion_timestamp IS NOT NULL)
);

-- uses (M:N)
CREATE TABLE work_order_part (
  work_order_id NUMBER(8) NOT NULL CONSTRAINT fk_wop_wo   REFERENCES work_order(work_order_id) ON DELETE CASCADE,
  part_id       NUMBER(6) NOT NULL CONSTRAINT fk_wop_part REFERENCES spare_parts(part_id),
  quantity_used NUMBER(6) NOT NULL CONSTRAINT ck_wop_qty CHECK (quantity_used > 0),
  CONSTRAINT pk_work_order_part PRIMARY KEY (work_order_id, part_id)
);

-- generates (WORK_ORDER 1 : 0..1 BILLING)
CREATE TABLE billing (
  billing_id        NUMBER(8)    CONSTRAINT pk_billing PRIMARY KEY,
  work_order_id     NUMBER(8)    NOT NULL CONSTRAINT fk_billing_wo REFERENCES work_order(work_order_id),
  payment_id        VARCHAR2(40),
  payment_type      VARCHAR2(20) NOT NULL
                    CONSTRAINT ck_billing_ptype CHECK (payment_type IN ('NEFT','RTGS','UPI','CHEQUE','DEMAND_DRAFT')),
  receipt_no        VARCHAR2(30) CONSTRAINT uq_billing_receipt UNIQUE,
  budget_sanctioned NUMBER(12,2) NOT NULL CONSTRAINT ck_billing_budget CHECK (budget_sanctioned >= 0),
  actually_spent    NUMBER(12,2) DEFAULT 0 NOT NULL CONSTRAINT ck_billing_spent CHECK (actually_spent >= 0),
  billing_amount    NUMBER(12,2) NOT NULL CONSTRAINT ck_billing_amount CHECK (billing_amount >= 0),
  CONSTRAINT uq_billing_wo UNIQUE (work_order_id)
);

-- ---------- indexes on FKs / hot filters (Oracle does not auto-index FKs) ----
CREATE INDEX ix_employee_dept      ON employee(dept_id);
CREATE INDEX ix_zone_emp           ON zone(emp_id);
CREATE INDEX ix_feeder_zone        ON feeder_pillar(zone_id);
CREATE INDEX ix_light_zone         ON streetlight(zone_id);
CREATE INDEX ix_light_feeder       ON streetlight(cabinet_id);
CREATE INDEX ix_light_status       ON streetlight(current_status);
CREATE INDEX ix_sensor_zone        ON sensor(zone_id);
CREATE INDEX ix_sensor_light       ON sensor(pole_id);
CREATE INDEX ix_energy_date        ON energy_log(reading_date);
CREATE INDEX ix_complaint_civ      ON complaint(citizen_id);
CREATE INDEX ix_complaint_light    ON complaint(pole_id);
CREATE INDEX ix_complaint_emp      ON complaint(handled_by);
CREATE INDEX ix_complaint_status   ON complaint(ticket_status);
CREATE INDEX ix_wo_zone            ON work_order(zone_id);
CREATE INDEX ix_wo_light           ON work_order(pole_id);
CREATE INDEX ix_wo_complaint       ON work_order(complaint_id);
CREATE INDEX ix_wo_emp             ON work_order(emp_id);
CREATE INDEX ix_wo_company         ON work_order(license_no);
CREATE INDEX ix_wo_status          ON work_order(status);
CREATE INDEX ix_wop_part           ON work_order_part(part_id);

PROMPT Schema created.
EXIT
