import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadResult {
  causelist_id: string;
  storage_path: string;
  status: string;
  source_type?: string;
}

// Detect if HTML is a Search Causelist (lawyer-filtered, multi-court)
function detectSearchCauselist(htmlContent: string): { isSearch: boolean; lawyerName: string | null } {
  // Pattern 1: Check for "Search Causelist" in title or header
  if (/SEARCH\s*CAUSE\s*LIST/i.test(htmlContent)) {
    // Try to extract lawyer name from the search
    const lawyerMatch = htmlContent.match(/advocate\s*name[:\s]*([^<\n]+)/i) ||
                        htmlContent.match(/lawyer\s*name[:\s]*([^<\n]+)/i) ||
                        htmlContent.match(/search\s*for[:\s]*([^<\n]+)/i);
    return {
      isSearch: true,
      lawyerName: lawyerMatch ? lawyerMatch[1].trim() : null
    };
  }
  
  // Pattern 2: Check for multi-court table structure typical of search results
  // Multiple "Court No." entries with case data
  const courtMatches = htmlContent.match(/Court\s*No\.?\s*\d+/gi);
  if (courtMatches && courtMatches.length >= 3) {
    // Has many courts - likely a search result across all courts
    // Try to extract lawyer name from table headers or content
    const lawyerMatch = htmlContent.match(/([A-Z][A-Za-z\s]+(?:PUROHIT|SHARMA|JAIN|GUPTA|VERMA|SINGH|AGRAWAL|AGARWAL|YADAV|CHAUHAN|RAO|MEHTA|KHAN|PATEL|REDDY|KUMAR|SAXENA|MISHRA|PANDEY|TIWARI))/i);
    return {
      isSearch: true,
      lawyerName: lawyerMatch ? lawyerMatch[1].trim() : null
    };
  }
  
  return { isSearch: false, lawyerName: null };
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
    const queryLawyerName = formData.get('query_lawyer_name') as string | null;

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

    // Validate list type - now includes SEARCH
    if (!['DAILY', 'SUPPLEMENTARY', 'SEARCH'].includes(listType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid list_type. Must be DAILY, SUPPLEMENTARY, or SEARCH' }),
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

    // Read file content for HTML analysis
    const fileBuffer = await file.arrayBuffer();
    let detectedSourceType: 'PDF' | 'HTML_COMPLETE' | 'HTML_SEARCH' = isPdf ? 'PDF' : 'HTML_COMPLETE';
    let detectedLawyerName = queryLawyerName;

    if (isHtml) {
      // Analyze HTML content to detect if it's a Search Causelist
      const htmlContent = new TextDecoder().decode(fileBuffer);
      const searchDetection = detectSearchCauselist(htmlContent);
      
      if (searchDetection.isSearch || listType === 'SEARCH') {
        detectedSourceType = 'HTML_SEARCH';
        if (!detectedLawyerName && searchDetection.lawyerName) {
          detectedLawyerName = searchDetection.lawyerName;
        }
        console.log(`[UPLOAD] Detected HTML_SEARCH causelist, lawyer: ${detectedLawyerName || 'unknown'}`);
      }
    }

    // Generate storage path
    const timestamp = Date.now();
    const extension = isPdf ? 'pdf' : 'html';
    const storagePath = `admin-uploads/${bench}/${listDate}/${timestamp}.${extension}`;

    console.log(`Uploading file to ${storagePath} (source_type: ${detectedSourceType})`);

    // Upload to storage
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

    // Create raw_causelists record with source_type
    const insertData: Record<string, unknown> = {
      bench,
      list_type: listType === 'SEARCH' ? 'DAILY' : listType, // Store as DAILY for docket consistency
      list_date: listDate,
      storage_path: storagePath,
      file_name: file.name,
      file_size_bytes: file.size,
      status: 'downloaded',
      source: 'admin_upload',
      uploaded_by: user.id,
      source_type: detectedSourceType,
    };

    // Add query_lawyer_name for HTML_SEARCH
    if (detectedSourceType === 'HTML_SEARCH' && detectedLawyerName) {
      insertData.query_lawyer_name = detectedLawyerName;
    }

    // For HTML, store the text content directly
    if (isHtml) {
      const htmlContent = new TextDecoder().decode(fileBuffer);
      insertData.text_content = htmlContent;
      insertData.status = 'text_extracted'; // Skip extraction step
    }

    const { data: causelist, error: dbError } = await supabase
      .from('raw_causelists')
      .insert(insertData)
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

    console.log(`Created causelist record: ${causelist.id} (source_type: ${detectedSourceType})`);

    // Route based on source type
    if (detectedSourceType === 'HTML_SEARCH') {
      // For HTML_SEARCH, go directly to search-html-parse
      console.log('Triggering search-html-parse for HTML_SEARCH...');
      const { error: parseError } = await supabase.functions.invoke('search-html-parse', {
        body: { causelist_id: causelist.id },
      });
      
      if (parseError) {
        console.error('search-html-parse trigger error:', parseError);
      }
    } else if (isHtml) {
      // For regular HTML, call scan-lawyer-names (will route appropriately)
      console.log('Triggering scan-lawyer-names for HTML...');
      const { error: scanError } = await supabase.functions.invoke('scan-lawyer-names', {
        body: { causelist_id: causelist.id },
      });
      
      if (scanError) {
        console.error('scan-lawyer-names trigger error:', scanError);
      }
    } else {
      // For PDF, call pdf-extract-chunk function
      console.log('Triggering PDF extraction...');
      const { error: extractError } = await supabase.functions.invoke('pdf-extract-chunk', {
        body: { causelist_id: causelist.id },
      });
      
      if (extractError) {
        console.error('PDF extraction trigger error:', extractError);
      }
    }

    const result: UploadResult = {
      causelist_id: causelist.id,
      storage_path: storagePath,
      status: detectedSourceType === 'HTML_SEARCH' ? 'queued_for_direct_parse' : 'queued_for_extraction',
      source_type: detectedSourceType,
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
