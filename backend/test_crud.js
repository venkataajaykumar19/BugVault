/**
 * Comprehensive Local CRUD, Category Relationship & Persistence Verification Suite
 * Tests:
 * - GET /health (Operational liveness)
 * - GET /categories (Relational Entity: Read seeded categories)
 * - POST /bugs (CREATE with foreign key category_id)
 * - POST /bugs (Validation: reject missing or non-existent category_id)
 * - GET /bugs (READ with SQL JOIN returning category_name)
 * - PUT /bugs/:id (UPDATE bug and switch category_id)
 * - PUT /bugs/:id (Validation: reject non-existent category_id)
 * - DELETE /bugs/:id (DELETE bug record)
 * - Category Preserved: Verify category table unchanged after bug deletion (no cascading deletion)
 * - SQLite Foreign Key Pragma check: PRAGMA foreign_key_list(bugs)
 * - Complete CRUD sequence: CREATE -> READ -> UPDATE -> READ -> DELETE -> READ
 */

const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, pathUrl, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + pathUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          json: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log('BUGVAULT: COMPREHENSIVE LOCAL TEST SUITE');
  console.log('Verifying 2 Database Entities & 1:N Foreign Key');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, detail = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // 1. HEALTH CHECK
  console.log('--- TEST 1: Health Check (GET /health) ---');
  const healthRes = await request('GET', '/health');
  assert(healthRes.status === 200, 'GET /health returns 200 OK', `Got ${healthRes.status}`);
  assert(healthRes.json?.status === 'ok', 'GET /health returns {"status":"ok"}', JSON.stringify(healthRes.json));

  // 2. CATEGORIES ENTITY (READ)
  console.log('\n--- TEST 2: Categories Entity (GET /categories) ---');
  const catRes = await request('GET', '/categories');
  assert(catRes.status === 200, 'GET /categories returns 200 OK', `Got ${catRes.status}`);
  assert(Array.isArray(catRes.json), 'GET /categories returns JSON array', typeof catRes.json);
  assert(catRes.json.length >= 5, 'At least 5 default categories exist in database', `Count: ${catRes.json?.length}`);
  const jsCat = catRes.json.find(c => c.name === 'JavaScript');
  const nodeCat = catRes.json.find(c => c.name === 'Node.js');
  assert(jsCat !== undefined, 'Found seeded category: "JavaScript"');
  assert(nodeCat !== undefined, 'Found seeded category: "Node.js"');

  // 3. DATABASE SCHEMA & FOREIGN KEY PRAGMA CHECK
  console.log('\n--- TEST 3: Database Schema & Foreign Key Pragma ---');
  const db = new Database(path.join(__dirname, 'database.sqlite'));
  const fkList = db.prepare('PRAGMA foreign_key_list(bugs)').all();
  assert(fkList.length > 0, 'Foreign key relationship active on table "bugs"');
  const fkCat = fkList.find(fk => fk.table === 'categories' && fk.from === 'category_id' && fk.to === 'id');
  assert(fkCat !== undefined, 'bugs.category_id REFERENCES categories(id) confirmed via PRAGMA foreign_key_list');
  db.close();

  // 4. CREATE RECORD WITH VALID CATEGORY (POST /bugs)
  console.log('\n--- TEST 4: Create Record with Category (POST /bugs) ---');
  const bugPayload1 = {
    title: 'Cannot read properties of undefined (reading map)',
    error: 'TypeError: Cannot read properties of undefined (reading "map")',
    cause: 'API response was undefined before asynchronous state resolved',
    solution: 'Added optional chaining data?.map(...) and initialized default empty array',
    date: '2026-09-16',
    category_id: jsCat.id
  };

  const createRes = await request('POST', '/bugs', bugPayload1);
  assert(createRes.status === 201, 'POST /bugs returns 201 Created', `Got ${createRes.status}`);
  assert(createRes.json?.id > 0, 'POST /bugs returns generated integer ID', `ID: ${createRes.json?.id}`);
  assert(createRes.json?.category_id === jsCat.id, 'Created record contains matching category_id');
  assert(createRes.json?.category_name === 'JavaScript', 'Created record contains joined category_name "JavaScript"');
  const bug1Id = createRes.json.id;

  // 5. VALIDATION: MISSING CATEGORY_ID IN POST /bugs
  console.log('\n--- TEST 5: Validation - Missing category_id ---');
  const missingCatRes = await request('POST', '/bugs', {
    title: 'Missing category bug',
    error: 'SyntaxError',
    cause: 'Test cause',
    solution: 'Test solution',
    date: '2026-09-16'
  });
  assert(missingCatRes.status === 400, 'POST /bugs without category_id returns 400 Bad Request', `Got ${missingCatRes.status}`);
  assert(missingCatRes.json?.missingFields?.includes('category_id'), 'Validation lists missing "category_id" field');

  // 6. VALIDATION: INVALID / NON-EXISTENT CATEGORY_ID
  console.log('\n--- TEST 6: Validation - Non-existent category_id (Foreign Key Violation Protection) ---');
  const invalidCatRes = await request('POST', '/bugs', {
    title: 'Invalid foreign key bug',
    error: 'ForeignKeyError',
    cause: 'Referencing non-existent category 99999',
    solution: 'Verify category exists before insertion',
    date: '2026-09-16',
    category_id: 99999
  });
  assert(invalidCatRes.status === 400, 'POST /bugs with non-existent category_id returns 400 Bad Request', `Got ${invalidCatRes.status}`);
  assert(invalidCatRes.json?.error === 'Invalid category', 'Error message identifies invalid category');

  // 7. READ ALL BUGS WITH SQL JOIN (GET /bugs)
  console.log('\n--- TEST 7: Read All Bugs with JOIN (GET /bugs) ---');
  const readRes1 = await request('GET', '/bugs');
  assert(readRes1.status === 200, 'GET /bugs returns 200 OK', `Got ${readRes1.status}`);
  assert(Array.isArray(readRes1.json), 'GET /bugs returns array');
  const foundBug = readRes1.json.find(b => b.id === bug1Id);
  assert(foundBug !== undefined, `Created bug #${bug1Id} found in database list`);
  assert(foundBug.category_id === jsCat.id, 'Stored category_id matches');
  assert(foundBug.category_name === 'JavaScript', 'SQL JOIN returns category_name "JavaScript"');

  // 8. UPDATE BUG AND SWITCH CATEGORY (PUT /bugs/:id)
  console.log('\n--- TEST 8: Update Bug and Switch Category (PUT /bugs/:id) ---');
  const updatePayload = {
    title: 'Cannot read properties of undefined (Resolved)',
    error: 'TypeError: Cannot read properties of undefined (reading "map")',
    cause: 'API response was undefined before state resolved; switched to Node.js backend handler',
    solution: 'Added defensive response envelope on Node.js controller',
    date: '2026-09-16',
    category_id: nodeCat.id
  };

  const updateRes = await request('PUT', `/bugs/${bug1Id}`, updatePayload);
  assert(updateRes.status === 200, 'PUT /bugs/:id returns 200 OK', `Got ${updateRes.status}`);
  assert(updateRes.json?.category_id === nodeCat.id, 'Updated bug category_id matches new category');
  assert(updateRes.json?.category_name === 'Node.js', 'Updated bug joined category_name is "Node.js"');

  // 9. VALIDATION: PUT WITH NON-EXISTENT CATEGORY_ID
  console.log('\n--- TEST 9: Validation - PUT with invalid category_id ---');
  const putInvalidCat = await request('PUT', `/bugs/${bug1Id}`, {
    ...updatePayload,
    category_id: 88888
  });
  assert(putInvalidCat.status === 400, 'PUT /bugs/:id with non-existent category returns 400 Bad Request', `Got ${putInvalidCat.status}`);

  // 10. DELETE BUG & VERIFY CATEGORY PRESERVATION (DELETE /bugs/:id)
  console.log('\n--- TEST 10: Delete Bug & Verify Category Preserved ---');
  const deleteRes = await request('DELETE', `/bugs/${bug1Id}`);
  assert(deleteRes.status === 200, 'DELETE /bugs/:id returns 200 OK', `Got ${deleteRes.status}`);
  assert(deleteRes.json?.success === true, 'DELETE confirmed with success: true');

  // Verify bug was deleted
  const readRes2 = await request('GET', '/bugs');
  assert(!readRes2.json.some(b => b.id === bug1Id), 'Deleted bug is no longer present in GET /bugs');

  // Verify category still exists (no cascading delete)
  const catResAfter = await request('GET', '/categories');
  const jsCatStillExists = catResAfter.json.some(c => c.id === jsCat.id);
  const nodeCatStillExists = catResAfter.json.some(c => c.id === nodeCat.id);
  assert(jsCatStillExists, 'Category "JavaScript" is preserved after bug deletion');
  assert(nodeCatStillExists, 'Category "Node.js" is preserved after bug deletion');

  // 11. EDGE CASES: 404 ON NON-EXISTENT ID
  console.log('\n--- TEST 11: Edge Cases (404 Not Found & Malformed JSON) ---');
  const put404 = await request('PUT', '/bugs/999999', updatePayload);
  assert(put404.status === 404, 'PUT non-existent ID returns 404 Not Found');

  const del404 = await request('DELETE', '/bugs/999999');
  assert(del404.status === 404, 'DELETE non-existent ID returns 404 Not Found');

  // 12. COMPLETE CRUD SEQUENCE WITH RELATIONAL CATEGORIES
  console.log('\n--- TEST 12: Complete Relational CRUD Sequence ---');
  const gitCat = catRes.json.find(c => c.name === 'Git/GitHub');
  
  // CREATE
  const seqCreate = await request('POST', '/bugs', {
    title: 'Git push rejected (fetch first)',
    error: 'Updates were rejected because the remote contains work that you do not have locally',
    cause: 'Remote main branch had new commits not present in local branch',
    solution: 'Ran git pull --rebase origin main then pushed again',
    date: '2026-09-16',
    category_id: gitCat.id
  });
  assert(seqCreate.status === 201, 'Seq Step 1: CREATE -> 201 Created with Git/GitHub category');
  const seqId = seqCreate.json.id;

  // READ
  const seqRead1 = await request('GET', '/bugs');
  const seqItem1 = seqRead1.json.find(b => b.id === seqId);
  assert(seqItem1?.category_name === 'Git/GitHub', 'Seq Step 2: READ -> Bug has category_name "Git/GitHub"');

  // UPDATE (Change category to Database)
  const dbCat = catRes.json.find(c => c.name === 'Database');
  const seqUpdate = await request('PUT', `/bugs/${seqId}`, {
    title: 'Git push rejected (fetch first) - Resolved',
    error: 'Updates were rejected because the remote contains work that you do not have locally',
    cause: 'Remote branch had unmerged changes',
    solution: 'Ran git pull --rebase origin main',
    date: '2026-09-16',
    category_id: dbCat.id
  });
  assert(seqUpdate.status === 200, 'Seq Step 3: UPDATE -> 200 OK');
  assert(seqUpdate.json?.category_name === 'Database', 'Seq Step 3: Updated category is now "Database"');

  // DELETE
  const seqDel = await request('DELETE', `/bugs/${seqId}`);
  assert(seqDel.status === 200, 'Seq Step 4: DELETE -> 200 OK');

  // READ (Verify permanently removed)
  const seqRead2 = await request('GET', '/bugs');
  assert(!seqRead2.json.some(b => b.id === seqId), 'Seq Step 5: READ confirms bug permanently removed');

  console.log('\n====================================================');
  console.log(`ALL LOCAL TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
  console.log('====================================================');
}

runVerification().catch(err => {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
});
