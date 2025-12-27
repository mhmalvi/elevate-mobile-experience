import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Timer } from '@/components/ui/timer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, Calendar, Receipt, Camera, DollarSign, Loader2, X, Image } from 'lucide-react';
import { format } from 'date-fns';

const JOB_STATUSES = ['quoted', 'approved', 'scheduled', 'in_progress', 'completed', 'invoiced'] as const;

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [materialCost, setMaterialCost] = useState('');
  const [savingMaterials, setSavingMaterials] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchJob();
      fetchPhotos();
    }
  }, [user, id]);

  const fetchJob = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, clients(name, email, phone), quotes(quote_number, total)')
      .eq('id', id)
      .single();
    setJob(data);
    setMaterialCost(data?.material_costs?.toString() || '');
    setLoading(false);
  };

  const fetchPhotos = async () => {
    // List photos from job-photos bucket
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
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    setUploading(true);
    
    for (const file of Array.from(files)) {
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
    toast({ title: 'Photos uploaded! 📸' });
    setUploading(false);
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    const fileName = photoUrl.split('/').pop();
    if (!fileName || !id) return;

    const { error } = await supabase.storage
      .from('job-photos')
      .remove([`${id}/${fileName}`]);

    if (!error) {
      setPhotos(photos.filter(p => p !== photoUrl));
      toast({ title: 'Photo removed' });
    }
  };

  const updateStatus = async (status: string) => {
    const updates: any = { status };
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from('jobs').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status updated' });
      fetchJob();
    }
  };

  const handleTimeUpdate = async (seconds: number) => {
    const hours = seconds / 3600;
    await supabase.from('jobs').update({ actual_hours: hours }).eq('id', id);
  };

  const saveMaterialCost = async () => {
    setSavingMaterials(true);
    const cost = parseFloat(materialCost) || 0;
    const { error } = await supabase.from('jobs').update({ material_costs: cost }).eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Material costs saved' });
    }
    setSavingMaterials(false);
  };

  const createInvoice = async () => {
    if (!job) return;
    
    const invoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const total = job.quotes?.total || 0;
    const subtotal = total / 1.1;
    const gst = total - subtotal;
    
    const { data: invoice, error } = await supabase.from('invoices').insert({
      user_id: user?.id,
      client_id: job.client_id,
      job_id: job.id,
      quote_id: job.quote_id,
      invoice_number: invoiceNumber,
      title: job.title,
      description: job.description,
      subtotal,
      gst,
      total,
      status: 'draft',
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await updateStatus('invoiced');
      toast({ title: 'Invoice created! 🎉' });
      navigate(`/invoices/${invoice.id}`);
    }
  };

  if (loading || !job) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title="Job" showBack backPath="/jobs" />
        <div className="p-4 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <PageHeader title="Job Details" showBack backPath="/jobs" />
      
      <div className="p-4 space-y-6 animate-fade-in pb-32">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">{job.title}</h2>
            <StatusBadge status={job.status} />
          </div>
          {job.clients && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              {job.clients.name}
            </div>
          )}
        </div>

        {/* Status Selector */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={job.status} onValueChange={updateStatus}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time Tracker */}
        {(job.status === 'in_progress' || job.status === 'scheduled' || job.status === 'approved') && (
          <Timer 
            initialSeconds={Math.round((job.actual_hours || 0) * 3600)} 
            onTimeUpdate={handleTimeUpdate}
          />
        )}

        {/* Details */}
        <div className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 space-y-3">
          {job.site_address && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span className="text-foreground">{job.site_address}</span>
            </div>
          )}
          {job.scheduled_date && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{format(new Date(job.scheduled_date), 'EEEE, d MMMM yyyy')}</span>
            </div>
          )}
          {job.quotes && (
            <button 
              onClick={() => navigate(`/quotes/${job.quote_id}`)}
              className="flex items-center gap-3 text-sm text-primary hover:underline"
            >
              <Receipt className="w-4 h-4" />
              Quote {job.quotes.quote_number} - ${Number(job.quotes.total).toLocaleString()}
            </button>
          )}
          {job.actual_hours > 0 && (
            <div className="flex items-center gap-3 text-sm text-success">
              <DollarSign className="w-4 h-4" />
              {job.actual_hours.toFixed(2)} hours tracked
            </div>
          )}
        </div>

        {/* Material Costs */}
        <div className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 space-y-3">
          <Label className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Material Costs
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              value={materialCost}
              onChange={(e) => setMaterialCost(e.target.value)}
              placeholder="0.00"
              className="h-11"
            />
            <Button onClick={saveMaterialCost} disabled={savingMaterials} className="px-6">
              {savingMaterials ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>

        {/* Job Photos */}
        <div className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Job Photos
            </Label>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={uploading}
              />
              <Button size="sm" variant="outline" asChild disabled={uploading}>
                <span>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Camera className="w-4 h-4 mr-1" />}
                  Add Photos
                </span>
              </Button>
            </label>
          </div>
          
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square group">
                  <img 
                    src={photo} 
                    alt={`Job photo ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo)}
                    className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No photos yet</p>
            </div>
          )}
        </div>

        {/* Description */}
        {job.description && (
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Description</h3>
            <p className="text-sm text-muted-foreground">{job.description}</p>
          </div>
        )}

        {/* Notes */}
        {job.notes && (
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Notes</h3>
            <p className="text-sm text-muted-foreground">{job.notes}</p>
          </div>
        )}

        {/* Actions */}
        {job.status === 'completed' && (
          <Button onClick={createInvoice} className="w-full h-12 shadow-premium">
            <Receipt className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        )}
      </div>
    </MobileLayout>
  );
}
