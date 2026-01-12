import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Timer } from '@/components/ui/timer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, safeNumber } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, Calendar, Receipt, Camera, Loader2, Image, Play, CheckCircle, TrendingUp, TrendingDown, Trash2, ArrowLeft, Briefcase, Edit } from 'lucide-react';
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
      .select('*, clients(name, email, phone), quotes(quote_number, total, subtotal)')
      .eq('id', id)
      .single();
    setJob(data);
    setMaterialCost(data?.material_costs?.toString() || '');
    setLoading(false);
  };

  const fetchPhotos = async () => {
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

  const handleDeleteJob = async () => {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Job deleted' });
      navigate('/jobs');
    }
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

  const calculateCosting = () => {
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
  };

  const costing = calculateCosting();

  if (loading || !job) {
    return (
      <MobileLayout showNav={false}>
        <div className="min-h-screen scrollbar-hide">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative px-4 pt-8 pb-6">
              <button
                onClick={() => navigate('/jobs')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Jobs</span>
              </button>

              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Job Details</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Loading...</h1>
            </div>
          </div>

          <div className="p-4 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigate('/jobs')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Jobs</span>
              </button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/jobs/${id}/edit`)}
                className="rounded-full bg-card/50 backdrop-blur-md border-border/50 shadow-sm hover:bg-card/80 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Edit className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Job #{job.id.slice(0, 8)}</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">{job.title}</h1>
            {job.clients && (
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="text-sm">{job.clients.name}</span>
              </div>
            )}
            <div className="mt-3">
              <StatusBadge status={job.status} />
            </div>
          </div>
        </div>

        <div className="px-4 space-y-6 animate-fade-in pb-48 safe-bottom">
          {/* Workflow Quick Actions */}
          <div className="grid grid-cols-1 gap-3">
            {job.status === 'approved' && (
              <Button onClick={() => updateStatus('scheduled')} className="h-16 text-lg rounded-2xl shadow-glow gradient-primary">
                <Calendar className="w-6 h-6 mr-2" />
                Schedule Job
              </Button>
            )}
            {job.status === 'scheduled' && (
              <Button onClick={() => updateStatus('in_progress')} className="h-16 text-lg rounded-2xl shadow-glow gradient-primary">
                <Play className="w-6 h-6 mr-2" />
                Start Job
              </Button>
            )}
            {job.status === 'in_progress' && (
              <Button onClick={() => updateStatus('completed')} className="h-16 text-lg rounded-2xl shadow-glow gradient-primary">
                <CheckCircle className="w-6 h-6 mr-2" />
                Complete Job
              </Button>
            )}
            {job.status === 'completed' && (
              <Button onClick={createInvoice} className="h-16 text-lg rounded-2xl shadow-glow gradient-primary">
                <Receipt className="w-6 h-6 mr-2" />
                Create Invoice
              </Button>
            )}
          </div>

          {/* Time Tracker */}
          {(job.status === 'in_progress' || job.status === 'scheduled' || job.status === 'approved') && (
            <Timer
              initialSeconds={Math.round((job.actual_hours || 0) * 3600)}
              onTimeUpdate={handleTimeUpdate}
              className="animate-scale-in"
            />
          )}

          {/* Location & Schedule Card */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="font-bold text-lg">Work Details</h3>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm space-y-4">
              {job.site_address && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{job.site_address}</p>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.site_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary font-bold hover:underline mt-1 inline-block"
                    >
                      Get Directions →
                    </a>
                  </div>
                </div>
              )}

              {job.scheduled_date && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(job.scheduled_date), 'EEEE, d MMMM yyyy')}
                  </p>
                </div>
              )}

              {job.quotes && (
                <button
                  onClick={() => navigate(`/quotes/${job.quote_id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors"
                >
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Link: Quote {job.quotes.quote_number}</span>
                  <span className="ml-auto font-bold">${safeNumber(job.quotes.total).toLocaleString()}</span>
                </button>
              )}
            </div>
          </div>

          {/* Map Embed */}
          {job.site_address && (
            <div className="rounded-2xl overflow-hidden border border-border/40 shadow-premium-lg h-48 animate-fade-in delay-100">
              <iframe
                title="Job Location"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(job.site_address)}`}
              />
            </div>
          )}

          {/* Photo Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                <h3 className="font-bold text-lg">Photos</h3>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button size="sm" variant="outline" asChild disabled={uploading} className="rounded-full shadow-sm hover:shadow-glow-sm">
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Camera className="w-4 h-4 mr-1 text-primary" />}
                    Upload
                  </span>
                </Button>
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-video group overflow-hidden rounded-2xl shadow-sm hover:shadow-premium-lg transition-all duration-300">
                    <img
                      src={photo}
                      alt={`Job photo ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="w-10 h-10 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-card/80 backdrop-blur-sm rounded-2xl border border-dashed border-border/60">
                <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Image className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">No job site photos yet</p>
              </div>
            )}
          </div>

          {/* Costing Section */}
          {costing && (job.status === 'completed' || job.status === 'invoiced') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1.5 h-6 bg-success rounded-full" />
                <h3 className="font-bold text-lg text-success">Profitability</h3>
              </div>
              <div className="p-5 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-success/10 rounded-full blur-2xl" />
                <div className="space-y-3 text-sm relative z-10">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Quoted Total</span>
                    <span className="font-bold">${costing.quotedTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-destructive/80 font-medium">
                    <span>Labour ({job.actual_hours?.toFixed(1) || 0}h × $85)</span>
                    <span>-${costing.labourCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-destructive/80 font-medium">
                    <span>Material Costs</span>
                    <span>-${costing.materialsCost.toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-border/60 flex justify-between items-end">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estimated Profit</span>
                      <div className="flex items-center gap-2">
                        {costing.profit >= 0 ? (
                          <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-success" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
                            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                          </div>
                        )}
                        <span className={cn("text-2xl font-black tracking-tight", costing.profit >= 0 ? 'text-success' : 'text-destructive')}>
                          ${costing.profit.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-black ring-1 ring-inset",
                      costing.profit >= 0 ? "bg-success/5 text-success ring-success/20" : "bg-destructive/5 text-destructive ring-destructive/20"
                    )}>
                      {costing.profitMargin.toFixed(0)}% MARGIN
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Fields Grid */}
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Update Status</Label>
                <Select value={job.status} onValueChange={updateStatus}>
                  <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/40">
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

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Material Costs ($)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={materialCost}
                    onChange={(e) => setMaterialCost(e.target.value)}
                    placeholder="0.00"
                    className="h-12 rounded-xl bg-background/50"
                  />
                  <Button onClick={saveMaterialCost} disabled={savingMaterials} className="px-6 h-12 rounded-xl">
                    {savingMaterials ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {(job.description || job.notes) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1.5 h-6 bg-muted-foreground/40 rounded-full" />
                <h3 className="font-bold text-lg">Job Notes</h3>
              </div>
              <div className="p-5 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
                {job.description && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">Description</h4>
                    <p className="text-foreground/90 leading-relaxed font-medium">{job.description}</p>
                  </div>
                )}
                {job.notes && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">Internal Notes</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed italic">"{job.notes}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="pt-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-destructive/60 hover:text-destructive hover:bg-destructive/10 h-12 rounded-xl">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Job Record
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All job data, tracked hours, and photos will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteJob} className="bg-destructive text-destructive-foreground rounded-xl">Delete Forever</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}