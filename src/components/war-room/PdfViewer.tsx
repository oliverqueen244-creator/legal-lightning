import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, RotateCw } from 'lucide-react';

interface PdfViewerProps {
  pdfUrl: string;
  targetPage?: number;
}

export function PdfViewer({ pdfUrl, targetPage = 1 }: PdfViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState(targetPage);
  const [zoom, setZoom] = useState(100);

  // When targetPage changes, update the current page
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  }, [targetPage]);

  // Build PDF URL with page parameter
  const pdfSrc = `${pdfUrl}#page=${currentPage}`;

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div 
        className="flex items-center justify-between p-3 border-b border-border bg-card"
        role="toolbar"
        aria-label="PDF viewer controls"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-medium text-foreground">Case Documents</span>
        </div>
        
        <div className="flex items-center gap-2" role="group" aria-label="Page navigation">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          
          <span className="text-sm text-muted-foreground px-2" aria-live="polite">
            Page {currentPage}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1" role="group" aria-label="Zoom controls">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleResetZoom}
            aria-label="Reset zoom"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      
      {/* PDF Embed */}
      <div className="flex-1 bg-muted/30 overflow-auto">
        <div 
          style={{ 
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            width: zoom > 100 ? `${100 * (100 / zoom)}%` : '100%',
            height: zoom > 100 ? `${100 * (100 / zoom)}%` : '100%',
          }}
        >
          <iframe
            ref={iframeRef}
            src={pdfSrc}
            className="w-full h-full border-0"
            title="Case Document PDF"
            aria-label={`PDF document, page ${currentPage}`}
          />
        </div>
      </div>
    </div>
  );
}
