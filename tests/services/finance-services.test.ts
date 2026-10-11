import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteBudgetRepository } from '@/db/repositories/budget-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { SqliteTransferRepository } from '@/db/repositories/transfer-repository';
import { createAccountService, type AccountService } from '@/services/account-service';
import { createBudgetService, type BudgetService } from '@/services/budget-service';
import { createCategoryService, type CategoryService } from '@/services/category-service';
import { createTransactionService, type TransactionService } from '@/services/transaction-service';
import { createTransferService, type TransferService } from '@/services/transfer-service';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

function createTickClock(startSeconds = 0): () => string {
  let tick = startSeconds;
  return () => {
    const iso = `2026-10-11T08:00:${String(tick).padStart(2, '0')}.000Z`;
    tick += 1;
    return iso;
  };
}

interface FinanceServices {
  db: TestDatabase;
  accounts: AccountService;
  categories: CategoryService;
  transactions: TransactionService;
  transfers: TransferService;
  budgets: BudgetService;
}

async function setup(): Promise<FinanceServices> {
  const db = await createMigratedDatabase();
  const accountRepo = new SqliteAccountRepository(db);
  const categoryRepo = new SqliteCategoryRepository(db);
  const transactionRepo = new SqliteTransactionRepository(db);
  const transferRepo = new SqliteTransferRepository(db);
  const budgetRepo = new SqliteBudgetRepository(db);
  let nextId = 0;
  const deps = {
    now: createTickClock(),
    generateId: () => `generated-${++nextId}`,
  };
  return {
    db,
    accounts: createAccountService(accountRepo, deps),
    categories: createCategoryService(categoryRepo, deps),
    transactions: createTransactionService(transactionRepo, {
      accounts: accountRepo,
      categories: categoryRepo,
      ...deps,
    }),
    transfers: createTransferService(transferRepo, { accounts: accountRepo, ...deps }),
    budgets: createBudgetService(budgetRepo, { categories: categoryRepo, ...deps }),
  };
}

/** Regex-matches the stable validation code carried by `AppError('validation')`. */
async function expectValidation(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code: 'validation', message: code });
}

async function expectConflict(promise: Promise<unknown>, reason: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code: 'conflict', message: reason });
}

