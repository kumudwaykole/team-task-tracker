import type { Status } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';

export type WorkItemEvent =
  | { type: 'ASSIGNED'; workItemId: string; assigneeId: string }
  | { type: 'STATUS_CHANGED'; workItemId: string; from: Status; to: Status }
  | { type: 'TICKET_CREATED'; workItemId: string };

/**
 * PHASE 5 HOOK. The work-item service reports every notifiable change here.
 * Phase 5 turns these into notification rows (recipients per llm.md 4.11, never the actor)
 * and emits them over Socket.IO after the change is committed.
 */
export function publishWorkItemEvents(_actor: AuthUser, _events: WorkItemEvent[]): void {}
