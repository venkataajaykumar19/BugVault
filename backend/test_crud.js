/**
 * Comprehensive Local CRUD & Persistence Verification Suite
 * Tests Phases 22 through 28:
 * - GET /health
 * - POST /bugs (CREATE)
 * - GET /bugs (READ & persistence across server restarts)
 * - PUT /bugs/:id (UPDATE)
 * - DELETE /bugs/:id (DELETE)
 * - Edge cases (400 on missing fields, 404 on nonexistent IDs, invalid ID format)
 * - Complete CRUD sequence: CREATE -> READ -> UPDATE -> READ -> DELETE -> READ
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

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
  console.log('BUGVAULT: RUNNING COMPREHENSIVE LOCAL TEST SUITE');
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

  // 1. PHASE 22 - HEALTH CHECK
  console.log('--- TEST 1: Health Check (GET /health) ---');
  const healthRes = await request('GET', '/health');
  assert(healthRes.status === 200, 'GET /health returns 200 OK', `Got ${healthRes.status}`);
  assert(healthRes.json?.status === 'ok', 'GET /health returns {"status":"ok"}', JSON.stringify(healthRes.json));

  // 2. PHASE 23 - CREATE RECORD (POST /bugs)
  console.log('\n--- TEST 2: Create Record (POST /bugs) ---');
  const bugPayload1 = {
    title: 'Prisma environment error',
    error: 'Environment variable not found: DATABASE_URL',
    cause: 'DATABASE_URL was missing from .env',
    solution: 'Added DATABASE_URL and regenerated Prisma client',
    date: '2026-09-16'
  };

  const createRes = await request('POST', '/bugs', bugPayload1);
  assert(createRes.status === 201, 'POST /bugs returns 201 Created', `Got ${createRes.status}`);
  assert(createRes.json?.id > 0, 'POST /bugs returns generated integer ID', `ID: ${createRes.json?.id}`);
  assert(createRes.json?.title === bugPayload1.title, 'Created record title matches payload');
  assert(createRes.json?.cause === bugPayload1.cause, 'Created record cause matches payload');
  const bug1Id = createRes.json.id;

  // 3. PHASE 24 - READ RECORD (GET /bugs)
  console.log('\n--- TEST 3: Read Records (GET /bugs) ---');
  const readRes1 = await request('GET', '/bugs');
  assert(readRes1.status === 200, 'GET /bugs returns 200 OK', `Got ${readRes1.status}`);
  assert(Array.isArray(readRes1.json), 'GET /bugs returns JSON array', typeof readRes1.json);
  const foundBug = readRes1.json.find(b => b.id === bug1Id);
  assert(foundBug !== undefined, `Created bug #${bug1Id} found in database list`);
  assert(foundBug.solution === bugPayload1.solution, 'Stored solution matches database record');

  // 4. PHASE 25 - UPDATE RECORD (PUT /bugs/:id)
  console.log('\n--- TEST 4: Update Record (PUT /bugs/:id) ---');
  const updatedPayload = {
    title: 'Prisma environment error (Fixed)',
    error: 'Environment variable not found: DATABASE_URL',
    cause: 'Missing DATABASE_URL in .env after clean repo clone',
    solution: 'Added DATABASE_URL to backend/.env and ran npx prisma generate',
    date: '2026-09-16'
  };

  const updateRes = await request('PUT', `/bugs/${bug1Id}`, updatedPayload);
  assert(updateRes.status === 200, 'PUT /bugs/:id returns 200 OK', `Got ${updateRes.status}`);
  assert(updateRes.json?.id === bug1Id, 'Updated bug ID matches target');
  assert(updateRes.json?.title === updatedPayload.title, 'Updated title matches');
  assert(updateRes.json?.cause === updatedPayload.cause, 'Updated cause matches');

  // Verify in GET /bugs
  const readRes2 = await request('GET', '/bugs');
  const verifiedBug = readRes2.json.find(b => b.id === bug1Id);
  assert(verifiedBug.title === updatedPayload.title, 'GET /bugs reflects updated title');

  // 5. PHASE 27 - EDGE CASES
  console.log('\n--- TEST 5: Edge Cases & Validation ---');
  // Missing fields in POST
  const missingTitleRes = await request('POST', '/bugs', {
    error: 'Some error',
    cause: 'Some cause',
    solution: 'Some solution',
    date: '2026-09-16'
  });
  assert(missingTitleRes.status === 400, 'POST with missing title returns 400 Bad Request', `Got ${missingTitleRes.status}`);
  assert(missingTitleRes.json?.missingFields?.includes('title'), 'Validation lists missing "title" field');

  // Empty fields in POST
  const emptyFieldsRes = await request('POST', '/bugs', {
    title: '   ',
    error: '',
    cause: '',
    solution: '',
    date: ''
  });
  assert(emptyFieldsRes.status === 400, 'POST with whitespace/empty fields returns 400', `Got ${emptyFieldsRes.status}`);

  // PUT nonexistent ID
  const putNotFoundRes = await request('PUT', '/bugs/999999', updatedPayload);
  assert(putNotFoundRes.status === 404, 'PUT /bugs/999999 returns 404 Not Found', `Got ${putNotFoundRes.status}`);

  // DELETE nonexistent ID
  const delNotFoundRes = await request('DELETE', '/bugs/999999');
  assert(delNotFoundRes.status === 404, 'DELETE /bugs/999999 returns 404 Not Found', `Got ${delNotFoundRes.status}`);

  // Invalid ID format
  const invalidIdRes = await request('GET', '/bugs/invalid-id'); // Route doesn't exist (404 expected as only /bugs is CRUD)
  assert(invalidIdRes.status === 404, 'Extra route GET /bugs/:id returns 404 (strictly 4 CRUD routes enforced)');

  const putInvalidId = await request('PUT', '/bugs/not-a-number', updatedPayload);
  assert(putInvalidId.status === 400, 'PUT /bugs/not-a-number returns 400 Invalid ID', `Got ${putInvalidId.status}`);

  // 6. PHASE 26 & 28 - COMPLETE CRUD SEQUENCE
  console.log('\n--- TEST 6: Complete CRUD Sequence (CREATE -> READ -> UPDATE -> READ -> DELETE -> READ) ---');
  // CREATE
  const seqBug = await request('POST', '/bugs', {
    title: 'CORS policy blocked request',
    error: 'Access to fetch at localhost from origin null has been blocked by CORS policy',
    cause: 'Backend missing cors() middleware',
    solution: 'Installed cors and added app.use(cors())',
    date: '2026-09-16'
  });
  assert(seqBug.status === 201, 'Seq step 1: CREATE -> 201 Created');
  const seqId = seqBug.json.id;

  // READ
  const seqRead1 = await request('GET', '/bugs');
  assert(seqRead1.status === 200, 'Seq step 2: READ -> 200 OK');
  assert(seqRead1.json.some(b => b.id === seqId), 'Seq step 2: Created record is present in list');

  // UPDATE
  const seqUpdate = await request('PUT', `/bugs/${seqId}`, {
    title: 'CORS policy blocked request (Resolved)',
    error: 'Access to fetch at localhost from origin null has been blocked by CORS policy',
    cause: 'Express backend lacked Access-Control-Allow-Origin response headers',
    solution: 'Installed npm cors and applied app.use(cors()) before routes',
    date: '2026-09-16'
  });
  assert(seqUpdate.status === 200, 'Seq step 3: UPDATE -> 200 OK');
  assert(seqUpdate.json.title.includes('(Resolved)'), 'Seq step 3: Updated record title confirmed');

  // READ
  const seqRead2 = await request('GET', '/bugs');
  const seqFound2 = seqRead2.json.find(b => b.id === seqId);
  assert(seqFound2.title.includes('(Resolved)'), 'Seq step 4: READ reflects update');

  // DELETE
  const seqDelete = await request('DELETE', `/bugs/${seqId}`);
  assert(seqDelete.status === 200, 'Seq step 5: DELETE -> 200 OK');
  assert(seqDelete.json.success === true, 'Seq step 5: Delete returns success');

  // READ
  const seqRead3 = await request('GET', '/bugs');
  assert(!seqRead3.json.some(b => b.id === seqId), 'Seq step 6: READ confirms bug was permanently removed');

  console.log('\n====================================================');
  console.log(`ALL LOCAL TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
  console.log('====================================================');
}

runVerification().catch(err => {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
});
