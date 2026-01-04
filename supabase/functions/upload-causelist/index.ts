import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadResult {
  causelist_id: string;
  storage_path: string;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'ADMIN') {
      console.log(`Access denied for user ${user.id}, role: ${roleData?.role}`);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bench = formData.get('bench') as string;
    const listType = formData.get('list_type') as string;
    const listDate = formData.get('list_date') as string;
    const courtNo = formData.get('court_no') as string | null;

    // Validate required fields
    if (!file || !bench || !listType || !listDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, bench, list_type, list_date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate bench
    if (!['JAIPUR', 'JODHPUR'].includes(bench)) {
      return new Response(
        JSON.stringify({ error: 'Invalid bench. Must be JAIPUR or JODHPUR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate list type
    if (!['DAILY', 'SUPPLEMENTARY'].includes(listType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid list_type. Must be DAILY or SUPPLEMENTARY' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const isPdf = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isHtml = fileType === 'text/html' || fileName.endsWith('.html') || fileName.endsWith('.htm');

    if (!isPdf && !isHtml) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Must be PDF or HTML' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum size is 20MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate storage path
    const timestamp = Date.now();
    const extension = isPdf ? 'pdf' : 'html';
    const storagePath = `admin-uploads/${bench}/${listDate}/${timestamp}.${extension}`;

    console.log(`Uploading file to ${storagePath}`);

    // Upload to storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('causelist-pdfs')
      .upload(storagePath, fileBuffer, {
        contentType: isPdf ? 'application/pdf' : 'text/html',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file to storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create raw_causelists record
    const { data: causelist, error: dbError } = await supabase
      .from('raw_causelists')
      .insert({
        bench,
        list_type: listType,
        list_date: listDate,
        storage_path: storagePath,
        file_name: file.name,
        file_size_bytes: file.size,
        status: 'downloaded',
        source: 'admin_upload',
        uploaded_by: user.id,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('causelist-pdfs').remove([storagePath]);
      return new Response(
        JSON.stringify({ error: 'Failed to create causelist record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created causelist record: ${causelist.id}`);

    // Trigger appropriate extraction
    if (isHtml) {
      // For HTML, call html-extract function
      console.log('Triggering HTML extraction...');
      const { error: extractError } = await supabase.functions.invoke('html-extract', {
        body: { causelist_id: causelist.id },
      });
      
      if (extractError) {
        console.error('HTML extraction trigger error:', extractError);
        // Don't fail the upload, just log
      }
    } else {
      // For PDF, call pdf-extract-chunk function
      console.log('Triggering PDF extraction...');
      const { error: extractError } = await supabase.functions.invoke('pdf-extract-chunk', {
        body: { causelist_id: causelist.id },
      });
      
      if (extractError) {
        console.error('PDF extraction trigger error:', extractError);
        // Don't fail the upload, just log
      }
    }

    const result: UploadResult = {
      causelist_id: causelist.id,
      storage_path: storagePath,
      status: 'queued_for_extraction',
    };

    console.log(`Upload complete: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
