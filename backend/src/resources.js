/**
 * Resource registry: one entry per ER entity exposed through the generic CRUD.
 * writeRoles = employee job roles allowed to create/update/delete (ADMIN always can).
 * Reads are open to every signed-in EMPLOYEE; civilians/companies use /api/portal.
 */
const { Resource } = require('./lib/crud');

const OPS = ['ZONE_SUPERVISOR', 'ENGINEER'];

const definitions = [
  {
    path: 'departments', title: 'Department', table: 'DEPARTMENT', view: 'V_DEPARTMENT', pk: 'dept_id',
    label: 'dept_name', sort: 'dept_id', search: ['dept_name', 'dept_type'],
  },
  {
    path: 'employees', title: 'Employee', table: 'EMPLOYEE', view: 'V_EMPLOYEE', pk: 'emp_id',
    label: "full_name || ' (' || role || ')'", sort: 'emp_id',
    search: ['full_name', 'role', 'dept_name', 'city', 'emails'],
    multi: { emails: { table: 'EMPLOYEE_EMAIL', fk: 'emp_id', col: 'email' },
             phones: { table: 'EMPLOYEE_PHONE', fk: 'emp_id', col: 'phone_number' } },
  },
  {
    path: 'civilians', title: 'Civilian', table: 'CIVILIAN', view: 'V_CIVILIAN', pk: 'citizen_id',
    label: 'full_name', sort: 'citizen_id', search: ['full_name', 'city', 'emails', 'phones'],
    writeRoles: ['SUPPORT_AGENT'],
    multi: { emails: { table: 'CIVILIAN_EMAIL', fk: 'citizen_id', col: 'email' },
             phones: { table: 'CIVILIAN_PHONE', fk: 'citizen_id', col: 'phone_number' } },
  },
  {
    path: 'companies', title: 'Company', table: 'COMPANY', view: 'V_COMPANY', pk: 'license_no', autoPk: false,
    label: 'company_name', sort: 'company_name', search: ['company_name', 'contractor_name', 'gst_no', 'license_no'],
    writeRoles: ['ACCOUNTANT'],
    multi: { phones: { table: 'COMPANY_PHONE', fk: 'license_no', col: 'phone_no' } },
  },
  {
    path: 'zones', title: 'Zone', table: 'ZONE', view: 'V_ZONE', pk: 'zone_id',
    label: 'zone_name', sort: 'zone_id', search: ['zone_name', 'city_region', 'supervisor_name'],
    writeRoles: ['ZONE_SUPERVISOR'],
  },
  {
    path: 'feeder-pillars', title: 'Feeder Pillar', table: 'FEEDER_PILLAR', view: 'V_FEEDER_PILLAR', pk: 'cabinet_id',
    label: "'FP-' || cabinet_id || ' · ' || zone_name", sort: 'cabinet_id', search: ['zone_name', 'operational_status'],
    writeRoles: OPS,
  },
  {
    path: 'streetlights', title: 'Streetlight', table: 'STREETLIGHT', view: 'V_STREETLIGHT', pk: 'pole_id',
    label: "'Pole ' || pole_id || ' · ' || zone_name", sort: 'pole_id',
    search: ['pole_id', 'zone_name', 'lamp_type', 'current_status'],
    writeRoles: [...OPS, 'TECHNICIAN'],
  },
  {
    path: 'sensors', title: 'Sensor', table: 'SENSOR', view: 'V_SENSOR', pk: 'sensor_id',
    label: "sensor_type || ' #' || sensor_id", sort: 'sensor_id',
    search: ['sensor_type', 'manufacturer', 'zone_name', 'status', 'pole_id'],
    writeRoles: [...OPS, 'TECHNICIAN'],
  },
  {
    path: 'complaints', title: 'Complaint', table: 'COMPLAINT', view: 'V_COMPLAINT', pk: 'complaint_id',
    label: "'#' || complaint_id || ' · ' || issue_category", sort: 'reported_timestamp', order: 'desc',
    search: ['complaint_id', 'description', 'citizen_name', 'zone_name', 'issue_category', 'pole_id'],
    writeRoles: ['SUPPORT_AGENT', 'ZONE_SUPERVISOR'],
  },
  {
    path: 'work-orders', title: 'Work Order', table: 'WORK_ORDER', view: 'V_WORK_ORDER', pk: 'work_order_id',
    label: "'WO-' || work_order_id || ' · ' || work_type", sort: 'created_timestamp', order: 'desc',
    search: ['work_order_id', 'work_type', 'zone_name', 'employee_name', 'company_name', 'resolution_notes'],
    writeRoles: [...OPS, 'TECHNICIAN'],
  },
  {
    path: 'spare-parts', title: 'Spare Part', table: 'SPARE_PARTS', view: 'V_SPARE_PARTS', pk: 'part_id',
    label: "part_name || ' (₹' || unit_price || ')'", sort: 'part_name', search: ['part_name'],
    writeRoles: ['ENGINEER', 'ACCOUNTANT'],
  },
  {
    path: 'billing', title: 'Billing', table: 'BILLING', view: 'V_BILLING', pk: 'billing_id',
    label: "'BILL-' || billing_id", sort: 'billing_id', order: 'desc',
    search: ['billing_id', 'work_order_id', 'receipt_no', 'payment_id', 'company_name'],
    writeRoles: ['ACCOUNTANT'],
  },
  {
    path: 'energy-logs', title: 'Energy Log', view: 'V_ENERGY_LOG', pk: null, readOnly: true,
    sort: 'reading_date', order: 'desc', search: ['zone_name', 'pole_id'],
  },
];

async function buildRegistry() {
  const resources = await Promise.all(definitions.map((d) => new Resource(d).init()));
  const byPath = Object.fromEntries(resources.map((r) => [r.def.path, r]));
  const byTable = Object.fromEntries(resources.filter((r) => r.def.table).map((r) => [r.def.table, r.def.path]));
  return { resources, byPath, byTable };
}

module.exports = { buildRegistry };
