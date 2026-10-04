import { z } from 'zod';
import { Priority, Status, WorkItemType } from '../../generated/prisma/enums.js';
import { paginationSchema } from '../../utils/pagination.js';

const title = z.string().trim().min(1).max(150);
const description = z.string().trim().min(1).max(5000);
const priority = z.enum(Priority);
const futureDate = z.coerce
  .date()
  .refine((date) => date > new Date(), 'Due date must be in the future');

const createBase = {
  title,
  description,
  priority: priority.default(Priority.MEDIUM),
  dueDate: futureDate.optional(),
  assigneeId: z.uuid().optional(),
};

// Status and requester are never accepted: the server sets them. `.strict()` turns them into 400s.
export const createWorkItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(WorkItemType.TASK), ...createBase, projectId: z.uuid() }).strict(),
  z
    .object({ type: z.literal(WorkItemType.TICKET), ...createBase, projectId: z.uuid().optional() })
    .strict(),
]);

// `type` and `projectId` are fixed at creation, so they are not accepted here.
export const updateWorkItemSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    priority: priority.optional(),
    status: z.enum(Status).optional(),
    assigneeId: z.uuid().nullable().optional(), // null = unassign
    dueDate: z.coerce.date().nullable().optional(), // null = clear; "future" is checked only when it changes
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field');

/** `status=TODO,IN_PROGRESS` -> ['TODO', 'IN_PROGRESS']. An empty value means "no filter". */
const csvOf = <T extends z.ZodType>(item: T) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }, z.array(item).optional());

export const listWorkItemsQuery = paginationSchema
  .extend({
    sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title']).default('createdAt'),
    type: z.enum(WorkItemType).optional(),
    status: csvOf(z.enum(Status)),
    priority: csvOf(priority),
    projectId: z.uuid().optional(),
    assigneeId: z.uuid().optional(),
    requesterId: z.uuid().optional(),
    mine: z.enum(['assigned', 'raised']).optional(),
    overdue: z.stringbool().optional(),
    dueFrom: z.coerce.date().optional(),
    dueTo: z.coerce.date().optional(),
  })
  .refine((q) => !q.dueFrom || !q.dueTo || q.dueFrom <= q.dueTo, {
    path: ['dueTo'],
    message: 'dueTo must not be before dueFrom',
  });

export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;
export type ListWorkItemsQuery = z.infer<typeof listWorkItemsQuery>;

export const boardQuery = paginationSchema.pick({ q: true }).extend({
  type: z.enum(WorkItemType).default(WorkItemType.TASK),
  assigneeId: z.uuid().optional(),
  perColumn: z.coerce.number().int().min(1).max(50).default(20),
});

export type BoardQuery = z.infer<typeof boardQuery>;
