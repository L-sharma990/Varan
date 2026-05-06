/**
 * VARAN Frontend Configuration
 * Centralized API base URL management.
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const API_BASE = isLocal 
    ? 'http://localhost:8080/api' 
    : 'https://varan-production.up.railway.app/api';

// Environment Detection Logging
console.log(`%c[VARAN] Running in ${isLocal ? 'DEVELOPMENT' : 'PRODUCTION'} mode`, 'color: #14b8a6; font-weight: bold;');
console.log(`[VARAN] API Endpoint: ${API_BASE}`);
