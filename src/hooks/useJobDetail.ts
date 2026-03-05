import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTeam } from '@/hooks/useTeam';
import { supabase } from '@/integrations/supabase/client';
import { compressImages } from '@/lib/utils/imageCompression';
import { Tables } from '@/integrations/supabase/types';

// ---------- Types ----------

type Job = Tables<'jobs'>;
type Client = Tables<'clients'>;
type Quote = Tables<'quotes'>;

/** The shape returned by the joined Supabase query for a single job */
interface JobWithRelations extends Job {
  /** Extra columns that exist in DB but not yet in generated types */
  actual_hours?: number;
  material_costs?: number;
  completed_at?: string | null;
  clients: Pick<Client, 'name' | 'email' | 'phone'> | null;
  quotes: Pick<Quote, 'quote_number' | 'total' | 'subtotal'> | null;
}

export interface VoiceNote {
  url: string;
  duration: number;
  name: string;
}

export interface CostingResult {
  quotedTotal: number;
  labourCost: number;
  materialsCost: number;
  actualCost: number;
  profit: number;
  profitMargin: number;
}

export interface UseJobDetailReturn {
  // Params
  id: string | undefined;

  // State
  job: JobWithRelations | null;
  loading: boolean;
  materialCost: string;
  setMaterialCost: (v: string) => void;
  photos: string[];
  uploading: boolean;
  voiceNotes: VoiceNote[];
  savingMaterials: boolean;
  costing: CostingResult | null;

  // Team helpers
  teamMembers: ReturnType<typeof useTeam>['teamMembers'];

  // Handlers
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeletePhoto: (photoUrl: string) => Promise<void>;
  handleSaveVoiceNote: (audioBlob: Blob, duration: number) => Promise<void>;
  handleDeleteVoiceNote: (name: string) => Promise<void>;
  updateStatus: (status: string) => Promise<void>;
  handleTimeUpdate: (seconds: number) => Promise<void>;
  saveMaterialCost: () => Promise<void>;
  handleDeleteJob: () => Promise<void>;
  createInvoice: () => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}

