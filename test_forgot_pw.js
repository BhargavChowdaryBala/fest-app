const axios = require('axios');

async function testForgotPassword() {
    const baseURL = 'http://localhost:3005/api/forgot-password';

    // Test Case 1: Legacy User (should fail with specific message)
    try {
        console.log('Testing Legacy User (bhargav)...');
        await axios.post(baseURL, { email: 'bhargav' });
    } catch (error) {
        if (error.response) {
            console.log(`Legacy User Response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.log('Legacy User Error:', error.message);
        }
    }

    // Test Case 2: Valid User (should succeed and log URL on server)
    try {
        console.log('\nTesting Valid User (bhargavbala56@gmail.com)...');
        const res = await axios.post(baseURL, { email: 'bhargavbala56@gmail.com' });
        console.log(`Valid User Response: ${res.status} - ${JSON.stringify(res.data)}`);
    } catch (error) {
        if (error.response) {
            console.log(`Valid User Response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.log('Valid User Error:', error.message);
        }
    }
}

// Wait for server to start
setTimeout(testForgotPassword, 3000);
