import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Upload, ChevronDown, ChevronUp, FileText, Check, X } from 'lucide-react';
import { useDocumentUpload } from '@/hooks/useDocumentManagement';
import { useFormDirtyState } from '@/contexts/FormDirtyContext';
import type { DocumentType, DocumentLanguage, DocumentFormat, DocumentLegibility, DocumentUploadMetadata } from '@/types/documents';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * SAFE PWA AUTO-UPDATE — Form Dirty Tracking Integration
 * 
 * This panel tracks dirty state to prevent PWA updates during file selection.
 */

interface WarRoomUploadPanelProps {
  docketId: string;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'PETITION', label: 'Petition' },
  { value: 'REPLY', label: 'Reply' },
  { value: 'REJOINDER', label: 'Rejoinder' },
  { value: 'ORDER', label: 'Order' },
  { value: 'ANNEXURES', label: 'Annexures' },
  { value: 'NOTES', label: 'Notes' },
];

const LANGUAGES: { value: DocumentLanguage; label: string }[] = [
  { value: 'EN', label: 'English' },
  { value: 'HI', label: 'Hindi' },
  { value: 'MIXED', label: 'Mixed' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const FORMATS: { value: DocumentFormat; label: string }[] = [
  { value: 'TYPED', label: 'Typed' },
  { value: 'SCANNED', label: 'Scanned' },
  { value: 'HANDWRITTEN', label: 'Handwritten' },
];

const LEGIBILITY: { value: DocumentLegibility; label: string }[] = [
  { value: 'CLEAR', label: 'Clear' },
  { value: 'AVERAGE', label: 'Average' },
  { value: 'POOR', label: 'Poor' },
];

export function WarRoomUploadPanel({ docketId }: WarRoomUploadPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [metadata, setMetadata] = useState<DocumentUploadMetadata>({
    document_type: 'PETITION',
    language: 'EN',
    format: 'TYPED',
    legibility: 'CLEAR',
  });

  const { uploadDocument, uploading, progress } = useDocumentUpload(docketId);
  
  // SAFE PWA UPDATE: Track form dirty state
  const { setDirty, setClean } = useFormDirtyState(`warroom-upload-${docketId}`);
  
  // Mark dirty when file is selected
  useEffect(() => {
    if (selectedFile) {
      setDirty();
    } else {
      setClean();
    }
  }, [selectedFile, setDirty, setClean]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setIsOpen(true);
    } else {
      toast.error('Please select a PDF file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else if (file) {
      toast.error('Please select a PDF file');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    try {
      await uploadDocument(selectedFile, metadata);
      toast.success('Document uploaded successfully', {
        description: 'It will be reviewed before becoming available.',
      });
      // Reset form and mark clean
      setSelectedFile(null);
      setClean(); // SAFE PWA UPDATE: Mark clean on successful upload
      setIsOpen(false);
      setMetadata({
        document_type: 'PETITION',
        language: 'EN',
        format: 'TYPED',
        legibility: 'CLEAR',
      });
    } catch {
      // Error already handled in hook
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setClean(); // SAFE PWA UPDATE: Mark clean on explicit clear
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-3 border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                Upload Document
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  SENIOR
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3 space-y-3">
            {/* Drop Zone - Compact */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-3 text-center transition-colors',
                isDragging && 'border-primary bg-primary/5',
                selectedFile && 'border-court-success bg-court-success/5',
                !isDragging && !selectedFile && 'border-muted-foreground/30 hover:border-primary/50'
              )}
            >
              {selectedFile ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-court-success shrink-0" />
                    <span className="text-sm truncate">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleClear}
                    disabled={uploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <p className="text-sm text-muted-foreground">
                    Drop PDF here or <span className="text-primary underline">browse</span>
                  </p>
                </label>
              )}
            </div>

            {/* Metadata Fields - 2x2 Grid */}
            {selectedFile && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={metadata.document_type}
                    onValueChange={(v) => setMetadata({ ...metadata, document_type: v as DocumentType })}
                    disabled={uploading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={metadata.language}
                    onValueChange={(v) => setMetadata({ ...metadata, language: v as DocumentLanguage })}
                    disabled={uploading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value} className="text-xs">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={metadata.format}
                    onValueChange={(v) => setMetadata({ ...metadata, format: v as DocumentFormat })}
                    disabled={uploading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={metadata.legibility}
                    onValueChange={(v) => setMetadata({ ...metadata, legibility: v as DocumentLegibility })}
                    disabled={uploading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Legibility" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEGIBILITY.map((l) => (
                        <SelectItem key={l.value} value={l.value} className="text-xs">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload Button with Progress */}
                {uploading ? (
                  <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                      Uploading... {progress}%
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedFile}
                    className="w-full h-8 text-sm"
                    variant="gold"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Upload for Review
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
