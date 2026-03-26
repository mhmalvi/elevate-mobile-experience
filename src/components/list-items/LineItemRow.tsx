import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { LineItem } from '@/lib/lineItems';

interface LineItemRowProps {
  item: LineItem;
  index: number;
  canRemove: boolean;
  showItemType?: boolean;
  onUpdate: (id: string, field: keyof LineItem, value: LineItem[keyof LineItem]) => void;
  onRemove: (id: string) => void;
}

export const LineItemRow = React.memo(function LineItemRow({
  item,
  index,
  canRemove,
  showItemType = false,
  onUpdate,
  onRemove,
}: LineItemRowProps) {
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(item.id, 'description', e.target.value),
    [item.id, onUpdate]
  );

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0),
    [item.id, onUpdate]
  );

  const handleUnitChange = useCallback(
    (v: string) => onUpdate(item.id, 'unit', v),
    [item.id, onUpdate]
  );

  const handlePriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(item.id, 'unit_price', parseFloat(e.target.value) || 0),
    [item.id, onUpdate]
  );

  const handleItemTypeChange = useCallback(
    (v: string) => onUpdate(item.id, 'item_type', v as 'labour' | 'materials'),
    [item.id, onUpdate]
  );

  const handleRemove = useCallback(
    () => onRemove(item.id),
    [item.id, onRemove]
  );

  return (
    <div
      className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-3 animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            aria-label={`Remove line item ${index + 1}`}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        )}
      </div>

      <Input
        placeholder="Description"
        value={item.description}
        onChange={handleDescriptionChange}
        className="h-11 rounded-xl"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Qty</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={item.quantity}
            onChange={handleQuantityChange}
            className="h-10 rounded-xl"
          />
        </div>
        <div>
          <Label className="text-xs">Unit</Label>
          <Select value={item.unit} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="each">Each</SelectItem>
              <SelectItem value="hour">Hour</SelectItem>
              <SelectItem value="sqm">m2</SelectItem>
              <SelectItem value="lm">Lm</SelectItem>
              <SelectItem value="job">Job</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Price{showItemType ? ' ($)' : ''}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.unit_price}
            onChange={handlePriceChange}
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      {showItemType && (
        <Select
          value={item.item_type}
          onValueChange={handleItemTypeChange}
        >
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="labour">Labour</SelectItem>
            <SelectItem value="materials">Materials</SelectItem>
          </SelectContent>
        </Select>
      )}

      <div className="text-right text-sm font-semibold text-primary">
        ${(item.quantity * item.unit_price).toFixed(2)}
      </div>
    </div>
  );
});
