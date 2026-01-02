import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, MessageSquare, Loader2, Send } from 'lucide-react';

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
  const [sendingDirectEmail, setSendingDirectEmail] = useState(false);

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
        // Check if on mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
          // On mobile, try to open SMS app
          window.location.href = data.smsUrl;
          toast({
            title: 'Ready to send!',
            description: 'Your SMS app will open now.'
          });
        } else {
          // On desktop, inform user that Twilio isn't configured
          toast({
            title: 'SMS on Desktop',
            description: 'SMS sending requires Twilio integration on desktop. Please configure Twilio in your environment or use a mobile device.',
            variant: 'destructive'
          });
        }
      }

      onSent?.();
    } catch (error: any) {
      console.error('Send notification error:', error);

      // Provide specific error messages
      let errorTitle = 'Error';
      let errorDescription = error.message || 'Failed to send notification';

      // Handle FunctionsHttpError with status code
      if (error.context?.status === 429 || error.message?.includes('429')) {
        errorTitle = 'Monthly Limit Reached';
        errorDescription = `You've reached your monthly ${method === 'sms' ? 'SMS' : 'email'} limit. Please upgrade your subscription plan for more notifications.`;
      } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        errorTitle = 'Authentication error';
        errorDescription = 'Please sign out and sign in again to refresh your session.';
      } else if (error.message?.includes('not configured')) {
        errorTitle = 'Service not configured';
        errorDescription = 'Notification service is not properly configured. Please contact support.';
      } else if (error.message?.includes('rate limit') || error.message?.includes('limit reached')) {
        errorTitle = 'Limit reached';
        errorDescription = error.message || 'You have reached your monthly notification limit. Please upgrade your plan.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive'
      });
    } finally {
      setSendingEmail(false);
      setSendingSms(false);
    }
  };

  const handleDirectEmail = async () => {
    if (!recipient.email) {
      toast({
        title: 'No email address',
        description: 'This client has no email address on file.',
        variant: 'destructive'
      });
      return;
    }

    setSendingDirectEmail(true);

    try {
      console.log('Sending direct email:', { type, id, email: recipient.email });
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type,
          id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
        },
      });

      console.log('Email response:', { data, error });

      if (error) {
        console.error('Email API error:', error);
        throw error;
      }

      toast({
        title: 'Email Sent!',
        description: `${type === 'quote' ? 'Quote' : 'Invoice'} sent directly to ${recipient.email}`
      });

      onSent?.();
    } catch (error: any) {
      console.error('Direct email error (full):', error);
      const errorMessage = error?.message || error?.error_description || 'Unknown error';

      // Provide specific error messages
      let fallbackMessage = `Direct email failed (${errorMessage})`;

      if (errorMessage.includes('rate limit') || errorMessage.includes('limit reached')) {
        fallbackMessage = 'Monthly email limit reached. Opening your email app instead.';
      } else if (errorMessage.includes('not configured')) {
        fallbackMessage = 'Email service not configured. Opening your email app instead.';
      } else if (errorMessage.includes('JWT') || errorMessage.includes('auth')) {
        fallbackMessage = 'Session expired. Opening your email app instead.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        fallbackMessage = 'Network error. Opening your email app instead.';
      }

      // If direct email fails, fall back to mailto
      const subject = encodeURIComponent(`${type === 'quote' ? 'Quote' : 'Invoice'} from TradieMate`);
      const body = encodeURIComponent(`Hi ${recipient.name || 'there'},\n\nPlease find your ${type} attached.\n\nView it online: ${window.location.origin}/${type === 'quote' ? 'q' : 'i'}/${id}\n\nThank you!`);
      window.location.href = `mailto:${recipient.email}?subject=${subject}&body=${body}`;
      toast({
        title: 'Opening email app',
        description: fallbackMessage
      });
    } finally {
      setSendingDirectEmail(false);
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
    <div className="space-y-2">
      {/* Direct Email Button - Primary */}
      {hasEmail && (
        <Button 
          className="w-full" 
          disabled={sendingDirectEmail}
          onClick={handleDirectEmail}
        >
          {sendingDirectEmail ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Send Email Directly
        </Button>
      )}
      
      {/* Secondary options */}
      <div className="flex gap-2">
        <Button 
          variant="outline"
          className="flex-1" 
          disabled={sendingEmail || !hasEmail}
          onClick={() => handleSend('email')}
        >
          {sendingEmail ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Mail className="w-4 h-4 mr-2" />
          )}
          Email App
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
    </div>
  );
}
