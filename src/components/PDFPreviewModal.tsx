import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, Loader2, Download, X, Printer } from 'lucide-react';
import DOMPurify from 'dompurify';

interface PDFPreviewModalProps {
  type: 'quote' | 'invoice';
  id: string;
  documentNumber: string;
}

export function PDFPreviewModal({ type, id, documentNumber }: PDFPreviewModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('generate-pdf', {
        body: { type, id }
      });

      if (response.error) {
        console.error('PDF generation error:', response.error);
        throw response.error;
      }

      if (!response.data || !response.data.html) {
        throw new Error('PDF generation failed - no HTML returned');
      }

      setHtml(response.data.html);
    } catch (error) {
      console.error('PDF preview error (full):', error);

      // Provide specific error messages based on error type
      let errorTitle = 'Error loading preview';
      let errorDescription = 'Unknown error';

      if (error instanceof Error) {
        errorDescription = error.message;

        // Detect specific error types
        if (error.message.includes('JWT') || error.message.includes('auth')) {
          errorTitle = 'Authentication error';
          errorDescription = 'Please sign out and sign in again to refresh your session.';
        } else if (error.message.includes('not found') || error.message.includes('404')) {
          errorTitle = 'Document not found';
          errorDescription = 'The document could not be found. It may have been deleted.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorTitle = 'Network error';
          errorDescription = 'Please check your internet connection and try again.';
        } else if (error.message.includes('service not configured')) {
          errorTitle = 'Service configuration error';
          errorDescription = 'PDF generation is not properly configured. Please contact support.';
        }
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive'
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !html) {
      loadPreview();
    }
  };

  // SECURITY: Sanitize HTML for contexts where scripts CAN execute (print, download).
  // The iframe preview uses sandbox="allow-same-origin" (no allow-scripts), so scripts
  // cannot execute there — raw HTML is safe in the iframe.
  const sanitizedHtml = useMemo(() => {
    if (!html) return null;
    return DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: true,
      ALLOWED_TAGS: [
        'html', 'head', 'body', 'style', 'meta', 'title', 'link',
        'div', 'p', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'br', 'hr',
        'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a'
      ],
      ALLOWED_ATTR: [
        'class', 'style', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan',
        'href', 'target', 'rel', 'charset', 'name', 'content', 'lang'
      ],
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  const handlePrint = () => {
    if (!sanitizedHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // SECURITY: Write sanitized HTML instead of raw HTML
      printWindow.document.write(sanitizedHtml);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: { type, id, format: 'pdf' },
      });

      if (error) throw error;

      // Handle Blob response
      if (data instanceof Blob) {
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${documentNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: 'PDF downloaded', description: `${documentNumber}.pdf saved successfully` });
      } else {
        // Fallback if supabase returns it differently (e.g. ArrayBuffer)
        const blob = new Blob([data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${documentNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: 'PDF downloaded', description: `${documentNumber}.pdf saved successfully` });
      }

    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Please try printing instead.',
        variant: 'destructive'
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="flex-1">
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle>Preview {documentNumber}</DrawerTitle>
              <DrawerDescription>
                Review before sending to client
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-auto p-4 bg-muted/30 min-h-[50vh] max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : html ? (
            <div className="bg-background rounded-lg shadow-lg overflow-hidden">
              <iframe
                ref={iframeRef}
                srcDoc={html}
                className="w-full h-[500px] border-0"
                title={`Preview ${documentNumber}`}
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Unable to load preview
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
          <div className="flex gap-2 w-full">
            <Button onClick={handleDownloadPDF} disabled={!sanitizedHtml || loading || downloading} className="flex-1">
              {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!sanitizedHtml || loading}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
