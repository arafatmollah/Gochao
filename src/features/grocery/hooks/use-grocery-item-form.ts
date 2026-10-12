import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteGroceryRepository } from '@/db/repositories/grocery-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createGroceryService } from '@/services/grocery-service';
import {
  parseQuantityInput,
  validateGroceryItemName,
  validateGroceryNotes,
  validateGroceryPrice,
  validateGroceryQuantity,
  validateGroceryUnit,
} from '@/services/grocery-validation';
import {
  GROCERY_ITEM_NAME_MAX_LENGTH,
  GROCERY_NOTES_MAX_LENGTH,
  GROCERY_UNIT_MAX_LENGTH,
} from '@/types/grocery';
import { minorToInputText, parseAmountToMinor } from '@/utils/money';

export interface GroceryMemberOption {
  id: string;
  name: string;
}

export interface UseGroceryItemFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;
  members: GroceryMemberOption[];

  name: string;
  setName: (value: string) => void;
  /** Validation code (see `grocery-validation`); translate before rendering. */
  nameError: string | null;
  quantityText: string;
  setQuantityText: (value: string) => void;
  quantityError: string | null;
  unit: string;
  setUnit: (value: string) => void;
  unitError: string | null;
  estimatedText: string;
  setEstimatedText: (value: string) => void;
  estimatedError: string | null;
  actualText: string;
  setActualText: (value: string) => void;
  actualError: string | null;
  assignedMemberId: string | null;
  setAssignedMemberId: (id: string | null) => void;
  notes: string;
  setNotes: (value: string) => void;
  notesError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useGroceryItemForm(listId: string | null, itemId?: string): UseGroceryItemFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createGroceryService(new SqliteGroceryRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = itemId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [members, setMembers] = useState<GroceryMemberOption[]>([]);

  const [name, setName] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [unit, setUnit] = useState('');
  const [estimatedText, setEstimatedText] = useState('');
  const [actualText, setActualText] = useState('');
  const [assignedMemberId, setAssignedMemberId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [estimatedError, setEstimatedError] = useState<string | null>(null);
  const [actualError, setActualError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    service
      .listActiveMembers()
      .then((loaded) => {
        if (active) setMembers(loaded);
      })
      .catch(() => {
        if (active) setMembers([]);
      });
    if (!isEdit || !itemId) {
      return () => {
        active = false;
      };
    }
    service
      .getItemById(itemId)
      .then((item) => {
        if (!active) return;
        setName(item.name);
        setQuantityText(String(item.quantity));
        setUnit(item.unit ?? '');
        setEstimatedText(item.estimatedPriceMinor === null ? '' : minorToInputText(item.estimatedPriceMinor));
        setActualText(item.actualPriceMinor === null ? '' : minorToInputText(item.actualPriceMinor));
        setAssignedMemberId(item.assignedMemberId);
        setNotes(item.notes ?? '');
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
  }, [isEdit, itemId, service, reloadKey, t]);

  const validate = useCallback((): {
    quantity: number;
    estimatedPriceMinor: number | null;
    actualPriceMinor: number | null;
  } | null => {
    const nameValidation = validateGroceryItemName(name);
    setNameError(nameValidation);

    const quantity = parseQuantityInput(quantityText);
    const quantityValidation =
      quantity === null ? 'grocery_quantity_invalid' : validateGroceryQuantity(quantity);
    setQuantityError(quantity === null ? quantityValidation : null);

    const unitValidation = validateGroceryUnit(unit);
    setUnitError(unitValidation);

    const estimatedTrimmed = estimatedText.trim();
    const estimatedPriceMinor =
      estimatedTrimmed === '' ? null : parseAmountToMinor(estimatedTrimmed);
    const estimatedValidation =
      estimatedTrimmed !== '' && estimatedPriceMinor === null
        ? 'grocery_price_invalid'
        : validateGroceryPrice(estimatedPriceMinor);
    setEstimatedError(estimatedValidation);

    const actualTrimmed = actualText.trim();
    const actualPriceMinor = actualTrimmed === '' ? null : parseAmountToMinor(actualTrimmed);
    const actualValidation =
      actualTrimmed !== '' && actualPriceMinor === null
        ? 'grocery_price_invalid'
        : validateGroceryPrice(actualPriceMinor);
    setActualError(actualValidation);

    const notesValidation = validateGroceryNotes(notes);
    setNotesError(notesValidation);

    const valid =
      nameValidation === null &&
      quantityValidation === null &&
      unitValidation === null &&
      estimatedValidation === null &&
      actualValidation === null &&
      notesValidation === null;
    return valid && quantity !== null ? { quantity, estimatedPriceMinor, actualPriceMinor } : null;
  }, [name, quantityText, unit, estimatedText, actualText, notes]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || deleting) {
      return false;
    }
    setFormError(null);
    const parsed = validate();
    if (!parsed) {
      return false;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        quantity: parsed.quantity,
        unit: unit.trim() === '' ? null : unit,
        estimatedPriceMinor: parsed.estimatedPriceMinor,
        actualPriceMinor: parsed.actualPriceMinor,
        assignedMemberId,
        notes,
      };
      if (isEdit && itemId) {
        await service.updateItem(itemId, payload);
      } else {
        if (!listId) {
          setFormError(t('errors.generic'));
          return false;
        }
        await service.createItem(listId, payload);
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    deleting,
    validate,
    isEdit,
    itemId,
    listId,
    service,
    name,
    unit,
    assignedMemberId,
    notes,
    t,
  ]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !itemId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.removeItem(itemId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, itemId, saving, deleting, service, t]);

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
    members,
    name,
    setName: (value) => {
      setName(value);
      if (nameError) setNameError(null);
    },
    nameError,
    quantityText,
    setQuantityText: (value) => {
      setQuantityText(value);
      if (quantityError) setQuantityError(null);
    },
    quantityError,
    unit,
    setUnit: (value) => {
      setUnit(value);
      if (unitError) setUnitError(null);
    },
    unitError,
    estimatedText,
    setEstimatedText: (value) => {
      setEstimatedText(value);
      if (estimatedError) setEstimatedError(null);
    },
    estimatedError,
    actualText,
    setActualText: (value) => {
      setActualText(value);
      if (actualError) setActualError(null);
    },
    actualError,
    assignedMemberId,
    setAssignedMemberId,
    notes,
    setNotes: (value) => {
      setNotes(value);
      if (notesError) setNotesError(null);
    },
    notesError,
    formError,
    saving,
    deleting,
    submit,
    remove,
  };
}

export { GROCERY_ITEM_NAME_MAX_LENGTH, GROCERY_NOTES_MAX_LENGTH, GROCERY_UNIT_MAX_LENGTH };
