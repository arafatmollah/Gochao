import type { BillRepository } from '@/db/repositories/bill-repository';
import type {
  Bill,
  BillDueItem,
  BillOccurrence,
  BillSummary,
  CreateBillInput,
  OccurrenceFilter,
  UpdateBillInput,
} from '@/types/bill';
import { addDaysIsoDate, monthBoundsIsoDate, todayIsoDate } from '@/utils/dates';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { pendingOccurrenceDates } from '@/utils/recurrence';
import { nowIso } from '@/utils/time';

import {
  asBillCategory,
  validateBillAmount,
  validateBillCategory,
  validateBillDueDate,
  validateBillInstallmentCount,
  validateBillName,
  validateBillNotes,
  validateBillRecurrence,
  validateBillReminderDays,
} from './bill-validation';

/**
 * How far ahead occurrences are materialized. Bounded so the schedule stays
 * small and generation stays cheap on every screen load; the horizon slides
 * forward on each `ensureOccurrencesAhead` call. The first occurrence (the
 * schedule anchor) is always materialized even when it is beyond the horizon.
 */
const OCCURRENCE_HORIZON_DAYS = 60;

export interface BillServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable local-date source (schedule math is calendar-based). */
  nowDate?: () => Date;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface BillService {
  listSummaries(options?: { includeArchived?: boolean }): Promise<BillSummary[]>;
  getById(id: string): Promise<Bill>;
  create(input: CreateBillInput): Promise<Bill>;
  update(id: string, input: UpdateBillInput): Promise<Bill>;
  setArchived(id: string, archived: boolean): Promise<Bill>;
  /** Deletes a bill only when it has no recorded payments; else conflicts. */
  remove(id: string): Promise<void>;
  /** Pending occurrences of active bills, ordered by due date. */
  listDue(filter?: OccurrenceFilter): Promise<BillDueItem[]>;
  /** Paid occurrences, most recently paid first (archived bills included). */
  listHistory(filter?: OccurrenceFilter): Promise<BillDueItem[]>;
  listOccurrences(billId: string): Promise<BillOccurrence[]>;
  /**
   * Materializes scheduled occurrences up to the horizon for every active
   * bill. Idempotent and safe to call on every screen load.
   */
  ensureOccurrencesAhead(): Promise<void>;
  /** Sum of pending expected amounts of active bills due in the current month. */
  monthDueTotal(): Promise<number>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This bill no longer exists.');
}

