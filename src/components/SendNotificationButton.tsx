import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Mail, MessageSquare, Loader2, ChevronDown } from 'lucide-react';

interface SendNotificationButtonProps {
  type: 'quote' | 'invoice';
  id: string;
  recipient: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
  };
  onSent?: () => void;
}

export function SendNotificationButton({ 
  type, 
  id, 
  recipient, 
  onSent 
}: SendNotificationButtonProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleSend = async (method: 'email' | 'sms') => {
    if (method === 'email' && !recipient.email) {
      toast({ 
        title: 'No email address', 
        description: 'This client has no email address on file.',
        variant: 'destructive' 
      });
      return;
    }

    if (method === 'sms' && !recipient.phone) {
      toast({ 
        title: 'No phone number', 
        description: 'This client has no phone number on file.',
        variant: 'destructive' 
      });
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          type,
          id,
          method,
          recipient: {
            email: recipient.email,
            phone: recipient.phone,
            name: recipient.name,
          },
        },
      });

      if (error) throw error;

      // Open the mailto: or sms: link
      if (method === 'email' && data.mailto) {
        window.location.href = data.mailto;
      } else if (method === 'sms' && data.smsUrl) {
        window.location.href = data.smsUrl;
      }

      toast({ 
        title: 'Sent! 📨', 
        description: `${type === 'quote' ? 'Quote' : 'Invoice'} sent via ${method.toUpperCase()}.`
      });

      onSent?.();
    } catch (error: any) {
      console.error('Send notification error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send notification',
        variant: 'destructive' 
      });
    } finally {
      setSending(false);
    }
  };

  const hasEmail = !!recipient.email;
  const hasPhone = !!recipient.phone;

  if (!hasEmail && !hasPhone) {
    return (
      <Button variant="outline" className="w-full" disabled>
        <Send className="w-4 h-4 mr-2" />
        No contact info
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full" disabled={sending}>
          {sending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Send to Client
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48">
        {hasEmail && (
          <DropdownMenuItem onClick={() => handleSend('email')}>
            <Mail className="w-4 h-4 mr-2" />
            Send via Email
          </DropdownMenuItem>
        )}
        {hasPhone && (
          <DropdownMenuItem onClick={() => handleSend('sms')}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Send via SMS
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}