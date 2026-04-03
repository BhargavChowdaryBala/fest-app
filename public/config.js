/**
 * CONFIG.JS - Environment & API Setup
 * Dynamically determines whether the app is running on localhost
 * or in production (Render/Vercel) to set the correct API URLs.
 */
function getApiUrl(path) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Explicitly check for Render/Vercel production domains
    const isProduction = window.location.hostname.includes('onrender.com') || window.location.hostname.includes('vercel.app');

    const BACKEND_URL = isLocal ? 'http://localhost:3000' : 'https://fest-app-backend.onrender.com';
    return `${BACKEND_URL}${path}`;
}
