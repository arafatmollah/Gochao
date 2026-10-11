import {
  SqliteAccountRepository,
  type AccountRepository,
} from '@/db/repositories/account-repository';
import {
  SqliteBudgetRepository,
  type BudgetRepository,
} from '@/db/repositories/budget-repository';
import {
  SqliteCategoryRepository,
  type CategoryRepository,
} from '@/db/repositories/category-repository';
import {
  SqliteTransactionRepository,
  type TransactionRepository,
} from '@/db/repositories/transaction-repository';
import {
  SqliteTransferRepository,
  type TransferRepository,
} from '@/db/repositories/transfer-repository';

import {
  makeAccount,
  makeBudget,
  makeCategory,
  makeTransaction,
  makeTransfer,
} from '../helpers/factories';
import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

interface FinanceHarness {
  db: TestDatabase;
  accounts: AccountRepository;
  categories: CategoryRepository;
  transactions: TransactionRepository;
  transfers: TransferRepository;
  budgets: BudgetRepository;
}

async function setup(): Promise<FinanceHarness> {
  const db = await createMigratedDatabase();
  return {
    db,
    accounts: new SqliteAccountRepository(db),
    categories: new SqliteCategoryRepository(db),
    transactions: new SqliteTransactionRepository(db),
    transfers: new SqliteTransferRepository(db),
    budgets: new SqliteBudgetRepository(db),
  };
}

/** Seeds two accounts (Cash ৳1,000 opening; Bank ৳500) for flow tests. */
async function seedAccounts(accounts: AccountRepository): Promise<void> {
  await accounts.insert(
    makeAccount({ id: 'acc-cash', name: 'Cash', openingBalanceMinor: 100_000 }),
  );
  await accounts.insert(
    makeAccount({ id: 'acc-bank', name: 'Bank', type: 'bank', openingBalanceMinor: 50_000 }),
  );
}

