// API test script - verifies all critical backend endpoints
const http = require('http');

function request(method, path, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost', port: 5001, path, method,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('=== ANTIDRAW API TEST SUITE ===\n');
  let pass = 0, fail = 0;

  function ok(label, result) {
    console.log(`✅ ${label}`);
    pass++;
  }
  function err(label, detail) {
    console.log(`❌ ${label}: ${detail}`);
    fail++;
  }

  // 1. Backend alive
  const root = await request('GET', '/');
  root.status === 200 ? ok('Backend is running') : err('Backend alive', root.status);

  // 2. DB connected
  const db = await request('GET', '/db-status');
  db.status === 200 && db.body.status === 'connected' ? ok('MongoDB connected') : err('DB status', JSON.stringify(db.body));

  // 3. Sign up new user
  const email = `apitestuser_${Date.now()}@test.com`;
  const signup = await request('POST', '/users', { username: `apitest${Date.now()}`, email, password: 'TestPass123' });
  let userId;
  if (signup.status === 201 && signup.body.userId) {
    userId = signup.body.userId;
    ok(`Sign up (userId: ${userId.substring(0,8)}...)`);
  } else {
    err('Sign up', JSON.stringify(signup.body));
  }

  // 4. Login
  const login = await request('POST', '/login', { email, password: 'TestPass123' });
  login.status === 200 && login.body.userId ? ok('Login') : err('Login', JSON.stringify(login.body));

  if (!userId) { console.log('\n⚠ No userId, skipping drawing tests'); return; }

  // 5. Create a drawing (POST)
  const createDrawing = await request('POST', '/drawings', {
    userId,
    elements: [{ type: 'rect', left: 100, top: 100, width: 200, height: 100 }],
    appState: {},
    title: 'API Test Drawing'
  });
  let drawingId;
  if (createDrawing.status === 201 && createDrawing.body._id) {
    drawingId = createDrawing.body._id;
    ok(`Create drawing (id: ${drawingId.substring(0,8)}...)`);
  } else {
    err('Create drawing', JSON.stringify(createDrawing.body));
  }

  // 6. Get user drawings
  const userDrawings = await request('GET', `/drawings/user/${userId}`);
  userDrawings.status === 200 && Array.isArray(userDrawings.body) ? ok(`Get user drawings (count: ${userDrawings.body.length})`) : err('Get user drawings', JSON.stringify(userDrawings.body));

  if (!drawingId) { console.log('\n⚠ No drawingId, skipping remaining tests'); return; }

  // 7. Get single drawing (BUG-10 - was missing)
  const single = await request('GET', `/drawings/single/${drawingId}`);
  single.status === 200 && single.body._id ? ok('GET /drawings/single/:id (BUG-10 fix verified)') : err('GET single drawing', JSON.stringify(single.body));

  // 8. PATCH drawing content (BUG-3 - new endpoint)  
  const patch = await request('PATCH', `/drawings/${drawingId}/content`, {
    userId,
    elements: [{ type: 'rect', left: 200, top: 200, width: 300, height: 150 }, { type: 'circle', left: 50, top: 50, radius: 40 }],
    appState: {}
  });
  if (patch.status === 200 && patch.body._id) {
    ok('PATCH /drawings/:id/content (BUG-3 fix verified)');
    // Verify the content actually updated
    const verify = await request('GET', `/drawings/single/${drawingId}`);
    verify.body.elements && verify.body.elements.length === 2 ? ok('Drawing content actually updated (2 elements)') : err('Content update verify', `elements: ${verify.body.elements?.length}`);
  } else {
    err('PATCH drawing content', JSON.stringify(patch.body));
  }

  // 9. PATCH share with ownership check (BUG-9 fix)
  const share = await request('PATCH', `/drawings/share/${drawingId}`, { isPublic: true, userId });
  share.status === 200 && share.body.isPublic === true ? ok('Share with ownership (BUG-9 fix verified)') : err('Share with ownership', JSON.stringify(share.body));

  // 10. Attempt share with WRONG userId (should fail)
  const wrongShare = await request('PATCH', `/drawings/share/${drawingId}`, { isPublic: false, userId: '000000000000000000000000' });
  wrongShare.status === 404 ? ok('Ownership check blocks unauthorized share (BUG-9 security)') : err('Ownership check', `Expected 404, got ${wrongShare.status}`);

  // 11. Delete drawing (cleanup)
  const del = await request('DELETE', `/drawings/${drawingId}`);
  del.status === 200 ? ok('Delete drawing (cleanup)') : err('Delete drawing', del.status);

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
}

runTests();
