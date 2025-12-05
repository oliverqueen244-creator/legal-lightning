import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CIS Portal URLs
const CIS_URLS: Record<string, string> = {
  JAIPUR: 'https://hcraj.nic.in/cishcraj-jp/causelists/',
  JODHPUR: 'https://hcraj.nic.in/cishcraj-jdp/causelists/'
};

interface CauseListEntry {
  item_no: number;
  case_number: string;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  petitioner: string | null;
  respondent: string | null;
  court_room_no: string;
  court_location: string;
  list_type: string;
  date: string;
  status: string;
}

interface ScrapeRequest {
  action: 'scrape' | 'preview';
  bench?: 'JAIPUR' | 'JODHPUR';
  date?: string;
  list_type?: 'D' | 'S';
  format?: 'html' | 'pdf';
}

// Smart date logic - after 6PM IST, get tomorrow's date
function getSmartTargetDate(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const istHour = istTime.getUTCHours();
  
  if (istHour >= 18) {
    const tomorrow = new Date(istTime);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  return istTime.toISOString().split('T')[0];
}

// Format date as DD/MM/YYYY for the form
function formatDateForForm(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Call solve-captcha function
async function solveCaptcha(imageData: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  console.log(`[scrape-causelist] Solving CAPTCHA...`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/solve-captcha`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    });

    if (!response.ok) {
      console.error(`[scrape-causelist] CAPTCHA solve failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[scrape-causelist] CAPTCHA solution: ${data.solution}`);
    return data.solution;
  } catch (error) {
    console.error('[scrape-causelist] CAPTCHA solve error:', error);
    return null;
  }
}

// Phase 1: Get page HTML and extract CAPTCHA using Browserless /content
async function getPageWithCaptcha(
  browserlessKey: string,
  cisUrl: string
): Promise<{ html: string; captchaBase64: string | null; error?: string }> {
  console.log(`[scrape-causelist] Phase 1: Getting page with CAPTCHA from ${cisUrl}`);
  
  try {
    const response = await fetch(`https://chrome.browserless.io/content?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: cisUrl,
        waitForSelector: { selector: '#captcha', timeout: 15000 },
        gotoOptions: { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[scrape-causelist] Browserless /content failed: ${response.status} - ${errorText}`);
      return { html: '', captchaBase64: null, error: `Browserless error: ${response.status}` };
    }

    const html = await response.text();
    console.log(`[scrape-causelist] Got page HTML: ${html.length} chars`);

    // Extract CAPTCHA base64 from <img id="captcha" src="data:image/...">
    const captchaMatch = html.match(/<img[^>]*id=["']captcha["'][^>]*src=["']([^"']+)["']/i) ||
                         html.match(/<img[^>]*src=["']([^"']+)["'][^>]*id=["']captcha["']/i);
    
    if (captchaMatch) {
      const captchaSrc = captchaMatch[1];
      console.log(`[scrape-causelist] Found CAPTCHA src: ${captchaSrc.substring(0, 100)}...`);
      
      if (captchaSrc.startsWith('data:image')) {
        return { html, captchaBase64: captchaSrc };
      }
    }

    // Try alternative patterns for PHP-based CAPTCHA
    const altCaptchaMatch = html.match(/id=["']captcha["'][^>]*>/i);
    if (altCaptchaMatch) {
      console.log(`[scrape-causelist] Found captcha element but need to extract image differently`);
    }

    console.log(`[scrape-causelist] CAPTCHA extraction failed. HTML snippet: ${html.substring(0, 1500)}`);
    return { html, captchaBase64: null, error: 'Could not extract CAPTCHA from page' };

  } catch (error) {
    console.error(`[scrape-causelist] Phase 1 error:`, error);
    return { html: '', captchaBase64: null, error: String(error) };
  }
}

// Phase 2: Submit form and get HTML result using Browserless /content with addScriptTag
async function submitFormForHtml(
  browserlessKey: string,
  cisUrl: string,
  formattedDate: string,
  listType: string,
  captchaSolution: string
): Promise<{ html: string; success: boolean; error?: string }> {
  console.log(`[scrape-causelist] Phase 2: Submitting form for HTML`);
  console.log(`[scrape-causelist] Date: ${formattedDate}, ListType: ${listType}, CAPTCHA: ${captchaSolution}`);

  // Use Browserless /content endpoint with addScriptTag to fill form
  const contentConfig = {
    url: cisUrl,
    gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
    waitForSelector: { selector: '#captcha', timeout: 10000 },
    addScriptTag: [
      {
        content: `
          // Fill the form
          const htmlRadio = document.getElementById('formatradio1');
          if (htmlRadio) htmlRadio.click();
          
          const dateInput = document.getElementById('causelstdt');
          if (dateInput) dateInput.value = '${formattedDate}';
          
          const listTypeSelect = document.getElementById('causelisttype');
          if (listTypeSelect) listTypeSelect.value = '${listType}';
          
          const captchaInput = document.getElementById('txtCaptcha');
          if (captchaInput) captchaInput.value = '${captchaSolution}';
          
          // Click view button
          const viewBtn = document.getElementById('btnViewCauseList');
          if (viewBtn) viewBtn.click();
        `
      }
    ],
    waitForTimeout: 5000, // Wait for AJAX response
  };

  try {
    const response = await fetch(`https://chrome.browserless.io/content?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contentConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[scrape-causelist] Browserless /content failed: ${response.status} - ${errorText}`);
      return { html: '', success: false, error: `Browserless content error: ${response.status}` };
    }

    const html = await response.text();
    console.log(`[scrape-causelist] Got result HTML: ${html.length} chars`);
    
    // Check for CAPTCHA errors
    if (html.toLowerCase().includes('invalid captcha') || html.toLowerCase().includes('wrong captcha')) {
      return { html, success: false, error: 'Invalid CAPTCHA solution' };
    }

    // Check for no records
    if (html.toLowerCase().includes('no record') || html.toLowerCase().includes('no data found')) {
      console.log(`[scrape-causelist] No records found for this date`);
      return { html, success: true }; // Success but no data
    }

    return { html, success: true };

  } catch (error) {
    console.error(`[scrape-causelist] Phase 2 HTML error:`, error);
    return { html: '', success: false, error: String(error) };
  }
}

// Phase 2 (PDF): Submit form and download PDF using Browserless /content with script injection
async function submitFormForPdf(
  browserlessKey: string,
  cisUrl: string,
  formattedDate: string,
  listType: string,
  captchaSolution: string
): Promise<{ pdfBuffer: ArrayBuffer | null; success: boolean; error?: string }> {
  console.log(`[scrape-causelist] Phase 2: Submitting form for PDF download`);
  console.log(`[scrape-causelist] Date: ${formattedDate}, ListType: ${listType}, CAPTCHA: ${captchaSolution}`);

  // For PDF download, we use /content with addScriptTag to fill form then check for download link
  // The CIS portal generates PDFs via JavaScript, so we need to capture the download URL
  const contentConfig = {
    url: cisUrl,
    gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
    waitForSelector: { selector: '#captcha', timeout: 10000 },
    addScriptTag: [
      {
        content: `
          // Fill the form
          const pdfRadio = document.getElementById('formatradio2');
          if (pdfRadio) pdfRadio.click();
          
          const dateInput = document.getElementById('causelstdt');
          if (dateInput) dateInput.value = '${formattedDate}';
          
          const listTypeSelect = document.getElementById('causelisttype');
          if (listTypeSelect) listTypeSelect.value = '${listType}';
          
          const captchaInput = document.getElementById('txtCaptcha');
          if (captchaInput) captchaInput.value = '${captchaSolution}';
          
          // Click download button
          const downloadBtn = document.getElementById('btnSearchCauseList');
          if (downloadBtn) downloadBtn.click();
        `
      }
    ],
    waitForTimeout: 5000, // Wait for response
  };

  try {
    const response = await fetch(`https://chrome.browserless.io/content?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contentConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[scrape-causelist] Browserless /content for PDF failed: ${response.status} - ${errorText}`);
      return { pdfBuffer: null, success: false, error: `Browserless error: ${response.status}` };
    }

    const html = await response.text();
    console.log(`[scrape-causelist] Got HTML after form submission: ${html.length} chars`);

    // Check for CAPTCHA errors
    if (html.toLowerCase().includes('invalid captcha') || html.toLowerCase().includes('wrong captcha')) {
      return { pdfBuffer: null, success: false, error: 'Invalid CAPTCHA solution' };
    }

    // Check for no records
    if (html.toLowerCase().includes('no record') || html.toLowerCase().includes('no data')) {
      return { pdfBuffer: null, success: false, error: 'No records found for this date' };
    }

    // Look for download link or PDF URL in the response
    const downloadLinkMatch = html.match(/href=["']([^"']*\.pdf[^"']*)["']/i) ||
                              html.match(/window\.open\(['"]([^'"]*\.pdf[^'"]*)['"]/i) ||
                              html.match(/location\.href\s*=\s*['"]([^'"]*\.pdf[^'"]*)['"]/i);
    
    if (downloadLinkMatch) {
      const pdfUrl = downloadLinkMatch[1].startsWith('http') 
        ? downloadLinkMatch[1] 
        : new URL(downloadLinkMatch[1], cisUrl).toString();
      
      console.log(`[scrape-causelist] Found PDF URL: ${pdfUrl}`);
      
      // Download the PDF
      const pdfResponse = await fetch(pdfUrl, {
        headers: {
          'Referer': cisUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (pdfResponse.ok) {
        const pdfBuffer = await pdfResponse.arrayBuffer();
        console.log(`[scrape-causelist] Downloaded PDF: ${pdfBuffer.byteLength} bytes`);
        return { pdfBuffer, success: true };
      }
    }

    // Alternative: Check for downloadFile element (from screenshot analysis)
    const downloadFileMatch = html.match(/id=["']downloadFile["'][^>]*href=["']([^"']+)["']/i);
    if (downloadFileMatch) {
      const pdfUrl = downloadFileMatch[1].startsWith('http') 
        ? downloadFileMatch[1] 
        : new URL(downloadFileMatch[1], cisUrl).toString();
      
      console.log(`[scrape-causelist] Found downloadFile URL: ${pdfUrl}`);
      
      const pdfResponse = await fetch(pdfUrl, {
        headers: {
          'Referer': cisUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (pdfResponse.ok) {
        const pdfBuffer = await pdfResponse.arrayBuffer();
        console.log(`[scrape-causelist] Downloaded PDF: ${pdfBuffer.byteLength} bytes`);
        return { pdfBuffer, success: true };
      }
    }

    console.log(`[scrape-causelist] No PDF download link found in response`);
    console.log(`[scrape-causelist] HTML snippet: ${html.substring(0, 1500)}`);
    return { pdfBuffer: null, success: false, error: 'PDF download link not found in response' };

  } catch (error) {
    console.error(`[scrape-causelist] Phase 2 PDF error:`, error);
    return { pdfBuffer: null, success: false, error: String(error) };
  }
}

// Parse cause list HTML to extract entries
function parseCauseListHtml(html: string, bench: string, date: string, listType: string): CauseListEntry[] {
  const entries: CauseListEntry[] = [];
  
  console.log('[scrape-causelist] Parsing HTML response...');
  
  // Check for no records
  if (html.includes('No Record Found') || html.includes('no record found') || html.includes('No Data')) {
    console.log('[scrape-causelist] No records found for this date');
    return [];
  }
  
  // Find table rows
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = html.match(tableRowPattern) || [];
  console.log(`[scrape-causelist] Found ${rows.length} table rows`);
  
  let currentCourtNo = '1';
  
  for (const row of rows) {
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }
    
    if (cells.length < 2) continue;
    
    // Skip header rows
    if (cells[0].toLowerCase().includes('sr') || 
        cells[0].toLowerCase().includes('item') ||
        cells[0].toLowerCase().includes('case no')) continue;
    
    // Check for court number header
    const courtMatch = row.match(/Court\s*(?:No\.?)?\s*(\d+)/i);
    if (courtMatch) {
      currentCourtNo = courtMatch[1];
      continue;
    }
    
    const itemNo = parseInt(cells[0]);
    if (isNaN(itemNo) || itemNo <= 0) continue;
    
    const caseNumber = cells[1] || '';
    if (!caseNumber || caseNumber.length < 3) continue;
    
    let petitioner = '';
    let respondent = '';
    let petitionerLawyer = '';
    let respondentLawyer = '';
    
    // Party names (usually in 3rd cell)
    const partyCell = cells[2] || '';
    const vsMatch = partyCell.match(/(.+?)\s*(?:vs?\.?|v\/s|versus)\s*(.+)/i);
    if (vsMatch) {
      petitioner = vsMatch[1].trim().substring(0, 200);
      respondent = vsMatch[2].trim().substring(0, 200);
    } else if (partyCell) {
      petitioner = partyCell.substring(0, 200);
    }
    
    // Lawyers (usually in 4th and 5th cells)
    if (cells.length > 3) petitionerLawyer = (cells[3] || '').substring(0, 100);
    if (cells.length > 4) respondentLawyer = (cells[4] || '').substring(0, 100);
    
    entries.push({
      item_no: itemNo,
      case_number: caseNumber,
      petitioner: petitioner || null,
      respondent: respondent || null,
      petitioner_lawyer: petitionerLawyer || null,
      respondent_lawyer: respondentLawyer || null,
      court_room_no: currentCourtNo,
      court_location: bench,
      list_type: listType,
      date: date,
      status: 'pending',
    });
  }
  
  return entries;
}

// Upload PDF to Supabase Storage
async function uploadPdfToStorage(
  supabase: any,
  pdfBuffer: ArrayBuffer,
  bench: string,
  date: string,
  listType: string
): Promise<{ publicUrl: string | null; filename: string; error?: string }> {
  const filename = `${bench}_${date}_${listType}.pdf`;
  console.log(`[scrape-causelist] Uploading PDF to storage: ${filename}`);
  
  try {
    const { data, error } = await supabase.storage
      .from('causelist-pdfs')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error(`[scrape-causelist] Storage upload error:`, error);
      return { publicUrl: null, filename, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('causelist-pdfs')
      .getPublicUrl(filename);

    console.log(`[scrape-causelist] PDF uploaded: ${urlData.publicUrl}`);
    return { publicUrl: urlData.publicUrl, filename };

  } catch (error) {
    console.error(`[scrape-causelist] Storage upload exception:`, error);
    return { publicUrl: null, filename, error: String(error) };
  }
}

// Log scraper run
async function logScraperRun(
  supabase: any, 
  bench: string, 
  status: string, 
  casesFound: number, 
  errorMessage: string | null, 
  listType: string
): Promise<void> {
  try {
    await supabase.from('scraper_logs').insert({
      bench,
      status,
      cases_found: casesFound,
      error_message: errorMessage,
      list_type: listType,
    });
  } catch (err) {
    console.error('[scrape-causelist] Log error:', err);
  }
}

// Main scraping function with retry logic
async function scrapeWithBrowserless(
  bench: string,
  targetDate: string,
  listType: string,
  format: 'html' | 'pdf',
  browserlessKey: string,
  supabaseUrl: string,
  supabaseKey: string,
  supabase: any
): Promise<{
  success: boolean;
  entries: CauseListEntry[];
  pdfUrl?: string;
  pdfFilename?: string;
  error?: string;
  attempts: number;
  captchaSolution?: string;
  rawHtml?: string;
}> {
  const cisUrl = CIS_URLS[bench];
  if (!cisUrl) {
    return { success: false, entries: [], error: `Invalid bench: ${bench}`, attempts: 0 };
  }

  const formattedDate = formatDateForForm(targetDate);
  const maxAttempts = 3;
  let attempts = 0;
  let lastError = '';

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[scrape-causelist] ========== Attempt ${attempts}/${maxAttempts} ==========`);

    // Phase 1: Get CAPTCHA
    const phase1 = await getPageWithCaptcha(browserlessKey, cisUrl);
    if (phase1.error || !phase1.captchaBase64) {
      lastError = phase1.error || 'Failed to get CAPTCHA';
      console.log(`[scrape-causelist] Phase 1 failed: ${lastError}`);
      continue;
    }

    // Solve CAPTCHA
    const captchaSolution = await solveCaptcha(phase1.captchaBase64, supabaseUrl, supabaseKey);
    if (!captchaSolution) {
      lastError = 'Failed to solve CAPTCHA';
      console.log(`[scrape-causelist] CAPTCHA solve failed`);
      continue;
    }

    // Phase 2: Submit form
    if (format === 'pdf') {
      const phase2 = await submitFormForPdf(browserlessKey, cisUrl, formattedDate, listType, captchaSolution);
      
      if (phase2.error && phase2.error.includes('Invalid CAPTCHA')) {
        lastError = phase2.error;
        console.log(`[scrape-causelist] CAPTCHA was wrong, retrying...`);
        continue;
      }

      if (!phase2.success || !phase2.pdfBuffer) {
        lastError = phase2.error || 'Failed to download PDF';
        console.log(`[scrape-causelist] Phase 2 PDF failed: ${lastError}`);
        continue;
      }

      // Upload PDF to storage
      const uploadResult = await uploadPdfToStorage(
        supabase,
        phase2.pdfBuffer,
        bench,
        targetDate,
        listType === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
      );

      if (uploadResult.error) {
        return {
          success: false,
          entries: [],
          error: `PDF upload failed: ${uploadResult.error}`,
          attempts,
          captchaSolution,
        };
      }

      return {
        success: true,
        entries: [],
        pdfUrl: uploadResult.publicUrl || undefined,
        pdfFilename: uploadResult.filename,
        attempts,
        captchaSolution,
      };

    } else {
      // HTML format
      const phase2 = await submitFormForHtml(browserlessKey, cisUrl, formattedDate, listType, captchaSolution);
      
      if (phase2.error && phase2.error.includes('Invalid CAPTCHA')) {
        lastError = phase2.error;
        console.log(`[scrape-causelist] CAPTCHA was wrong, retrying...`);
        continue;
      }

      if (!phase2.success) {
        lastError = phase2.error || 'Failed to get HTML result';
        console.log(`[scrape-causelist] Phase 2 HTML failed: ${lastError}`);
        continue;
      }

      // Parse HTML for entries
      const entries = parseCauseListHtml(
        phase2.html,
        bench,
        targetDate,
        listType === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
      );

      return {
        success: true,
        entries,
        attempts,
        captchaSolution,
        rawHtml: phase2.html.substring(0, 3000),
      };
    }
  }

  return {
    success: false,
    entries: [],
    error: `Failed after ${maxAttempts} attempts. Last error: ${lastError}`,
    attempts,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const browserlessKey = Deno.env.get('BROWSERLESS_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      action = 'scrape', 
      bench = 'JODHPUR', 
      date, 
      list_type = 'D',
      format = 'html',
    } = await req.json() as ScrapeRequest;
    
    const targetDate = date || getSmartTargetDate();
    
    console.log(`[scrape-causelist] ========================================`);
    console.log(`[scrape-causelist] Action: ${action}, Bench: ${bench}`);
    console.log(`[scrape-causelist] Date: ${targetDate}, List Type: ${list_type}, Format: ${format}`);
    console.log(`[scrape-causelist] ========================================`);

    // Check for Browserless API key
    if (!browserlessKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'BROWSERLESS_API_KEY not configured. Please add it in project secrets.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape using Browserless
    const result = await scrapeWithBrowserless(
      bench,
      targetDate,
      list_type,
      format,
      browserlessKey,
      supabaseUrl,
      supabaseKey,
      supabase
    );

    // Store entries in database if scrape action and HTML format
    if (action === 'scrape' && result.success && result.entries.length > 0) {
      console.log(`[scrape-causelist] Storing ${result.entries.length} entries`);
      
      let inserted = 0;
      let updated = 0;
      
      for (const entry of result.entries) {
        const { data, error } = await supabase
          .from('daily_court_docket')
          .upsert(entry, { 
            onConflict: 'case_number,date,court_room_no',
            ignoreDuplicates: false 
          })
          .select();
        
        if (!error && data) {
          inserted++;
        }
      }
      
      console.log(`[scrape-causelist] Stored: ${inserted} entries`);
    }

    // Log the scraper run
    await logScraperRun(
      supabase,
      bench,
      result.success ? 'success' : 'failed',
      result.entries.length,
      result.error || null,
      list_type === 'D' ? 'DAILY' : 'SUPPLEMENTARY'
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        format,
        message: result.success 
          ? format === 'pdf' 
            ? `PDF downloaded and stored: ${result.pdfFilename}`
            : `Found ${result.entries.length} cases` 
          : result.error,
        entries: result.entries,
        entries_count: result.entries.length,
        pdf_url: result.pdfUrl,
        pdf_filename: result.pdfFilename,
        attempts: result.attempts,
        captcha_solution: result.captchaSolution,
        raw_content_preview: result.rawHtml,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[scrape-causelist] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
