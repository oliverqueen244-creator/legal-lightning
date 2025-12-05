import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, TestTube, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TestResult {
  success: boolean;
  message: string;
  entries_count: number;
  entries?: Array<{
    item_no: number;
    case_number: string;
    petitioner: string;
    respondent: string;
    petitioner_lawyer: string;
    respondent_lawyer: string;
    court_room_no: string;
  }>;
  raw_response_preview?: string;
  captcha_extracted?: boolean;
  captcha_solution?: string;
  attempts: number;
}

export function CISPortalTest() {
  const [bench, setBench] = useState<'JAIPUR' | 'JODHPUR'>('JODHPUR');
  const [listType, setListType] = useState<'D' | 'S'>('D');
  const [date, setDate] = useState(format(new Date(), 'dd/MM/yyyy'));
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      toast.info('Testing CIS Portal scraper...', {
        description: 'Fetching CAPTCHA and solving with Gemini...'
      });

      const { data, error } = await supabase.functions.invoke('scrape-cis-portal', {
        body: {
          bench,
          date,
          list_type: listType,
          test_mode: true // Don't store in database, just return results
        }
      });

      if (error) {
        throw error;
      }

      setResult(data as TestResult);

      if (data.success) {
        toast.success('Scrape successful!', {
          description: `Found ${data.entries_count} entries in ${data.attempts} attempt(s)`
        });
      } else {
        toast.error('Scrape failed', {
          description: data.message || 'Unknown error'
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Error', { description: errMsg });
      setResult({
        success: false,
        message: errMsg,
        entries_count: 0,
        attempts: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          CIS Portal Scraper Test
        </CardTitle>
        <CardDescription>
          Test the CIS portal scraper with Gemini CAPTCHA solving. This uses test mode (data won't be stored).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Bench</Label>
            <Select value={bench} onValueChange={(v) => setBench(v as 'JAIPUR' | 'JODHPUR')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JODHPUR">Jodhpur</SelectItem>
                <SelectItem value="JAIPUR">Jaipur</SelectItem>
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
                <SelectItem value="D">Daily</SelectItem>
                <SelectItem value="S">Supplementary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date (DD/MM/YYYY)</Label>
            <Input 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              placeholder="05/12/2025"
            />
          </div>
        </div>

        <Button 
          onClick={handleTest} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing... (solving CAPTCHA)
            </>
          ) : (
            <>
              <TestTube className="mr-2 h-4 w-4" />
              Test Scraper
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                {result.message}
              </span>
              <Badge variant="outline">
                {result.attempts} attempt(s)
              </Badge>
            </div>

            {result.entries && result.entries.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Sample Entries ({result.entries_count} total)
                </h4>
                <div className="max-h-60 overflow-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-left">Case Number</th>
                        <th className="p-2 text-left">Petitioner</th>
                        <th className="p-2 text-left">Respondent</th>
                        <th className="p-2 text-left">Pet. Lawyer</th>
                        <th className="p-2 text-left">Res. Lawyer</th>
                        <th className="p-2 text-left">Court</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.entries.slice(0, 10).map((entry, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{entry.item_no}</td>
                          <td className="p-2 font-mono">{entry.case_number}</td>
                          <td className="p-2 truncate max-w-32">{entry.petitioner}</td>
                          <td className="p-2 truncate max-w-32">{entry.respondent}</td>
                          <td className="p-2 truncate max-w-32">{entry.petitioner_lawyer}</td>
                          <td className="p-2 truncate max-w-32">{entry.respondent_lawyer}</td>
                          <td className="p-2">{entry.court_room_no}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CAPTCHA Debug Info */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={result.captcha_extracted ? "default" : "destructive"}>
                CAPTCHA: {result.captcha_extracted ? 'Extracted' : 'Not Found'}
              </Badge>
              {result.captcha_solution && (
                <Badge variant="outline">
                  Solution: {result.captcha_solution}
                </Badge>
              )}
            </div>

            {result.raw_response_preview && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Raw HTML Preview (first 5000 chars)
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded-md overflow-auto max-h-40 whitespace-pre-wrap">
                  {result.raw_response_preview}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
