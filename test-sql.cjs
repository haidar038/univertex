const https = require('https');

const payload = JSON.stringify({
  query: "CREATE OR REPLACE VIEW auth.factors AS SELECT * FROM auth.mfa_factors; GRANT SELECT, INSERT, UPDATE, DELETE ON auth.factors TO supabase_auth_admin;"
});

const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/oiurjnmpkguyxevdbpbu/sql',
  method: 'POST',
  headers: {
    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdXJqbm1wa2pndXl4ZXZkcGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTg0NTYzOSwiZXhwIjoyMDc3NDIxNjM5fQ.cYbNHlFGyOMyGid7Ks0RhW2GbkCfcyvNDsT_4WDS4ic`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(payload);
req.end();
