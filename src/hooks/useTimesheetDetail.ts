import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, addDays } from 'date-fns';
import { calculateHoursFromTimes } from '@/lib/utils/timeUtils';

export interface TimesheetEntry {
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

export interface Job {
  id: string;
  title: string;
  status: string;
}

/** The raw timesheet row from Supabase (we only use a subset of fields). */
export interface TimesheetRow {
  id: string;
  week_starting: string;
  status: string;
  notes: string | null;
  member_id: string;
  approved_at: string | null;
  approved_by: string | null;
  total_hours: number | null;
  [key: string]: unknown;
}

export interface UseTimesheetDetailReturn {
  timesheet: TimesheetRow | null;
  entries: TimesheetEntry[];
  jobs: Job[];
  loading: boolean;
  saving: boolean;
  notes: string;
  totalHours: number;
  isEditable: boolean;
  canApprove: boolean;
  memberName: string;
  setNotes: (notes: string) => void;
  updateEntry: (index: number, field: keyof TimesheetEntry, value: string | number | null) => void;
  handleSave: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleApprove: () => Promise<void>;
  handleReject: () => Promise<void>;
  handleDelete: () => Promise<void>;
}

export function useTimesheetDetail(id: string | undefined): UseTimesheetDetailReturn {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canManageTeam, teamMembers } = useTeam();
  const { toast } = useToast();

  const [timesheet, setTimesheet] = useState<TimesheetRow | null>(null);
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
  }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTimesheet = async () => {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: 'Error loading timesheet', description: error.message, variant: 'destructive' });
      navigate('/timesheets');
      return;
    }

    setTimesheet(data as TimesheetRow);
    setNotes(data.notes || '');

    const { data: entryData, error: entryError } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', id)
      .order('entry_date', { ascending: true });

    if (entryError) {
      console.error('Error fetching entries:', entryError);
    }

    const weekStart = parseISO(data.week_starting);
    const existingEntries = entryData || [];
    const weekEntries: TimesheetEntry[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = existingEntries.find(
        (e: Record<string, unknown>) => e.entry_date === dateStr,
      );

      if (existing) {
        weekEntries.push({
          id: existing.id as string,
          timesheet_id: id!,
          entry_date: dateStr,
          start_time: (existing.start_time as string) || '',
          end_time: (existing.end_time as string) || '',
          break_minutes: (existing.break_minutes as number) || 0,
          hours: Number(existing.hours) || 0,
          job_id: (existing.job_id as string) || null,
          description: (existing.description as string) || '',
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
  const canApprove =
    canManageTeam &&
    timesheet?.status === 'submitted' &&
    timesheet?.member_id !== user?.id;

  const memberName = useMemo(() => {
    if (!timesheet) return '';
    if (timesheet.member_id === user?.id) return 'Your Timesheet';
    const member = teamMembers.find(
      (m: Record<string, unknown>) => m.user_id === timesheet.member_id,
    );
    const profiles = member?.profiles as Record<string, unknown> | undefined;
    return (profiles?.business_name as string) || (profiles?.email as string) || 'Team Member';
  }, [timesheet, user?.id, teamMembers]);

  const updateEntry = useCallback(
    (index: number, field: keyof TimesheetEntry, value: string | number | null) => {
      setEntries((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };

        // Auto-calculate hours from start/end times
        if (
          (field === 'start_time' || field === 'end_time' || field === 'break_minutes') &&
          updated[index].start_time &&
          updated[index].end_time
        ) {
          updated[index].hours = calculateHoursFromTimes(
            updated[index].start_time,
            updated[index].end_time,
            Number(updated[index].break_minutes) || 0,
          );
        }

        return updated;
      });
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);

    try {
      for (const entry of entries) {
        if (entry.hours === 0 && !entry.start_time && !entry.description) {
          if (entry.id) {
            await supabase.from('timesheet_entries').delete().eq('id', entry.id);
          }
          continue;
        }

        if (entry.id) {
          await supabase
            .from('timesheet_entries')
            .update({
              start_time: entry.start_time || null,
              end_time: entry.end_time || null,
              break_minutes: entry.break_minutes,
              hours: entry.hours,
              job_id: entry.job_id || null,
              description: entry.description || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', entry.id);
        } else {
          const { data } = await supabase
            .from('timesheet_entries')
            .insert({
              timesheet_id: id,
              entry_date: entry.entry_date,
              start_time: entry.start_time || null,
              end_time: entry.end_time || null,
              break_minutes: entry.break_minutes,
              hours: entry.hours,
              job_id: entry.job_id || null,
              description: entry.description || null,
            })
            .select()
            .single();

          if (data) {
            entry.id = data.id;
          }
        }
      }

      await supabase
        .from('timesheets')
        .update({
          total_hours: totalHours,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      toast({ title: 'Timesheet saved' });
    } catch (error) {
      toast({
        title: 'Error saving',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }

    setSaving(false);
  }, [id, entries, totalHours, notes, toast]);

  const handleSubmit = useCallback(async () => {
    await handleSave();
    const { error } = await supabase
      .from('timesheets')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error submitting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet submitted for approval' });
      setTimesheet((prev) => (prev ? { ...prev, status: 'submitted' } : prev));
    }
  }, [handleSave, id, toast]);

  const handleApprove = useCallback(async () => {
    const { error } = await supabase
      .from('timesheets')
      .update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error approving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet approved' });
      setTimesheet((prev) =>
        prev ? { ...prev, status: 'approved', approved_by: user?.id ?? null } : prev,
      );
    }
  }, [id, user?.id, toast]);

  const handleReject = useCallback(async () => {
    const { error } = await supabase
      .from('timesheets')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error rejecting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet rejected — member can revise and resubmit' });
      setTimesheet((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
    }
  }, [id, toast]);

  const handleDelete = useCallback(async () => {
    const { error } = await supabase.from('timesheets').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Timesheet deleted' });
      navigate('/timesheets');
    }
  }, [id, navigate, toast]);

  return {
    timesheet,
    entries,
    jobs,
    loading,
    saving,
    notes,
    totalHours,
    isEditable,
    canApprove,
    memberName,
    setNotes,
    updateEntry,
    handleSave,
    handleSubmit,
    handleApprove,
    handleReject,
    handleDelete,
  };
}
