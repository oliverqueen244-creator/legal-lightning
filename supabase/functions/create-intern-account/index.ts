/**
 * INTERN INTEGRATION: Secure Intern Account Creation
 * 
 * Creates a new intern account with:
 * - auth.users entry (role: INTERN)
 * - profiles entry
 * - intern_accounts entry linked to supervisor
 * 
 * Only SENIOR users can invoke this function.
 * 
 * SECURITY: Validates supervisor authentication and role
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getCorsHeaders } from "../_shared/cors.ts";
interface CreateInternRequest {
  email: string;
  name: string;
  institution?: string;
  durationDays: number;
  chamberId: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client for auth validation (uses user's JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for creating users (service role)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the supervisor
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check supervisor role
    const { data: profile, error: profileError } = await supabaseAuth
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.role !== 'SENIOR' && profile.role !== 'ADMIN') {
      return new Response(
        JSON.stringify({ error: 'Only senior lawyers can create intern accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateInternRequest = await req.json();
    const { email, name, institution, durationDays, chamberId } = body;

    // Validate required fields
    if (!email || !name || !durationDays || !chamberId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, name, durationDays, chamberId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify supervisor owns the chamber
    const { data: chamber, error: chamberError } = await supabaseAdmin
      .from('chambers')
      .select('id')
      .eq('id', chamberId)
      .eq('owner_id', user.id)
      .single();

    if (chamberError || !chamber) {
      return new Response(
        JSON.stringify({ error: 'Chamber not found or you are not the owner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a temporary password
    const tempPassword = generateTempPassword();
    
    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    console.log(`Creating intern account for ${email}, expires ${expiresAt.toISOString()}`);

    // Step 1: Create auth user using admin client
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: name,
        role: 'INTERN'
      }
    });

    if (createUserError) {
      console.error('Create user error:', createUserError);
      
      // Check for duplicate email
      if (createUserError.message?.includes('already') || createUserError.message?.includes('exists')) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createUserError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const internUserId = newUser.user.id;
    console.log(`Created auth user: ${internUserId}`);

    // Step 2: Create profile entry
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: internUserId,
        full_name: name,
        role: 'INTERN',
        onboarding_completed: true // Interns don't need onboarding
      });

    if (profileInsertError) {
      console.error('Profile insert error:', profileInsertError);
      // Cleanup: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(internUserId);
      return new Response(
        JSON.stringify({ error: 'Failed to create profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created profile entry');

    // Step 3: Create intern_accounts entry
    const { error: internInsertError } = await supabaseAdmin
      .from('intern_accounts')
      .insert({
        user_id: internUserId,
        supervisor_id: user.id,
        chamber_id: chamberId,
        intern_name: name,
        institution: institution || null,
        expires_at: expiresAt.toISOString()
      });

    if (internInsertError) {
      console.error('Intern account insert error:', internInsertError);
      // Cleanup: delete profile and auth user
      await supabaseAdmin.from('profiles').delete().eq('id', internUserId);
      await supabaseAdmin.auth.admin.deleteUser(internUserId);
      return new Response(
        JSON.stringify({ error: 'Failed to create intern account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created intern_accounts entry');

    // Success! Return credentials
    return new Response(
      JSON.stringify({
        success: true,
        intern: {
          email,
          name,
          tempPassword, // One-time display
          expiresAt: expiresAt.toISOString(),
          supervisorName: profile.full_name
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Generate a secure temporary password
 * Format: 3 words + 2 digits for memorability
 */
function generateTempPassword(): string {
  const words = [
    'court', 'judge', 'case', 'brief', 'trial', 'bench', 'legal', 'draft',
    'order', 'writ', 'plea', 'suit', 'jury', 'bail', 'bond', 'deed',
    'claim', 'file', 'rule', 'oath', 'seal', 'term', 'ward', 'will'
  ];
  
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(Math.random() * 90 + 10); // 10-99
  
  return `${capitalize(word1)}${capitalize(word2)}${digits}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