describe('finance repositories', () => {
  describe('account repository', () => {
    it('round-trips accounts and computes an empty balance from the opening balance', async () => {
      const { db, accounts } = await setup();
      await accounts.insert(makeAccount({ id: 'a1', name: 'Cash', openingBalanceMinor: 123_456 }));

      const loaded = await accounts.findById('a1');
      expect(loaded).toMatchObject({
        id: 'a1',
        name: 'Cash',
        type: 'cash',
        openingBalanceMinor: 123_456,
        isArchived: false,
      });

      const [withBalance] = await accounts.listWithBalances();
      expect(withBalance.balanceMinor).toBe(123_456);
      expect(withBalance.transactionCount).toBe(0);
      expect(withBalance.transferCount).toBe(0);
      db.close();
    });

    it('rejects duplicate names case-insensitively at the SQL level', async () => {
      const { db, accounts } = await setup();
      await accounts.insert(makeAccount({ id: 'a1', name: 'Cash' }));
      await expect(accounts.insert(makeAccount({ id: 'a2', name: 'cash' }))).rejects.toThrow();
      db.close();
    });

    it('hides archived accounts unless requested and keeps them archived-first', async () => {
      const { db, accounts } = await setup();
      await accounts.insert(makeAccount({ id: 'a1', name: 'Cash' }));
      await accounts.insert(
        makeAccount({ id: 'a2', name: 'Old bank', type: 'bank', isArchived: true }),
      );

      expect((await accounts.list()).map((a) => a.id)).toEqual(['a1']);
      const all = await accounts.list({ includeArchived: true });
      expect(all.map((a) => a.id)).toEqual(['a1', 'a2']);
      db.close();
    });

    it('deleteIfUnused refuses accounts with transactions and allows pristine ones', async () => {
      const { db, accounts, transactions } = await setup();
      await seedAccounts(accounts);
      await transactions.insert(makeTransaction({ id: 'tx1', accountId: 'acc-cash' }));

      expect(await accounts.deleteIfUnused('acc-cash')).toBe(false);
      expect(await accounts.deleteIfUnused('acc-bank')).toBe(true);
      expect(await accounts.findById('acc-bank')).toBeNull();
      db.close();
    });

    it('refuses to delete accounts referenced only by transfers', async () => {
      const { db, accounts, transfers } = await setup();
      await seedAccounts(accounts);
      await transfers.insert(makeTransfer({ fromAccountId: 'acc-cash', toAccountId: 'acc-bank' }));

      expect(await accounts.deleteIfUnused('acc-cash')).toBe(false);
      expect(await accounts.deleteIfUnused('acc-bank')).toBe(false);
      db.close();
    });
  });

  describe('category repository', () => {
    it('lists seeded built-ins per kind in sort order', async () => {
      const { db, categories } = await setup();
      const income = await categories.list({ kind: 'income' });
      expect(income.map((c) => c.id)).toEqual([
        'cat_income_salary',
        'cat_income_freelance',
        'cat_income_business',
        'cat_income_gift',
        'cat_income_refund',
        'cat_income_other',
      ]);
      expect(income.every((c) => c.isBuiltin)).toBe(true);

      const expense = await categories.list({ kind: 'expense' });
      expect(expense).toHaveLength(13);
      expect(expense[0]).toMatchObject({ id: 'cat_expense_food', name: 'Food' });
      db.close();
    });

    it('sorts custom categories after built-ins and rejects duplicate kind+name', async () => {
      const { db, categories } = await setup();
      await categories.insert(
        makeCategory({
          id: 'custom-1',
          kind: 'expense',
          name: 'Bazaar extra',
          isBuiltin: false,
          sortOrder: 999,
        }),
      );
      const expense = await categories.list({ kind: 'expense' });
      expect(expense[expense.length - 1].id).toBe('custom-1');

      await expect(
        categories.insert(
          makeCategory({
            id: 'custom-2',
            kind: 'expense',
            name: 'bazaar extra',
            isBuiltin: false,
            sortOrder: 999,
          }),
        ),
      ).rejects.toThrow();
      db.close();
    });

    it('deleteIfUnused protects built-ins and in-use customs', async () => {
      const { db, accounts, categories, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await categories.insert(
        makeCategory({
          id: 'custom-1',
          kind: 'expense',
          name: 'Cats',
          isBuiltin: false,
          sortOrder: 999,
        }),
      );
      expect(await categories.deleteIfUnused('cat_expense_food')).toBe(false);

      await transactions.insert(
        makeTransaction({ id: 'tx1', categoryId: 'custom-1', accountId: 'acc-1' }),
      );
      expect(await categories.deleteIfUnused('custom-1')).toBe(false);
      expect(await categories.deleteIfUnused('cat_income_salary')).toBe(false);
      db.close();
    });

    it('lists usage counts and the budget id for each category', async () => {
      const { db, accounts, categories, transactions, budgets } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(makeTransaction({ id: 'tx1', categoryId: 'cat_expense_food' }));
      await transactions.insert(makeTransaction({ id: 'tx2', categoryId: 'cat_expense_food' }));
      await budgets.insert(makeBudget({ id: 'b1', categoryId: 'cat_expense_food' }));

      const withUsage = await categories.listWithUsage({ kind: 'expense' });
      const food = withUsage.find((c) => c.id === 'cat_expense_food');
      expect(food).toMatchObject({ transactionCount: 2, budgetId: 'b1' });
      const other = withUsage.find((c) => c.id === 'cat_expense_other');
      expect(other).toMatchObject({ transactionCount: 0, budgetId: null });
      db.close();
    });
  });

  describe('transaction repository', () => {
    it('round-trips transactions and rejects invalid amounts and blank descriptions', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(
        makeTransaction({ id: 'tx1', amountMinor: 2500, description: 'Tea' }),
      );

      const loaded = await transactions.findById('tx1');
      expect(loaded).toMatchObject({ amountMinor: 2500, description: 'Tea', kind: 'expense' });

      await expect(
        transactions.insert(makeTransaction({ id: 'tx2', amountMinor: 0 })),
      ).rejects.toThrow();
      await expect(
        transactions.insert(makeTransaction({ id: 'tx3', amountMinor: -100 })),
      ).rejects.toThrow();

      // Direct SQL: the CHECK also rejects a blank description.
      await expect(
        db.runAsync(
          `INSERT INTO transactions (id, kind, amount_minor, account_id, category_id,
             occurred_on, description, created_at, updated_at)
           VALUES ('tx4', 'expense', 100, 'acc-1', 'cat_expense_food', '2026-10-11', '   ', 'x', 'x')`,
        ),
      ).rejects.toThrow();
      db.close();
    });

    it('enforces a valid occurred_on date pattern at the SQL level', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await expect(
        transactions.insert(makeTransaction({ id: 'tx1', occurredOn: '11/10/2026' })),
      ).rejects.toThrow();
      db.close();
    });

    it('updates and deletes transactions', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(makeTransaction({ id: 'tx1' }));

      await transactions.update(
        makeTransaction({ id: 'tx1', amountMinor: 9_900, description: 'Updated' }),
      );
      expect(await transactions.findById('tx1')).toMatchObject({
        amountMinor: 9_900,
        description: 'Updated',
      });

      expect(await transactions.delete('tx1')).toBe(true);
      expect(await transactions.findById('tx1')).toBeNull();
      db.close();
    });

    it('builds the unified activity feed with transfers, newest first', async () => {
      const { db, accounts, transactions, transfers } = await setup();
      await seedAccounts(accounts);
      await transactions.insert(
        makeTransaction({
          id: 'tx1',
          accountId: 'acc-cash',
          occurredOn: '2026-10-10',
          description: 'Lunch',
        }),
      );
      await transfers.insert(
        makeTransfer({
          id: 'tr1',
          fromAccountId: 'acc-cash',
          toAccountId: 'acc-bank',
          occurredOn: '2026-10-11',
          amountMinor: 20_000,
          notes: 'ATM',
        }),
      );
      await transactions.insert(
        makeTransaction({
          id: 'tx2',
          kind: 'income',
          accountId: 'acc-bank',
          categoryId: 'cat_income_salary',
          occurredOn: '2026-10-09',
          description: 'Salary',
        }),
      );

      const rows = await transactions.listActivity();
      expect(rows.map((r) => r.id)).toEqual(['tr1', 'tx1', 'tx2']);
      expect(rows[0]).toMatchObject({
        kind: 'transfer',
        accountName: 'Cash',
        toAccountName: 'Bank',
        description: null,
        categoryId: null,
      });
      expect(rows[1]).toMatchObject({
        kind: 'expense',
        categoryName: 'Food',
        categoryIsBuiltin: true,
      });
      db.close();
    });

    it('filters the activity feed by kind, account, category, dates, and search', async () => {
      const { db, accounts, transactions, transfers } = await setup();
      await seedAccounts(accounts);
      await transactions.insert(
        makeTransaction({
          id: 'tx1',
          accountId: 'acc-cash',
          occurredOn: '2026-10-05',
          description: 'Lunch 50% off',
        }),
      );
      await transactions.insert(
        makeTransaction({
          id: 'tx2',
          kind: 'income',
          accountId: 'acc-bank',
          categoryId: 'cat_income_salary',
          occurredOn: '2026-09-30',
          description: 'Salary',
        }),
      );
      await transfers.insert(
        makeTransfer({
          id: 'tr1',
          fromAccountId: 'acc-cash',
          toAccountId: 'acc-bank',
          occurredOn: '2026-10-06',
          notes: 'ATM',
        }),
      );

      expect((await transactions.listActivity({ kind: 'income' })).map((r) => r.id)).toEqual([
        'tx2',
      ]);
      expect((await transactions.listActivity({ kind: 'transfer' })).map((r) => r.id)).toEqual([
        'tr1',
      ]);
      expect(
        (await transactions.listActivity({ accountId: 'acc-bank' })).map((r) => r.id).sort(),
      ).toEqual(['tr1', 'tx2']);
      expect(
        (await transactions.listActivity({ categoryId: 'cat_income_salary' })).map((r) => r.id),
      ).toEqual(['tx2']);
      expect(
        (await transactions.listActivity({ fromOn: '2026-10-01', toOn: '2026-10-31' })).map(
          (r) => r.id,
        ),
      ).toEqual(['tr1', 'tx1']);
      expect((await transactions.listActivity({ search: '50%' })).map((r) => r.id)).toEqual([
        'tx1',
      ]);
      expect((await transactions.listActivity({ search: 'ATM' })).map((r) => r.id)).toEqual([
        'tr1',
      ]);
      db.close();
    });

    it('paginates the activity feed with limit and offset', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      for (let index = 1; index <= 5; index += 1) {
        await transactions.insert(
          makeTransaction({
            id: `tx${index}`,
            occurredOn: `2026-10-0${index}`,
            description: `Item ${index}`,
          }),
        );
      }

      const page1 = await transactions.listActivity({ limit: 2, offset: 0 });
      const page2 = await transactions.listActivity({ limit: 2, offset: 2 });
      const page3 = await transactions.listActivity({ limit: 2, offset: 4 });
      expect(page1.map((r) => r.id)).toEqual(['tx5', 'tx4']);
      expect(page2.map((r) => r.id)).toEqual(['tx3', 'tx2']);
      expect(page3.map((r) => r.id)).toEqual(['tx1']);
      db.close();
    });

    it('sums income and expense excluding transfers', async () => {
      const { db, accounts, transactions, transfers } = await setup();
      await seedAccounts(accounts);
      await transactions.insert(makeTransaction({ id: 'tx1', accountId: 'acc-cash', amountMinor: 30_000 }));
      await transactions.insert(makeTransaction({ id: 'tx2', accountId: 'acc-cash', amountMinor: 20_000 }));
      await transactions.insert(
        makeTransaction({
          id: 'tx3',
          kind: 'income',
          categoryId: 'cat_income_salary',
          accountId: 'acc-bank',
          amountMinor: 100_000,
        }),
      );
      await transfers.insert(
        makeTransfer({
          fromAccountId: 'acc-cash',
          toAccountId: 'acc-bank',
          amountMinor: 500_000,
        }),
      );

      const totals = await transactions.sumActivity();
      expect(totals).toEqual({ incomeMinor: 100_000, expenseMinor: 50_000 });
      db.close();
    });

    it('groups totals by category, largest first', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(makeTransaction({ id: 'tx1', amountMinor: 10_000 }));
      await transactions.insert(makeTransaction({ id: 'tx2', amountMinor: 40_000 }));
      await transactions.insert(
        makeTransaction({ id: 'tx3', categoryId: 'cat_expense_transport', amountMinor: 25_000 }),
      );

      const totals = await transactions.sumByCategory({
        kind: 'expense',
        fromOn: '2026-10-01',
        toOn: '2026-10-31',
      });
      expect(totals).toEqual([
        expect.objectContaining({ categoryId: 'cat_expense_food', totalMinor: 50_000 }),
        expect.objectContaining({ categoryId: 'cat_expense_transport', totalMinor: 25_000 }),
      ]);
      db.close();
    });

    it('computes per-month totals within a range', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(
        makeTransaction({ id: 'tx1', amountMinor: 10_000, occurredOn: '2026-08-15' }),
      );
      await transactions.insert(
        makeTransaction({ id: 'tx2', amountMinor: 20_000, occurredOn: '2026-09-01' }),
      );
      await transactions.insert(
        makeTransaction({
          id: 'tx3',
          kind: 'income',
          categoryId: 'cat_income_salary',
          amountMinor: 50_000,
          occurredOn: '2026-09-30',
        }),
      );
      await transactions.insert(
        makeTransaction({ id: 'tx4', amountMinor: 999, occurredOn: '2026-07-31' }),
      );

      const months = await transactions.monthTotals({
        fromOn: '2026-08-01',
        nextStartOn: '2026-10-01',
      });
      expect(months).toEqual([
        { monthKey: '2026-08', incomeMinor: 0, expenseMinor: 10_000, netMinor: -10_000 },
        { monthKey: '2026-09', incomeMinor: 50_000, expenseMinor: 20_000, netMinor: 30_000 },
      ]);
      db.close();
    });
  });

  describe('transfer repository', () => {
    it('round-trips a transfer and rejects self-transfers at the SQL level', async () => {
      const { db, accounts, transfers } = await setup();
      await seedAccounts(accounts);
      await transfers.insert(
        makeTransfer({
          id: 'tr1',
          fromAccountId: 'acc-cash',
          toAccountId: 'acc-bank',
          notes: 'To savings',
        }),
      );
      expect(await transfers.findById('tr1')).toMatchObject({
        fromAccountId: 'acc-cash',
        toAccountId: 'acc-bank',
        amountMinor: 100_000,
        notes: 'To savings',
      });

      await expect(
        transfers.insert(
          makeTransfer({ id: 'tr2', fromAccountId: 'acc-cash', toAccountId: 'acc-cash' }),
        ),
      ).rejects.toThrow();
      db.close();
    });

    it('updates and deletes transfers', async () => {
      const { db, accounts, transfers } = await setup();
      await seedAccounts(accounts);
      await transfers.insert(
        makeTransfer({ id: 'tr1', fromAccountId: 'acc-cash', toAccountId: 'acc-bank' }),
      );
      await transfers.update(
        makeTransfer({
          id: 'tr1',
          fromAccountId: 'acc-cash',
          toAccountId: 'acc-bank',
          amountMinor: 1_000,
        }),
      );
      expect((await transfers.findById('tr1'))?.amountMinor).toBe(1_000);
      expect(await transfers.delete('tr1')).toBe(true);
      expect(await transfers.findById('tr1')).toBeNull();
      db.close();
    });
  });

  describe('budget repository', () => {
    it('enforces one budget per category', async () => {
      const { db, budgets } = await setup();
      await budgets.insert(makeBudget({ id: 'b1', categoryId: 'cat_expense_food' }));
      await expect(
        budgets.insert(makeBudget({ id: 'b2', categoryId: 'cat_expense_food' })),
      ).rejects.toThrow();
      db.close();
    });

    it('derives spend from stored transactions within the month bounds only', async () => {
      const { db, accounts, transactions, budgets } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(
        makeTransaction({ id: 'tx1', amountMinor: 30_000, occurredOn: '2026-10-01' }),
      );
      await transactions.insert(
        makeTransaction({ id: 'tx2', amountMinor: 20_000, occurredOn: '2026-10-31' }),
      );
      await transactions.insert(
        makeTransaction({ id: 'tx3', amountMinor: 99_999, occurredOn: '2026-11-01' }),
      );
      await transactions.insert(
        makeTransaction({ id: 'tx4', amountMinor: 88_888, occurredOn: '2026-09-30' }),
      );
      // Income in the same category must not reduce spending.
      await transactions.insert(
        makeTransaction({
          id: 'tx5',
          kind: 'income',
          categoryId: 'cat_expense_food',
          amountMinor: 10_000,
        }),
      );
      await budgets.insert(
        makeBudget({ id: 'b1', categoryId: 'cat_expense_food', amountMinor: 100_000 }),
      );

      const [food] = await budgets.listWithUsage({
        startOn: '2026-10-01',
        nextStartOn: '2026-11-01',
      });
      expect(food).toMatchObject({
        categoryId: 'cat_expense_food',
        amountMinor: 100_000,
        spentMinor: 50_000,
        categoryIsBuiltin: true,
      });
      db.close();
    });
  });

  /**
   * Master prompt §14: explicit financial-correctness cases. The finance
   * module is not complete until these pass.
   */
  describe('financial correctness (master prompt §14)', () => {
    it('1. opening balance plus income', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1', openingBalanceMinor: 100_000 }));
      await transactions.insert(
        makeTransaction({
          id: 'tx1',
          kind: 'income',
          categoryId: 'cat_income_salary',
          amountMinor: 50_000,
        }),
      );

      const [account] = await accounts.listWithBalances();
      expect(account.balanceMinor).toBe(150_000);
      db.close();
    });

    it('2. expense reduces the correct account only', async () => {
      const { db, accounts, transactions } = await setup();
      await seedAccounts(accounts);
      await transactions.insert(
        makeTransaction({ id: 'tx1', accountId: 'acc-cash', amountMinor: 25_000 }),
      );

      const balances = await accounts.listWithBalances();
      expect(balances.find((a) => a.id === 'acc-cash')?.balanceMinor).toBe(75_000);
      expect(balances.find((a) => a.id === 'acc-bank')?.balanceMinor).toBe(50_000);
      db.close();
    });

    it('3. transfer reduces one account and increases the other', async () => {
      const { db, accounts, transfers } = await setup();
      await seedAccounts(accounts);
      await transfers.insert(
        makeTransfer({ fromAccountId: 'acc-cash', toAccountId: 'acc-bank', amountMinor: 30_000 }),
      );

      const balances = await accounts.listWithBalances();
      expect(balances.find((a) => a.id === 'acc-cash')?.balanceMinor).toBe(70_000);
      expect(balances.find((a) => a.id === 'acc-bank')?.balanceMinor).toBe(80_000);
      db.close();
    });

    it('4. transfers are excluded from income and expense reports', async () => {
      const { db, accounts, transactions, transfers } = await setup();
      await seedAccounts(accounts);
      await transactions.insert(makeTransaction({ id: 'tx1', accountId: 'acc-cash' }));
      await transfers.insert(
        makeTransfer({
          fromAccountId: 'acc-cash',
          toAccountId: 'acc-bank',
          amountMinor: 999_999,
        }),
      );

      // Sanity: the expense exists once, unchanged by the transfer.
      expect(await transactions.sumActivity()).toEqual({ incomeMinor: 0, expenseMinor: 50_000 });

      const { db: db2, accounts: accounts2, transactions: transactions2, transfers: transfers2 } =
        await setup();
      await seedAccounts(accounts2);
      await transfers2.insert(
        makeTransfer({
          fromAccountId: 'acc-cash',
          toAccountId: 'acc-bank',
          amountMinor: 999_999,
        }),
      );
      expect(await transactions2.sumActivity()).toEqual({ incomeMinor: 0, expenseMinor: 0 });
      expect(
        await transactions2.sumByCategory({
          kind: 'expense',
          fromOn: '2026-01-01',
          toOn: '2026-12-31',
        }),
      ).toEqual([]);
      db.close();
      db2.close();
    });

    it('5. monthly date boundaries include first/last day and exclude neighbours', async () => {
      const { db, accounts, transactions, budgets } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(
        makeTransaction({ id: 'tx1', amountMinor: 100, occurredOn: '2026-10-01' }),
      );
      await transactions.insert(
        makeTransaction({ id: 'tx2', amountMinor: 200, occurredOn: '2026-10-31' }),
      );
      await transactions.insert(
        makeTransaction({ id: 'tx3', amountMinor: 999, occurredOn: '2026-11-01' }),
      );
      await budgets.insert(makeBudget({ id: 'b1' }));

      const { incomeMinor, expenseMinor } = await transactions.sumActivity({
        fromOn: '2026-10-01',
        toOn: '2026-10-31',
      });
      expect(incomeMinor).toBe(0);
      expect(expenseMinor).toBe(300);

      const [food] = await budgets.listWithUsage({
        startOn: '2026-10-01',
        nextStartOn: '2026-11-01',
      });
      expect(food.spentMinor).toBe(300);
      db.close();
    });

    it('6. editing and deleting a transaction updates balances', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1', openingBalanceMinor: 100_000 }));
      await transactions.insert(makeTransaction({ id: 'tx1', amountMinor: 40_000 }));
      expect((await accounts.listWithBalances())[0].balanceMinor).toBe(60_000);

      await transactions.update(makeTransaction({ id: 'tx1', amountMinor: 10_000 }));
      expect((await accounts.listWithBalances())[0].balanceMinor).toBe(90_000);

      await transactions.delete('tx1');
      expect((await accounts.listWithBalances())[0].balanceMinor).toBe(100_000);
      db.close();
    });

    it('8. refunds are income transactions that offset expenses (documented refund model)', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1', openingBalanceMinor: 0 }));
      await transactions.insert(
        makeTransaction({ id: 'tx1', amountMinor: 30_000, description: 'Order' }),
      );
      await transactions.insert(
        makeTransaction({
          id: 'tx2',
          kind: 'income',
          categoryId: 'cat_income_refund',
          amountMinor: 30_000,
          description: 'Order refund',
        }),
      );

      const totals = await transactions.sumActivity();
      expect(totals).toEqual({ incomeMinor: 30_000, expenseMinor: 30_000 });
      // The refund model keeps the original expense intact and records the
      // recovery as income; net savings and the balance both land at zero.
      expect((await accounts.listWithBalances())[0].balanceMinor).toBe(0);
      db.close();
    });

    it('9. budget calculation: spent, remaining, and exceeded status from stored rows', async () => {
      const { db, accounts, transactions, budgets } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await transactions.insert(makeTransaction({ id: 'tx1', amountMinor: 120_000 }));
      await budgets.insert(
        makeBudget({ id: 'b1', categoryId: 'cat_expense_food', amountMinor: 100_000 }),
      );

      const [budget] = await budgets.listWithUsage({
        startOn: '2026-10-01',
        nextStartOn: '2026-11-01',
      });
      expect(budget.spentMinor).toBe(120_000);
      expect(budget.spentMinor - budget.amountMinor).toBe(20_000);
      expect(budget.spentMinor > budget.amountMinor).toBe(true);
      db.close();
    });

    it('keeps bill-linked expenses unique per occurrence at the SQL level', async () => {
      const { db, accounts, transactions } = await setup();
      await accounts.insert(makeAccount({ id: 'acc-1' }));
      await db.runAsync(
        `INSERT INTO bills (id, name, category, expected_amount_minor, recurrence, first_due_on, created_at, updated_at)
         VALUES ('bill-1', 'Internet', 'internet', 125000, 'monthly', '2026-10-05', 'x', 'x')`,
      );
      await db.runAsync(
        `INSERT INTO bill_occurrences (id, bill_id, due_on, expected_amount_minor, status, created_at, updated_at)
         VALUES ('occ-1', 'bill-1', '2026-10-05', 125000, 'pending', 'x', 'x')`,
      );
      await transactions.insert(makeTransaction({ id: 'tx1', billOccurrenceId: 'occ-1' }));

      await expect(
        transactions.insert(makeTransaction({ id: 'tx2', billOccurrenceId: 'occ-1' })),
      ).rejects.toThrow();
      db.close();
    });
  });
});
