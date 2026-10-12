import type { FamilyMemberRepository } from '@/db/repositories/family-member-repository';
import type {
  CreateFamilyMemberInput,
  FamilyMember,
  FamilyMemberFilter,
  UpdateFamilyMemberInput,
} from '@/types/family';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import {
  validateMemberContact,
  validateMemberName,
  validateMemberNotes,
  validateMemberRelationship,
} from './family-validation';

export interface FamilyMemberServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface FamilyMemberService {
  list(filter?: FamilyMemberFilter): Promise<FamilyMember[]>;
  count(filter?: FamilyMemberFilter): Promise<number>;
  getById(id: string): Promise<FamilyMember>;
  create(input: CreateFamilyMemberInput): Promise<FamilyMember>;
  update(id: string, input: UpdateFamilyMemberInput): Promise<FamilyMember>;
  /** Archives or restores a member. Idempotent. */
  setArchived(id: string, archived: boolean): Promise<FamilyMember>;
  /**
   * Deletes a member outright. Refused while family requests still
   * reference the member — archive instead, or delete those first.
   */
  remove(id: string): Promise<void>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This family member no longer exists.');
}

function assertValidName(name: string): string {
  const error = validateMemberName(name);
  if (error) {
    throw new AppError('validation', error);
  }
  return name.trim();
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function assertValid<T>(
  value: T,
  check: (value: T) => string | null,
): T {
  const error = check(value);
  if (error) {
    throw new AppError('validation', error);
  }
  return value;
}

export function createFamilyMemberService(
  repo: FamilyMemberRepository,
  deps: FamilyMemberServiceDeps = {},
): FamilyMemberService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<FamilyMember> {
    const member = await repo.findById(id);
    if (!member) {
      throw notFoundError();
    }
    return member;
  }

  function buildFields(input: {
    name?: string;
    relationship?: FamilyMember['relationship'];
    contact?: string | null;
    notes?: string | null;
  }) {
    const name =
      input.name === undefined ? undefined : assertValidName(input.name);
    const relationship =
      input.relationship === undefined
        ? undefined
        : assertValid(input.relationship, validateMemberRelationship);
    const contact = normalizeOptional(input.contact);
    if (input.contact !== undefined) {
      assertValid(contact, validateMemberContact);
    }
    const notes = normalizeOptional(input.notes);
    if (input.notes !== undefined) {
      assertValid(notes, validateMemberNotes);
    }
    return { name, relationship, contact, notes };
  }

  return {
    async list(filter: FamilyMemberFilter = {}): Promise<FamilyMember[]> {
      try {
        return await repo.list(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async count(filter: FamilyMemberFilter = {}): Promise<number> {
      try {
        return await repo.count(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<FamilyMember> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateFamilyMemberInput): Promise<FamilyMember> {
      const name = assertValidName(input.name);
      const relationship = assertValid(input.relationship, validateMemberRelationship);
      const contact = normalizeOptional(input.contact);
      assertValid(contact, validateMemberContact);
      const notes = normalizeOptional(input.notes);
      assertValid(notes, validateMemberNotes);

      const timestamp = now();
      const member: FamilyMember = {
        id: generateId(),
        name,
        relationship,
        contact,
        notes,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await repo.insert(member);
      } catch (error) {
        throw databaseError(error);
      }
      return member;
    },

    async update(id: string, input: UpdateFamilyMemberInput): Promise<FamilyMember> {
      let existing: FamilyMember;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const fields = buildFields(input);
      const updated: FamilyMember = {
        ...existing,
        name: fields.name ?? existing.name,
        relationship: fields.relationship ?? existing.relationship,
        contact: input.contact === undefined ? existing.contact : fields.contact,
        notes: input.notes === undefined ? existing.notes : fields.notes,
        isArchived: input.isArchived === undefined ? existing.isArchived : input.isArchived,
        updatedAt: now(),
      };

      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async setArchived(id: string, archived: boolean): Promise<FamilyMember> {
      let existing: FamilyMember;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
      if (existing.isArchived === archived) {
        return existing;
      }

      const updated: FamilyMember = {
        ...existing,
        isArchived: archived,
        updatedAt: now(),
      };
      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async remove(id: string): Promise<void> {
      try {
        await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      let deleted: boolean;
      try {
        deleted = await repo.deleteIfUnreferenced(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!deleted) {
        throw new AppError('conflict', 'family_member_has_requests');
      }
    },
  };
}
