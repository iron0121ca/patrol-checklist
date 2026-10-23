import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

Deno.serve(async request => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
        return jsonResponse({ error: 'Authentication is required.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        console.error('Required Supabase Edge Function environment variables are missing.');
        return jsonResponse({ error: 'User creation is not configured on the server.' }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: { user: caller }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !caller) {
        return jsonResponse({ error: 'Your session is invalid or expired.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: callerProfile, error: profileError } = await adminClient
        .from('profiles')
        .select('role, is_active')
        .eq('id', caller.id)
        .single();

    if (profileError || callerProfile?.role !== 'admin' || callerProfile.is_active !== true) {
        return jsonResponse({ error: 'Only active administrators can create users.' }, 403);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
    }

    if (!body || typeof body !== 'object') {
        return jsonResponse({ error: 'Invalid user details.' }, 400);
    }

    const { email, displayName, password, role } = body as Record<string, unknown>;
    if (
        typeof email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        email.trim().length > 254 ||
        typeof displayName !== 'string' ||
        !displayName.trim() ||
        displayName.trim().length > 100 ||
        typeof password !== 'string' ||
        password.length < 8 ||
        (role !== 'admin' && role !== 'caretaker')
    ) {
        return jsonResponse({ error: 'Provide a valid email, name, role, and password of at least 8 characters.' }, 400);
    }

    const { data, error: createError } = await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName.trim() }
    });

    if (createError || !data.user) {
        return jsonResponse({ error: createError?.message || 'Unable to create the user.' }, 400);
    }

    const { error: updateError } = await adminClient
        .from('profiles')
        .update({ display_name: displayName.trim(), role })
        .eq('id', data.user.id)
        .select('id')
        .single();

    if (updateError) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(data.user.id);
        if (cleanupError) {
            console.error('Failed to roll back user after profile update failed:', cleanupError.message);
            return jsonResponse({
                error: 'Profile setup failed and account cleanup did not complete. Contact an administrator before retrying.'
            }, 500);
        }
        return jsonResponse({ error: 'The user profile could not be created. The account was rolled back.' }, 500);
    }

    return jsonResponse({
        user: {
            id: data.user.id,
            email: data.user.email,
            displayName: displayName.trim(),
            role
        }
    }, 201);
});
