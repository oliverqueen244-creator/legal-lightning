import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DocumentType,
  DocumentLanguage,
  DocumentFormat,
  DocumentLegibility,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_LANGUAGE_LABELS,
  DOCUMENT_FORMAT_LABELS,
  DOCUMENT_LEGIBILITY_LABELS,
  DocumentUploadMetadata,
} from '@/types/documents';

interface DocumentUploadFormProps {
  docketId: string;
  onUpload: (file: File, metadata: DocumentUploadMetadata) => Promise<{ success: boolean } | void>;
  uploading?: boolean;
}

export function DocumentUploadForm({ docketId, onUpload, uploading }: DocumentUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<DocumentUploadMetadata>({
    document_type: 'PETITION',
    language: 'UNKNOWN',
    format: 'TYPED',
    legibility: 'CLEAR',
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        toast.error('Only PDF files are accepted');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        toast.error('Only PDF files are accepted');
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      await onUpload(selectedFile, metadata);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success('Document uploaded - pending Senior review');
    } catch (error) {
      toast.error('Upload failed');
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display tracking-wide">
          <Upload className="h-5 w-5 text-primary" />
          Document Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Drop Zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-foreground font-medium mb-2">
              Drag & drop PDF here
            </p>
            <p className="text-sm text-muted-foreground">
              Or click to select file
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg glass-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearFile}>
              Change
            </Button>
          </div>
        )}

        {/* Metadata Form */}
        {selectedFile && (
          <div className="grid grid-cols-2 gap-4">
            {/* Document Type */}
            <div className="space-y-2">
              <Label htmlFor="doc-type">Document Type *</Label>
              <Select
                value={metadata.document_type}
                onValueChange={(value: DocumentType) =>
                  setMetadata({ ...metadata, document_type: value })
                }
              >
                <SelectTrigger id="doc-type" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">Language *</Label>
              <Select
                value={metadata.language}
                onValueChange={(value: DocumentLanguage) =>
                  setMetadata({ ...metadata, language: value })
                }
              >
                <SelectTrigger id="language" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {(Object.keys(DOCUMENT_LANGUAGE_LABELS) as DocumentLanguage[]).map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {DOCUMENT_LANGUAGE_LABELS[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label htmlFor="format">Format *</Label>
              <Select
                value={metadata.format}
                onValueChange={(value: DocumentFormat) =>
                  setMetadata({ ...metadata, format: value })
                }
              >
                <SelectTrigger id="format" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {(Object.keys(DOCUMENT_FORMAT_LABELS) as DocumentFormat[]).map((fmt) => (
                    <SelectItem key={fmt} value={fmt}>
                      {DOCUMENT_FORMAT_LABELS[fmt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Legibility */}
            <div className="space-y-2">
              <Label htmlFor="legibility">Legibility *</Label>
              <Select
                value={metadata.legibility}
                onValueChange={(value: DocumentLegibility) =>
                  setMetadata({ ...metadata, legibility: value })
                }
              >
                <SelectTrigger id="legibility" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {(Object.keys(DOCUMENT_LEGIBILITY_LABELS) as DocumentLegibility[]).map((leg) => (
                    <SelectItem key={leg} value={leg}>
                      {DOCUMENT_LEGIBILITY_LABELS[leg]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Warning for handwritten/poor legibility */}
        {selectedFile && (metadata.format === 'HANDWRITTEN' || metadata.legibility === 'POOR') && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-court-warning/10 border border-court-warning/30">
            <AlertCircle className="h-5 w-5 text-court-warning flex-shrink-0" />
            <p className="text-sm text-court-warning">
              {metadata.format === 'HANDWRITTEN' && metadata.legibility === 'POOR'
                ? 'Handwritten document with poor legibility - Senior review strongly recommended'
                : metadata.format === 'HANDWRITTEN'
                ? 'Handwritten documents may require extra review time'
                : 'Poor legibility noted - ensure document is readable'}
            </p>
          </div>
        )}

        {/* Submit Button */}
        {selectedFile && (
          <Button
            variant="gold"
            className="w-full min-h-touch"
            onClick={handleSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 animate-pulse" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload for Review
              </>
            )}
          </Button>
        )}

        {/* Status Note */}
        <p className="text-xs text-muted-foreground text-center">
          Documents are marked as "Pending Senior Review" until approved
        </p>
      </CardContent>
    </Card>
  );
}
