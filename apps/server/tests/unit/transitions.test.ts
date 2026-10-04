import { describe, expect, it } from 'vitest';
import { Role, Status, WorkItemType } from '../../src/generated/prisma/enums.js';
import { AppError } from '../../src/utils/AppError.js';
import {
  allowedNext,
  assertTransition,
  INITIAL_STATUS,
  statusesFor,
} from '../../src/modules/workItems/workItems.transitions.js';
import { ALL_STATUSES, isValidTransition } from '../helpers/workflow.js';

const { TODO, OPEN, IN_PROGRESS, IN_REVIEW, ESCALATED, RESOLVED, CLOSED, DONE } = Status;
const ALL = ALL_STATUSES;
const isValid = isValidTransition;

const errorOf = (fn: () => void) => {
  try {
    fn();
  } catch (err) {
    return err as AppError;
  }
  return undefined;
};

describe('status transitions', () => {
  it('starts a TASK in TODO and a TICKET in OPEN', () => {
    expect(INITIAL_STATUS).toEqual({ TASK: TODO, TICKET: OPEN });
  });

  it('lists each type’s statuses in workflow order', () => {
    expect(statusesFor(WorkItemType.TASK)).toEqual([TODO, IN_PROGRESS, IN_REVIEW, DONE]);
    expect(statusesFor(WorkItemType.TICKET)).toEqual([
      OPEN,
      IN_PROGRESS,
      ESCALATED,
      RESOLVED,
      CLOSED,
    ]);
  });

  for (const type of Object.values(WorkItemType)) {
    describe(type, () => {
      const pairs = ALL.flatMap((from) => ALL.map((to) => [from, to] as const));

      it.each(pairs.filter(([from, to]) => isValid(type, from, to)))(
        'allows %s -> %s',
        (from, to) => {
          expect(() => assertTransition(type, from, to, Role.ADMIN)).not.toThrow();
        },
      );

      it.each(pairs.filter(([from, to]) => !isValid(type, from, to)))(
        'rejects %s -> %s with 409 INVALID_TRANSITION',
        (from, to) => {
          const err = errorOf(() => assertTransition(type, from, to, Role.ADMIN));
          expect(err).toBeInstanceOf(AppError);
          expect(err).toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });
        },
      );
    });
  }

  describe('ESCALATED is for Managers and Admins only', () => {
    it('rejects a Member escalating with 403', () => {
      for (const from of [OPEN, IN_PROGRESS]) {
        const err = errorOf(() => assertTransition('TICKET', from, ESCALATED, Role.MEMBER));
        expect(err).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      }
    });

    it.each([Role.MANAGER, Role.ADMIN])('allows %s to escalate', (role) => {
      expect(() => assertTransition('TICKET', OPEN, ESCALATED, role)).not.toThrow();
    });

    it('hides ESCALATED from a Member’s allowed moves', () => {
      expect(allowedNext('TICKET', OPEN, Role.MEMBER)).toEqual([IN_PROGRESS, CLOSED]);
      expect(allowedNext('TICKET', OPEN, Role.MANAGER)).toEqual([IN_PROGRESS, ESCALATED, CLOSED]);
    });
  });

  it('allows no moves out of CLOSED, or from a status of the other type', () => {
    expect(allowedNext('TICKET', CLOSED, Role.ADMIN)).toEqual([]);
    expect(allowedNext('TASK', OPEN, Role.ADMIN)).toEqual([]);
  });
});
