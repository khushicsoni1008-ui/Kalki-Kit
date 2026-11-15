// ==========================================================================
// KALKI-KIT AUTHENTICATION & ACCESS CONTROL
// Supports Firebase Auth + Local Analyst Guest Session Fallback
// ==========================================================================

const firebaseConfig = {
    apiKey: "AIzaSyAoZVlnct1nw4c1gjOL-Nmzne5eGlKI298",
    authDomain: "kalki-kit.firebaseapp.com",
    projectId: "kalki-kit",
    storageBucket: "kalki-kit.firebasestorage.app",
    messagingSenderId: "68493047756",
    appId: "1:68493047756:web:9ad9d52565364c61b38f69",
    measurementId: "G-01B6Y6J7P1"
};

let auth = null;

try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
    }
} catch (e) {
    console.warn("Firebase initialized with local fallback:", e.message);
}

// Logic for login.html
if (document.getElementById('auth-form')) {
    let isLoginMode = true;

    const authForm = document.getElementById('auth-form');
    const formTitle = document.getElementById('form-title');
    const btnAuthText = document.getElementById('btn-auth-text');
    const toggleAuthMode = document.getElementById('toggle-auth-mode');
    const toggleText = document.getElementById('toggle-text');
    const errorDiv = document.getElementById('auth-error');
    const errorMsg = document.getElementById('auth-error-msg');
    const btnAuth = document.getElementById('btn-auth');

    // Sent back here because the server no longer accepts the saved session (for example after a restart)
    if (new URLSearchParams(window.location.search).has('expired') && errorDiv && errorMsg) {
        errorMsg.textContent = 'Your session expired. Please sign in again.';
        errorDiv.style.display = 'block';
    }

    // Toggle between Sign In and Sign Up
    if (toggleAuthMode) {
        toggleAuthMode.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            if (errorDiv) errorDiv.style.display = 'none';
            
            if (isLoginMode) {
                if (formTitle) formTitle.textContent = "Sign In";
                if (btnAuthText) btnAuthText.textContent = "Sign In";
                if (toggleText) toggleText.textContent = "Don't have an account?";
                toggleAuthMode.textContent = "Sign Up";
            } else {
                if (formTitle) formTitle.textContent = "Create Account";
                if (btnAuthText) btnAuthText.textContent = "Sign Up";
                if (toggleText) toggleText.textContent = "Already have an account?";
                toggleAuthMode.textContent = "Sign In";
            }
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('userEmail').value;
            const password = document.getElementById('userPass').value;

            if (errorDiv) errorDiv.style.display = 'none';
            const originalIcon = btnAuth.querySelector('i') ? btnAuth.querySelector('i').className : '';
            if (btnAuth.querySelector('i')) {
                btnAuth.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin me-2';
            }
            btnAuth.disabled = true;

            const showError = (message) => {
                if (errorMsg) errorMsg.textContent = message;
                if (errorDiv) errorDiv.style.display = 'block';
                if (btnAuth.querySelector('i')) btnAuth.querySelector('i').className = originalIcon;
                btnAuth.disabled = false;
            };

            if (!auth) {
                showError('Sign-in service is unavailable. Check your connection, or use guest login.');
                return;
            }

            const authPromise = isLoginMode
                ? auth.signInWithEmailAndPassword(email, password)
                : auth.createUserWithEmailAndPassword(email, password);

            authPromise.then((userCredential) => {
                localStorage.setItem('kalki_user_session', JSON.stringify({ email, uid: userCredential.user.uid, mode: 'firebase' }));
                window.location.href = 'index.html';
            }).catch((error) => showError(friendlyAuthError(error)));
        });
    }

    // Guest / Quick Demo Analyst Login (gets a short-lived token from the server)
    const guestBtn = document.getElementById('btn-guest-login');
    if (guestBtn) {
        guestBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (errorDiv) errorDiv.style.display = 'none';
            try {
                const res = await fetch(`${getBackendBase()}/api/guest-session`, { method: 'POST' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const { token, expiresAt } = await res.json();
                localStorage.setItem('kalki_user_session', JSON.stringify({ email: 'analyst@kalki.intelligence', uid: 'analyst-demo', mode: 'demo', token, expiresAt }));
                window.location.href = 'index.html';
            } catch (err) {
                if (errorMsg) errorMsg.textContent = 'Could not start a guest session. Is the server running?';
                if (errorDiv) errorDiv.style.display = 'block';
            }
        });
    }
}

// Plain-English messages for the Firebase error codes people actually hit
function friendlyAuthError(error) {
    const messages = {
        'auth/invalid-email': 'That email address does not look right.',
        'auth/user-not-found': 'No account found with that email. Use Sign Up to create one.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Incorrect email or password. Please try again.',
        'auth/invalid-login-credentials': 'Incorrect email or password. Please try again.',
        'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
        'auth/weak-password': 'Please choose a password with at least 6 characters.',
        'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
        'auth/network-request-failed': 'Could not connect. Check your internet connection and try again.',
        'auth/user-disabled': 'This account has been disabled.'
    };
    return messages[error && error.code] || 'Could not sign you in. Please try again.';
}

function getBackendBase() {
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    // Use the local Express server during split-port development; use same-origin API routes in production.
    return isLocalHost && window.location.port !== '3000' ? 'http://localhost:3000' : '';
}

// Session Check for index.html
function readSession() {
    try { return JSON.parse(localStorage.getItem('kalki_user_session')); } catch (e) { return null; }
}

// A guest session counts only while its server-issued token is unexpired
function getValidGuestSession() {
    const s = readSession();
    return (s && s.mode === 'demo' && s.token && s.expiresAt > Date.now()) ? s : null;
}

// Resolves once Firebase has restored (or failed to restore) the signed-in user
const authReady = new Promise((resolve) => {
    if (auth) auth.onAuthStateChanged((user) => resolve(user));
    else resolve(null);
});

(function checkSession() {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const page = document.documentElement;

    // Hide protected pages until the session is confirmed, so nothing flashes before a redirect
    if (!isLoginPage) page.style.visibility = 'hidden';

    const allow = (email) => {
        if (isLoginPage) {
            window.location.href = 'index.html';
            return;
        }
        const userEmailElement = document.getElementById('nav-user-email');
        if (userEmailElement) userEmailElement.textContent = email || 'Analyst';
        page.style.visibility = '';
    };

    const deny = () => {
        if (isLoginPage) return;
        localStorage.removeItem('kalki_user_session');
        window.location.replace('login.html');
    };

    authReady.then((user) => {
        const guest = getValidGuestSession();
        if (user) allow(user.email);
        else if (guest) allow(guest.email);
        else deny();
    });
})();

// Auth header for API calls: Firebase ID token, or the guest token
window.getAuthHeaders = async function() {
    const user = await authReady.then(() => auth && auth.currentUser);
    if (user) {
        try { return { Authorization: 'Bearer ' + await user.getIdToken() }; } catch (e) {}
    }
    const guest = getValidGuestSession();
    return guest ? { Authorization: 'Bearer ' + guest.token } : {};
};

// fetch() that sends the login token and returns to the login page if the server rejects it
window.authFetch = async function(url, options = {}) {
    const authHeaders = await window.getAuthHeaders();
    const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), ...authHeaders } });
    if (res.status === 401) window.logoutUser('expired');
    return res;
};

// Global logout function
window.logoutUser = function(reason) {
    localStorage.removeItem('kalki_user_session');
    const target = reason === 'expired' ? 'login.html?expired=1' : 'login.html';
    if (auth) {
        auth.signOut().finally(() => {
            window.location.href = target;
        });
    } else {
        window.location.href = target;
    }
};
