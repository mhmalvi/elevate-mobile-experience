import { Phone, MessageSquare, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickContactProps {
  phone?: string | null;
  email?: string | null;
  className?: string;
}

export function QuickContact({ phone, email, className }: QuickContactProps) {
  if (!phone && !email) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {phone && (
        <>
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-full bg-success/20 text-success flex items-center justify-center hover:bg-success/30 active:scale-95 transition-all"
            aria-label="Call"
          >
            <Phone className="w-4 h-4" />
          </a>
          <a
            href={`sms:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 active:scale-95 transition-all"
            aria-label="Send SMS"
          >
            <MessageSquare className="w-4 h-4" />
          </a>
        </>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          className="w-9 h-9 rounded-full bg-warning/20 text-warning flex items-center justify-center hover:bg-warning/30 active:scale-95 transition-all"
          aria-label="Send email"
        >
          <Mail className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
