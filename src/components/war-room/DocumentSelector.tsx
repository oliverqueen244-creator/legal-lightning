import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText } from 'lucide-react';
import type { CaseDocument } from '@/types/database';

interface DocumentSelectorProps {
  documents: CaseDocument[];
  selectedDocId: string | null;
  onSelectDoc: (docId: string) => void;
}

export function DocumentSelector({ documents, selectedDocId, onSelectDoc }: DocumentSelectorProps) {
  if (documents.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 p-3 border-b border-border bg-card">
      <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Select value={selectedDocId ?? undefined} onValueChange={onSelectDoc}>
        <SelectTrigger 
          className="w-[200px]" 
          aria-label="Select document to view"
        >
          <SelectValue placeholder="Select document" />
        </SelectTrigger>
        <SelectContent>
          {documents.map((doc) => (
            <SelectItem key={doc.id} value={doc.id}>
              {doc.doc_type || 'Document'} - {new Date(doc.uploaded_at).toLocaleDateString()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
