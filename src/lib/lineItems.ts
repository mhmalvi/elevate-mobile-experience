import type { Dispatch, SetStateAction } from 'react';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: 'labour' | 'materials';
}

/**
 * Updates a single field on a line item identified by `id`.
 * Returns a new array with the updated item, suitable for use with a state setter.
 *
 * Usage with React state:
 *   updateLineItem(setLineItems, id, field, value)
 */
export function updateLineItem(
  setLineItems: Dispatch<SetStateAction<LineItem[]>>,
  id: string,
  field: keyof LineItem,
  value: LineItem[keyof LineItem]
): void {
  setLineItems((items) =>
    items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
  );
}

/**
 * Calculates subtotal, GST (10%), and total for a list of line items.
 */
export function calculateLineItemTotals(lineItems: LineItem[]) {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const gst = subtotal * 0.1;
  const total = subtotal + gst;
  return { subtotal, gst, total };
}
