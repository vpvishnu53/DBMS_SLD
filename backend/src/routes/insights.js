/**
 * /api/dashboard and /api/reports -- aggregate, read-only analytics (employees).
 */
const express = require('express');
const { query, queryOne } = require('../config/db');
const { requireType } = require('../middleware/auth');

const router = express.Router();
router.use(requireType('EMPLOYEE'));

router.get('/dashboard', async (_req, res) => {
  const [kpi, lightStatus, complaintStatus, categories, energy, zones, recent, feeders, lowStock] = await Promise.all([
    queryOne(`
      SELECT (SELECT COUNT(*) FROM streetlight WHERE current_status <> 'DECOMMISSIONED')          AS active_lights,
             (SELECT COUNT(*) FROM streetlight WHERE current_status = 'FUNCTIONAL')               AS functional_lights,
             (SELECT COUNT(*) FROM streetlight WHERE current_status = 'FAULTY')                   AS faulty_lights,
             (SELECT COUNT(*) FROM streetlight WHERE current_status = 'UNDER_MAINTENANCE')        AS maintenance_lights,
             (SELECT COUNT(*) FROM complaint WHERE ticket_status IN ('OPEN','ASSIGNED','IN_PROGRESS')) AS open_complaints,
             (SELECT COUNT(*) FROM work_order WHERE status IN ('PENDING','ASSIGNED','IN_PROGRESS'))    AS open_work_orders,
             (SELECT ROUND(AVG(resolution_hours), 1) FROM v_work_order
               WHERE completion_timestamp > SYSTIMESTAMP - NUMTODSINTERVAL(90, 'DAY'))            AS avg_resolution_hours,
             (SELECT COUNT(*) FROM sensor WHERE status = 'ACTIVE')                                AS active_sensors,
             (SELECT COUNT(*) FROM sensor)                                                        AS total_sensors
        FROM dual`),
    query(`SELECT current_status AS label, COUNT(*) AS value FROM streetlight GROUP BY current_status ORDER BY value DESC`),
    query(`SELECT ticket_status AS label, COUNT(*) AS value FROM complaint GROUP BY ticket_status ORDER BY value DESC`),
    query(`SELECT issue_category AS label, COUNT(*) AS value FROM complaint GROUP BY issue_category ORDER BY value DESC`),
    query(`
      SELECT TO_CHAR(TRUNC(reading_date, 'MM'), 'YYYY-MM') AS month,
             ROUND(SUM(units_consumed)) AS units, ROUND(SUM(cost_inr)) AS cost
        FROM energy_log
       WHERE reading_date >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -12)
       GROUP BY TRUNC(reading_date, 'MM') ORDER BY 1`),
    query(`SELECT zone_id, zone_name, total_lights, functional_lights, faulty_lights, supervisor_name FROM v_zone ORDER BY zone_id`),
    query(`SELECT * FROM (SELECT complaint_id, issue_category, ticket_status, zone_name, pole_id, citizen_name, reported_timestamp
                            FROM v_complaint ORDER BY reported_timestamp DESC) WHERE ROWNUM <= 6`),
    query(`SELECT * FROM (SELECT cabinet_id, zone_name, load_percent, operational_status, lights_powered
                            FROM v_feeder_pillar ORDER BY load_percent DESC) WHERE ROWNUM <= 5`),
    query(`SELECT part_id, part_name, quantity_in_stock, stock_level FROM v_spare_parts WHERE stock_level <> 'OK' ORDER BY quantity_in_stock`),
  ]);
  res.json({ kpi, lightStatus, complaintStatus, categories, energy, zones, recent, feeders, lowStock });
});

/* ------------------------------ reports ------------------------------ */