export function useJobDetail(): UseJobDetailReturn {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { team, teamMembers } = useTeam();

  const [job, setJob] = useState<JobWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [materialCost, setMaterialCost] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [savingMaterials, setSavingMaterials] = useState(false);

  // ---------- Data fetching ----------

  const fetchJob = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('jobs')
      .select('*, clients(name, email, phone), quotes(quote_number, total, subtotal)')
      .eq('id', id)
      .single();

    const jobData = data as unknown as JobWithRelations | null;
    setJob(jobData);
    setMaterialCost(jobData?.material_costs?.toString() || '');
    setLoading(false);
  }, [id]);

  const fetchPhotos = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.storage
      .from('job-photos')
      .list(`${id}`, { limit: 20 });

    if (data && data.length > 0) {
      const urls = data.map(file => {
        const { data: urlData } = supabase.storage
          .from('job-photos')
          .getPublicUrl(`${id}/${file.name}`);
        return urlData.publicUrl;
      });
      setPhotos(urls);
    }
  }, [id]);

  const fetchVoiceNotes = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.storage
      .from('job-voice-notes')
      .list(`${id}`, { limit: 20 });

    if (data && data.length > 0) {
      const notes = data.map(file => {
        const { data: urlData } = supabase.storage
          .from('job-voice-notes')
          .getPublicUrl(`${id}/${file.name}`);
        const durationMatch = file.name.match(/-(\d+)\.webm$/);
        return {
          url: urlData.publicUrl,
          duration: durationMatch ? parseInt(durationMatch[1]) : 0,
          name: file.name,
        };
      });
      setVoiceNotes(notes);
    }
  }, [id]);

  useEffect(() => {
    if (user && id) {
      fetchJob();
      fetchPhotos();
      fetchVoiceNotes();
    }
  }, [user, id, fetchJob, fetchPhotos, fetchVoiceNotes]);

  // ---------- Photo handlers ----------

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    setUploading(true);

    try {
      const compressedFiles = await compressImages(Array.from(files));

      for (const file of compressedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${id}/${fileName}`;

        const { error } = await supabase.storage
          .from('job-photos')
          .upload(filePath, file);

        if (error) {
          toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        }
      }

      await fetchPhotos();
      toast({ title: 'Photos uploaded!' });
    } catch {
      toast({ title: 'Compression failed', description: 'Could not process images', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [id, fetchPhotos, toast]);

  const handleDeletePhoto = useCallback(async (photoUrl: string) => {
    const fileName = photoUrl.split('/').pop();
    if (!fileName || !id) return;

    const { error } = await supabase.storage
      .from('job-photos')
      .remove([`${id}/${fileName}`]);

    if (!error) {
      setPhotos(prev => prev.filter(p => p !== photoUrl));
      toast({ title: 'Photo removed' });
    }
  }, [id, toast]);

  // ---------- Voice note handlers ----------

  const handleSaveVoiceNote = useCallback(async (audioBlob: Blob, duration: number) => {
    if (!id) return;

    const fileName = `${Date.now()}-${duration}.webm`;
    const filePath = `${id}/${fileName}`;

    const { error } = await supabase.storage
      .from('job-voice-notes')
      .upload(filePath, audioBlob, { contentType: 'audio/webm' });

    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      throw error;
    }

    await fetchVoiceNotes();
    toast({ title: 'Voice note saved!' });
  }, [id, fetchVoiceNotes, toast]);

  const handleDeleteVoiceNote = useCallback(async (name: string) => {
    if (!id) return;

    const { error } = await supabase.storage
      .from('job-voice-notes')
      .remove([`${id}/${name}`]);

    if (!error) {
      setVoiceNotes(prev => prev.filter(n => n.name !== name));
      toast({ title: 'Voice note removed' });
    }
  }, [id, toast]);

  // ---------- Job mutation handlers ----------

  const updateStatus = useCallback(async (status: string) => {
    const updates: Record<string, string> = { status };
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from('jobs').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status updated' });
      fetchJob();
    }
  }, [id, toast, fetchJob]);

  const handleTimeUpdate = useCallback(async (seconds: number) => {
    const hours = seconds / 3600;
    await supabase.from('jobs').update({ actual_hours: hours }).eq('id', id);
  }, [id]);

  const saveMaterialCost = useCallback(async () => {
    setSavingMaterials(true);
    const cost = parseFloat(materialCost) || 0;
    const { error } = await supabase.from('jobs').update({ material_costs: cost }).eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Material costs saved' });
    }
    setSavingMaterials(false);
  }, [id, materialCost, toast]);

  const handleDeleteJob = useCallback(async () => {
    const { error } = await supabase.from('jobs').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Job deleted' });
      navigate('/jobs');
    }
  }, [id, toast, navigate]);

  const createInvoice = useCallback(async () => {
    if (!job) return;

    const invoiceNumber = await (async () => {
      const { data, error } = await supabase.rpc('get_next_document_number', { p_document_type: 'invoice' });
      if (error || !data) {
        return `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
      }
      return data as string;
    })();

    const total = job.quotes?.total || 0;
    const subtotal = job.quotes?.subtotal || total / 1.1;
    const gst = total - subtotal;

    const { data: invoice, error } = await supabase.from('invoices').insert({
      user_id: user?.id,
      team_id: team?.id || null,
      client_id: job.client_id,
      job_id: job.id,
      quote_id: job.quote_id,
      invoice_number: invoiceNumber,
      title: job.title,
      description: job.description,
      subtotal,
      gst,
      total,
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    if (job.quote_id) {
      const { data: quoteItems } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', job.quote_id)
        .order('sort_order');

      if (quoteItems && quoteItems.length > 0) {
        const invoiceItems = quoteItems.map((item: Record<string, unknown>, index: number) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total: item.total,
          item_type: item.item_type,
          sort_order: index,
        }));
        await supabase.from('invoice_line_items').insert(invoiceItems);
      }
    }

    await updateStatus('invoiced');
    toast({ title: 'Invoice created!' });
    navigate(`/invoices/${invoice.id}`);
  }, [job, user?.id, team?.id, toast, navigate, updateStatus]);

  // ---------- Costing calculation ----------

  const calculateCosting = useCallback((): CostingResult | null => {
    if (!job?.quotes) return null;

    const quotedTotal = Number(job.quotes.total) || 0;
    const labourHours = job.actual_hours || 0;
    const hourlyRate = 85;
    const labourCost = labourHours * hourlyRate;
    const materialsCost = Number(job.material_costs) || 0;
    const actualCost = labourCost + materialsCost;
    const profit = quotedTotal - actualCost;
    const profitMargin = quotedTotal > 0 ? (profit / quotedTotal) * 100 : 0;

    return {
      quotedTotal,
      labourCost,
      materialsCost,
      actualCost,
      profit,
      profitMargin,
    };
  }, [job]);

  const costing = calculateCosting();

  return {
    id,
    job,
    loading,
    materialCost,
    setMaterialCost,
    photos,
    uploading,
    voiceNotes,
    savingMaterials,
    costing,
    teamMembers,
    handlePhotoUpload,
    handleDeletePhoto,
    handleSaveVoiceNote,
    handleDeleteVoiceNote,
    updateStatus,
    handleTimeUpdate,
    saveMaterialCost,
    handleDeleteJob,
    createInvoice,
    navigate,
  };
}
