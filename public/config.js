const CONFIG = {
    // Automatically detect environment
    apiBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://fest-app-backend.onrender.com'
};

// Helper to get full API URL
const getApiUrl = (endpoint) => `${CONFIG.apiBaseUrl}${endpoint}`;
