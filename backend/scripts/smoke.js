/**
 * End-to-end API smoke test against a running server + seeded DB.
 *   npm run test:smoke        (API_URL defaults to http://localhost:5000/api)
 * Creates a test company (then deletes it) and runs one full complaint ->
 * work-order -> completion cycle, which is kept as history. Reseed to reset.
 */
const API = process.env.API_URL || 'http://localhost:5000/api';
let pass = 0, fail = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  \x1b[35m✓\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}\x1b[0m`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}

const login = async (u) => (await call('POST', '/auth/login', { body: { username: u, password: 'Password@123' } })).data?.token;

(async () => {
  console.log(`Smoke testing ${API}\n`);

  console.log('health & auth');
  const h = await call('GET', '/health');
  check('GET /health -> db up', h.status === 200 && h.data.db.status === 'up', h);
  const bad = await call('POST', '/auth/login', { body: { username: 'admin', password: 'nope' } });
  check('bad password -> 401', bad.status === 401, bad);
  const admin = await login('admin');
  const tech = await login('suresh.kumar');
  const citizen = await login('rohan.desai');
  const company = await login('lumen');
  check('admin/tech/citizen/company can log in', admin && tech && citizen && company);
  check('no token -> 401', (await call('GET', '/zones')).status === 401);

  console.log('\nmeta & reads');
  const meta = await call('GET', '/meta', { token: admin });
  const lampEnum = meta.data?.streetlights?.fields.find((f) => f.name === 'lamp_type')?.enum;
  check('meta introspects CHECK enums (lamp_type)', Array.isArray(lampEnum) && lampEnum.includes('LED'), lampEnum);
  const zoneRef = meta.data?.streetlights?.fields.find((f) => f.name === 'zone_id')?.references;
  check('meta introspects FKs (streetlight.zone_id -> zones)', zoneRef?.resource === 'zones', zoneRef);
  const lights = await call('GET', '/streetlights?pageSize=5&page=2&sort=wattage&order=desc', { token: admin });
  check('paged list (ROWNUM) returns 5 of 48', lights.data?.data?.length === 5 && lights.data.total === 48, lights.data?.total);
  const faulty = await call('GET', '/streetlights?current_status=FAULTY', { token: admin });
  check('filter by status', faulty.data?.data.every((l) => l.current_status === 'FAULTY'));
  const emp = await call('GET', '/employees/1001', { token: admin });
  check('employee detail has derived age + multivalued emails', emp.data?.age > 30 && emp.data?.emails?.length === 2, emp.data);
  const dash = await call('GET', '/dashboard', { token: admin });
  check('dashboard aggregates', dash.status === 200 && dash.data.kpi.active_lights === 47, dash.data?.kpi);
  for (const r of ['zone-energy', 'lamp-efficiency', 'workforce', 'contractors', 'budget-overruns', 'aging-lights']) {
    const rep = await call('GET', `/reports/${r}`, { token: admin });
    check(`report ${r}`, rep.status === 200 && Array.isArray(rep.data.rows), rep.data);
  }

  console.log('\nRBAC');
  check('technician cannot create department -> 403',
    (await call('POST', '/departments', { token: tech, body: { dept_name: 'X', dept_type: 'IT' } })).status === 403);
  check('citizen cannot read employees -> 403', (await call('GET', '/employees', { token: citizen })).status === 403);
  check('non-admin cannot list users -> 403', (await call('GET', '/users', { token: tech })).status === 403);

  console.log('\nvalidation & Oracle error mapping');
  const v1 = await call('POST', '/streetlights', { token: admin, body: { lamp_type: 'NEON' } });
  check('enum violation -> 400', v1.status === 400 && /lamp_type/.test(v1.data.error), v1.data);
  const v2 = await call('POST', '/streetlights', { token: admin, body: { lamp_type: 'LED', wattage: 90, latitude: 12.9, longitude: 77.6, installation_date: '2024-01-01', zone_id: 1, cabinet_id: 103 } });
  check('trigger: feeder in wrong zone -> 400 ORA-20003', v2.status === 400 && /zone/.test(v2.data.error), v2.data);
  const v3 = await call('POST', '/employees', { token: admin, body: { first_name: 'Kid', last_name: 'X', date_of_birth: '2015-01-01', date_of_joining: '2025-01-01', role: 'TECHNICIAN', aadhar_id: '299999999999', salary: 1000, dept_id: 30 } });
  check('trigger: employee under 18 -> 400', v3.status === 400 && /18/.test(v3.data.error), v3.data);
  const v4 = await call('DELETE', '/zones/1', { token: admin });
  check('delete referenced zone -> 409', v4.status === 409, v4.data);

  console.log('\nCRUD round-trip (multivalued attrs)');
  const c = await call('POST', '/companies', { token: admin, body: {
    license_no: 'KA-EL-TEST-0001', company_name: 'Smoke Test Electricals', contractor_name: 'Tester',
    gst_no: '29AAAAA0000A1Z5', class_rating: 'CLASS_IV', city: 'Bengaluru', phones: ['+919000000001', '+919000000002'] } });
  check('create company with 2 phones', c.status === 201 && c.data.phones?.length === 2, c.data);
  const cu = await call('PUT', '/companies/KA-EL-TEST-0001', { token: admin, body: { class_rating: 'CLASS_III', phones: ['+919000000003'] } });
  check('update company + replace phones', cu.data?.class_rating === 'CLASS_III' && cu.data.phones.length === 1, cu.data);
  const dup = await call('POST', '/companies', { token: admin, body: { ...c.data, phones: [] } });
  check('duplicate PK -> 409 friendly', dup.status === 409 && /licence/.test(dup.data.error), dup.data);
  check('delete company', (await call('DELETE', '/companies/KA-EL-TEST-0001', { token: admin })).status === 200);

  console.log('\ncitizen -> complaint -> work order -> parts -> completion (trigger cascade)');
  const pole = 10002;
  const cmp = await call('POST', '/portal/citizen/complaints', { token: citizen, body: { pole_id: pole, issue_category: 'LIGHT_OUT', description: 'Smoke test: lamp not glowing at night' } });
  check('citizen files complaint', cmp.status === 201, cmp.data);
  const light1 = await call('GET', `/streetlights/${pole}`, { token: admin });
  check('trigger flipped light to FAULTY', light1.data?.current_status === 'FAULTY', light1.data);
  const wo = await call('POST', `/complaints/${cmp.data.complaint_id}/work-order`, { token: admin, body: { emp_id: 1006, license_no: 'KA-EL-2019-0457', work_type: 'REPAIR' } });
  check('sp_complaint_to_work_order creates ASSIGNED WO', wo.status === 201 && wo.data.status === 'ASSIGNED', wo.data);
  const again = await call('POST', `/complaints/${cmp.data.complaint_id}/work-order`, { token: admin, body: {} });
  check('second open WO for same complaint -> 400', again.status === 400, again.data);
  const stockBefore = (await call('GET', '/spare-parts/505', { token: admin })).data.quantity_in_stock;
  const parts = await call('POST', `/work-orders/${wo.data.work_order_id}/parts`, { token: tech, body: { part_id: 505, quantity_used: 2 } });
  const stockAfter = (await call('GET', '/spare-parts/505', { token: admin })).data.quantity_in_stock;
  check('adding parts debits stock via trigger', parts.status === 201 && stockAfter === stockBefore - 2, { stockBefore, stockAfter });
  const tooMany = await call('POST', `/work-orders/${wo.data.work_order_id}/parts`, { token: tech, body: { part_id: 510, quantity_used: 999 } });
  check('insufficient stock -> 400 ORA-20010', tooMany.status === 400 && /stock/i.test(tooMany.data.error), tooMany.data);
  const cwo = await call('GET', '/portal/company/work-orders', { token: company });
  check('company sees its new job', cwo.data?.some((w) => w.work_order_id === wo.data.work_order_id));
  const skip = await call('PATCH', `/portal/company/work-orders/${wo.data.work_order_id}`, { token: company, body: { status: 'COMPLETED' } });
  check('company cannot skip ASSIGNED -> COMPLETED', skip.status === 400, skip.data);
  await call('PATCH', `/portal/company/work-orders/${wo.data.work_order_id}`, { token: company, body: { status: 'IN_PROGRESS' } });
  const done = await call('PATCH', `/portal/company/work-orders/${wo.data.work_order_id}`, { token: company, body: { status: 'COMPLETED', resolution_notes: 'Photocell replaced (smoke test)' } });
  check('company completes job', done.data?.status === 'COMPLETED' && done.data.resolution_hours !== null, done.data);
  const light2 = await call('GET', `/streetlights/${pole}`, { token: admin });
  check('trigger restored light to FUNCTIONAL', light2.data?.current_status === 'FUNCTIONAL', light2.data);
  const mine = await call('GET', '/portal/citizen/complaints', { token: citizen });
  check('citizen sees complaint RESOLVED', mine.data?.find((x) => x.complaint_id === cmp.data.complaint_id)?.ticket_status === 'RESOLVED');

  console.log('\nenergy log (weak entity via sp_record_energy)');
  const el = await call('POST', '/energy-logs', { token: tech, body: { pole_id: pole, reading_date: '2030-01-31', units_consumed: 30 } });
  check('log_number auto-allocated = 7, cost = 225', el.status === 201 && el.data.log_number === 7 && el.data.cost_inr === 225, el.data);
  check('delete energy log', (await call('DELETE', `/energy-logs/${pole}/7`, { token: tech })).status === 200);

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('note: the smoke complaint/work order are kept as history (they reference real rows).');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
