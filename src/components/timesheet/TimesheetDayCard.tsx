import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Clock, Coffee, Briefcase } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import type { TimesheetEntry, Job } from '@/hooks/useTimesheetDetail';

interface TimesheetDayCardProps {
  entry: TimesheetEntry;
  index: number;
  isEditable: boolean;
  jobs: Job[];
  onUpdateEntry: (index: number, field: keyof TimesheetEntry, value: string | number | null) => void;
}

function TimesheetDayCardInner({
  entry,
  index,
  isEditable,
  jobs,
  onUpdateEntry,
}: TimesheetDayCardProps) {
  const date = parseISO(entry.entry_date);
  const isToday = isSameDay(date, new Date());
  const dayName = format(date, 'EEE');
  const dayNum = format(date, 'dd MMM');
  const isWeekend = index >= 5;

  return (
    <div
      className={cn(
        'p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 transition-all animate-fade-in',
        isToday && 'ring-1 ring-primary/30 bg-primary/5',
        isWeekend && entry.hours === 0 && !isEditable && 'opacity-50',
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
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {dayName}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{dayNum}</p>
            {isToday && <p className="text-[10px] font-bold text-primary">TODAY</p>}
          </div>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-lg font-bold',
              entry.hours > 0 ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {Number(entry.hours).toFixed(1)}h
          </p>
        </div>
      </div>

      {isEditable && (
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
                onChange={(e) => onUpdateEntry(index, 'start_time', e.target.value)}
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
                onChange={(e) => onUpdateEntry(index, 'end_time', e.target.value)}
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
                onChange={(e) =>
                  onUpdateEntry(index, 'break_minutes', parseInt(e.target.value) || 0)
                }
                className="h-9 rounded-lg text-sm"
                placeholder="0"
              />
            </div>
          </div>

          {/* Or manual hours */}
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
                onChange={(e) =>
                  onUpdateEntry(index, 'hours', parseFloat(e.target.value) || 0)
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
                onValueChange={(v) =>
                  onUpdateEntry(index, 'job_id', v === 'none' ? null : v)
                }
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue placeholder="No job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No job</SelectItem>
                  {jobs.map((j) => (
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
            onChange={(e) => onUpdateEntry(index, 'description', e.target.value)}
            placeholder="What did you work on?"
            className="h-9 rounded-lg text-sm"
          />
        </div>
      )}

      {/* Read-only view for non-editable */}
      {!isEditable && entry.hours > 0 && (
        <div className="space-y-1.5 text-sm">
          {entry.start_time && entry.end_time && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {entry.start_time} - {entry.end_time}
              </span>
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
              <span>{jobs.find((j) => j.id === entry.job_id)?.title || 'Job'}</span>
            </div>
          )}
          {entry.description && (
            <p className="text-muted-foreground">{entry.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

export const TimesheetDayCard = React.memo(TimesheetDayCardInner);
