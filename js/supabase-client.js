/**
 * Supabase Client & Database Operations
 * ==========================================
 * This file handles:
 * 1. Supabase client initialization (from env/config)
 * 2. All database CRUD operations
 * 3. Row Level Security helpers
 */

// ===== Supabase Configuration =====
// In production, replace these with your actual Supabase project values.
// For local dev, use .env file (see .env.example).
const SUPABASE_CONFIG = {
    url: 'https://qlvipvsepcuzzjntxekf.supabase.co',
    anonKey: 'sb_publishable__HanKROZO6TzLkI4kqEJ6A_FMEntt14'
};

// Try to load from window.env (set by .env loading script), else use defaults
const SUPABASE_URL = window.ENV?.SUPABASE_URL || SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || SUPABASE_CONFIG.anonKey;

let supabase = null;

/**
 * Initialize the Supabase client.
 * Must be called before any other database operations.
 */
async function initSupabase() {
    if (supabase) return supabase;

    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
        // Expose globally for inline scripts to use directly
        window.supabase = supabase;
        console.log('✅ Supabase client initialized');
        return supabase;
    } catch (error) {
        console.error('❌ Supabase initialization failed:', error);
        throw error;
    }
}

// ========================================================================
// PATROL OPERATIONS
// ========================================================================

/**
 * Submit a complete daily patrol record.
 * This function is designed to work with a Supabase Edge Function or RPC.
 *
 * @param {Object} patrolData - The complete patrol data payload
 * @param {string} patrolData.patrol_date - Date string (YYYY-MM-DD)
 * @param {string} patrolData.user_id - UUID of the caretaker
 * @param {string} patrolData.user_name - Display name of the caretaker
 * @param {Array} patrolData.entries - Array of patrol entry objects
 * @param {Object} patrolData.summary - Daily summary object
 * @param {string} patrolData.caretaker_signature - Caretaker's signature
 *
 * @returns {Object} Result with patrol_id
 */
async function submitPatrol(patrolData) {
    const { data, error } = await supabase
        .from('patrols')
        .insert({
            user_id: patrolData.user_id,
            patrol_date: patrolData.patrol_date,
            status: 'Submitted',
            patrol_data: patrolData,  // Store full data as JSON
            caretaker_signature: patrolData.caretaker_signature
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get today's patrol status for a user.
 * @param {string} userId - User's UUID
 * @param {string} date - Date string (YYYY-MM-DD), defaults to today
 * @returns {Array} Patrol records for today
 */
async function getTodayPatrol(userId, date = null) {
    const patrolDate = date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('patrols')
        .select('*')
        .eq('user_id', userId)
        .eq('patrol_date', patrolDate)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) throw error;
    return data || [];
}

/**
 * Get patrol history with filters.
 * @param {Object} filters
 * @param {string} filters.userId - Filter by user (admin only)
 * @param {string} filters.fromDate - Start date (YYYY-MM-DD)
 * @param {string} filters.toDate - End date (YYYY-MM-DD)
 * @param {number} filters.limit - Page size
 * @param {number} filters.offset - Pagination offset
 * @returns {Object} { data, count }
 */
async function getPatrolHistory(filters = {}) {
    let query = supabase
        .from('patrols')
        .select(`
            *,
            profiles:user_id (display_name, username)
        `, { count: 'exact' });

    if (filters.userId) {
        query = query.eq('user_id', filters.userId);
    }
    if (filters.fromDate) {
        query = query.gte('patrol_date', filters.fromDate);
    }
    if (filters.toDate) {
        query = query.lte('patrol_date', filters.toDate);
    }

    query = query
        .order('patrol_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data, count };
}

/**
 * Get a single patrol record with full details.
 * @param {number} patrolId
 * @returns {Object} Patrol record with user profile
 */
async function getPatrolDetail(patrolId) {
    const { data, error } = await supabase
        .from('patrols')
        .select(`
            *,
            profiles:user_id (display_name, username, role)
        `)
        .eq('id', patrolId)
        .single();

    if (error) throw error;
    return data;
}

// ========================================================================
// CHECKLIST ITEMS OPERATIONS
// ========================================================================

/**
 * Get all active checklist items.
 * @returns {Array} Checklist items sorted by display order
 */
async function getChecklistItems() {
    const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

    if (error) throw error;
    return data || [];
}

/**
 * Get checklist items grouped by category.
 * @returns {Object} { categoryName: [items] }
 */
async function getChecklistItemsByCategory() {
    const items = await getChecklistItems();
    const grouped = {};
    for (const item of items) {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    }
    return grouped;
}

// ========================================================================
// PROFILE / USER OPERATIONS
// ========================================================================

/**
 * Get the current user's profile.
 * @param {string} userId - User's UUID
 * @returns {Object} Profile record
 */
async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get all caretaker profiles (admin use).
 * @returns {Array} All user profiles
 */
async function getAllProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * Update a user's profile (admin use).
 * @param {string} userId
 * @param {Object} updates - Fields to update
 */
async function updateUserProfile(userId, updates) {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (error) throw error;
}

// ========================================================================
// STATISTICS (Admin)
// ========================================================================

/**
 * Get patrol statistics for the admin dashboard.
 * @returns {Object} { totalUsers, todayCount, weekCount, monthCount }
 */
async function getPatrolStats() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [
        { count: totalUsers },
        { count: todayCount },
        { count: weekCount },
        { count: monthCount }
    ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('patrols').select('*', { count: 'exact', head: true }).eq('patrol_date', today),
        supabase.from('patrols').select('*', { count: 'exact', head: true }).gte('patrol_date', weekAgo),
        supabase.from('patrols').select('*', { count: 'exact', head: true }).gte('patrol_date', monthAgo)
    ]);

    return {
        totalUsers: totalUsers || 0,
        todayCount: todayCount || 0,
        weekCount: weekCount || 0,
        monthCount: monthCount || 0
    };
}

// ========================================================================
// DRAFT MANAGEMENT (Local Storage)
// ========================================================================

const DRAFT_KEY_PREFIX = 'patrol_draft_';

/**
 * Save a patrol draft to local storage.
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {Object} draftData - The draft data to save
 */
function savePatrolDraft(date, draftData) {
    try {
        const key = DRAFT_KEY_PREFIX + date;
        const payload = {
            ...draftData,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(payload));
        return true;
    } catch (e) {
        console.warn('Failed to save draft:', e);
        return false;
    }
}

/**
 * Load a patrol draft from local storage.
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object|null} Saved draft or null
 */
function loadPatrolDraft(date) {
    try {
        const key = DRAFT_KEY_PREFIX + date;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('Failed to load draft:', e);
        return null;
    }
}

/**
 * Delete a patrol draft from local storage.
 * @param {string} date - Date string (YYYY-MM-DD)
 */
function deletePatrolDraft(date) {
    try {
        localStorage.removeItem(DRAFT_KEY_PREFIX + date);
    } catch (e) {
        // Silently fail
    }
}

// Export for use in other scripts
window.SupabaseClient = {
    initSupabase,
    submitPatrol,
    getTodayPatrol,
    getPatrolHistory,
    getPatrolDetail,
    getChecklistItems,
    getChecklistItemsByCategory,
    getUserProfile,
    getAllProfiles,
    updateUserProfile,
    getPatrolStats,
    savePatrolDraft,
    loadPatrolDraft,
    deletePatrolDraft,
    get supabase() { return supabase; }
};