function validationError(code: string): AppError {
  return new AppError('validation', code);
}

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createBillService(repo: BillRepository, deps: BillServiceDeps = {}): BillService {
  const now = deps.now ?? nowIso;
  const nowDate = deps.nowDate ?? (() => new Date());
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Bill> {
    const bill = await repo.findById(id);
    if (!bill) {
      throw notFoundError();
    }
    return bill;
  }

  function occurrenceRowsFor(
    bill: Bill,
    lastDueOn: string | null,
    existingCount: number,
  ): { id: string; billId: string; dueOn: string; expectedAmountMinor: number; createdAt: string; updatedAt: string }[] {
    const timestamp = now();
    const horizonOn = addDaysIsoDate(todayIsoDate(nowDate()), OCCURRENCE_HORIZON_DAYS);
    const dates = pendingOccurrenceDates({
      firstDueOn: bill.firstDueOn,
      recurrence: bill.recurrence,
      installmentCount: bill.installmentCount,
      lastDueOn,
      existingCount,
      horizonOn,
    });
    return dates.map((dueOn) => ({
      id: generateId(),
      billId: bill.id,
      dueOn,
      expectedAmountMinor: bill.expectedAmountMinor,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }

  return {
    async listSummaries(options: { includeArchived?: boolean } = {}): Promise<BillSummary[]> {
      try {
        return await repo.listSummaries(options);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<Bill> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateBillInput): Promise<Bill> {
      const nameError = validateBillName(input.name);
      if (nameError) throw validationError(nameError);
      const amountError = validateBillAmount(input.expectedAmountMinor);
      if (amountError) throw validationError(amountError);
      const categoryError = validateBillCategory(input.category);
      if (categoryError) throw validationError(categoryError);
      const recurrenceError = validateBillRecurrence(input.recurrence);
      if (recurrenceError) throw validationError(recurrenceError);
      const dueError = validateBillDueDate(input.firstDueOn);
      if (dueError) throw validationError(dueError);
      const installmentsError = validateBillInstallmentCount(
        input.installmentCount ?? null,
        input.recurrence,
      );
      if (installmentsError) throw validationError(installmentsError);
      const reminderError = validateBillReminderDays(input.reminderDaysBefore ?? null);
      if (reminderError) throw validationError(reminderError);
      const notes = normalizeNotes(input.notes);
      const notesError = validateBillNotes(notes);
      if (notesError) throw validationError(notesError);

      const timestamp = now();
      const bill: Bill = {
        id: generateId(),
        name: input.name.trim(),
        category: input.category,
        expectedAmountMinor: input.expectedAmountMinor,
        recurrence: input.recurrence,
        firstDueOn: input.firstDueOn,
        installmentCount: input.installmentCount ?? null,
        reminderDaysBefore: input.reminderDaysBefore ?? null,
        notes,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const occurrences = occurrenceRowsFor(bill, null, 0);

      try {
        await repo.runInTransaction(async (txn) => {
          await txn.insert(bill);
          for (const occurrence of occurrences) {
            await txn.insertOccurrence(occurrence);
          }
        });
      } catch (error) {
        throw databaseError(error);
      }
      return bill;
    },

    async update(id: string, input: UpdateBillInput): Promise<Bill> {
      let existing: Bill;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }

      const name = input.name === undefined ? existing.name : input.name.trim();
      const nameError = validateBillName(name);
      if (nameError) throw validationError(nameError);

      const amount = input.expectedAmountMinor ?? existing.expectedAmountMinor;
      const amountError = validateBillAmount(amount);
      if (amountError) throw validationError(amountError);

      const category =
        input.category === undefined ? existing.category : asBillCategory(input.category);
      const categoryError = validateBillCategory(category);
      if (categoryError) throw validationError(categoryError);

      const reminderDays =
        input.reminderDaysBefore === undefined
          ? existing.reminderDaysBefore
          : input.reminderDaysBefore;
      const reminderError = validateBillReminderDays(reminderDays);
      if (reminderError) throw validationError(reminderError);

      const notes = input.notes === undefined ? existing.notes : normalizeNotes(input.notes);
      const notesError = validateBillNotes(notes);
      if (notesError) throw validationError(notesError);

      const updated: Bill = {
        ...existing,
        name,
        category,
        expectedAmountMinor: amount,
        reminderDaysBefore: reminderDays,
        notes,
        isArchived: input.isArchived ?? existing.isArchived,
        updatedAt: now(),
      };
      const amountChanged = amount !== existing.expectedAmountMinor;

      try {
        await repo.runInTransaction(async (txn) => {
          await txn.update(updated);
          if (amountChanged) {
            // Pending dues follow the new amount; paid history keeps the
            // amount it was actually settled at.
            await txn.syncPendingExpectedAmount(id, amount, updated.updatedAt);
          }
        });
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async setArchived(id: string, archived: boolean): Promise<Bill> {
      let existing: Bill;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      if (existing.isArchived === archived) {
        return existing;
      }
      const updated: Bill = { ...existing, isArchived: archived, updatedAt: now() };
      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async remove(id: string): Promise<void> {
      let deleted: boolean;
      try {
        deleted = await repo.deleteIfNoPayments(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (deleted) {
        return;
      }
      // Either the bill is gone, or it has payment history that must survive.
      let existing: Bill | null;
      try {
        existing = await repo.findById(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!existing) {
        throw notFoundError();
      }
      throw new AppError('conflict', 'bill_has_payments');
    },

    async listDue(filter: OccurrenceFilter = {}): Promise<BillDueItem[]> {
      try {
        return await repo.listOccurrences({ ...filter, status: 'pending' });
      } catch (error) {
        throw databaseError(error);
      }
    },

    async listHistory(filter: OccurrenceFilter = {}): Promise<BillDueItem[]> {
      try {
        return await repo.listOccurrences({
          includeArchivedBills: true,
          ...filter,
          status: 'paid',
        });
      } catch (error) {
        throw databaseError(error);
      }
    },

    async listOccurrences(billId: string): Promise<BillOccurrence[]> {
      try {
        return await repo.listByBill(billId);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async ensureOccurrencesAhead(): Promise<void> {
      let candidates;
      try {
        candidates = await repo.listGenerationCandidates();
      } catch (error) {
        throw databaseError(error);
      }
      try {
        // Deliberately not one big transaction: every insert is idempotent
        // (UNIQUE (bill_id, due_on) + ON CONFLICT DO NOTHING), so a partial
        // run self-heals on the next call and concurrent callers cannot
        // duplicate or corrupt the schedule.
        for (const candidate of candidates) {
          const rows = occurrenceRowsFor(candidate.bill, candidate.lastDueOn, candidate.occurrenceCount);
          for (const row of rows) {
            await repo.insertOccurrence(row);
          }
        }
      } catch (error) {
        throw databaseError(error);
      }
    },

    async monthDueTotal(): Promise<number> {
      const { startOn, nextStartOn } = monthBoundsIsoDate(nowDate());
      try {
        return await repo.sumPendingDueBetween(startOn, nextStartOn);
      } catch (error) {
        throw databaseError(error);
      }
    },
  };
}
