import { useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type DocumentType = 'invoice' | 'quote';

interface PrintDocumentConfig {
  documentType: DocumentType;
  documentId: string;
}

interface PrintDocumentResult {
  printing: boolean;
  handlePrint: () => Promise<void>;
}

/** DOMPurify configuration shared across all print paths */
const SANITIZE_CONFIG: DOMPurify.Config = {
  WHOLE_DOCUMENT: true,
  ALLOWED_TAGS: [
    'html', 'head', 'body', 'style', 'meta', 'title', 'link',
    'div', 'p', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a',
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan',
    'href', 'target', 'rel', 'charset', 'name', 'content', 'lang',
  ],
  ALLOW_DATA_ATTR: false,
};

/**
 * Shared hook for printing invoices/quotes via the generate-pdf edge function.
 * Calls the function, sanitizes the returned HTML with DOMPurify, and opens
 * a print window.
 */
export function usePrintDocument({
  documentType,
  documentId,
}: PrintDocumentConfig): PrintDocumentResult {
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);

  const handlePrint = useCallback(async () => {
    setPrinting(true);
    try {
      const response = await supabase.functions.invoke('generate-pdf', {
        body: { type: documentType, id: documentId },
      });

      if (response.error) throw response.error;

      const sanitizedHtml = DOMPurify.sanitize(
        response.data.html,
        SANITIZE_CONFIG,
      );

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(sanitizedHtml);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Error generating PDF',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPrinting(false);
    }
  }, [documentType, documentId, toast]);

  return { printing, handlePrint };
}
