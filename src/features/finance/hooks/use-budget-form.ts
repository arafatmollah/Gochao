import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteBudgetRepository } from '@/db/repositories/budget-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createBudgetService } from '@/services/budget-service';
import { createCategoryService } from '@/services/category-service';
import { amountError as amountValidationError } from '@/services/finance-validation';
import type { Category, CategoryWithUsage } from '@/types/finance';
import { minorToInputText, parseAmountToMinor } from '@/utils/money';

export interface UseBudgetFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  /** Expense categories without a budget yet (new mode only). */
  availableCategories: CategoryWithUsage[];
  /** Locked category of an existing budget (edit mode). */
  lockedCategory: Pick<Category, 'id' | 'name' | 'isBuiltin'> | null;

  categoryId: string | null;
  chooseCategory: (id: string) => void;
  amountText: string;
  setAmountText: (value: string) => void;
  /** Validation code (`budget_amount_invalid`); translate before rendering. */
  amountError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useBudgetForm(budgetId?: string): UseBudgetFormResult {
  const db = useSQLiteContext();
  const budgetService = useMemo(
    () =>
      createBudgetService(new SqliteBudgetRepository(toSqlDatabase(db)), {
        categories: new SqliteCategoryRepository(toSqlDatabase(db)),
      }),
    [db],
  );
  const categoryService = useMemo(
    () => createCategoryService(new SqliteCategoryRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = budgetId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [availableCategories, setAvailableCategories] = useState<CategoryWithUsage[]>([]);
  const [lockedCategory, setLockedCategory] = useState<Pick<
    Category,
    'id' | 'name' | 'isBuiltin'
  > | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // New mode: offer only non-archived expense categories that have no budget yet.
  useEffect(() => {
    if (isEdit) {
      return;
    }
    let active = true;
    categoryService
      .listWithUsage({ kind: 'expense' })
      .then((categories) => {
        if (!active) return;
        const available = categories.filter((category) => category.budgetId === null);
        setAvailableCategories(available);
        setCategoryId((current) => current ?? available[0]?.id ?? null);
        setLoadState('ready');
      })
      .catch((loadFailure: unknown) => {
        if (!active) return;
        setLoadError(translateError(loadFailure, t));
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [isEdit, categoryService, reloadKey, t]);

  // Edit mode: load the budget plus its (possibly archived) category for display.
  useEffect(() => {
    if (!isEdit || !budgetId) {
      return;
    }
    let active = true;
    budgetService
      .getById(budgetId)
      .then(async (budget) => {
        const category = await categoryService.getById(budget.categoryId);
        if (!active) return;
        setLockedCategory({ id: category.id, name: category.name, isBuiltin: category.isBuiltin });
        setCategoryId(category.id);
        setAmountText(minorToInputText(budget.amountMinor));
        setLoadError(null);
        setLoadState('ready');
      })
      .catch((loadFailure: unknown) => {
        if (!active) return;
        setLoadError(translateError(loadFailure, t));
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [isEdit, budgetId, budgetService, categoryService, reloadKey, t]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || deleting) {
      return false;
    }
    setFormError(null);

    const parsed = parseAmountToMinor(amountText);
    const validation = amountValidationError(parsed, 'budget_amount_invalid');
    const categoryValidation = categoryId === null ? 'budget_category_invalid' : null;
    setAmountError(validation ?? categoryValidation);
    if (validation !== null || categoryValidation !== null || parsed === null || !categoryId) {
      return false;
    }

    setSaving(true);
    try {
      if (isEdit && budgetId) {
        await budgetService.update(budgetId, { amountMinor: parsed });
      } else {
        await budgetService.create({ categoryId, amountMinor: parsed });
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, deleting, amountText, categoryId, isEdit, budgetId, budgetService, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !budgetId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await budgetService.remove(budgetId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, budgetId, saving, deleting, budgetService, t]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }, []);

  return {
    isEdit,
    loadState,
    loadError,
    retryLoad,
    availableCategories,
    lockedCategory,
    categoryId,
    chooseCategory: (id) => {
      setCategoryId(id);
      if (amountError === 'budget_category_invalid') setAmountError(null);
    },
    amountText,
    setAmountText: (value) => {
      setAmountText(value);
      if (amountError) setAmountError(null);
    },
    amountError,
    formError,
    saving,
    deleting,
    submit,
    remove,
  };
}
