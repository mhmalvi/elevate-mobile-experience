import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, MessageSquare, Loader2 } from 'lucide-react';

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
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

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

    if (method === 'email') {
      setSendingEmail(true);
    } else {
      setSendingSms(true);
    }

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

      // Handle response - check if SMS was sent directly via Twilio
      if (method === 'sms' && data.directSend) {
        toast({ 
          title: 'SMS Sent!', 
          description: 'Your SMS has been delivered successfully.'
        });
      } else if (method === 'email' && data.mailto) {
        window.location.href = data.mailto;
        toast({ 
          title: 'Ready to send!', 
          description: 'Your email app will open now.'
        });
      } else if (method === 'sms' && data.smsUrl) {
        window.location.href = data.smsUrl;
        toast({ 
          title: 'Ready to send!', 
          description: 'Your SMS app will open now.'
        });
      }

      onSent?.();
    } catch (error: any) {
      console.error('Send notification error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send notification',
        variant: 'destructive' 
      });
    } finally {
      setSendingEmail(false);
      setSendingSms(false);
    }
  };

  const hasEmail = !!recipient.email;
  const hasPhone = !!recipient.phone;

  if (!hasEmail && !hasPhone) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled>
          <Mail className="w-4 h-4 mr-2" />
          No Email
        </Button>
        <Button variant="outline" className="flex-1" disabled>
          <MessageSquare className="w-4 h-4 mr-2" />
          No Phone
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button 
        variant={hasEmail ? "default" : "outline"}
        className="flex-1" 
        disabled={sendingEmail || !hasEmail}
        onClick={() => handleSend('email')}
      >
        {sendingEmail ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Mail className="w-4 h-4 mr-2" />
        )}
        Email
      </Button>
      <Button 
        variant={hasPhone ? "default" : "outline"}
        className="flex-1" 
        disabled={sendingSms || !hasPhone}
        onClick={() => handleSend('sms')}
      >
        {sendingSms ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <MessageSquare className="w-4 h-4 mr-2" />
        )}
        SMS
      </Button>
    </div>
  );
}
