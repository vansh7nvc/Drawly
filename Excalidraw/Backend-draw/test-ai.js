import fetch from 'node-fetch';

const res = await fetch('http://localhost:5001/ai/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Draw a simple login form with a username box and a password box',
    userKey: 'AIzaSyD79oG1mTDEKjxBufiniVNJkdftF8yfKRk'
  })
});

const data = await res.json();
console.log('STATUS:', res.status);
console.log('RESPONSE:', JSON.stringify(data, null, 2));
