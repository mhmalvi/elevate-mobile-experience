/**
 * Entity configuration: table-name mappings and dependency ordering.
 * All modules that need to derive a Supabase table name or a local Dexie table
 * import from here instead of duplicating these constants.
 */

import { db } from './db';
import { encryptedDb } from './encryptedDb';

/**
 * Entity type to Supabase table name mapping.
 * Prevents fragile pluralisation issues.
 */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  job: 'jobs',
  quote: 'quotes',
  invoice: 'invoices',
  client: 'clients',
  quote_line_item: 'quote_line_items',
  invoice_line_item: 'invoice_line_items',
};

/**
 * Entity dependency order for sync.
 * Parents must be synced before children to prevent FK violations:
 * clients -> jobs -> quotes -> quote_line_items -> invoices -> invoice_line_items
 */
export const ENTITY_DEPENDENCY_ORDER = [
  'client',
  'job',
  'quote',
  'quote_line_item',
  'invoice',
  'invoice_line_item',
];

/**
 * Get the Supabase table name for an entity type.
 * Falls back to naive pluralisation when the type is not in the map.
 */
export function getTableName(entityType: string): string {
  return ENTITY_TABLE_MAP[entityType] ?? `${entityType}s`;
}

/**
 * Get the local IndexedDB table for an entity type.
 * SECURITY: Returns encrypted table wrappers for sensitive data
 * (clients, invoices, quotes). Line items use the plain db table.
 */
export function getLocalTable(entityType: string) {
  const tableMap: Record<string, object> = {
    job: encryptedDb.jobs,
    quote: encryptedDb.quotes,
    invoice: encryptedDb.invoices,
    client: encryptedDb.clients,
    quote_line_item: db.quote_line_items,
    invoice_line_item: db.invoice_line_items,
  };
  return tableMap[entityType] ?? null;
}
