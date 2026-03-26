import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface BrandingFormData {
  logo_url: string;
  logo_position: 'left' | 'center' | 'right';
  show_logo_on_documents: boolean;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  accent_color: string;
  email_header_color: string;
  email_footer_text: string;
  email_signature: string;
  document_header_style: 'gradient' | 'solid' | 'minimal';
  default_quote_terms: string;
  default_invoice_terms: string;
  document_footer_text: string;
}

const DEFAULT_BRANDING: BrandingFormData = {
  logo_url: '',
  logo_position: 'left',
  show_logo_on_documents: true,
  primary_color: '#3b82f6',
  secondary_color: '#1d4ed8',
  text_color: '#1a1a1a',
  accent_color: '#3b82f6',
  email_header_color: '#3b82f6',
  email_footer_text: '',
  email_signature: '',
  document_header_style: 'gradient',
  default_quote_terms: '',
  default_invoice_terms: '',
  document_footer_text: 'Thank you for your business!',
};

export function useBranding() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['branding', user?.id],
    queryFn: async (): Promise<BrandingFormData> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) return DEFAULT_BRANDING;

      return {
        logo_url: data.logo_url || '',
        logo_position: (data.logo_position as 'left' | 'center' | 'right') || 'left',
        show_logo_on_documents: data.show_logo_on_documents ?? true,
        primary_color: data.primary_color || '#3b82f6',
        secondary_color: data.secondary_color || '#1d4ed8',
        text_color: data.text_color || '#1a1a1a',
        accent_color: data.accent_color || '#3b82f6',
        email_header_color: data.email_header_color || '#3b82f6',
        email_footer_text: data.email_footer_text || '',
        email_signature: data.email_signature || '',
        document_header_style: (data.document_header_style as 'gradient' | 'solid' | 'minimal') || 'gradient',
        default_quote_terms: data.default_quote_terms || '',
        default_invoice_terms: data.default_invoice_terms || '',
        document_footer_text: data.document_footer_text || 'Thank you for your business!',
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useSaveBranding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (form: BrandingFormData) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('branding_settings')
        .upsert({
          user_id: user.id,
          ...form,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      toast({
        title: 'Branding saved',
        description: 'Your branding settings have been updated.',
        className: 'bg-success/10 border-success/20 text-success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
