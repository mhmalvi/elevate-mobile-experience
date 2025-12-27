import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface RecurringInvoiceToggleProps {
  isRecurring: boolean;
  recurringInterval: string;
  nextDueDate: string;
  onToggle: (enabled: boolean) => void;
  onIntervalChange: (interval: string) => void;
  onNextDueDateChange: (date: string) => void;
}

export function RecurringInvoiceToggle({
  isRecurring,
  recurringInterval,
  nextDueDate,
  onToggle,
  onIntervalChange,
  onNextDueDateChange,
}: RecurringInvoiceToggleProps) {
  return (
    <div className="p-4 bg-card rounded-xl border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div>
            <Label htmlFor="recurring" className="font-semibold cursor-pointer">Recurring Invoice</Label>
            <p className="text-sm text-muted-foreground">
              Auto-generate and send on schedule
            </p>
          </div>
        </div>
        <Switch
          id="recurring"
          checked={isRecurring}
          onCheckedChange={onToggle}
        />
      </div>

      {isRecurring && (
        <div className="space-y-4 pt-2 border-t animate-in slide-in-from-top-2">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={recurringInterval} onValueChange={onIntervalChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly (Every 3 months)</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often should this invoice be generated
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextDueDate">Next Invoice Date</Label>
            <div className="relative">
              <Input
                id="nextDueDate"
                type="date"
                value={nextDueDate}
                onChange={(e) => onNextDueDateChange(e.target.value)}
                className="pl-10"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <p className="text-xs text-muted-foreground">
              The first invoice will be generated on this date
            </p>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> Recurring invoices will be automatically generated and emailed to your client on the scheduled date.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
