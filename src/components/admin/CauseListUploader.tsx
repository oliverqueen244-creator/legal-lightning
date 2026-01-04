import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Calendar as CalendarIcon, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  progress?: number;
}

export function CauseListUploader() {
  const { isOnline } = useNetworkStatus();
  const [file, setFile] = useState<File | null>(null);
  const [bench, setBench] = useState<string>('');
  const [listType, setListType] = useState<string>('');
  const [listDate, setListDate] = useState<Date | undefined>(new Date());
  const [courtNo, setCourtNo] = useState<string>('');
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      
      // Validate file size (20MB max)
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 20MB.');
        return;
      }
      
      setFile(selectedFile);
      setUploadState({ status: 'idle' });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/html': ['.html', '.htm'],
    },
    maxFiles: 1,
    disabled: !isOnline,
  });

  const handleUpload = async () => {
    if (!file || !bench || !listType || !listDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!isOnline) {
      toast.error('Cannot upload while offline');
      return;
    }

    setUploadState({ status: 'uploading', message: 'Uploading file...' });

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bench', bench);
      formData.append('list_type', listType);
      formData.append('list_date', format(listDate, 'yyyy-MM-dd'));
      if (courtNo) {
        formData.append('court_no', courtNo);
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Call edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-causelist`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadState({ 
        status: 'success', 
        message: `Causelist uploaded successfully. ID: ${result.causelist_id}` 
      });
      toast.success('Causelist uploaded and queued for processing');
      
      // Reset form
      setFile(null);
      setBench('');
      setListType('');
      setCourtNo('');
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadState({ status: 'error', message });
      toast.error(message);
    }
  };

  const isFormValid = file && bench && listType && listDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Causelist
        </CardTitle>
        <CardDescription>
          Upload PDF or HTML causelist files directly for processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Offline Warning */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">
              Upload unavailable while offline
            </span>
          </div>
        )}

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            !isOnline && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-10 w-10 text-muted-foreground" />
            {file ? (
              <div className="space-y-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {isDragActive
                    ? 'Drop the file here...'
                    : 'Drag & drop PDF or HTML file, or click to select'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Maximum file size: 20MB
                </p>
              </>
            )}
          </div>
        </div>

        {/* Metadata Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bench *</Label>
            <Select value={bench} onValueChange={setBench}>
              <SelectTrigger>
                <SelectValue placeholder="Select bench" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JAIPUR">Jaipur</SelectItem>
                <SelectItem value="JODHPUR">Jodhpur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>List Type *</Label>
            <Select value={listType} onValueChange={setListType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="SUPPLEMENTARY">Supplementary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>List Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !listDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {listDate ? format(listDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={listDate}
                  onSelect={setListDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Court Number (optional)</Label>
            <Input
              placeholder="e.g., 1, 2, DB-I"
              value={courtNo}
              onChange={(e) => setCourtNo(e.target.value)}
            />
          </div>
        </div>

        {/* HTML Upload Info */}
        <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground">
          <p><strong>HTML Causelists:</strong> All cases are parsed directly from the table structure with 90% confidence. Lawyer matching happens automatically after parsing.</p>
          <p className="mt-1"><strong>PDF Causelists:</strong> Text is extracted first, then processed through AI for lawyer-specific parsing.</p>
        </div>

        {/* Status Message */}
        {uploadState.status !== 'idle' && (
          <div
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg',
              uploadState.status === 'uploading' && 'bg-primary/10 text-primary',
              uploadState.status === 'success' && 'bg-green-500/10 text-green-600',
              uploadState.status === 'error' && 'bg-destructive/10 text-destructive'
            )}
          >
            {uploadState.status === 'uploading' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {uploadState.status === 'success' && (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {uploadState.status === 'error' && (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{uploadState.message}</span>
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!isFormValid || !isOnline || uploadState.status === 'uploading'}
          className="w-full"
        >
          {uploadState.status === 'uploading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Causelist
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
