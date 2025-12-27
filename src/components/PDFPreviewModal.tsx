import { useState } from 'react';
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
import { Eye, Loader2, Download, X } from 'lucide-react';

interface PDFPreviewModalProps {
  type: 'quote' | 'invoice';
  id: string;
  documentNumber: string;
}

export function PDFPreviewModal({ type, id, documentNumber }: PDFPreviewModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('generate-pdf', {
        body: { type, id }
      });
      
      if (response.error) throw response.error;
      setHtml(response.data.html);
    } catch (error) {
      console.error('PDF preview error:', error);
      toast({ title: 'Error loading preview', description: 'Please try again.', variant: 'destructive' });
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

  const handlePrint = () => {
    if (!html) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
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
                srcDoc={html}
                className="w-full h-[500px] border-0"
                title={`Preview ${documentNumber}`}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Unable to load preview
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
          <Button onClick={handlePrint} disabled={!html || loading}>
            <Download className="w-4 h-4 mr-2" />
            Download / Print
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
