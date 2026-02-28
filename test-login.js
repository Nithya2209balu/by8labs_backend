const axios = require('axios');

async function testLogin() {
    try {
        console.log('=== Testing Login API ===\n');
        console.log('Backend URL: http://localhost:5000');
        console.log('Frontend URL: http://localhost:5173\n');

        const credentials = {
            email: 'hr@test.com',
            password: 'password123'
        };

        console.log('Attempting login with:');
        console.log('Email:', credentials.email);
        console.log('Password:', credentials.password);
        console.log('\nSending POST request to /api/auth/login...\n');

        const response = await axios.post('http://localhost:5000/api/auth/login', credentials);

        console.log('✅ LOGIN SUCCESSFUL!');
        console.log('\nResponse:');
        console.log('- User ID:', response.data._id);
        console.log('- Username:', response.data.username);
        console.log('- Email:', response.data.email);
        console.log('- Role:', response.data.role);
        console.log('- Token received:', response.data.token ? 'YES' : 'NO');
        console.log('\n✓ The backend is working correctly!');
        console.log('\n--- Next Steps ---');
        console.log('1. Make sure you\'re typing the email correctly: hr@test.com');
        console.log('2. Make sure you\'re typing the password correctly: password123');
        console.log('3. Try clearing your browser cache (Ctrl+Shift+Delete)');
        console.log('4. Try opening in incognito/private mode');

    } catch (error) {
        console.log('❌ LOGIN FAILED\n');

        if (error.response) {
            console.log('Server Response:');
            console.log('- Status:', error.response.status);
            console.log('- Message:', error.response.data.message);

            if (error.response.status === 401) {
                console.log('\n⚠️  Authentication failed - credentials are incorrect in database');
                console.log('Run: node fix-hr-user.js');
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.log('⚠️  Cannot connect to backend server');
            console.log('Make sure backend is running on port 5000');
            console.log('Check if "npm run dev" is running in the backend folder');
        } else {
            console.log('Error:', error.message);
        }
    }
}

testLogin();
