/**
 * Audit logging helpers.
 *
 * Every privileged action (admin CRUD, login, candidate approval, vote, etc.)
 * should call `logAudit` so that there is a single, consistent trail in
 * public.audit_log.
 *
 * The DB function `log_audit_event(p_action, p_description, ...)` does the
 * heavy lifting: it reads `auth.uid()` server-side and stamps the row.
 */

import { supabase } from '@/integrations/supabase/client';

export type AuditSeverity = 'info' | 'warning' | 'critical';
export type AuditCategory = 'admin' | 'auth' | 'election' | 'security';

export interface AuditLogInput {
  action: string;          // e.g. 'event.create'
  description: string;     // human-readable
  category?: AuditCategory;
  targetType?: string;     // e.g. 'election_events'
  targetId?: string;       // string so non-uuid ids are accepted
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_audit_event', {
      p_action: input.action,
      p_description: input.description,
      p_category: input.category ?? 'admin',
      p_target_type: input.targetType ?? null,
      p_target_id: input.targetId ?? null,
      p_metadata: input.metadata ?? {},
      p_severity: input.severity ?? 'info',
    });
    if (error) {
      // Audit must never break the calling flow, but log the error.
      console.warn('[audit] failed:', error.message);
    }
  } catch (e) {
    console.warn('[audit] unexpected:', e);
  }
}

export interface AuditLogRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  category: string;
  target_type: string | null;
  target_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  severity: string;
}

export async function fetchAuditLog(options: {
  limit?: number;
  offset?: number;
  category?: AuditCategory;
  severity?: AuditSeverity;
  search?: string;
} = {}): Promise<AuditLogRow[]> {
  let q = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (options.category) q = q.eq('category', options.category);
  if (options.severity) q = q.eq('severity', options.severity);
  if (options.search) q = q.ilike('description', `%${options.search}%`);

  if (options.limit) q = q.limit(options.limit);

  const { data, error } = await q;
  if (error) {
    console.error('[audit] fetchAuditLog:', error);
    return [];
  }
  return (data || []) as AuditLogRow[];
}
