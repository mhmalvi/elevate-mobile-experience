import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
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
import {
  Clock,
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { useTimesheetDetail } from '@/hooks/useTimesheetDetail';
import { TimesheetDayCard } from '@/components/timesheet/TimesheetDayCard';

export default function TimesheetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
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
  } = useTimesheetDetail(id);

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
              <span className="text-sm font-medium text-primary">{memberName}</span>
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
          {entries.map((entry, index) => (
            <TimesheetDayCard
              key={entry.entry_date}
              entry={entry}
              index={index}
              isEditable={isEditable}
              jobs={jobs}
              onUpdateEntry={updateEntry}
            />
          ))}

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
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-foreground">Awaiting Your Approval</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {memberName} submitted this timesheet with {totalHours.toFixed(1)} hours.
                </p>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="flex-1 rounded-xl h-12 bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Approve this timesheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the timesheet as approved. The team member will be notified.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700 rounded-xl">
                          Approve
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1 rounded-xl h-12">
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject this timesheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The team member will be able to revise and resubmit their timesheet.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground rounded-xl">
                          Reject
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {timesheet.status === 'approved' && timesheet.approved_at && (
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-2xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-foreground">Approved</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Approved on {format(parseISO(timesheet.approved_at), 'dd MMM yyyy, h:mm a')}
                </p>
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
