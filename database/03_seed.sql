-- =====================================================================
--  03_seed.sql -- demo data (Bengaluru)              (run as SLMS)
--  All demo logins use password:  Password@123
--  IDs come from sequences; 01_schema.sql resets them so they are stable:
--    employees 1001.., civilians 5001.., zones 1.., feeders 101..,
--    poles 10001.., complaints 90001.., work orders 30001.., parts 501..
-- =====================================================================
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

-- ---------- departments (10,20,...) ----------
-- dept_id 10
INSERT INTO department (dept_name, dept_type) VALUES ('Administration',          'ADMINISTRATION');
-- dept_id 20
INSERT INTO department (dept_name, dept_type) VALUES ('Field Operations',        'OPERATIONS');
-- dept_id 30
INSERT INTO department (dept_name, dept_type) VALUES ('Electrical Maintenance',  'MAINTENANCE');
-- dept_id 40
INSERT INTO department (dept_name, dept_type) VALUES ('Finance & Accounts',      'FINANCE');
-- dept_id 50
INSERT INTO department (dept_name, dept_type) VALUES ('IT & Smart Systems',      'IT');
-- dept_id 60
INSERT INTO department (dept_name, dept_type) VALUES ('Citizen Services',        'CUSTOMER_SERVICE');

-- ---------- login accounts (HOMEPAGE) : password = Password@123 ----------
-- logs_into / registers_on / accesses are 1:1 with TOTAL participation, so every
-- employee, civilian and company row below references exactly one of these logins.
INSERT INTO homepage (username, password, user_type) VALUES ('admin',           '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('karthik.menon',   '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('priya.nair',      '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('rahul.gowda',     '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('deepa.k',         '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('suresh.kumar',    '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('m.irfan',         '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('lakshmi.hegde',   '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('vikram.shetty',   '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('sneha.k',         '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('arjun.reddy',     '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('meera.iyer',      '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'EMPLOYEE');
INSERT INTO homepage (username, password, user_type) VALUES ('rohan.desai',     '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('fatima.sheikh',   '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('aditya.bhat',     '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('kavya.shenoy',    '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('naveen.prasad',   '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('pooja.ramesh',    '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('thomas.george',   '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('divya.joshi',     '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('harish.rao',      '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('anjali.verma',    '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'CIVILIAN');
INSERT INTO homepage (username, password, user_type) VALUES ('lumen',           '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'COMPANY');
INSERT INTO homepage (username, password, user_type) VALUES ('brightpath',      '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'COMPANY');
INSERT INTO homepage (username, password, user_type) VALUES ('deccanpower',     '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'COMPANY');
INSERT INTO homepage (username, password, user_type) VALUES ('nammalights',     '$2b$10$ie.D4SXU6NGsUVv4uT.cxuJyqYlznj/rPfYiMP4oltUWVxd2UVfvG', 'COMPANY');

-- ---------- employees (1001..1012) ----------
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Ananya', NULL, 'Rao', DATE '1984-03-12', DATE '2012-06-01', 'ADMIN', '234567890123', 'MORNING', 145000, '12 MG Road', 'Bengaluru', 'Karnataka', '560001', 10, 'admin');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Karthik', 'S', 'Menon', DATE '1988-07-21', DATE '2015-01-15', 'ZONE_SUPERVISOR', '345678901234', 'MORNING', 92000, '4th Block, 80 Ft Rd', 'Bengaluru', 'Karnataka', '560034', 20, 'karthik.menon');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Priya', NULL, 'Nair', DATE '1990-11-02', DATE '2016-08-10', 'ZONE_SUPERVISOR', '456789012345', 'EVENING', 89000, '100 Ft Road', 'Bengaluru', 'Karnataka', '560038', 20, 'priya.nair');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Rahul', NULL, 'Gowda', DATE '1986-01-30', DATE '2014-04-01', 'ZONE_SUPERVISOR', '567890123456', 'ROTATIONAL', 95000, '9th Block', 'Bengaluru', 'Karnataka', '560069', 20, 'rahul.gowda');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Deepa', NULL, 'Krishnan', DATE '1991-05-17', DATE '2018-02-19', 'ENGINEER', '678901234567', 'MORNING', 78000, 'ITPL Main Rd', 'Bengaluru', 'Karnataka', '560066', 30, 'deepa.k');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Suresh', NULL, 'Kumar', DATE '1993-09-09', DATE '2019-07-01', 'TECHNICIAN', '789012345678', 'NIGHT', 42000, 'Sampige Road', 'Bengaluru', 'Karnataka', '560003', 30, 'suresh.kumar');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Mohammed', NULL, 'Irfan', DATE '1995-12-25', DATE '2020-03-16', 'TECHNICIAN', '890123456789', 'EVENING', 40000, 'Hosur Road', 'Bengaluru', 'Karnataka', '560100', 30, 'm.irfan');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Lakshmi', 'B', 'Hegde', DATE '1994-04-14', DATE '2021-01-04', 'TECHNICIAN', '901234567890', 'NIGHT', 39000, 'CMH Road', 'Bengaluru', 'Karnataka', '560038', 30, 'lakshmi.hegde');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Vikram', NULL, 'Shetty', DATE '1987-08-08', DATE '2013-11-11', 'ACCOUNTANT', '298765432109', 'MORNING', 70000, 'Residency Road', 'Bengaluru', 'Karnataka', '560025', 40, 'vikram.shetty');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Sneha', NULL, 'Kulkarni', DATE '1997-02-27', DATE '2022-06-20', 'SUPPORT_AGENT', '387654321098', 'MORNING', 34000, 'Basavanagudi', 'Bengaluru', 'Karnataka', '560004', 60, 'sneha.k');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Arjun', NULL, 'Reddy', DATE '1992-10-05', DATE '2017-09-25', 'ENGINEER', '476543210987', 'ROTATIONAL', 85000, 'Outer Ring Road', 'Bengaluru', 'Karnataka', '560103', 50, 'arjun.reddy');
INSERT INTO employee (first_name, middle_name, last_name, date_of_birth, date_of_joining, role, aadhar_id, shift_type, salary, street, city, state, pincode, dept_id, username)
VALUES ('Meera', NULL, 'Iyer', DATE '1998-06-30', DATE '2023-03-01', 'SUPPORT_AGENT', '565432109876', 'EVENING', 32000, 'Malleshwaram 8th Cross', 'Bengaluru', 'Karnataka', '560003', 60, 'meera.iyer');

INSERT INTO employee_email VALUES (1001, 'ananya.rao@slms.gov.in');
INSERT INTO employee_email VALUES (1001, 'ananya.r84@gmail.com');
INSERT INTO employee_email VALUES (1002, 'karthik.menon@slms.gov.in');
INSERT INTO employee_email VALUES (1003, 'priya.nair@slms.gov.in');
INSERT INTO employee_email VALUES (1004, 'rahul.gowda@slms.gov.in');
INSERT INTO employee_email VALUES (1005, 'deepa.k@slms.gov.in');
INSERT INTO employee_email VALUES (1006, 'suresh.kumar@slms.gov.in');
INSERT INTO employee_email VALUES (1007, 'm.irfan@slms.gov.in');
INSERT INTO employee_email VALUES (1008, 'lakshmi.hegde@slms.gov.in');
INSERT INTO employee_email VALUES (1009, 'vikram.shetty@slms.gov.in');
INSERT INTO employee_email VALUES (1010, 'sneha.k@slms.gov.in');
INSERT INTO employee_email VALUES (1011, 'arjun.reddy@slms.gov.in');
INSERT INTO employee_email VALUES (1012, 'meera.iyer@slms.gov.in');
INSERT INTO employee_phone VALUES (1001, '+919845012345');
INSERT INTO employee_phone VALUES (1001, '08022213344');
INSERT INTO employee_phone VALUES (1002, '+919880123456');
INSERT INTO employee_phone VALUES (1003, '+919900234567');
INSERT INTO employee_phone VALUES (1004, '+919731345678');
INSERT INTO employee_phone VALUES (1005, '+919611456789');
INSERT INTO employee_phone VALUES (1006, '+919535567890');
INSERT INTO employee_phone VALUES (1006, '+918147678901');
INSERT INTO employee_phone VALUES (1007, '+917022789012');
INSERT INTO employee_phone VALUES (1008, '+919448890123');
INSERT INTO employee_phone VALUES (1009, '+919343901234');
INSERT INTO employee_phone VALUES (1010, '+918971012345');
INSERT INTO employee_phone VALUES (1011, '+919986123450');
INSERT INTO employee_phone VALUES (1012, '+917760234561');

-- ---------- civilians (5001..5010) ----------
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Rohan', NULL, 'Desai', '5th Cross, Koramangala 6th Block', 'Bengaluru', 'Karnataka', '560095', 'rohan.desai');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Fatima', NULL, 'Sheikh', '12th Main, HAL 2nd Stage', 'Bengaluru', 'Karnataka', '560038', 'fatima.sheikh');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Aditya', 'K', 'Bhat', '30th Cross, Jayanagar 4th T Block', 'Bengaluru', 'Karnataka', '560041', 'aditya.bhat');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Kavya', NULL, 'Shenoy', 'Hope Farm Junction', 'Bengaluru', 'Karnataka', '560066', 'kavya.shenoy');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Naveen', NULL, 'Prasad', '15th Cross, Malleshwaram', 'Bengaluru', 'Karnataka', '560003', 'naveen.prasad');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Pooja', NULL, 'Ramesh', 'Neeladri Nagar, Electronic City Ph 1', 'Bengaluru', 'Karnataka', '560100', 'pooja.ramesh');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Thomas', NULL, 'George', '1st Block, Koramangala', 'Bengaluru', 'Karnataka', '560034', 'thomas.george');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Divya', NULL, 'Joshi', 'Defence Colony, Indiranagar', 'Bengaluru', 'Karnataka', '560038', 'divya.joshi');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Harish', NULL, 'Rao', 'South End Circle', 'Bengaluru', 'Karnataka', '560011', 'harish.rao');
INSERT INTO civilian (first_name, middle_name, last_name, street, city, state, pincode, username) VALUES ('Anjali', 'M', 'Verma', 'Brookefield Main Rd', 'Bengaluru', 'Karnataka', '560066', 'anjali.verma');

INSERT INTO civilian_email VALUES (5001, 'rohan.desai@gmail.com');
INSERT INTO civilian_email VALUES (5002, 'fatima.sheikh@outlook.com');
INSERT INTO civilian_email VALUES (5003, 'aditya.bhat@yahoo.in');
INSERT INTO civilian_email VALUES (5003, 'adi.kb@gmail.com');
INSERT INTO civilian_email VALUES (5004, 'kavya.shenoy@gmail.com');
INSERT INTO civilian_email VALUES (5005, 'naveen.p@gmail.com');
INSERT INTO civilian_email VALUES (5006, 'pooja.ramesh@gmail.com');
INSERT INTO civilian_email VALUES (5007, 'thomas.george@proton.me');
INSERT INTO civilian_email VALUES (5008, 'divya.joshi@gmail.com');
INSERT INTO civilian_email VALUES (5009, 'harish.rao@rediffmail.com');
INSERT INTO civilian_email VALUES (5010, 'anjali.verma@gmail.com');
INSERT INTO civilian_phone VALUES (5001, '+919876500001');
INSERT INTO civilian_phone VALUES (5002, '+919876500002');
INSERT INTO civilian_phone VALUES (5003, '+919876500003');
INSERT INTO civilian_phone VALUES (5004, '+919876500004');
INSERT INTO civilian_phone VALUES (5004, '+918050500004');
INSERT INTO civilian_phone VALUES (5005, '+919876500005');
INSERT INTO civilian_phone VALUES (5006, '+919876500006');
INSERT INTO civilian_phone VALUES (5007, '+919876500007');
INSERT INTO civilian_phone VALUES (5008, '+919876500008');
INSERT INTO civilian_phone VALUES (5009, '+919876500009');
INSERT INTO civilian_phone VALUES (5010, '+919876500010');

-- ---------- contractor companies ----------
INSERT INTO company VALUES ('KA-EL-2019-0457', 'Lumen Infra Services Pvt Ltd', 'Ravi Shankar',  '29AABCL4571K1Z3', 'CLASS_I',   'Peenya Industrial Area', 'Bengaluru', 'Karnataka', '560058', 'lumen');
INSERT INTO company VALUES ('KA-EL-2020-1123', 'BrightPath Electricals',       'Nandini Murthy','29AADFB1123M1Z8', 'CLASS_II',  'Bommasandra Ind. Area',  'Bengaluru', 'Karnataka', '560099', 'brightpath');
INSERT INTO company VALUES ('KA-EL-2018-0789', 'Deccan Power Solutions LLP',   'Imran Pasha',   '29AAKFD0789P1ZQ', 'CLASS_I',   'Rajajinagar',            'Bengaluru', 'Karnataka', '560010', 'deccanpower');
INSERT INTO company VALUES ('KA-EL-2022-2045', 'Namma Lights Contractors',     'Gopal Swamy',   '29ABNPN2045R1Z1', 'CLASS_III', 'Yeshwanthpur',           'Bengaluru', 'Karnataka', '560022', 'nammalights');
INSERT INTO company_phone VALUES ('KA-EL-2019-0457', '+918028391100');
INSERT INTO company_phone VALUES ('KA-EL-2019-0457', '+919845991100');
INSERT INTO company_phone VALUES ('KA-EL-2020-1123', '+918027832200');
INSERT INTO company_phone VALUES ('KA-EL-2018-0789', '+918023356600');
INSERT INTO company_phone VALUES ('KA-EL-2022-2045', '+919008877660');

-- ---------- zones (1..6) ----------
INSERT INTO zone (zone_name, city_region, emp_id) VALUES ('Koramangala',     'South Bengaluru',      1002);
INSERT INTO zone (zone_name, city_region, emp_id) VALUES ('Indiranagar',     'East Bengaluru',       1003);
INSERT INTO zone (zone_name, city_region, emp_id) VALUES ('Jayanagar',       'South Bengaluru',      1004);
INSERT INTO zone (zone_name, city_region, emp_id) VALUES ('Whitefield',      'East Bengaluru',       1003);
INSERT INTO zone (zone_name, city_region, emp_id) VALUES ('Malleshwaram',    'North-West Bengaluru', 1002);
INSERT INTO zone (zone_name, city_region, emp_id) VALUES ('Electronic City', 'South-East Bengaluru', 1004);

-- ---------- spare parts (501..510) ----------
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('LED Module 90W',            3450.00, 60);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('LED Driver 100W',           1890.00, 45);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('Sodium Vapour Lamp 150W',    620.00, 30);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('Ballast 150W',               980.00, 25);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('Photocell / LDR Switch',     340.00, 80);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('Armoured Cable 4C x 16 sqmm (m)', 410.00, 500);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('MCB 32A',                    265.00, 40);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('GI Pole 9m',               18500.00, 6);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('Smart Dimming Controller',  2750.00, 12);
INSERT INTO spare_parts (part_name, unit_price, quantity_in_stock) VALUES ('Surge Protection Device',    720.00, 3);

-- ---------- feeders, streetlights, sensors, energy logs (generated) ----------
DECLARE
  TYPE t_num IS TABLE OF NUMBER;
  lat0 t_num := t_num(12.9352, 12.9784, 12.9250, 12.9698, 13.0035, 12.8452);
  lng0 t_num := t_num(77.6245, 77.6408, 77.5938, 77.7500, 77.5647, 77.6602);
  TYPE t_str IS TABLE OF VARCHAR2(40);
  lamps t_str := t_str('LED','LED','LED','SODIUM_VAPOUR','LED','METAL_HALIDE','SOLAR_LED','CFL');
  mfrs  t_str := t_str('Philips','Syska','Havells','Bosch','Honeywell');
  v_cab   NUMBER;
  v_pole  NUMBER;
  v_watt  NUMBER;
  v_lamp  VARCHAR2(20);
  v_dim   CHAR(1);
  v_inst  DATE;
  v_units NUMBER;
BEGIN
  DBMS_RANDOM.SEED(42);
  FOR z IN 1 .. 6 LOOP
    FOR f IN 1 .. 2 LOOP
      INSERT INTO feeder_pillar (installation_date, operational_status, power_rating_kva, zone_id)
      VALUES (ADD_MONTHS(DATE '2015-01-01', z * 6 + f), 'OPERATIONAL', CASE f WHEN 1 THEN 5 ELSE 7.5 END, z);
    END LOOP;
  END LOOP;

  FOR z IN 1 .. 6 LOOP
    FOR i IN 1 .. 8 LOOP
      v_cab  := 101 + (z - 1) * 2 + CASE WHEN i <= 4 THEN 0 ELSE 1 END;
      v_lamp := lamps(MOD(i + z, 8) + 1);
      v_watt := CASE v_lamp WHEN 'LED' THEN 60 + 30 * MOD(i, 3)
                            WHEN 'SODIUM_VAPOUR' THEN 150
                            WHEN 'METAL_HALIDE' THEN 250
                            WHEN 'SOLAR_LED' THEN 40
                            ELSE 45 END;
      v_dim  := CASE WHEN v_lamp IN ('LED','SOLAR_LED') AND MOD(i, 2) = 0 THEN 'Y' ELSE 'N' END;
      v_inst := ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -TRUNC(DBMS_RANDOM.VALUE(18, 108)));

      INSERT INTO streetlight (current_status, lamp_type, wattage, dimming_support, latitude, longitude,
                               installation_date, last_serviced_date, zone_id, cabinet_id)
      VALUES ('FUNCTIONAL', v_lamp, v_watt, v_dim,
              ROUND(lat0(z) + DBMS_RANDOM.VALUE(-0.008, 0.008), 6),
              ROUND(lng0(z) + DBMS_RANDOM.VALUE(-0.008, 0.008), 6),
              v_inst,
              CASE WHEN MOD(i, 3) = 0 THEN NULL ELSE v_inst + TRUNC(DBMS_RANDOM.VALUE(60, 400)) END,
              z, v_cab)
      RETURNING pole_id INTO v_pole;

      IF MOD(i, 2) = 1 THEN
        INSERT INTO sensor (sensor_type, manufacturer, status, last_reading_value, last_reading_time, zone_id, pole_id)
        VALUES ('LDR', mfrs(MOD(i + z, 5) + 1), CASE WHEN MOD(v_pole, 13) = 0 THEN 'FAULTY' ELSE 'ACTIVE' END,
                ROUND(DBMS_RANDOM.VALUE(2, 40), 2), SYSTIMESTAMP - NUMTODSINTERVAL(DBMS_RANDOM.VALUE(1, 300), 'MINUTE'), z, v_pole);
      END IF;
      IF MOD(i, 4) = 1 THEN
        INSERT INTO sensor (sensor_type, manufacturer, status, last_reading_value, last_reading_time, zone_id, pole_id)
        VALUES ('CURRENT', mfrs(MOD(i * z, 5) + 1), 'ACTIVE',
                ROUND(v_watt / 230 * DBMS_RANDOM.VALUE(0.9, 1.1), 3), SYSTIMESTAMP - NUMTODSINTERVAL(DBMS_RANDOM.VALUE(1, 120), 'MINUTE'), z, v_pole);
      END IF;
      IF z IN (1, 4) AND i = 8 THEN
        INSERT INTO sensor (sensor_type, manufacturer, status, last_reading_value, last_reading_time, zone_id, pole_id)
        VALUES ('MOTION', 'Honeywell', 'ACTIVE', 1, SYSTIMESTAMP - NUMTODSINTERVAL(15, 'MINUTE'), z, v_pole);
      END IF;

      -- 6 monthly energy readings; ~11.5 burn hours/night, dimming saves ~30%
      FOR m IN REVERSE 1 .. 6 LOOP
        v_units := ROUND(v_watt * 11.5 * 30 / 1000 * CASE v_dim WHEN 'Y' THEN 0.7 ELSE 1 END
                         * DBMS_RANDOM.VALUE(0.9, 1.1), 3);
        INSERT INTO energy_log (pole_id, log_number, reading_date, units_consumed, cost_inr)
        VALUES (v_pole, 7 - m, LAST_DAY(ADD_MONTHS(TRUNC(SYSDATE), -m)), v_units, ROUND(v_units * 7.5, 2));
      END LOOP;
    END LOOP;
  END LOOP;
END;
/

-- a few lights flagged by sensors / retired
UPDATE streetlight SET current_status = 'FAULTY'         WHERE pole_id IN (10020, 10040);
UPDATE streetlight SET current_status = 'DECOMMISSIONED' WHERE pole_id = 10048;
UPDATE feeder_pillar SET operational_status = 'MAINTENANCE' WHERE cabinet_id = 110;

-- ---------- complaints (90001..90015) -- trigger flips light to FAULTY ----------
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('LIGHT_OUT',      'Light completely off near the bakery for 3 nights.',            SYSTIMESTAMP - NUMTODSINTERVAL(40, 'DAY'), 5001, 10003, 1010);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('FLICKERING',     'Lamp flickers continuously after 9 PM.',                         SYSTIMESTAMP - NUMTODSINTERVAL(35, 'DAY'), 5002, 10011, 1010);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('DAMAGED_POLE',   'Pole tilted after a truck hit it, looks unsafe.',                SYSTIMESTAMP - NUMTODSINTERVAL(30, 'DAY'), 5003, 10019, 1012);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('EXPOSED_WIRING', 'Junction box open with wires hanging at child height.',          SYSTIMESTAMP - NUMTODSINTERVAL(25, 'DAY'), 5004, 10027, 1010);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('DAY_BURNING',    'Light stays on during the day, wasting power.',                  SYSTIMESTAMP - NUMTODSINTERVAL(20, 'DAY'), 5005, 10035, 1012);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('LIGHT_OUT',      'Entire stretch dark near the bus stop.',                         SYSTIMESTAMP - NUMTODSINTERVAL(15, 'DAY'), 5006, 10043, 1010);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('FLICKERING',     'Strobe-like flicker, very distracting for drivers.',             SYSTIMESTAMP - NUMTODSINTERVAL(6, 'DAY'),  5007, 10005, 1012);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('LIGHT_OUT',      'Not working since the rain on Sunday.',                          SYSTIMESTAMP - NUMTODSINTERVAL(5, 'DAY'),  5008, 10014, 1010);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('EXPOSED_WIRING', 'Sparks seen from the base of the pole.',                         SYSTIMESTAMP - NUMTODSINTERVAL(3, 'DAY'),  5009, 10022, 1012);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('LIGHT_OUT',      'Dark corner near the park gate.',                                SYSTIMESTAMP - NUMTODSINTERVAL(2, 'DAY'),  5010, 10030, NULL);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('FLICKERING',     'Flickering on and off every few seconds.',                       SYSTIMESTAMP - NUMTODSINTERVAL(1, 'DAY'),  5001, 10038, NULL);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('DAMAGED_POLE',   'Lamp head cover broken, glass on the footpath.',                 SYSTIMESTAMP - NUMTODSINTERVAL(1, 'DAY'),  5002, 10046, NULL);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('OTHER',          'Please install a new light on our lane (no pole here).',        SYSTIMESTAMP - NUMTODSINTERVAL(10, 'DAY'), 5003, NULL,  1012);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('LIGHT_OUT',      'Light out outside apartment block B.',                           SYSTIMESTAMP - NUMTODSINTERVAL(50, 'DAY'), 5004, 10016, 1010);
INSERT INTO complaint (issue_category, description, reported_timestamp, citizen_id, pole_id, handled_by) VALUES ('FLICKERING',     'Same pole as an earlier report - still flickering badly.',        SYSTIMESTAMP - NUMTODSINTERVAL(4, 'DAY'),  5008, 10005, 1012);

-- ---------- work orders (30001..30013) ----------
-- resolves is 1:N (one work order -> many complaints), stored as COMPLAINT.work_order_id.
-- Each job is created as ASSIGNED, its complaint(s) are linked, then it is moved to
-- its final status so the triggers cascade to lights and tickets as in real use.
DECLARE
  v_id NUMBER;
  FUNCTION ago(p_days NUMBER, p_hours NUMBER DEFAULT 0) RETURN TIMESTAMP IS
  BEGIN
    RETURN SYSTIMESTAMP - NUMTODSINTERVAL(p_days, 'DAY') + NUMTODSINTERVAL(p_hours, 'HOUR');
  END;
  PROCEDURE wo(p_type VARCHAR2, p_status VARCHAR2, p_notes VARCHAR2, p_created TIMESTAMP, p_done TIMESTAMP,
               p_pole NUMBER, p_zone NUMBER, p_emp NUMBER, p_lic VARCHAR2, p_complaints VARCHAR2 DEFAULT NULL) IS
  BEGIN
    INSERT INTO work_order (work_type, status, resolution_notes, created_timestamp, zone_id, pole_id, emp_id, license_no)
    VALUES (p_type, 'ASSIGNED', p_notes, p_created, p_zone, p_pole, p_emp, p_lic)
    RETURNING work_order_id INTO v_id;
    IF p_complaints IS NOT NULL THEN
      UPDATE complaint SET work_order_id = v_id
       WHERE INSTR(',' || p_complaints || ',', ',' || complaint_id || ',') > 0;
    END IF;
    IF p_status <> 'ASSIGNED' THEN
      UPDATE work_order SET status = p_status, completion_timestamp = p_done WHERE work_order_id = v_id;
    END IF;
  END;
BEGIN
  --   type           status         notes                                                          created       completed   pole   zone  emp   company             complaints
  wo('REPAIR',      'COMPLETED',   'Replaced failed LED driver; tested OK.',                       ago(40, 3), ago(39),     10003, NULL, 1006, NULL,              '90001');
  wo('REPAIR',      'COMPLETED',   'Loose neutral at terminal block fixed, photocell replaced.',   ago(35, 5), ago(33),     10011, NULL, 1007, 'KA-EL-2020-1123', '90002');
  wo('REPLACEMENT', 'COMPLETED',   'Pole replaced with new 9m GI pole and LED fixture.',           ago(30, 2), ago(26),     10019, NULL, 1005, 'KA-EL-2019-0457', '90003');
  wo('REPAIR',      'COMPLETED',   'Junction box sealed, cable re-terminated, SPD installed.',     ago(25, 1), ago(25, 9),  10027, NULL, 1008, 'KA-EL-2018-0789', '90004');
  wo('REPAIR',      'COMPLETED',   'Faulty photocell swapped.',                                    ago(20, 6), ago(19),     10035, NULL, 1006, NULL,              '90005');
  wo('REPLACEMENT', 'COMPLETED',   'Sodium lamp + ballast replaced with LED retrofit.',            ago(15, 4), ago(13),     10043, NULL, 1007, 'KA-EL-2019-0457', '90006');
  wo('REPAIR',      'IN_PROGRESS', 'Driver ordered, awaiting install.',                            ago(5),     NULL,        10005, NULL, 1006, NULL,              '90007,90015');
  wo('REPAIR',      'ASSIGNED',    NULL,                                                           ago(4),     NULL,        10014, NULL, 1008, NULL,              '90008');
  wo('REPAIR',      'IN_PROGRESS', 'Area cordoned off; cable fault being traced.',                 ago(3, 2),  NULL,        10022, NULL, 1005, 'KA-EL-2018-0789', '90009');
  wo('REPAIR',      'COMPLETED',   'MCB tripped repeatedly; replaced MCB.',                        ago(50, 2), ago(49),     10016, NULL, 1006, NULL,              '90014');
  wo('PREVENTIVE',  'COMPLETED',   'Quarterly cleaning and IR inspection of Whitefield feeders.',  ago(60),    ago(57),     NULL,  4,    1005, 'KA-EL-2022-2045');
  wo('INSPECTION',  'PENDING',     NULL,                                                           ago(1),     NULL,        NULL,  6,    1005, NULL);
  wo('UPGRADE',     'COMPLETED',   'Smart dimming controller retrofitted.',                        ago(70),    ago(68),     10001, NULL, 1011, 'KA-EL-2019-0457');
END;
/

UPDATE complaint SET ticket_status = 'CLOSED'   WHERE complaint_id = 90014;
UPDATE complaint SET ticket_status = 'REJECTED' WHERE complaint_id = 90013;

-- ---------- parts consumed (trigger debits stock) ----------
INSERT INTO work_order_part VALUES (30001, 502, 1);
INSERT INTO work_order_part VALUES (30002, 505, 1);
INSERT INTO work_order_part VALUES (30003, 508, 1);
INSERT INTO work_order_part VALUES (30003, 501, 1);
INSERT INTO work_order_part VALUES (30003, 506, 12);
INSERT INTO work_order_part VALUES (30004, 506, 6);
INSERT INTO work_order_part VALUES (30004, 510, 1);
INSERT INTO work_order_part VALUES (30005, 505, 1);
INSERT INTO work_order_part VALUES (30006, 501, 1);
INSERT INTO work_order_part VALUES (30006, 502, 1);
INSERT INTO work_order_part VALUES (30009, 506, 20);
INSERT INTO work_order_part VALUES (30010, 507, 1);
INSERT INTO work_order_part VALUES (30011, 507, 2);
INSERT INTO work_order_part VALUES (30013, 509, 1);

-- ---------- billing (contractor jobs) ----------
INSERT INTO billing (work_order_id, payment_id, payment_type, receipt_no, budget_sanctioned, actually_spent, billing_amount) VALUES (30002, 'UPI-77812093', 'UPI',    'RCPT-2026-0141', 3000,  2640,  2640);
INSERT INTO billing (work_order_id, payment_id, payment_type, receipt_no, budget_sanctioned, actually_spent, billing_amount) VALUES (30003, 'NEFT-SBIN0045', 'NEFT',  'RCPT-2026-0152', 35000, 38870, 38870);
INSERT INTO billing (work_order_id, payment_id, payment_type, receipt_no, budget_sanctioned, actually_spent, billing_amount) VALUES (30004, 'NEFT-HDFC0912', 'NEFT',  'RCPT-2026-0160', 6000,  5180,  5180);
INSERT INTO billing (work_order_id, payment_id, payment_type, receipt_no, budget_sanctioned, actually_spent, billing_amount) VALUES (30006, 'RTGS-ICIC2231', 'RTGS',  'RCPT-2026-0171', 8000,  7340,  7340);
INSERT INTO billing (work_order_id, payment_id, payment_type, receipt_no, budget_sanctioned, actually_spent, billing_amount) VALUES (30011, 'CHQ-004512',    'CHEQUE','RCPT-2026-0118', 12000, 9530,  9530);
INSERT INTO billing (work_order_id, payment_id, payment_type, receipt_no, budget_sanctioned, actually_spent, billing_amount) VALUES (30013, NULL,            'NEFT',   NULL,            5000,  0,     4250);

COMMIT;
PROMPT Seed data loaded.
EXIT