describe('finance services', () => {
  describe('AccountService', () => {
    it('creates a trimmed account with a fixed currency and zero default opening balance', async () => {
      const { db, accounts } = await setup();
      const account = await accounts.create({ name: '  Cash  ', type: 'cash' });
      expect(account).toMatchObject({
        name: 'Cash',
        type: 'cash',
        currency: 'BDT',
        openingBalanceMinor: 0,
        isArchived: false,
      });
      expect(account.createdAt).toBe(account.updatedAt);
      db.close();
    });

    it('rejects invalid input with stable codes', async () => {
      const { db, accounts } = await setup();
      await expectValidation(accounts.create({ name: '   ', type: 'cash' }), 'account_name_required');
      await expectValidation(
        accounts.create({ name: 'x'.repeat(141), type: 'cash' }),
        'account_name_too_long',
      );
      await expectValidation(
        accounts.create({ name: 'Wallet', type: 'cash', openingBalanceMinor: -1 }),
        'account_opening_balance_invalid',
      );
      await expectValidation(
        accounts.create({ name: 'Wallet', type: 'cash', openingBalanceMinor: 10.5 }),
        'account_opening_balance_invalid',
      );
      db.close();
    });

    it('treats names case-insensitively for uniqueness', async () => {
      const { db, accounts } = await setup();
      await accounts.create({ name: 'Cash', type: 'cash' });
      await expectConflict(accounts.create({ name: 'CASH', type: 'cash' }), 'account_name_taken');

      const bank = await accounts.create({ name: 'Bank', type: 'bank' });
      await expect(accounts.update(bank.id, { name: 'cash' })).rejects.toMatchObject({
        code: 'conflict',
      });
      db.close();
    });

    it('updates fields and toggles archiving', async () => {
      const { db, accounts } = await setup();
      const account = await accounts.create({ name: 'Cash', type: 'cash', openingBalanceMinor: 100 });
      const updated = await accounts.update(account.id, {
        name: 'Wallet',
        openingBalanceMinor: 200,
      });
      expect(updated).toMatchObject({ name: 'Wallet', openingBalanceMinor: 200 });

      const archived = await accounts.setArchived(account.id, true);
      expect(archived.isArchived).toBe(true);
      expect((await accounts.list()).map((a) => a.id)).toEqual([]);
      expect((await accounts.list({ includeArchived: true })).map((a) => a.id)).toEqual([account.id]);
      db.close();
    });

    it('removes unused accounts and refuses in-use ones with a conflict', async () => {
      const { db, accounts, transactions } = await setup();
      const cash = await accounts.create({ name: 'Cash', type: 'cash' });
      const bank = await accounts.create({ name: 'Bank', type: 'bank' });
      await transactions.create({
        kind: 'expense',
        amountMinor: 5_000,
        accountId: cash.id,
        categoryId: 'cat_expense_food',
        occurredOn: '2026-10-11',
        description: 'Tea',
      });

      await expectConflict(accounts.remove(cash.id), 'account_in_use');
      await accounts.remove(bank.id);
      await expect(accounts.getById(bank.id)).rejects.toMatchObject({ code: 'not_found' });
      db.close();
    });

    it('computes balances through the service listing', async () => {
      const { db, accounts, transactions, transfers } = await setup();
      const cash = await accounts.create({ name: 'Cash', type: 'cash', openingBalanceMinor: 100_000 });
      const bank = await accounts.create({ name: 'Bank', type: 'bank', openingBalanceMinor: 50_000 });
      await transactions.create({
        kind: 'income',
        amountMinor: 30_000,
        accountId: cash.id,
        categoryId: 'cat_income_salary',
        occurredOn: '2026-10-11',
        description: 'Salary',
      });
      await transactions.create({
        kind: 'expense',
        amountMinor: 10_000,
        accountId: cash.id,
        categoryId: 'cat_expense_food',
        occurredOn: '2026-10-11',
        description: 'Groceries',
      });
      await transfers.create({
        fromAccountId: cash.id,
        toAccountId: bank.id,
        amountMinor: 20_000,
        occurredOn: '2026-10-11',
      });

      const balances = await accounts.listWithBalances();
      expect(balances.find((a) => a.id === cash.id)?.balanceMinor).toBe(100_000);
      expect(balances.find((a) => a.id === bank.id)?.balanceMinor).toBe(70_000);
      db.close();
    });
  });

  describe('CategoryService', () => {
    it('creates custom categories after built-ins and rejects duplicates per kind', async () => {
      const { db, categories } = await setup();
      const custom = await categories.create({ kind: 'expense', name: 'Bazaar' });
      expect(custom).toMatchObject({ isBuiltin: false, sortOrder: 999 });

      const expense = await categories.list({ kind: 'expense' });
      expect(expense[expense.length - 1].id).toBe(custom.id);

      await expectConflict(
        categories.create({ kind: 'expense', name: 'bazaar' }),
        'category_name_taken',
      );
      // Same name in the other kind is fine.
      const income = await categories.create({ kind: 'income', name: 'Bazaar' });
      expect(income.kind).toBe('income');
      db.close();
    });

    it('validates name and kind', async () => {
      const { db, categories } = await setup();
      await expectValidation(
        categories.create({ kind: 'expense', name: '  ' }),
        'category_name_required',
      );
      await expectValidation(
        categories.create({ kind: 'expense', name: 'x'.repeat(61) }),
        'category_name_too_long',
      );
      db.close();
    });

    it('refuses renaming built-ins but allows archiving them', async () => {
      const { db, categories } = await setup();
      await expectConflict(
        categories.update('cat_expense_food', { name: 'Foods' }),
        'category_builtin',
      );
      const archived = await categories.update('cat_expense_food', { isArchived: true });
      expect(archived.isArchived).toBe(true);
      expect((await categories.list({ kind: 'expense' })).some((c) => c.id === 'cat_expense_food')).toBe(
        false,
      );
      db.close();
    });

    it('removes only custom unused categories; in-use and built-ins conflict', async () => {
      const { db, categories, accounts, transactions } = await setup();
      await expectConflict(categories.remove('cat_expense_food'), 'category_builtin');

      const used = await categories.create({ kind: 'expense', name: 'Used' });
      const unused = await categories.create({ kind: 'expense', name: 'Unused' });
      const account = await accounts.create({ name: 'Cash', type: 'cash' });
      await transactions.create({
        kind: 'expense',
        amountMinor: 1_000,
        accountId: account.id,
        categoryId: used.id,
        occurredOn: '2026-10-11',
        description: 'Something',
      });

      await expectConflict(categories.remove(used.id), 'category_in_use');
      await categories.remove(unused.id);
      await expect(categories.getById(unused.id)).rejects.toMatchObject({ code: 'not_found' });
      db.close();
    });
  });

  describe('TransactionService', () => {
    it('creates a normalized transaction and rejects unknown or archived references', async () => {
      const { db, accounts, transactions } = await setup();
      const account = await accounts.create({ name: 'Cash', type: 'cash' });
      const created = await transactions.create({
        kind: 'expense',
        amountMinor: 25_000,
        accountId: account.id,
        categoryId: 'cat_expense_food',
        occurredOn: '2026-10-11',
        description: '  Lunch  ',
        recipient: '   ',
        notes: '  ',
      });
      expect(created).toMatchObject({
        description: 'Lunch',
        recipient: null,
        notes: null,
        billOccurrenceId: null,
      });

      await expectValidation(
        transactions.create({
          kind: 'expense',
          amountMinor: 0,
          accountId: account.id,
          categoryId: 'cat_expense_food',
          occurredOn: '2026-10-11',
          description: 'x',
        }),
        'transaction_amount_invalid',
      );
      await expectValidation(
        transactions.create({
          kind: 'expense',
          amountMinor: 100,
          accountId: 'nope',
          categoryId: 'cat_expense_food',
          occurredOn: '2026-10-11',
          description: 'x',
        }),
        'account_unavailable',
      );
      await expectValidation(
        transactions.create({
          kind: 'income',
          amountMinor: 100,
          accountId: account.id,
          categoryId: 'cat_expense_food',
          occurredOn: '2026-10-11',
          description: 'x',
        }),
        'category_unavailable',
      );
      await expectValidation(
        transactions.create({
          kind: 'expense',
          amountMinor: 100,
          accountId: account.id,
          categoryId: 'cat_expense_food',
          occurredOn: '11/10/2026',
          description: 'x',
        }),
        'transaction_date_invalid',
      );

      await accounts.setArchived(account.id, true);
      await expectValidation(
        transactions.create({
          kind: 'expense',
          amountMinor: 100,
          accountId: account.id,
          categoryId: 'cat_expense_food',
          occurredOn: '2026-10-11',
          description: 'x',
        }),
        'account_unavailable',
      );
      db.close();
    });

    it('resolves partial updates and keeps edits to archived references allowed', async () => {
      const { db, accounts, categories, transactions } = await setup();
      const cash = await accounts.create({ name: 'Cash', type: 'cash' });
      const bank = await accounts.create({ name: 'Bank', type: 'bank' });
      const moved = await categories.create({ kind: 'expense', name: 'Moved' });
      const tx = await transactions.create({
        kind: 'expense',
        amountMinor: 5_000,
        accountId: cash.id,
        categoryId: 'cat_expense_food',
        occurredOn: '2026-10-11',
        description: 'Tea',
      });

      const updated = await transactions.update(tx.id, {
        amountMinor: 6_000,
        accountId: bank.id,
        categoryId: moved.id,
      });
      expect(updated).toMatchObject({
        amountMinor: 6_000,
        accountId: bank.id,
        categoryId: moved.id,
        description: 'Tea',
      });

      // Archiving the account/category keeps the existing record editable.
      await accounts.setArchived(bank.id, true);
      await categories.update(moved.id, { isArchived: true });
      const afterArchive = await transactions.update(tx.id, { description: 'Coffee' });
      expect(afterArchive.description).toBe('Coffee');

      // ...but moving the record to a different archived account is refused.
      await accounts.setArchived(cash.id, true);
      await expectValidation(
        transactions.update(tx.id, { accountId: cash.id }),
        'account_unavailable',
      );
      db.close();
    });

    it('deletes transactions and reports missing ones', async () => {
      const { db, accounts, transactions } = await setup();
      const account = await accounts.create({ name: 'Cash', type: 'cash' });
      const tx = await transactions.create({
        kind: 'expense',
        amountMinor: 1_000,
        accountId: account.id,
        categoryId: 'cat_expense_food',
        occurredOn: '2026-10-11',
        description: 'Tea',
      });
      await transactions.remove(tx.id);
      await expect(transactions.getById(tx.id)).rejects.toMatchObject({ code: 'not_found' });
      await expect(transactions.remove(tx.id)).rejects.toMatchObject({ code: 'not_found' });
      db.close();
    });

    it('locks bill-linked expenses against edits and deletes', async () => {
      const { db, accounts, transactions } = await setup();
      const account = await accounts.create({ name: 'Cash', type: 'cash' });
      await db.runAsync(
        `INSERT INTO bills (id, name, category, expected_amount_minor, recurrence, first_due_on, created_at, updated_at)
         VALUES ('bill-1', 'Internet', 'internet', 125000, 'monthly', '2026-10-05', 'x', 'x')`,
      );
      await db.runAsync(
        `INSERT INTO bill_occurrences (id, bill_id, due_on, expected_amount_minor, status, paid_amount_minor, paid_on, created_at, updated_at)
         VALUES ('occ-1', 'bill-1', '2026-10-05', 125000, 'paid', 125000, '2026-10-05', 'x', 'x')`,
      );
      const tx = await transactions.create({
        kind: 'expense',
        amountMinor: 125_000,
        accountId: account.id,
        categoryId: 'cat_expense_utilities',
        occurredOn: '2026-10-05',
        description: 'Internet bill',
      });
      // Simulate the bill-payment link (set by migration-level constraint).
      await db.runAsync(`UPDATE transactions SET bill_occurrence_id = 'occ-1' WHERE id = ?`, [tx.id]);

      await expectConflict(transactions.update(tx.id, { amountMinor: 1 }), 'transaction_linked_to_bill');
      await expectConflict(transactions.remove(tx.id), 'transaction_linked_to_bill');
      db.close();
    });

    it('returns net totals and grouped reports', async () => {
      const { db, accounts, transactions } = await setup();
      const account = await accounts.create({ name: 'Cash', type: 'cash' });
      await transactions.create({
        kind: 'income',
        amountMinor: 100_000,
        accountId: account.id,
        categoryId: 'cat_income_salary',
        occurredOn: '2026-10-01',
        description: 'Salary',
      });
      await transactions.create({
        kind: 'expense',
        amountMinor: 40_000,
        accountId: account.id,
        categoryId: 'cat_expense_food',
        occurredOn: '2026-10-11',
        description: 'Groceries',
      });

      expect(await transactions.sumActivity({ fromOn: '2026-10-01', toOn: '2026-10-31' })).toEqual({
        incomeMinor: 100_000,
        expenseMinor: 40_000,
        netMinor: 60_000,
      });

      const byCategory = await transactions.sumByCategory({
        kind: 'expense',
        fromOn: '2026-10-01',
        toOn: '2026-10-31',
      });
      expect(byCategory).toEqual([
        expect.objectContaining({ categoryId: 'cat_expense_food', totalMinor: 40_000 }),
      ]);

      const months = await transactions.monthTotals({
        fromOn: '2026-10-01',
        nextStartOn: '2026-11-01',
      });
      expect(months).toEqual([
        { monthKey: '2026-10', incomeMinor: 100_000, expenseMinor: 40_000, netMinor: 60_000 },
      ]);
      db.close();
    });
  });

  describe('TransferService', () => {
    it('creates transfers between distinct active accounts only', async () => {
      const { db, accounts, transfers } = await setup();
      const cash = await accounts.create({ name: 'Cash', type: 'cash' });
      const bank = await accounts.create({ name: 'Bank', type: 'bank' });

      const transfer = await transfers.create({
        fromAccountId: cash.id,
        toAccountId: bank.id,
        amountMinor: 30_000,
        occurredOn: '2026-10-11',
        notes: '  ',
      });
      expect(transfer).toMatchObject({ amountMinor: 30_000, notes: null });

      await expectValidation(
        transfers.create({
          fromAccountId: cash.id,
          toAccountId: cash.id,
          amountMinor: 100,
          occurredOn: '2026-10-11',
        }),
        'transfer_same_account',
      );
      await expectValidation(
        transfers.create({
          fromAccountId: cash.id,
          toAccountId: bank.id,
          amountMinor: 0,
          occurredOn: '2026-10-11',
        }),
        'transfer_amount_invalid',
      );
      await expectValidation(
        transfers.create({
          fromAccountId: cash.id,
          toAccountId: bank.id,
          amountMinor: 100,
          occurredOn: '2026-13-01',
        }),
        'transfer_date_invalid',
      );

      await accounts.setArchived(bank.id, true);
      await expectValidation(
        transfers.create({
          fromAccountId: cash.id,
          toAccountId: bank.id,
          amountMinor: 100,
          occurredOn: '2026-10-11',
        }),
        'account_unavailable',
      );
      db.close();
    });

    it('updates and removes transfers', async () => {
      const { db, accounts, transfers } = await setup();
      const cash = await accounts.create({ name: 'Cash', type: 'cash' });
      const bank = await accounts.create({ name: 'Bank', type: 'bank' });
      const transfer = await transfers.create({
        fromAccountId: cash.id,
        toAccountId: bank.id,
        amountMinor: 30_000,
        occurredOn: '2026-10-11',
      });

      const updated = await transfers.update(transfer.id, { amountMinor: 10_000 });
      expect(updated.amountMinor).toBe(10_000);

      await transfers.remove(transfer.id);
      await expect(transfers.getById(transfer.id)).rejects.toMatchObject({ code: 'not_found' });
      await expect(transfers.remove(transfer.id)).rejects.toMatchObject({ code: 'not_found' });
      db.close();
    });
  });

  describe('BudgetService', () => {
    it('creates monthly budgets for expense categories only, once per category', async () => {
      const { db, budgets } = await setup();
      const budget = await budgets.create({
        categoryId: 'cat_expense_food',
        amountMinor: 500_000,
      });
      expect(budget).toMatchObject({ categoryId: 'cat_expense_food', amountMinor: 500_000 });

      await expectConflict(
        budgets.create({ categoryId: 'cat_expense_food', amountMinor: 1_000 }),
        'budget_exists',
      );
      await expectValidation(
        budgets.create({ categoryId: 'cat_income_salary', amountMinor: 1_000 }),
        'budget_category_invalid',
      );
      await expectValidation(
        budgets.create({ categoryId: 'missing', amountMinor: 1_000 }),
        'budget_category_invalid',
      );
      await expectValidation(
        budgets.create({ categoryId: 'cat_expense_rent', amountMinor: 0 }),
        'budget_amount_invalid',
      );
      db.close();
    });

    it('updates amounts, removes budgets, and derives spend for the month', async () => {
      const { db, accounts, budgets, transactions } = await setup();
      const account = await accounts.create({ name: 'Cash', type: 'cash' });
      const budget = await budgets.create({ categoryId: 'cat_expense_food', amountMinor: 500_000 });
      await transactions.create({
        kind: 'expense',
        amountMinor: 120_000,
        accountId: account.id,
        categoryId: 'cat_expense_food',
        occurredOn: '2026-10-11',
        description: 'Groceries',
      });

      const [usage] = await budgets.listWithUsage({
        startOn: '2026-10-01',
        nextStartOn: '2026-11-01',
      });
      expect(usage).toMatchObject({ spentMinor: 120_000, amountMinor: 500_000 });

      const updated = await budgets.update(budget.id, { amountMinor: 100_000 });
      expect(updated.amountMinor).toBe(100_000);

      await budgets.remove(budget.id);
      await expect(budgets.getById(budget.id)).rejects.toMatchObject({ code: 'not_found' });
      expect(
        await budgets.listWithUsage({ startOn: '2026-10-01', nextStartOn: '2026-11-01' }),
      ).toEqual([]);
      db.close();
    });
  });
});
