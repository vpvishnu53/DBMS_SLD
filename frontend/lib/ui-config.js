/**
 * Presentation config per resource. Field types, enums, required flags and FK
 * targets come from the API's /meta (introspected from Oracle) -- this file only
 * decides what to SHOW and in what order.
 *
 *  columns : list columns (view column names)
 *  filters : view columns offered as dropdown filters (enum fields or FK lookups)
 *  status  : column rendered as a status badge
 *  form    : field order in the create/edit form (omitted fields are appended)
 *  hidden  : form fields never shown
 */
export const RESOURCES = {
  zones: {
    icon: 'map', blurb: 'City zones and their supervisors',
    columns: ['zone_id', 'zone_name', 'city_region', 'supervisor_name', 'total_lights', 'functional_lights', 'faulty_lights', 'feeder_count', 'sensor_count'],
  },
  'feeder-pillars': {
    icon: 'zap', blurb: 'Feeder cabinets that power streetlights',
    columns: ['cabinet_id', 'zone_name', 'operational_status', 'power_rating_kva', 'lights_powered', 'connected_load_kw', 'load_percent', 'installation_date'],
    filters: ['zone_id', 'operational_status'], status: 'operational_status',
  },
  streetlights: {
    icon: 'lamp', blurb: 'Every pole in the network',
    columns: ['pole_id', 'zone_name', 'current_status', 'lamp_type', 'wattage', 'dimming_support', 'age_years', 'last_serviced_date', 'open_complaints'],
    filters: ['zone_id', 'current_status', 'lamp_type'], status: 'current_status',
    form: ['zone_id', 'cabinet_id', 'current_status', 'lamp_type', 'wattage', 'dimming_support', 'latitude', 'longitude', 'installation_date', 'last_serviced_date'],
  },
  sensors: {
    icon: 'radar', blurb: 'IoT sensors mounted on poles',
    columns: ['sensor_id', 'sensor_type', 'status', 'pole_id', 'zone_name', 'manufacturer', 'last_reading_value', 'last_reading_time'],
    filters: ['zone_id', 'sensor_type', 'status'], status: 'status',
    form: ['pole_id', 'zone_id', 'sensor_type', 'status', 'manufacturer', 'last_reading_value', 'last_reading_time'],
  },
  'energy-logs': {
    icon: 'bolt', blurb: 'Monthly consumption per pole (weak entity of Streetlight)',
    columns: ['pole_id', 'log_number', 'reading_date', 'zone_name', 'lamp_type', 'units_consumed', 'cost_inr'],
    filters: ['zone_id'],
  },
  complaints: {
    icon: 'alert', blurb: 'Citizen-reported issues',
    columns: ['complaint_id', 'issue_category', 'ticket_status', 'pole_id', 'zone_name', 'citizen_name', 'handler_name', 'reported_timestamp'],
    filters: ['ticket_status', 'issue_category', 'zone_id'], status: 'ticket_status',
    form: ['citizen_id', 'pole_id', 'issue_category', 'ticket_status', 'handled_by', 'reported_timestamp', 'description'],
  },
  'work-orders': {
    icon: 'wrench', blurb: 'Repair, replacement and maintenance jobs',
    columns: ['work_order_id', 'work_type', 'status', 'zone_name', 'pole_id', 'employee_name', 'company_name', 'created_timestamp', 'resolution_hours'],
    filters: ['status', 'work_type', 'zone_id'], status: 'status',
    form: ['work_type', 'status', 'zone_id', 'pole_id', 'complaint_id', 'emp_id', 'license_no', 'created_timestamp', 'completion_timestamp', 'resolution_notes'],
  },
  'spare-parts': {
    icon: 'box', blurb: 'Inventory of replacement parts',
    columns: ['part_id', 'part_name', 'unit_price', 'quantity_in_stock', 'total_cost', 'stock_level', 'total_used'],
    filters: ['stock_level'], status: 'stock_level',
  },
  billing: {
    icon: 'receipt', blurb: 'Contractor billing against work orders',
    columns: ['billing_id', 'work_order_id', 'company_name', 'payment_type', 'receipt_no', 'budget_sanctioned', 'actually_spent', 'billing_amount', 'budget_variance'],
    filters: ['payment_type'],
  },
  employees: {
    icon: 'users', blurb: 'Staff of the lighting department',
    columns: ['emp_id', 'full_name', 'role', 'dept_name', 'shift_type', 'age', 'work_experience', 'emails', 'phones'],
    filters: ['dept_id', 'role', 'shift_type'],
    form: ['first_name', 'middle_name', 'last_name', 'date_of_birth', 'date_of_joining', 'aadhar_id', 'dept_id', 'role', 'shift_type', 'salary', 'emails', 'phones', 'street', 'city', 'state', 'pincode'],
  },
  departments: {
    icon: 'building', blurb: 'Organisational units',
    columns: ['dept_id', 'dept_name', 'dept_type', 'employee_count', 'monthly_payroll'],
  },
  civilians: {
    icon: 'user', blurb: 'Registered citizens',
    columns: ['citizen_id', 'full_name', 'city', 'pincode', 'emails', 'phones', 'complaint_count'],
    form: ['first_name', 'middle_name', 'last_name', 'emails', 'phones', 'street', 'city', 'state', 'pincode'],
  },
  companies: {
    icon: 'briefcase', blurb: 'Licensed electrical contractors',
    columns: ['license_no', 'company_name', 'contractor_name', 'class_rating', 'gst_no', 'phones', 'work_order_count', 'open_work_orders'],
    filters: ['class_rating'],
    form: ['license_no', 'company_name', 'contractor_name', 'gst_no', 'class_rating', 'phones', 'street', 'city', 'state', 'pincode'],
  },
};

export const EMPLOYEE_NAV = [
  { label: 'Overview', items: [
    { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { href: '/reports', label: 'Reports', icon: 'chart' },
  ] },
  { label: 'Operations', items: [
    { href: '/manage/complaints', label: 'Complaints', icon: 'alert' },
    { href: '/manage/work-orders', label: 'Work Orders', icon: 'wrench' },
    { href: '/manage/spare-parts', label: 'Spare Parts', icon: 'box' },
    { href: '/manage/billing', label: 'Billing', icon: 'receipt' },
  ] },
  { label: 'Infrastructure', items: [
    { href: '/manage/zones', label: 'Zones', icon: 'map' },
    { href: '/manage/streetlights', label: 'Streetlights', icon: 'lamp' },
    { href: '/manage/feeder-pillars', label: 'Feeder Pillars', icon: 'zap' },
    { href: '/manage/sensors', label: 'Sensors', icon: 'radar' },
    { href: '/manage/energy-logs', label: 'Energy Logs', icon: 'bolt' },
  ] },
  { label: 'People', items: [
    { href: '/manage/employees', label: 'Employees', icon: 'users' },
    { href: '/manage/departments', label: 'Departments', icon: 'building' },
    { href: '/manage/civilians', label: 'Civilians', icon: 'user' },
    { href: '/manage/companies', label: 'Companies', icon: 'briefcase' },
    { href: '/users', label: 'User Accounts', icon: 'key', adminOnly: true },
  ] },
];

export const CIVILIAN_NAV = [
  { label: 'Citizen portal', items: [
    { href: '/citizen', label: 'My Complaints', icon: 'alert' },
    { href: '/account', label: 'Account', icon: 'key' },
  ] },
];

export const COMPANY_NAV = [
  { label: 'Contractor portal', items: [
    { href: '/contractor', label: 'My Jobs', icon: 'wrench' },
    { href: '/account', label: 'Account', icon: 'key' },
  ] },
];
