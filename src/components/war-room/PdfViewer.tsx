import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText } from 'lucide-react';

interface PdfViewerProps {
  pdfUrl: string;
  targetPage?: number;
}

export function PdfViewer({ pdfUrl, targetPage = 1 }: PdfViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState(targetPage);

  // When targetPage changes, update the iframe src with page parameter
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  }, [targetPage]);

  // Build PDF URL with page parameter
  const pdfSrc = `${pdfUrl}#page=${currentPage}`;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">Case Documents</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* PDF Embed */}
      <div className="flex-1 bg-muted/30">
        <iframe
          ref={iframeRef}
          src={pdfSrc}
          className="w-full h-full border-0"
          title="Case Document PDF"
        />
      </div>
    </div>
  );
}
