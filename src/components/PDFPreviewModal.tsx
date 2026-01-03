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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
      console.log('Loading PDF preview for:', { type, id });
      const response = await supabase.functions.invoke('generate-pdf', {
        body: { type, id }
      });

      console.log('PDF response:', {
        error: response.error,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });

      if (response.error) {
        console.error('PDF generation error:', response.error);
        throw response.error;
      }

      if (!response.data || !response.data.html) {
        console.error('PDF response missing HTML:', response.data);
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

  // SECURITY: Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = useMemo(() => {
    if (!html) return null;
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['html', 'head', 'body', 'style', 'div', 'p', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'br', 'hr', 'strong', 'em', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['class', 'style', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan'],
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
    if (!sanitizedHtml) return;
    setDownloading(true);

    try {
      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px'; // A4 width in pixels at 96 DPI
      // SECURITY: Use sanitized HTML to prevent XSS
      container.innerHTML = sanitizedHtml;
      document.body.appendChild(container);

      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(container);

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${documentNumber}.pdf`);
      toast({ title: 'PDF downloaded', description: `${documentNumber}.pdf saved successfully` });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({ title: 'Download failed', description: 'Please try printing instead.', variant: 'destructive' });
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
          ) : sanitizedHtml ? (
            <div className="bg-background rounded-lg shadow-lg overflow-hidden">
              <iframe
                ref={iframeRef}
                srcDoc={sanitizedHtml}
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
