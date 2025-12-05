import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Globe, 
  Download, 
  Eye, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  ExternalLink
} from 'lucide-react';

interface CauseListEntry {
  item_no: number;
  case_number: string;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  court_room_no: string;
  court_location: string;
  list_type: string;
  date: string;
}

interface ScrapeResult {
  success: boolean;
  message?: string;
  error?: string;
  entries?: CauseListEntry[];
  entries_count?: number;
  pdf_links?: string[];
  raw_content_preview?: string;
  needs_firecrawl?: boolean;
  inserted?: number;
  updated?: number;
}

export function CauseListScraper() {
  const [bench, setBench] = useState<'JAIPUR' | 'JODHPUR'>('JAIPUR');
  const [courtNo, setCourtNo] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customUrl, setCustomUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [previewEntries, setPreviewEntries] = useState<CauseListEntry[]>([]);

  const handleScrape = async (preview: boolean = false) => {
    setIsLoading(true);
    setResult(null);
    setPreviewEntries([]);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-causelist', {
        body: {
          action: preview ? 'preview' : 'scrape',
          bench,
          date,
          court_no: courtNo,
          url: customUrl || undefined,
        },
      });

      if (error) throw error;

      setResult(data);
      
      if (data.entries) {
        setPreviewEntries(data.entries);
      }

      if (data.success) {
        toast.success(data.message || 'Scrape completed successfully');
      } else {
        toast.error(data.error || 'Scrape failed');
      }
    } catch (error: any) {
      console.error('Scrape error:', error);
      setResult({ success: false, error: error.message });
      toast.error('Failed to scrape cause list');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Cause List Scraper
          </CardTitle>
          <CardDescription>
            Scrape cause lists from the Rajasthan High Court website. Cases will be automatically matched to lawyers based on their aliases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Bench</Label>
              <Select value={bench} onValueChange={(v) => setBench(v as 'JAIPUR' | 'JODHPUR')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JAIPUR">Jaipur Bench</SelectItem>
                  <SelectItem value="JODHPUR">Jodhpur Bench</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Court No.</Label>
              <Input
                type="text"
                value={courtNo}
                onChange={(e) => setCourtNo(e.target.value)}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Custom URL (optional)</Label>
              <Input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://hcraj.nic.in/..."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => handleScrape(true)} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Preview
            </Button>
            <Button 
              onClick={() => handleScrape(false)} 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Scrape & Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              Scrape Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.needs_firecrawl && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Firecrawl Required</AlertTitle>
                <AlertDescription>
                  Please connect Firecrawl in your workspace settings to enable web scraping.
                  Go to Workspace Settings → Integrations → Connect Firecrawl.
                </AlertDescription>
              </Alert>
            )}

            {result.message && (
              <Alert variant={result.success ? "default" : "destructive"}>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}

            {result.error && !result.needs_firecrawl && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}

            {/* Stats */}
            {result.success && (
              <div className="flex gap-4 flex-wrap">
                <Badge variant="secondary" className="text-sm">
                  {result.entries_count || 0} entries found
                </Badge>
                {result.inserted !== undefined && (
                  <Badge variant="default" className="text-sm bg-green-500">
                    {result.inserted} inserted
                  </Badge>
                )}
                {result.updated !== undefined && (
                  <Badge variant="outline" className="text-sm">
                    {result.updated} updated
                  </Badge>
                )}
                {result.pdf_links && result.pdf_links.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {result.pdf_links.length} PDF links
                  </Badge>
                )}
              </div>
            )}

            {/* PDF Links */}
            {result.pdf_links && result.pdf_links.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Available PDF Links
                </h4>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="space-y-1">
                    {result.pdf_links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline truncate"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        {link}
                      </a>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Preview Entries */}
            {previewEntries.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Parsed Entries</h4>
                <ScrollArea className="h-64 border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Item</TableHead>
                        <TableHead>Case Number</TableHead>
                        <TableHead>Petitioner Lawyer</TableHead>
                        <TableHead>Respondent Lawyer</TableHead>
                        <TableHead className="w-20">Court</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewEntries.map((entry, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{entry.item_no}</TableCell>
                          <TableCell className="font-mono text-xs">{entry.case_number}</TableCell>
                          <TableCell>{entry.petitioner_lawyer || '-'}</TableCell>
                          <TableCell>{entry.respondent_lawyer || '-'}</TableCell>
                          <TableCell>{entry.court_room_no}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            {/* Raw Content Preview */}
            {result.raw_content_preview && (
              <div className="space-y-2">
                <h4 className="font-medium">Raw Content Preview</h4>
                <ScrollArea className="h-40 border rounded-md p-2">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {result.raw_content_preview}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. <strong>Scrape:</strong> Fetches cause list from hcraj.nic.in using Firecrawl</p>
          <p>2. <strong>Parse:</strong> Extracts case numbers, item numbers, and lawyer names</p>
          <p>3. <strong>Import:</strong> Inserts entries into the docket database</p>
          <p>4. <strong>Auto-match:</strong> The system automatically matches cases to lawyers based on their registered aliases</p>
        </CardContent>
      </Card>
    </div>
  );
}
