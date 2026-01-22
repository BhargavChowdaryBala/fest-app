const config = {
    // API_BASE_URL: "http://localhost:3000" // Uncomment for local development
    API_BASE_URL: "" // Leave empty for same-origin (when hosted together or proxied) OR set to Render URL
};

// Auto-detect if running on Vercel (or any other domain not matching the backend)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Replace with your actual Render Backend URL after deployment
    // config.API_BASE_URL = "https://your-render-app-name.onrender.com"; 
}
