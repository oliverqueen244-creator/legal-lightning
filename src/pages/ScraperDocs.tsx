import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Lock, 
  Globe, 
  Server,
  FileCode,
  Zap
} from "lucide-react";

const ScraperDocs = () => {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">CIS Portal Scraper</h1>
          <p className="text-xl text-muted-foreground">Technical Documentation & Error Analysis</p>
          <Badge variant="outline" className="text-amber-500 border-amber-500">
            Work In Progress
          </Badge>
        </div>

        {/* The Challenge */}
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              The Core Challenge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The Rajasthan High Court CIS Portal uses <strong>session-bound CAPTCHAs</strong> with AJAX-based 
              form submissions. This creates a fundamental challenge for automated scraping:
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <Lock className="h-8 w-8 text-red-500 mb-2" />
                <h4 className="font-semibold">Session-Bound CAPTCHA</h4>
                <p className="text-sm text-muted-foreground">Each browser session gets a unique CAPTCHA tied to server-side cookies</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <Zap className="h-8 w-8 text-yellow-500 mb-2" />
                <h4 className="font-semibold">AJAX Submission</h4>
                <p className="text-sm text-muted-foreground">Form results load dynamically via JavaScript, not page reload</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <Server className="h-8 w-8 text-blue-500 mb-2" />
                <h4 className="font-semibold">ASP.NET ViewState</h4>
                <p className="text-sm text-muted-foreground">Form state is validated server-side using ViewState tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flowchart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Scraping Process Flowchart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[600px] p-6 bg-muted/30 rounded-lg">
                {/* Flow diagram using divs */}
                <div className="flex flex-col items-center gap-4">
                  {/* Step 1 */}
                  <div className="flex items-center gap-4 w-full justify-center">
                    <div className="p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg text-center min-w-[200px]">
                      <Globe className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                      <p className="font-semibold">Load CIS Portal</p>
                      <p className="text-xs text-muted-foreground">Get initial page with CAPTCHA</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <p className="text-xs">Session Created</p>
                    </div>
                  </div>

                  <div className="h-8 w-0.5 bg-border" />

                  {/* Step 2 */}
                  <div className="flex items-center gap-4 w-full justify-center">
                    <div className="p-4 bg-purple-500/20 border border-purple-500/50 rounded-lg text-center min-w-[200px]">
                      <Lock className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                      <p className="font-semibold">Extract CAPTCHA</p>
                      <p className="text-xs text-muted-foreground">Base64 image from page</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <p className="text-xs">Works via Browserless</p>
                    </div>
                  </div>

                  <div className="h-8 w-0.5 bg-border" />

                  {/* Step 3 */}
                  <div className="flex items-center gap-4 w-full justify-center">
                    <div className="p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg text-center min-w-[200px]">
                      <Zap className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                      <p className="font-semibold">Solve CAPTCHA</p>
                      <p className="text-xs text-muted-foreground">Using Gemini Vision API</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <p className="text-xs">~90% accuracy</p>
                    </div>
                  </div>

                  <div className="h-8 w-0.5 bg-border" />

                  {/* Step 4 - THE PROBLEM */}
                  <div className="flex items-center gap-4 w-full justify-center">
                    <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-center min-w-[200px]">
                      <Server className="h-6 w-6 mx-auto mb-2 text-red-500" />
                      <p className="font-semibold">Submit Form</p>
                      <p className="text-xs text-muted-foreground">With solved CAPTCHA</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <p className="text-xs font-bold">SESSION LOST!</p>
                    </div>
                  </div>

                  <div className="h-8 w-0.5 bg-red-500" />

                  {/* Problem explanation */}
                  <Alert variant="destructive" className="max-w-lg">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Session Persistence Issue</AlertTitle>
                    <AlertDescription>
                      Each Browserless HTTP request creates a NEW browser session. The CAPTCHA solved 
                      from Request 1 is invalid in Request 2 because they have different session cookies.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approaches Tried */}
        <Card>
          <CardHeader>
            <CardTitle>Approaches Attempted & Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Approach 1 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">1. Firecrawl with Actions</h3>
                <Badge variant="destructive">Failed</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Used Firecrawl scraping service with action sequences to fill form and click buttons.
              </p>
              <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                <p className="text-sm font-mono text-red-400">
                  Error: Action timeout - form submission did not complete within 30s
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Root cause:</strong> Firecrawl actions execute sequentially but the AJAX response 
                was not captured because content is returned before JavaScript completes.
              </p>
            </div>

            <Separator />

            {/* Approach 2 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">2. Browserless /content + addScriptTag</h3>
                <Badge variant="destructive">Failed</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Used Browserless /content endpoint with injected JavaScript to fill and submit form.
              </p>
              <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                <p className="text-sm font-mono text-red-400">
                  Result: 0 cases returned - received initial form page instead of results
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Root cause:</strong> addScriptTag executes AFTER content is already captured. 
                The AJAX results load after the response is sent.
              </p>
            </div>

            <Separator />

            {/* Approach 3 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">3. Browserless /screenshot with html:true</h3>
                <Badge variant="destructive">Failed</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Attempted to use screenshot endpoint with HTML return option to capture rendered state.
              </p>
              <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                <p className="text-sm font-mono text-red-400">
                  Error: 400 Bad Request - "html must be a string"
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Root cause:</strong> The html:true option is not supported on /screenshot endpoint 
                in the way we attempted to use it.
              </p>
            </div>

            <Separator />

            {/* Approach 4 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">4. Browserless /function (Puppeteer Script)</h3>
                <Badge variant="destructive">Failed</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Wrote full Puppeteer script to run via Browserless /function endpoint.
              </p>
              <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                <p className="text-sm font-mono text-red-400">
                  Error: "module is not defined" - API format incompatibility
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Root cause:</strong> The /function endpoint expects a specific format that differs 
                from standard Puppeteer scripts. Version/API compatibility issue.
              </p>
            </div>

            <Separator />

            {/* Approach 5 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">5. Cookie-based Session Persistence</h3>
                <Badge variant="destructive">Failed</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Extract cookies from first request and pass them to second request.
              </p>
              <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                <p className="text-sm font-mono text-red-400">
                  Error: /scrape endpoint - "cookies must be an array" validation error
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Root cause:</strong> Server-side session cookies are HTTP-only and cannot be 
                accessed via document.cookie. Even if passed, each Browserless request creates a new browser instance.
              </p>
            </div>

            <Separator />

            {/* Approach 6 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">6. ViewState-based POST Request</h3>
                <Badge variant="secondary">Partial</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Extract ASP.NET ViewState and submit form via direct HTTP POST.
              </p>
              <div className="bg-amber-500/10 p-3 rounded border border-amber-500/30">
                <p className="text-sm font-mono text-amber-400">
                  Error: Navigation timeout (30s) - CIS portal slow/blocking
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Status:</strong> Approach is theoretically sound for ASP.NET forms, but the CIS portal 
                validates CAPTCHA against session cookies, not just ViewState.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Technical Requirements */}
        <Card className="border-blue-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              What Actually Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                <h4 className="font-semibold">CAPTCHA Extraction</h4>
                <p className="text-sm text-muted-foreground">Successfully extracting CAPTCHA image as base64 from the portal</p>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                <h4 className="font-semibold">CAPTCHA Solving</h4>
                <p className="text-sm text-muted-foreground">Gemini Vision API solving with ~90% accuracy</p>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                <h4 className="font-semibold">ViewState Extraction</h4>
                <p className="text-sm text-muted-foreground">Successfully parsing ASP.NET hidden fields</p>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                <h4 className="font-semibold">HTML Parsing</h4>
                <p className="text-sm text-muted-foreground">Cause list table parsing and data extraction</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Solution Path */}
        <Card className="border-green-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-500" />
              Recommended Solutions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <Badge>Option 1</Badge>
                  Self-Hosted Puppeteer with WebSocket
                </h4>
                <p className="text-sm text-muted-foreground mt-2">
                  Deploy a persistent server that maintains Puppeteer browser sessions via WebSocket. 
                  This allows all steps (load, extract CAPTCHA, solve, submit) to occur in a single session.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <Badge>Option 2</Badge>
                  Scheduled Cron Job with Session Persistence
                </h4>
                <p className="text-sm text-muted-foreground mt-2">
                  Use a cron job service that supports persistent browser contexts (e.g., Apify, 
                  ScrapingBee with session support) to maintain state between CAPTCHA extraction and form submission.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <Badge>Option 3</Badge>
                  Browser Extension Approach
                </h4>
                <p className="text-sm text-muted-foreground mt-2">
                  Build a browser extension that runs in user's browser, solves CAPTCHA, 
                  and sends data to our backend. Maintains natural session.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Debug Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex gap-4">
                <span className="text-muted-foreground w-24">Dec 5, 2025</span>
                <span>Initial Firecrawl implementation - timeout issues</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-24">Dec 5, 2025</span>
                <span>Switched to Browserless - discovered session issue</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-24">Dec 5, 2025</span>
                <span>Attempted multiple Browserless endpoints</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-24">Dec 5, 2025</span>
                <span>ViewState approach - portal timeouts/rate limiting</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-24">Current</span>
                <span className="text-amber-500">Evaluating persistent session solutions</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm">
          <p>Last updated: December 5, 2025</p>
        </div>
      </div>
    </div>
  );
};

export default ScraperDocs;
