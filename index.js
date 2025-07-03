import fetch from 'node-fetch';

async function run() {
  // According to Project44 docs, you should use either:
  // 1. Basic Auth with username/password as your client_id/client_secret
  // 2. Form data with client_id and client_secret fields
  // But not both at the same time

  // For this example, we'll use Basic Auth
  const clientId = 'morgan@fitzmark.com';
  const clientSecret = 'Fitzmark21';
  
  // Only include grant_type in the form data when using Basic Auth
  const formData = {
    grant_type: 'client_credentials'
  };

  try {
    console.log('Authenticating with Project44...');
    const resp = await fetch(
      'https://na12.api.project44.com/api/v4/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        },
        body: new URLSearchParams(formData).toString()
      }
    );

    const responseText = await resp.text();
    console.log(`Response status: ${resp.status} ${resp.statusText}`);
    
    if (!resp.ok) {
      console.error('Authentication failed:');
      console.error(responseText);
      return;
    }

    try {
      // Try to parse as JSON
      const data = JSON.parse(responseText);
      console.log('Authentication successful!');
      console.log('Access Token:', data.access_token ? `${data.access_token.substring(0, 10)}...` : 'None');
      console.log('Token Type:', data.token_type);
      console.log('Expires In:', data.expires_in, 'seconds');
    } catch (e) {
      // If not valid JSON, just show the raw response
      console.log('Raw response:', responseText);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

run();