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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  ExternalLink,
  FileDown
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
  format: 'html' | 'pdf';
  message?: string;
  error?: string;
  entries?: CauseListEntry[];
  entries_count?: number;
  pdf_url?: string;
  pdf_filename?: string;
  attempts?: number;
  captcha_solution?: string;
  raw_content_preview?: string;
}

export function CauseListScraper() {
  const [bench, setBench] = useState<'JAIPUR' | 'JODHPUR'>('JAIPUR');
  const [listType, setListType] = useState<'D' | 'S'>('D');
  const [format, setFormat] = useState<'html' | 'pdf'>('html');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
          list_type: listType,
          format,
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
      setResult({ success: false, format, error: error.message });
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
            Scrape cause lists from the Rajasthan High Court CIS portal using Browserless automation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <Label>List Type</Label>
              <Select value={listType} onValueChange={(v) => setListType(v as 'D' | 'S')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">Daily Cause List</SelectItem>
                  <SelectItem value="S">Supplementary Cause List</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>Output Format</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'html' | 'pdf')} className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="html" id="format-html" />
                  <Label htmlFor="format-html" className="cursor-pointer">HTML (Parse Data)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="format-pdf" />
                  <Label htmlFor="format-pdf" className="cursor-pointer">PDF (Archive)</Label>
                </div>
              </RadioGroup>
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
              ) : format === 'pdf' ? (
                <FileDown className="h-4 w-4 mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {format === 'pdf' ? 'Download PDF' : 'Scrape & Import'}
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
            {result.message && (
              <Alert variant={result.success ? "default" : "destructive"}>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}

            {result.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}

            {/* Stats */}
            {result.success && (
              <div className="flex gap-4 flex-wrap">
                <Badge variant="secondary" className="text-sm">
                  Format: {result.format?.toUpperCase()}
                </Badge>
                {result.attempts && (
                  <Badge variant="outline" className="text-sm">
                    {result.attempts} attempt(s)
                  </Badge>
                )}
                {result.format === 'html' && (
                  <Badge variant="secondary" className="text-sm">
                    {result.entries_count || 0} entries found
                  </Badge>
                )}
                {result.captcha_solution && (
                  <Badge variant="outline" className="text-sm font-mono">
                    CAPTCHA: {result.captcha_solution}
                  </Badge>
                )}
              </div>
            )}

            {/* PDF Download Link */}
            {result.pdf_url && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Downloaded PDF
                </h4>
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{result.pdf_filename}</p>
                    <p className="text-sm text-muted-foreground">Stored in causelist-pdfs bucket</p>
                  </div>
                  <a
                    href={result.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open PDF
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Preview Entries (HTML format) */}
            {previewEntries.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Parsed Entries ({previewEntries.length})</h4>
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
                <h4 className="font-medium">Raw HTML Preview</h4>
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
          <p>1. <strong>Browserless:</strong> Automates browser to navigate to CIS portal</p>
          <p>2. <strong>CAPTCHA:</strong> Extracts and solves CAPTCHA using AI (up to 3 retries)</p>
          <p>3. <strong>HTML Mode:</strong> Parses cause list table and imports to database</p>
          <p>4. <strong>PDF Mode:</strong> Downloads PDF and stores in causelist-pdfs bucket</p>
          <p>5. <strong>Auto-match:</strong> System matches cases to lawyers based on aliases</p>
        </CardContent>
      </Card>
    </div>
  );
}
