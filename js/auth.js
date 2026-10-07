/**
 * Authentication Module
 * ==========================================
 * Handles login, logout, session management,
 * and auth state change events for Supabase.
 *
 * Dependencies: supabase-client.js (must load first)
 */

// ===== Auth State =====
const AuthState = {
    user: null,         // Current Supabase user object
    profile: null,      // Current user's profile from public.profiles table
    session: null,      // Current session
    isAuthenticated: false
};

// ===== Event Callbacks =====
const AuthCallbacks = {
    onLogin: [],        // Called after successful login
    onLogout: [],       // Called after logout
    onSessionExpired: [] // Called when session expires
};

/**
 * Initialize auth - check existing session and set up listener.
 * Must be called after initSupabase().
 */
async function initAuth() {
    const sb = window.SupabaseClient.supabase;
    if (!sb) throw new Error('Supabase not initialized. Call initSupabase() first.');

    // Check for existing session
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) {
        console.error('Session retrieval error:', error);
        return null;
    }

    if (session) {
        AuthState.session = session;
        AuthState.user = session.user;
        await loadProfile();
    }

    // Listen for auth state changes
    sb.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state change:', event);

        switch (event) {
            case 'SIGNED_IN':
                AuthState.session = session;
                AuthState.user = session.user;
                await loadProfile();
                notifyCallbacks('onLogin');
                break;

            case 'SIGNED_OUT':
                AuthState.user = null;
                AuthState.profile = null;
                AuthState.session = null;
                AuthState.isAuthenticated = false;
                notifyCallbacks('onLogout');
                break;

            case 'TOKEN_REFRESHED':
                AuthState.session = session;
                break;

            case 'USER_UPDATED':
                AuthState.user = session.user;
                await loadProfile();
                break;
        }
    });

    return AuthState;
}

/**
 * Load the user's profile from the public.profiles table.
 */
async function loadProfile() {
    if (!AuthState.user) {
        AuthState.profile = null;
        AuthState.isAuthenticated = false;
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', AuthState.user.id)
            .single();

        if (error) {
            console.warn('Profile load warning:', error.message);
            // Profile might not exist yet (trigger hasn't fired)
            AuthState.profile = {
                id: AuthState.user.id,
                username: AuthState.user.email,
                display_name: AuthState.user.email?.split('@')[0] || 'Unknown',
                role: 'caretaker',
                is_active: true
            };
        } else {
            AuthState.profile = data;
        }

        AuthState.isAuthenticated = data?.is_active !== false;
    } catch (e) {
        console.error('Profile load error:', e);
        AuthState.profile = null;
        AuthState.isAuthenticated = false;
    }
}

/**
 * Log in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Object} { user, session }
 */
async function login(email, password) {
    const sb = window.SupabaseClient.supabase;
    const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password: password
    });

    if (error) {
        throw new Error(getChineseErrorMessage(error));
    }

    return data;
}

/**
 * Log out the current user.
 */
async function logout() {
    const sb = window.SupabaseClient.supabase;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
}

/**
 * Get the current auth state.
 */
function getAuthState() {
    return { ...AuthState };
}

/**
 * Check if current user is an admin.
 */
function isAdmin() {
    return AuthState.profile?.role === 'admin';
}

/**
 * Check if current user is a caretaker.
 */
function isCaretaker() {
    return AuthState.profile?.role === 'caretaker';
}

/**
 * Register a callback for auth events.
 * @param {string} event - 'onLogin', 'onLogout', 'onSessionExpired'
 * @param {Function} callback
 */
function onAuthEvent(event, callback) {
    if (AuthCallbacks[event]) {
        AuthCallbacks[event].push(callback);
    }
}

function notifyCallbacks(event) {
    (AuthCallbacks[event] || []).forEach(cb => {
        try { cb(AuthState); } catch (e) { console.warn('Auth callback error:', e); }
    });
}

/**
 * Translate Supabase auth errors to Chinese.
 */
function getChineseErrorMessage(error) {
    const messages = {
        'Invalid login credentials': '❌ Invalid email or password',
        'Email not confirmed': '📧 Email not yet verified, check your inbox',
        'User not found': '👤 User not found',
        'Invalid email': '📧 Invalid email format',
        'Password should be at least 6 characters': '🔑 Password must be at least 6 characters',
        'Email rate limit exceeded': '⏰ Too many attempts, please try again later',
        'Signup requires a valid password': '🔑 Please enter a valid password'
    };
    return messages[error.message] || `❌ ${error.message}`;
}

// ===== Admin User Management =====

/**
 * Create a new user (admin only - requires service_role key).
 * NOTE: This function requires admin privileges on Supabase.
 * For simplicity, we use signUp as a workaround.
 *
 * @param {string} email
 * @param {string} password
 * @param {Object} metadata - { display_name, role }
 */
async function createUser(email, password, metadata = {}) {
    const sb = window.SupabaseClient.supabase;

    // Use signUp with auto-confirm (set in Supabase Auth settings)
    const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: {
                display_name: metadata.display_name || email.split('@')[0],
                role: metadata.role || 'caretaker'
            }
        }
    });

    if (error) throw new Error(getChineseErrorMessage(error));
    return data;
}

/**
 * Send password reset email.
 * @param {string} email
 */
async function resetPassword(email) {
    const sb = window.SupabaseClient.supabase;
    const { error } = await sb.auth.resetPasswordForEmail(email.trim());
    if (error) throw new Error(getChineseErrorMessage(error));
}

// ===== Session helpers =====

async function getSession() {
    const sb = window.SupabaseClient.supabase;
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    return session;
}

async function refreshSession() {
    const sb = window.SupabaseClient.supabase;
    const { data: { session }, error } = await sb.auth.refreshSession();
    if (error) throw error;
    return session;
}

// ===== Export =====
window.Auth = {
    initAuth,
    login,
    logout,
    getAuthState,
    isAdmin,
    isCaretaker,
    onAuthEvent,
    createUser,
    resetPassword,
    getSession,
    refreshSession,
    getChineseErrorMessage
};