import { Status, type WorkItemType } from '../../src/generated/prisma/enums.js';

const { TODO, OPEN, IN_PROGRESS, IN_REVIEW, ESCALATED, RESOLVED, CLOSED, DONE } = Status;

export const ALL_STATUSES = Object.values(Status);

/** Each type's statuses, in workflow order. */
export const STATUSES: Record<WorkItemType, Status[]> = {
  TASK: [TODO, IN_PROGRESS, IN_REVIEW, DONE],
  TICKET: [OPEN, IN_PROGRESS, ESCALATED, RESOLVED, CLOSED],
};

/** The workflow from the assignment, written out independently of the implementation. */
export const VALID_TRANSITIONS: Record<WorkItemType, [Status, Status][]> = {
  TASK: [
    [TODO, IN_PROGRESS],
    [IN_PROGRESS, TODO],
    [IN_PROGRESS, IN_REVIEW],
    [IN_REVIEW, IN_PROGRESS],
    [IN_REVIEW, DONE],
    [DONE, IN_PROGRESS],
  ],
  TICKET: [
    [OPEN, IN_PROGRESS],
    [OPEN, ESCALATED],
    [OPEN, CLOSED],
    [IN_PROGRESS, OPEN],
    [IN_PROGRESS, ESCALATED],
    [IN_PROGRESS, RESOLVED],
    [ESCALATED, IN_PROGRESS],
    [ESCALATED, RESOLVED],
    [RESOLVED, IN_PROGRESS],
    [RESOLVED, CLOSED],
  ],
};

export const isValidTransition = (type: WorkItemType, from: Status, to: Status) =>
  VALID_TRANSITIONS[type].some(([a, b]) => a === from && b === to);
