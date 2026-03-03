// Quick test to verify AI endpoint is alive and wired up
const https = require('https');
const http = require('http');

const payload = JSON.stringify({
  prompt: 'Draw a simple login form',
  userKey: 'AIzaSyD79oG1mTDEKjxBufiniVNJkdftF8yfKRk'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/ai/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      const elementCount = parsed.elements ? parsed.elements.length : 0;
      console.log('SUCCESS! Elements generated:', elementCount);
      if (elementCount > 0) {
        console.log('First element type:', parsed.elements[0].type);
      }
    } catch(e) {
      console.log('RAW RESPONSE:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => { console.error('Error:', e.message); });
req.write(payload);
req.end();
