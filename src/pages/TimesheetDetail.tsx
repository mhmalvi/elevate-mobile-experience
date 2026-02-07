import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useTeam } from '@/hooks/useTeam';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Clock,
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  Briefcase,
  Calendar,
  Coffee,
  Plus,
  Minus,
} from 'lucide-react';
import { format, parseISO, addDays, isSameDay } from 'date-fns';

interface TimesheetEntry {
  id?: string;
  timesheet_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  hours: number;
  job_id: string | null;
  description: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
}

export default function TimesheetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canManageTeam, teamMembers } = useTeam();
  const { toast } = useToast();

  const [timesheet, setTimesheet] = useState<any>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user && id) {
      fetchTimesheet();
      fetchJobs();
    }
  }, [user, id]);

  const fetchTimesheet = async () => {
    const { data, error } = await (supabase as any)
      .from('timesheets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: 'Error loading timesheet', description: error.message, variant: 'destructive' });
      navigate('/timesheets');
      return;
    }

    setTimesheet(data);
    setNotes(data.notes || '');

    // Fetch entries
    const { data: entryData, error: entryError } = await (supabase as any)
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', id)
      .order('entry_date', { ascending: true });

    if (entryError) {
      console.error('Error fetching entries:', entryError);
    }

    // Build 7-day entry grid (Mon-Sun)
    const weekStart = parseISO(data.week_starting);
    const existingEntries = entryData || [];
    const weekEntries: TimesheetEntry[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = existingEntries.find((e: any) => e.entry_date === dateStr);

      if (existing) {
        weekEntries.push({
          id: existing.id,
          timesheet_id: id!,
          entry_date: dateStr,
          start_time: existing.start_time || '',
          end_time: existing.end_time || '',
          break_minutes: existing.break_minutes || 0,
          hours: Number(existing.hours) || 0,
          job_id: existing.job_id || null,
          description: existing.description || '',
        });
      } else {
        weekEntries.push({
          timesheet_id: id!,
          entry_date: dateStr,
          start_time: '',
          end_time: '',
          break_minutes: 0,
          hours: 0,
          job_id: null,
          description: '',
        });
      }
    }

    setEntries(weekEntries);
    setLoading(false);
  };

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('id, title, status')
      .eq('user_id', user?.id || '')
      .is('deleted_at', null)
      .in('status', ['approved', 'scheduled', 'in_progress', 'completed'])
      .order('created_at', { ascending: false })
      .limit(50);

    setJobs(data || []);
  };

  const totalHours = useMemo(() => {
    return entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  }, [entries]);

  const isEditable = timesheet?.status === 'draft' || timesheet?.status === 'rejected';
  const isOwnerOrAdmin = canManageTeam;
  const canApprove = isOwnerOrAdmin && timesheet?.status === 'submitted' && timesheet?.member_id !== user?.id;

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: any) => {
    setEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate hours from start/end times
      if ((field === 'start_time' || field === 'end_time' || field === 'break_minutes') &&
          updated[index].start_time && updated[index].end_time) {
        const [sh, sm] = updated[index].start_time.split(':').map(Number);
        const [eh, em] = updated[index].end_time.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        const breakMins = Number(updated[index].break_minutes) || 0;
        if (endMins > startMins) {
          updated[index].hours = Math.max(0, (endMins - startMins - breakMins) / 60);
          updated[index].hours = Math.round(updated[index].hours * 100) / 100;
        }
      }

      return updated;
    });
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);

    try {
      // Upsert entries
      for (const entry of entries) {
        if (entry.hours === 0 && !entry.start_time && !entry.description) {
          // Skip empty entries, but delete if they exist in DB
          if (entry.id) {
            await (supabase as any).from('timesheet_entries').delete().eq('id', entry.id);
          }
          continue;
        }

        if (entry.id) {
          await (supabase as any).from('timesheet_entries').update({
            start_time: entry.start_time || null,
            end_time: entry.end_time || null,
            break_minutes: entry.break_minutes,
            hours: entry.hours,
            job_id: entry.job_id || null,
            description: entry.description || null,
            updated_at: new Date().toISOString(),
          }).eq('id', entry.id);
        } else {
          const { data } = await (supabase as any).from('timesheet_entries').insert({
            timesheet_id: id,
            entry_date: entry.entry_date,
            start_time: entry.start_time || null,
            end_time: entry.end_time || null,
            break_minutes: entry.break_minutes,
            hours: entry.hours,
            job_id: entry.job_id || null,
            description: entry.description || null,
          }).select().single();

          if (data) {
            entry.id = data.id;
          }
        }
      }

      // Update timesheet totals
      await (supabase as any).from('timesheets').update({
        total_hours: totalHours,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      toast({ title: 'Timesheet saved' });
    } catch (error) {
      toast({ title: 'Error saving', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }

    setSaving(false);
  };

  const handleSubmit = async () => {
    await handleSave();
    const { error } = await (supabase as any).from('timesheets').update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error submitting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet submitted for approval' });
      setTimesheet((prev: any) => ({ ...prev, status: 'submitted' }));
    }
  };

  const handleApprove = async () => {
    const { error } = await (supabase as any).from('timesheets').update({
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error approving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet approved' });
      setTimesheet((prev: any) => ({ ...prev, status: 'approved', approved_by: user?.id }));
    }
  };

  const handleReject = async () => {
    const { error } = await (supabase as any).from('timesheets').update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error rejecting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet rejected — member can revise and resubmit' });
      setTimesheet((prev: any) => ({ ...prev, status: 'rejected' }));
    }
  };

  const handleDelete = async () => {
    const { error } = await (supabase as any).from('timesheets').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet deleted' });
      navigate('/timesheets');
    }
  };

  const getMemberName = () => {
    if (!timesheet) return '';
    if (timesheet.member_id === user?.id) return 'Your Timesheet';
    const member = teamMembers.find(m => m.user_id === timesheet.member_id);
    return member?.profiles?.business_name || member?.profiles?.email || 'Team Member';
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!timesheet) return null;

  return (
    <MobileLayout showNav={false}>
      <div className="min-h-screen scrollbar-hide">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="relative px-4 pt-8 pb-6">
            <button
              onClick={() => navigate('/timesheets')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Timesheets</span>
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{getMemberName()}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Week of {format(parseISO(timesheet.week_starting), 'dd MMM yyyy')}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={timesheet.status} />
              <span className="text-sm font-semibold text-primary">{totalHours.toFixed(1)} hours</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-4">
          {/* Daily Entries */}
          {entries.map((entry, index) => {
            const date = parseISO(entry.entry_date);
            const isToday = isSameDay(date, new Date());
            const dayName = format(date, 'EEE');
            const dayNum = format(date, 'dd MMM');
            const isWeekend = index >= 5;

            return (
              <div
                key={entry.entry_date}
                className={cn(
                  "p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 transition-all animate-fade-in",
                  isToday && "ring-1 ring-primary/30 bg-primary/5",
                  isWeekend && entry.hours === 0 && !isEditable && "opacity-50"
                )}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold",
                      isToday ? "bg-primary text-primary-foreground" :
                      entry.hours > 0 ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {dayName}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{dayNum}</p>
                      {isToday && <p className="text-[10px] font-bold text-primary">TODAY</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold",
                      entry.hours > 0 ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {Number(entry.hours).toFixed(1)}h
                    </p>
                  </div>
                </div>

                {isEditable && (
                  <div className="space-y-3">
                    {/* Time inputs */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Start</Label>
                        <Input
                          type="time"
                          value={entry.start_time}
                          onChange={e => updateEntry(index, 'start_time', e.target.value)}
                          className="h-9 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">End</Label>
                        <Input
                          type="time"
                          value={entry.end_time}
                          onChange={e => updateEntry(index, 'end_time', e.target.value)}
                          className="h-9 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Break (min)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="5"
                          value={entry.break_minutes || ''}
                          onChange={e => updateEntry(index, 'break_minutes', parseInt(e.target.value) || 0)}
                          className="h-9 rounded-lg text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Or manual hours */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Or Manual Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          step="0.25"
                          value={entry.hours || ''}
                          onChange={e => updateEntry(index, 'hours', parseFloat(e.target.value) || 0)}
                          className="h-9 rounded-lg text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Job</Label>
                        <Select
                          value={entry.job_id || 'none'}
                          onValueChange={v => updateEntry(index, 'job_id', v === 'none' ? null : v)}
                        >
                          <SelectTrigger className="h-9 rounded-lg text-sm">
                            <SelectValue placeholder="No job" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No job</SelectItem>
                            {jobs.map(j => (
                              <SelectItem key={j.id} value={j.id}>
                                {j.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Description */}
                    <Input
                      value={entry.description}
                      onChange={e => updateEntry(index, 'description', e.target.value)}
                      placeholder="What did you work on?"
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                )}

                {/* Read-only view for non-editable */}
                {!isEditable && entry.hours > 0 && (
                  <div className="space-y-1.5 text-sm">
                    {(entry.start_time && entry.end_time) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{entry.start_time} - {entry.end_time}</span>
                        {entry.break_minutes > 0 && (
                          <span className="flex items-center gap-1">
                            <Coffee className="w-3 h-3" />
                            {entry.break_minutes}min break
                          </span>
                        )}
                      </div>
                    )}
                    {entry.job_id && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>{jobs.find(j => j.id === entry.job_id)?.title || 'Job'}</span>
                      </div>
                    )}
                    {entry.description && (
                      <p className="text-muted-foreground">{entry.description}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Notes */}
          <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Notes</Label>
            {isEditable ? (
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any notes for this week..."
                rows={2}
                className="mt-2 rounded-lg"
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{notes || 'No notes'}</p>
            )}
          </div>

          {/* Total Summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Total Hours</span>
              <span className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}h</span>
            </div>
            {totalHours > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Avg {(totalHours / Math.max(1, entries.filter(e => e.hours > 0).length)).toFixed(1)}h per day worked
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {isEditable && (
              <>
                <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-12">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Timesheet
                </Button>
                <Button onClick={handleSubmit} disabled={saving || totalHours === 0} variant="outline" className="w-full rounded-xl h-12">
                  <Send className="w-4 h-4 mr-2" />
                  Submit for Approval
                </Button>
              </>
            )}

            {canApprove && (
              <div className="flex gap-2">
                <Button onClick={handleApprove} className="flex-1 rounded-xl h-12 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button onClick={handleReject} variant="destructive" className="flex-1 rounded-xl h-12">
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}

            {isEditable && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full rounded-xl h-10 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Timesheet
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this timesheet?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this timesheet and all its entries. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