const REPORTS = {
  'zone-energy': {
    title: 'Monthly energy by zone',
    sql: `SELECT z.zone_name, TO_CHAR(TRUNC(el.reading_date, 'MM'), 'YYYY-MM') AS month,
                 ROUND(SUM(el.units_consumed), 1) AS units_kwh, ROUND(SUM(el.cost_inr), 2) AS cost_inr,
                 COUNT(DISTINCT el.pole_id) AS poles
            FROM energy_log el
            JOIN streetlight s ON s.pole_id = el.pole_id
            JOIN zone z        ON z.zone_id = s.zone_id
           GROUP BY z.zone_name, TRUNC(el.reading_date, 'MM')
           ORDER BY month DESC, z.zone_name`,
  },
  'lamp-efficiency': {
    title: 'Average monthly consumption per lamp type',
    sql: `SELECT s.lamp_type, COUNT(DISTINCT s.pole_id) AS poles,
                 ROUND(AVG(s.wattage)) AS avg_wattage,
                 ROUND(AVG(el.units_consumed), 2) AS avg_kwh_per_pole_month,
                 ROUND(AVG(el.cost_inr), 2) AS avg_cost_per_pole_month
            FROM streetlight s JOIN energy_log el ON el.pole_id = s.pole_id
           GROUP BY s.lamp_type ORDER BY avg_kwh_per_pole_month DESC`,
  },
  workforce: {
    title: 'Workforce performance',
    sql: `SELECT e.emp_id, e.full_name, e.role, e.dept_name,
                 COUNT(w.work_order_id) AS work_orders,
                 SUM(CASE WHEN w.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
                 SUM(CASE WHEN w.status IN ('ASSIGNED','IN_PROGRESS') THEN 1 ELSE 0 END) AS open,
                 ROUND(AVG(w.resolution_hours), 1) AS avg_resolution_hours
            FROM v_employee e LEFT JOIN v_work_order w ON w.emp_id = e.emp_id
           GROUP BY e.emp_id, e.full_name, e.role, e.dept_name
          HAVING COUNT(w.work_order_id) > 0
           ORDER BY completed DESC, avg_resolution_hours`,
  },
  contractors: {
    title: 'Contractor scorecard',
    sql: `SELECT c.license_no, c.company_name, c.class_rating,
                 COUNT(w.work_order_id) AS work_orders,
                 SUM(CASE WHEN w.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
                 ROUND(AVG(w.resolution_hours), 1) AS avg_resolution_hours,
                 NVL(SUM(b.billing_amount), 0) AS billed_inr,
                 NVL(SUM(b.budget_variance), 0) AS budget_variance_inr
            FROM company c
            LEFT JOIN v_work_order w ON w.license_no = c.license_no
            LEFT JOIN v_billing b    ON b.work_order_id = w.work_order_id
           GROUP BY c.license_no, c.company_name, c.class_rating
           ORDER BY completed DESC`,
  },
  'budget-overruns': {
    title: 'Billing: budget vs actual',
    sql: `SELECT billing_id, work_order_id, company_name, work_type, budget_sanctioned, actually_spent,
                 budget_variance, parts_cost,
                 CASE WHEN budget_variance < 0 THEN 'OVER BUDGET' ELSE 'WITHIN BUDGET' END AS verdict
            FROM v_billing ORDER BY budget_variance`,
  },
  'aging-lights': {
    title: 'Ageing lights due for service (> 12 months since last service)',
    sql: `SELECT pole_id, zone_name, lamp_type, age_years, installation_date, last_serviced_date,
                 ROUND(MONTHS_BETWEEN(SYSDATE, NVL(last_serviced_date, installation_date))) AS months_since_service
            FROM v_streetlight
           WHERE current_status <> 'DECOMMISSIONED'
             AND MONTHS_BETWEEN(SYSDATE, NVL(last_serviced_date, installation_date)) > 12
           ORDER BY months_since_service DESC`,
  },
};

router.get('/reports', (_req, res) =>
  res.json(Object.entries(REPORTS).map(([id, r]) => ({ id, title: r.title }))));

router.get('/reports/:id', async (req, res, next) => {
  const r = REPORTS[req.params.id];
  if (!r) return next();
  res.json({ id: req.params.id, title: r.title, rows: await query(r.sql) });
});

module.exports = router;
