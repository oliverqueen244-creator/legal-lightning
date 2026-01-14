/**
 * CaseExportPanel Component
 * 
 * UI for lawyer-initiated case exports.
 * DEFAULT: Export today's cases only (one-click)
 * OPTIONAL: Custom date range when explicitly selected
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  AlertCircle,
  Calendar,
  Loader2,
  Info,
  CalendarDays,
  CalendarRange
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
import { useLawyerCaseNotes } from '@/hooks/useLawyerCaseNotes';
import { useExportAudit } from '@/hooks/useExportAudit';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { exportCases } from '@/lib/exportGenerators';
import type { ExportFormat, ExportType, ExportDateMode } from '@/types/export';
import { EXPORT_FOOTER, NOTES_DISCLAIMER } from '@/types/export';

export function CaseExportPanel() {
  const { canExport, reason, isAdmin } = useCanExportCases();
  const { isOnline, blockIfOffline } = useNetworkStatus();
  const { logExport, isLogging } = useExportAudit();
  
  // Date mode: 'today' (default) or 'range'
  const [dateMode, setDateMode] = useState<ExportDateMode>('today');
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>();
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf-a4');
  const [exportType] = useState<ExportType>('profile');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStage, setExportStage] = useState<string>('');
  
  const { data, isLoading, error, hasData, refetch, caseFingerprints, isValidRange } = useCaseExport({
    dateMode,
    dateRangeStart,
    dateRangeEnd,
  });
  
  // Fetch stored notes for cases
  const { notes: storedNotes, isLoading: notesLoading } = useLawyerCaseNotes(caseFingerprints);
  
  // Merge stored notes into export data
  const dataWithNotes = useMemo(() => {
    if (!data) return null;
    
    return {
      ...data,
      groups: data.groups.map(group => ({
        ...group,
        cases: group.cases.map(caseItem => ({
          ...caseItem,
          lawyerNotes: storedNotes.get(caseItem.caseFingerprint) || '',
        })),
      })),
    };
  }, [data, storedNotes]);
  
  const handleExport = useCallback(async () => {
    // Block if offline
    if (blockIfOffline('export cases')) {
      return;
    }
    
    // Validate date range if in range mode
    if (dateMode === 'range' && (!dateRangeStart || !dateRangeEnd)) {
      toast.error('Invalid date range', {
        description: 'Please select both start and end dates.',
      });
      return;
    }
    
    if (!dataWithNotes || !hasData) {
      toast.error(dateMode === 'today' 
        ? 'No cases available for today\'s export.' 
        : 'No cases available for the selected date range.'
      );
      return;
    }
    
    setIsExporting(true);
    
    try {
      setExportStage('Preparing export...');
      
      await exportCases(dataWithNotes, selectedFormat, setExportStage);
      
      setExportStage('Logging audit...');
      
      // Log the export for audit
      await logExport({
        exportType,
        exportFormat: selectedFormat,
        casesExported: dataWithNotes.totalCases,
        dateRangeStart: dateMode === 'today' ? new Date() : dateRangeStart,
        dateRangeEnd: dateMode === 'today' ? new Date() : dateRangeEnd,
      });
      
      toast.success('Export completed', {
        description: `${dataWithNotes.totalCases} cases exported as ${selectedFormat.toUpperCase()}`,
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
  }, [dataWithNotes, hasData, selectedFormat, exportType, dateMode, dateRangeStart, dateRangeEnd, blockIfOffline, logExport]);
  
  // Clear date range when switching to today mode
  useEffect(() => {
    if (dateMode === 'today') {
      setDateRangeStart(undefined);
      setDateRangeEnd(undefined);
    }
  }, [dateMode]);
  
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
  
  const formattedToday = format(new Date(), 'dd MMM yyyy');
  const isRangeValid = dateMode === 'today' || (dateRangeStart && dateRangeEnd);
  const isDataLoading = isLoading || notesLoading;
  
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
        
        {/* Date Mode Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Export Scope</Label>
          <RadioGroup
            value={dateMode}
            onValueChange={(v) => setDateMode(v as ExportDateMode)}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="today"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                dateMode === 'today' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem value="today" id="today" />
              <CalendarDays className="h-4 w-4" />
              <div>
                <div className="font-medium">Today</div>
                <div className="text-xs text-muted-foreground">{formattedToday}</div>
              </div>
            </Label>
            
            <Label
              htmlFor="range"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                dateMode === 'range' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem value="range" id="range" />
              <CalendarRange className="h-4 w-4" />
              <div>
                <div className="font-medium">Custom Range</div>
                <div className="text-xs text-muted-foreground">Select dates</div>
              </div>
            </Label>
          </RadioGroup>
        </div>
        
        {/* Date Range Pickers - Only shown for range mode */}
        {dateMode === 'range' && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-dashed">
            <Label className="text-sm font-medium text-muted-foreground">Select Date Range</Label>
            <div className="flex flex-wrap gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRangeStart && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRangeStart ? format(dateRangeStart, 'dd MMM yyyy') : 'From Date'}
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
                  <Button 
                    variant="outline" 
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRangeEnd && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRangeEnd ? format(dateRangeEnd, 'dd MMM yyyy') : 'To Date'}
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
            </div>
            
            {!isRangeValid && (
              <p className="text-xs text-amber-600">Please select both start and end dates to proceed.</p>
            )}
          </div>
        )}
        
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
          
          {isDataLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading case data...
            </div>
          ) : !isRangeValid ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Select a valid date range to see available cases.
              </AlertDescription>
            </Alert>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error instanceof Error && error.message === 'Invalid date range' 
                  ? 'Invalid date range. Please check your selection.'
                  : 'Failed to load cases. Please try again.'}
              </AlertDescription>
            </Alert>
          ) : !hasData ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {dateMode === 'today' 
                  ? 'No cases available for today\'s export.'
                  : 'No cases found for the selected date range.'}
              </AlertDescription>
            </Alert>
          ) : dataWithNotes && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Lawyer</span>
                <span className="font-medium">{dataWithNotes.lawyerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Cases</span>
                <Badge variant="secondary">{dataWithNotes.totalCases}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Court Groups</span>
                <Badge variant="outline">{dataWithNotes.groups.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Export Scope</span>
                <Badge variant="outline">
                  {dateMode === 'today' 
                    ? formattedToday 
                    : `${format(dateRangeStart!, 'dd MMM yyyy')} → ${format(dateRangeEnd!, 'dd MMM yyyy')}`}
                </Badge>
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
          disabled={!hasData || isExporting || isLogging || !isOnline || !isRangeValid}
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
              {dateMode === 'today' 
                ? `Export Today's Cases (${dataWithNotes?.totalCases || 0})`
                : `Export ${dataWithNotes?.totalCases || 0} Cases`}
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
