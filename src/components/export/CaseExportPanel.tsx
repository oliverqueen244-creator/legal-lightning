/**
 * CaseExportPanel Component
 * 
 * UI for lawyer-initiated case exports.
 * Supports PDF (A4/Legal), CSV, and Excel formats.
 */

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  AlertCircle,
  Calendar,
  Loader2,
  CheckCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useCaseExport, useCanExportCases } from '@/hooks/useCaseExport';
import { useExportAudit } from '@/hooks/useExportAudit';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { exportCases } from '@/lib/exportGenerators';
import type { ExportFormat, ExportType } from '@/types/export';
import { EXPORT_FOOTER, NOTES_DISCLAIMER } from '@/types/export';

export function CaseExportPanel() {
  const { canExport, reason, isAdmin } = useCanExportCases();
  const { isOnline, blockIfOffline } = useNetworkStatus();
  const { logExport, isLogging } = useExportAudit();
  
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>();
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf-a4');
  const [exportType] = useState<ExportType>('profile');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStage, setExportStage] = useState<string>('');
  
  const { data, isLoading, error, hasData, refetch } = useCaseExport({
    dateRangeStart,
    dateRangeEnd,
  });
  
  const handleExport = useCallback(async () => {
    // Block if offline
    if (blockIfOffline('export cases')) {
      return;
    }
    
    if (!data || !hasData) {
      toast.error('No cases available for export');
      return;
    }
    
    setIsExporting(true);
    
    try {
      setExportStage('Preparing export...');
      
      await exportCases(data, selectedFormat, setExportStage);
      
      setExportStage('Logging audit...');
      
      // Log the export for audit
      await logExport({
        exportType,
        exportFormat: selectedFormat,
        casesExported: data.totalCases,
        dateRangeStart,
        dateRangeEnd,
      });
      
      toast.success('Export completed', {
        description: `${data.totalCases} cases exported as ${selectedFormat.toUpperCase()}`,
      });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please retry.', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
      setExportStage('');
    }
  }, [data, hasData, selectedFormat, exportType, dateRangeStart, dateRangeEnd, blockIfOffline, logExport]);
  
  // Forbidden role check
  if (!canExport) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Export Not Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{reason || 'You do not have permission to export cases.'}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Export Case Record
        </CardTitle>
        <CardDescription>
          Generate a professional export of your case history for profiles, CVs, or empanelment.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Offline Warning */}
        {!isOnline && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection required</AlertTitle>
            <AlertDescription>
              Export requires an internet connection. Please connect to proceed.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Date Range Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Date Range (Optional)</Label>
          <div className="flex flex-wrap gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRangeStart ? format(dateRangeStart, 'dd MMM yyyy') : 'Start Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarPicker
                  mode="single"
                  selected={dateRangeStart}
                  onSelect={setDateRangeStart}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <span className="self-center text-muted-foreground">to</span>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRangeEnd ? format(dateRangeEnd, 'dd MMM yyyy') : 'End Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarPicker
                  mode="single"
                  selected={dateRangeEnd}
                  onSelect={setDateRangeEnd}
                  disabled={(date) => dateRangeStart ? date < dateRangeStart : false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            {(dateRangeStart || dateRangeEnd) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setDateRangeStart(undefined);
                  setDateRangeEnd(undefined);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Export Format</Label>
          <RadioGroup
            value={selectedFormat}
            onValueChange={(v) => setSelectedFormat(v as ExportFormat)}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="pdf-a4"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                selectedFormat === 'pdf-a4' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem value="pdf-a4" id="pdf-a4" />
              <FileText className="h-4 w-4" />
              <div>
                <div className="font-medium">PDF (A4)</div>
                <div className="text-xs text-muted-foreground">Standard paper size</div>
              </div>
            </Label>
            
            <Label
              htmlFor="pdf-legal"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                selectedFormat === 'pdf-legal' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem value="pdf-legal" id="pdf-legal" />
              <FileText className="h-4 w-4" />
              <div>
                <div className="font-medium">PDF (Legal)</div>
                <div className="text-xs text-muted-foreground">Larger format</div>
              </div>
            </Label>
            
            <Label
              htmlFor="csv"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                selectedFormat === 'csv' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem value="csv" id="csv" />
              <FileSpreadsheet className="h-4 w-4" />
              <div>
                <div className="font-medium">CSV</div>
                <div className="text-xs text-muted-foreground">Universal format</div>
              </div>
            </Label>
            
            <Label
              htmlFor="excel"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                selectedFormat === 'excel' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem value="excel" id="excel" />
              <FileSpreadsheet className="h-4 w-4" />
              <div>
                <div className="font-medium">Excel</div>
                <div className="text-xs text-muted-foreground">Spreadsheet format</div>
              </div>
            </Label>
          </RadioGroup>
        </div>
        
        <Separator />
        
        {/* Data Summary */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Export Summary</Label>
          
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading case data...
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load cases. Please try again.
              </AlertDescription>
            </Alert>
          ) : !hasData ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No cases found for the selected criteria.
              </AlertDescription>
            </Alert>
          ) : data && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Lawyer</span>
                <span className="font-medium">{data.lawyerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Cases</span>
                <Badge variant="secondary">{data.totalCases}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Court Groups</span>
                <Badge variant="outline">{data.groups.length}</Badge>
              </div>
            </div>
          )}
        </div>
        
        {/* Notes Disclaimer */}
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
            {NOTES_DISCLAIMER}
          </AlertDescription>
        </Alert>
        
        {/* Export Button */}
        <Button
          onClick={handleExport}
          disabled={!hasData || isExporting || isLogging || !isOnline}
          className="w-full"
          size="lg"
        >
          {isExporting || isLogging ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {exportStage || 'Exporting...'}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export {data?.totalCases || 0} Cases
            </>
          )}
        </Button>
        
        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground">
          {EXPORT_FOOTER}
        </p>
      </CardContent>
    </Card>
  );
}
