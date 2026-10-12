import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteFamilyMemberRepository } from '@/db/repositories/family-member-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createFamilyMemberService } from '@/services/family-member-service';
import type { FamilyRelationship } from '@/types/family';

export interface UseMemberFormResult {
  mode: 'new' | 'edit';
  loading: boolean;
  loadError: string | null;
  name: string;
  setName: (value: string) => void;
  relationship: FamilyRelationship;
  setRelationship: (relationship: FamilyRelationship) => void;
  contact: string;
  setContact: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  isArchived: boolean;
  /** Edit mode only; toggles the archived flag (persisted on save). */
  toggleArchived: () => void;
  saving: boolean;
  notice: string | null;
  clearNotice: () => void;
  createdAt: string | null;
  updatedAt: string | null;
  /** Resolves true when the member was stored and the screen may go back. */
  save: () => Promise<boolean>;
  /** Resolves true when the member was deleted and the screen may go back. */
  remove: () => Promise<boolean>;
}

/** Create/edit state for one family member. */
export function useMemberForm(memberId: string | null): UseMemberFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createFamilyMemberService(new SqliteFamilyMemberRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const [loading, setLoading] = useState(memberId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('other');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [isArchived, setIsArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!memberId) {
        setLoading(false);
        return;
      }
      try {
        const member = await service.getById(memberId);
        if (cancelled) return;
        setName(member.name);
        setRelationship(member.relationship);
        setContact(member.contact ?? '');
        setNotes(member.notes ?? '');
        setIsArchived(member.isArchived);
        setCreatedAt(member.createdAt);
        setUpdatedAt(member.updatedAt);
        setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(translateError(error, t));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service, memberId, t]);

  const editName = useCallback((value: string) => {
    setName(value);
    setNotice(null);
  }, []);

  const toggleArchived = useCallback(() => {
    setIsArchived((current) => !current);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const payload = {
      name,
      relationship,
      contact: contact.trim().length > 0 ? contact.trim() : null,
      notes: notes.trim().length > 0 ? notes.trim() : null,
      isArchived,
    };
    setSaving(true);
    try {
      if (memberId) {
        const updated = await service.update(memberId, payload);
        setUpdatedAt(updated.updatedAt);
      } else {
        await service.create(payload);
      }
      return true;
    } catch (error) {
      setNotice(translateError(error, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [service, memberId, name, relationship, contact, notes, isArchived, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!memberId) {
      return false;
    }
    setSaving(true);
    try {
      await service.remove(memberId);
      return true;
    } catch (error) {
      setNotice(translateError(error, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [service, memberId, t]);

  return {
    mode: memberId ? 'edit' : 'new',
    loading,
    loadError,
    name,
    setName: editName,
    relationship,
    setRelationship,
    contact,
    setContact,
    notes,
    setNotes,
    isArchived,
    toggleArchived,
    saving,
    notice,
    clearNotice: () => setNotice(null),
    createdAt,
    updatedAt,
    save,
    remove,
  };
}
