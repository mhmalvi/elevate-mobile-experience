import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useActiveJobs } from '@/hooks/queries/useTimesheets';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Clock,
  ArrowLeft,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  parseISO,
  isSameDay,
} from 'date-fns';

interface TimesheetEntry {
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  hours: number;
  job_id: string | null;
  description: string;
}

export default function TimesheetForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { team } = useTeam();
  const { toast } = useToast();
  const { data: jobs = [] } = useActiveJobs();

  const [weekStarting, setWeekStarting] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Build 7-day entry grid whenever weekStarting changes
  useEffect(() => {
    const weekEntries: TimesheetEntry[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStarting, i);
      weekEntries.push({
        entry_date: format(date, 'yyyy-MM-dd'),
        start_time: '',
        end_time: '',
        break_minutes: 0,
        hours: 0,
        job_id: null,
        description: '',
      });
    }
    setEntries(weekEntries);
  }, [weekStarting]);

  const totalHours = useMemo(() => {
    return entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  }, [entries]);

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: string | number | null) => {
    setEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate hours from start/end times
      if (
        (field === 'start_time' || field === 'end_time' || field === 'break_minutes') &&
        updated[index].start_time &&
        updated[index].end_time
      ) {
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
    if (!user) return;
    setSaving(true);

    const weekStr = format(weekStarting, 'yyyy-MM-dd');

    try {
      // Check if a timesheet already exists for this week
      const { data: existing } = await supabase
        .from('timesheets')
        .select('id')
        .eq('member_id', user.id)
        .eq('week_starting', weekStr)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Timesheet already exists',
          description: 'A timesheet for this week already exists. Redirecting...',
        });
        navigate(`/timesheets/${existing.id}`);
        setSaving(false);
        return;
      }

      // Create the timesheet
      const { data: timesheet, error: tsError } = await supabase
        .from('timesheets')
        .insert({
          user_id: user.id,
          team_id: team?.id || null,
          member_id: user.id,
          week_starting: weekStr,
          status: 'draft',
          total_hours: totalHours,
          notes: notes || null,
        })
        .select()
        .single();

      if (tsError) {
        toast({
          title: 'Error creating timesheet',
          description: tsError.message,
          variant: 'destructive',
        });
        return;
      }

      // Insert non-empty entries
      const entriesToInsert = entries
        .filter(e => e.hours > 0 || e.start_time || e.description)
        .map(e => ({
          timesheet_id: timesheet.id,
          entry_date: e.entry_date,
          start_time: e.start_time || null,
          end_time: e.end_time || null,
          break_minutes: e.break_minutes,
          hours: e.hours,
          job_id: e.job_id || null,
          description: e.description || null,
        }));

      if (entriesToInsert.length > 0) {
        const { error: entryError } = await supabase
          .from('timesheet_entries')
          .insert(entriesToInsert);

        if (entryError) {
          // Rollback: delete the orphaned timesheet
          await supabase.from('timesheets').delete().eq('id', timesheet.id);
          toast({
            title: 'Error creating timesheet entries',
            description: entryError.message,
            variant: 'destructive',
          });
          return;
        }
      }

      toast({ title: 'Timesheet created' });
      navigate(`/timesheets/${timesheet.id}`);
    } catch (error) {
      toast({
        title: 'Error creating timesheet',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStarting(prev =>
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const formatWeekRange = () => {
    const end = addDays(weekStarting, 6);
    return `${format(weekStarting, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`;
  };

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
              <span className="text-sm font-medium text-primary">New</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Create Timesheet</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Fill in your hours for the week
            </p>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-4">
          {/* Week Picker */}
          <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Week Starting
            </Label>
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    {formatWeekRange()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monday to Sunday
                </p>
              </div>
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

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
                  'p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 transition-all animate-fade-in',
                  isToday && 'ring-1 ring-primary/30 bg-primary/5',
                  isWeekend && 'opacity-80'
                )}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold',
                        isToday
                          ? 'bg-primary text-primary-foreground'
                          : entry.hours > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {dayName}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{dayNum}</p>
                      {isToday && (
                        <p className="text-[10px] font-bold text-primary">TODAY</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-lg font-bold',
                        entry.hours > 0 ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {Number(entry.hours).toFixed(1)}h
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Time inputs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Start
                      </Label>
                      <Input
                        type="time"
                        value={entry.start_time}
                        onChange={e =>
                          updateEntry(index, 'start_time', e.target.value)
                        }
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        End
                      </Label>
                      <Input
                        type="time"
                        value={entry.end_time}
                        onChange={e =>
                          updateEntry(index, 'end_time', e.target.value)
                        }
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Break (min)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        value={entry.break_minutes || ''}
                        onChange={e =>
                          updateEntry(
                            index,
                            'break_minutes',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="h-9 rounded-lg text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Manual hours + Job */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Or Manual Hours
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        step="0.25"
                        value={entry.hours || ''}
                        onChange={e =>
                          updateEntry(
                            index,
                            'hours',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-9 rounded-lg text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Job
                      </Label>
                      <Select
                        value={entry.job_id || 'none'}
                        onValueChange={v =>
                          updateEntry(
                            index,
                            'job_id',
                            v === 'none' ? null : v
                          )
                        }
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
                    onChange={e =>
                      updateEntry(index, 'description', e.target.value)
                    }
                    placeholder="What did you work on?"
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Weekly Notes
            </Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes for this week..."
              rows={2}
              className="mt-2 rounded-lg"
            />
          </div>

          {/* Total Summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Total Hours</span>
              <span className="text-2xl font-bold text-primary">
                {totalHours.toFixed(1)}h
              </span>
            </div>
            {totalHours > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Avg{' '}
                {(
                  totalHours /
                  Math.max(
                    1,
                    entries.filter(e => e.hours > 0).length
                  )
                ).toFixed(1)}
                h per day worked
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl h-12"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Create Timesheet
            </Button>
            <Button
              onClick={() => navigate('/timesheets')}
              variant="ghost"
              className="w-full rounded-xl h-10"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
