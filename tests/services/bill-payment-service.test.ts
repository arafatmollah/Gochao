import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { createBillService, type BillService } from '@/services/bill-service';
import {
  createBillPaymentService,
  expenseCategoryForBillCategory,
  type BillPaymentService,
} from '@/services/bill-payment-service';
import { createTransactionService } from '@/services/transaction-service';

import { makeAccount } from '../helpers/factories';
import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

function createTickClock(startSeconds = 0): () => string {
  let tick = startSeconds;
  return () => {
    const iso = `2026-10-11T08:00:${String(tick).padStart(2, '0')}.000Z`;
    tick += 1;
    return iso;
  };
}

function fixedNowDate(): Date {
  return new Date(2026, 9, 11, 12, 0, 0);
}

describe('BillPaymentService', () => {
  let db: TestDatabase;
  let repo: SqliteBillRepository;
  let bills: BillService;
  let payments: BillPaymentService;
  let billId: string;
  let firstDueId: string;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    repo = new SqliteBillRepository(db);
    let nextId = 0;
    // expo-crypto's randomUUID has no native module under jest, so tests
    // inject deterministic ids (same convention as the task service tests).
    bills = createBillService(repo, {
      now: createTickClock(),
      nowDate: fixedNowDate,
      generateId: () => `generated-${++nextId}`,
    });
    payments = createBillPaymentService(repo, { now: createTickClock(30), nowDate: fixedNowDate });

    const bill = await bills.create({
      name: 'Electricity',
      category: 'electricity',
      expectedAmountMinor: 125000,
      recurrence: 'monthly',
      firstDueOn: '2026-10-15',
    });
    billId = bill.id;
    const due = await bills.listDue();
    firstDueId = due[0].id;
  });

  afterEach(() => {
    db.close();
  });

  describe('recordPayment', () => {
    it('defaults to the expected amount and today, in integer minor units', async () => {
      const paid = await payments.recordPayment(firstDueId);

      expect(paid.status).toBe('paid');
      expect(paid.paidAmountMinor).toBe(125000);
      expect(paid.paidOn).toBe('2026-10-11');
      expect(paid.dueOn).toBe('2026-10-15');
    });

    it('records a custom amount and payment date', async () => {
      const paid = await payments.recordPayment(firstDueId, {
        paidAmountMinor: 130050,
        paidOn: '2026-10-09',
      });

      expect(paid.paidAmountMinor).toBe(130050);
      expect(paid.paidOn).toBe('2026-10-09');

      const stored = await payments.getOccurrence(firstDueId);
      expect(stored).toMatchObject({ paidAmountMinor: 130050, paidOn: '2026-10-09' });
    });

    it('is idempotent: repeating a recording keeps the original payment', async () => {
      const first = await payments.recordPayment(firstDueId, {
        paidAmountMinor: 125000,
        paidOn: '2026-10-09',
      });
      const second = await payments.recordPayment(firstDueId, {
        paidAmountMinor: 999999,
        paidOn: '2026-10-20',
      });

      expect(second).toEqual(first);
    });

    it('records exactly one payment even when called concurrently', async () => {
      const results = await Promise.all([
        payments.recordPayment(firstDueId, { paidAmountMinor: 100000 }),
        payments.recordPayment(firstDueId, { paidAmountMinor: 200000 }),
      ]);

      expect(results[0].status).toBe('paid');
      expect(results[1].status).toBe('paid');
      expect(results[0].paidAmountMinor).toBe(results[1].paidAmountMinor);

      const occurrences = await bills.listOccurrences(billId);
      const paidRows = occurrences.filter((occurrence) => occurrence.status === 'paid');
      expect(paidRows).toHaveLength(1);
      expect(paidRows[0].paidAmountMinor).toBe(results[0].paidAmountMinor);
    });

    it('rejects invalid amounts and dates without recording', async () => {
      await expect(
        payments.recordPayment(firstDueId, { paidAmountMinor: 0 }),
      ).rejects.toMatchObject({ code: 'validation', message: 'bill_paid_amount_invalid' });
      await expect(
        payments.recordPayment(firstDueId, { paidAmountMinor: -5 }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        payments.recordPayment(firstDueId, { paidAmountMinor: 10.5 }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        payments.recordPayment(firstDueId, { paidOn: '2026-02-30' }),
      ).rejects.toMatchObject({ code: 'validation', message: 'bill_paid_on_invalid' });

      const occurrence = await payments.getOccurrence(firstDueId);
      expect(occurrence.status).toBe('pending');
    });

    it('reports not-found for an unknown occurrence', async () => {
      await expect(payments.recordPayment('missing')).rejects.toMatchObject({
        code: 'not_found',
      });
    });

    it('no longer appears as due after recording, and appears in history', async () => {
      await payments.recordPayment(firstDueId);

      const due = await bills.listDue();
      expect(due.map((item) => item.id)).not.toContain(firstDueId);

      const history = await bills.listHistory();
      expect(history.map((item) => item.id)).toContain(firstDueId);
      expect(await bills.monthDueTotal()).toBe(0);
    });
  });

  describe('undoPayment', () => {
    it('reverts a paid occurrence and clears the payment fields', async () => {
      await payments.recordPayment(firstDueId, { paidAmountMinor: 130000 });
      const undone = await payments.undoPayment(firstDueId);

      expect(undone.status).toBe('pending');
      expect(undone.paidAmountMinor).toBeNull();
      expect(undone.paidOn).toBeNull();

      const due = await bills.listDue();
      expect(due.map((item) => item.id)).toContain(firstDueId);
    });

    it('is idempotent: undoing a pending occurrence is a safe no-op', async () => {
      const before = await payments.getOccurrence(firstDueId);
      const after = await payments.undoPayment(firstDueId);
      expect(after).toEqual(before);
    });

    it('allows re-recording after an undo without duplicating', async () => {
      await payments.recordPayment(firstDueId, { paidAmountMinor: 125000, paidOn: '2026-10-09' });
      await payments.undoPayment(firstDueId);
      const reRecorded = await payments.recordPayment(firstDueId, {
        paidAmountMinor: 140000,
        paidOn: '2026-10-12',
      });

      expect(reRecorded).toMatchObject({
        status: 'paid',
        paidAmountMinor: 140000,
        paidOn: '2026-10-12',
      });

      const occurrences = await bills.listOccurrences(billId);
      expect(occurrences.filter((occurrence) => occurrence.status === 'paid')).toHaveLength(1);
    });
  });

  describe('getOccurrence', () => {
    it('returns the occurrence joined with its bill fields', async () => {
      const occurrence = await payments.getOccurrence(firstDueId);
      expect(occurrence).toMatchObject({
        billId,
        billName: 'Electricity',
        billCategory: 'electricity',
      });
    });

    it('reports not-found for an unknown id', async () => {
      await expect(payments.getOccurrence('missing')).rejects.toMatchObject({
        code: 'not_found',
      });
    });
  });

  describe('linked expense integration (Module E)', () => {
    let accounts: SqliteAccountRepository;
    let transactions: SqliteTransactionRepository;
    let paymentsWithAccounts: BillPaymentService;

    beforeEach(async () => {
      accounts = new SqliteAccountRepository(db);
      transactions = new SqliteTransactionRepository(db);
      await accounts.insert(
        makeAccount({ id: 'acc-cash', name: 'Cash', openingBalanceMinor: 500_000 }),
      );
      let expenseId = 0;
      paymentsWithAccounts = createBillPaymentService(repo, {
        now: createTickClock(60),
        nowDate: fixedNowDate,
        generateId: () => `linked-expense-${++expenseId}`,
        accounts,
      });
    });

    it('files exactly one expense when recording with an account', async () => {
      await paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'acc-cash' });

      const activity = await transactions.listActivity();
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({
        kind: 'expense',
        amountMinor: 125_000,
        occurredOn: '2026-10-11',
        description: 'Electricity',
        accountId: 'acc-cash',
        categoryId: 'cat_expense_utilities',
        billOccurrenceId: firstDueId,
      });

      const [balance] = await accounts.listWithBalances();
      expect(balance.balanceMinor).toBe(500_000 - 125_000);
    });

    it('files the actual paid amount and date, not the expected ones', async () => {
      await paymentsWithAccounts.recordPayment(firstDueId, {
        accountId: 'acc-cash',
        paidAmountMinor: 130_050,
        paidOn: '2026-10-09',
      });

      const [expense] = await transactions.listActivity();
      expect(expense).toMatchObject({ amountMinor: 130_050, occurredOn: '2026-10-09' });
    });

    it('maps every bill category onto a seeded expense category', async () => {
      expect(expenseCategoryForBillCategory('electricity')).toBe('cat_expense_utilities');
      expect(expenseCategoryForBillCategory('internet')).toBe('cat_expense_utilities');
      expect(expenseCategoryForBillCategory('rent')).toBe('cat_expense_rent');
      expect(expenseCategoryForBillCategory('credit_card')).toBe('cat_expense_other');
      expect(expenseCategoryForBillCategory('subscription')).toBe('cat_expense_subscriptions');
      expect(expenseCategoryForBillCategory('education')).toBe('cat_expense_education');

      const rentBill = await bills.create({
        name: 'House rent',
        category: 'rent',
        expectedAmountMinor: 2_000_000,
        recurrence: 'monthly',
        firstDueOn: '2026-10-05',
      });
      const rentDue = (await bills.listOccurrences(rentBill.id)).find((o) => o.dueOn === '2026-10-05');
      await paymentsWithAccounts.recordPayment(rentDue!.id, { accountId: 'acc-cash' });

      const rentExpense = (await transactions.listActivity()).find(
        (row) => row.billOccurrenceId === rentDue!.id,
      );
      expect(rentExpense?.categoryId).toBe('cat_expense_rent');
    });

    it('does not duplicate the expense on repeated recordings', async () => {
      await paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'acc-cash' });
      await paymentsWithAccounts.recordPayment(firstDueId, {
        accountId: 'acc-cash',
        paidAmountMinor: 999_999,
      });

      expect(await transactions.listActivity()).toHaveLength(1);
    });

    it('creates exactly one expense even when recording concurrently', async () => {
      const results = await Promise.all([
        paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'acc-cash' }),
        paymentsWithAccounts.recordPayment(firstDueId, {
          accountId: 'acc-cash',
          paidAmountMinor: 200_000,
        }),
      ]);

      expect(results[0].paidAmountMinor).toBe(results[1].paidAmountMinor);
      const activity = await transactions.listActivity();
      expect(activity).toHaveLength(1);
      expect(activity[0].amountMinor).toBe(results[0].paidAmountMinor);
    });

    it('records the payment without any expense when no account is chosen', async () => {
      const paid = await payments.recordPayment(firstDueId);
      expect(paid.status).toBe('paid');
      expect(await transactions.listActivity()).toEqual([]);
    });

    it('rejects unknown or archived accounts without recording the payment', async () => {
      await expect(
        paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'missing' }),
      ).rejects.toMatchObject({ code: 'validation', message: 'account_unavailable' });

      await accounts.insert(
        makeAccount({ id: 'acc-old', name: 'Old bank', type: 'bank', isArchived: true }),
      );
      await expect(
        paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'acc-old' }),
      ).rejects.toMatchObject({ code: 'validation', message: 'account_unavailable' });

      // Without an accounts repository wired the service cannot verify an
      // account reference, so it refuses rather than filing blindly.
      await expect(
        payments.recordPayment(firstDueId, { accountId: 'acc-cash' }),
      ).rejects.toMatchObject({ code: 'validation', message: 'account_unavailable' });

      expect((await payments.getOccurrence(firstDueId)).status).toBe('pending');
      expect(await transactions.listActivity()).toEqual([]);
    });

    it('undoPayment reverses the linked expense in the same transaction', async () => {
      await paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'acc-cash' });
      expect(await transactions.listActivity()).toHaveLength(1);

      const undone = await paymentsWithAccounts.undoPayment(firstDueId);
      expect(undone.status).toBe('pending');
      expect(await transactions.listActivity()).toEqual([]);

      const [balance] = await accounts.listWithBalances();
      expect(balance.balanceMinor).toBe(500_000);
    });

    it('allows re-recording after an undo, still with a single expense', async () => {
      await paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'acc-cash' });
      await paymentsWithAccounts.undoPayment(firstDueId);
      await paymentsWithAccounts.recordPayment(firstDueId, {
        accountId: 'acc-cash',
        paidAmountMinor: 140_000,
        paidOn: '2026-10-12',
      });

      const activity = await transactions.listActivity();
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({ amountMinor: 140_000, occurredOn: '2026-10-12' });
    });

    it('keeps the linked-expense lock in the finance service', async () => {
      await paymentsWithAccounts.recordPayment(firstDueId, { accountId: 'acc-cash' });
      const [expense] = await transactions.listActivity();
      const finance = createTransactionService(transactions, {
        accounts,
        categories: new SqliteCategoryRepository(db),
      });
      await expect(finance.remove(expense.id)).rejects.toMatchObject({
        code: 'conflict',
        message: 'transaction_linked_to_bill',
      });
      expect(await transactions.listActivity()).toHaveLength(1);
    });
  });
});
