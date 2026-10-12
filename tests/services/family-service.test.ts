import { SqliteFamilyMemberRepository } from '@/db/repositories/family-member-repository';
import { SqliteFamilyRequestRepository } from '@/db/repositories/family-request-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import {
  createFamilyMemberService,
  type FamilyMemberService,
} from '@/services/family-member-service';
import {
  createFamilyRequestService,
  type FamilyRequestService,
} from '@/services/family-request-service';
import { createTaskService } from '@/services/task-service';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

/** Deterministic clock: each call returns the next timestamp in a fixed sequence. */
function createTickClock(startSeconds = 0): () => string {
  let tick = startSeconds;
  return () => {
    const iso = `2026-10-11T08:00:${String(tick).padStart(2, '0')}.000Z`;
    tick += 1;
    return iso;
  };
}

describe('Family services', () => {
  let db: TestDatabase;
  let memberRepo: SqliteFamilyMemberRepository;
  let requestRepo: SqliteFamilyRequestRepository;
  let memberService: FamilyMemberService;
  let requestService: FamilyRequestService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    memberRepo = new SqliteFamilyMemberRepository(db);
    requestRepo = new SqliteFamilyRequestRepository(db);
    nextId = 0;

    const taskService = createTaskService(new SqliteTaskRepository(db), {
      now: createTickClock(100),
      generateId: () => `task-${++nextId}`,
    });
    memberService = createFamilyMemberService(memberRepo, {
      now: createTickClock(),
      generateId: () => `member-${++nextId}`,
    });
    requestService = createFamilyRequestService(requestRepo, {
      members: memberRepo,
      tasks: taskService,
      now: createTickClock(50),
      generateId: () => `request-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('FamilyMemberService', () => {
    it('creates a member with trimmed fields and empty optional text normalized to null', async () => {
      const member = await memberService.create({
        name: '  Ayesha  ',
        relationship: 'spouse',
        contact: '  01711-000000  ',
        notes: '   ',
      });

      expect(member).toMatchObject({
        id: 'member-1',
        name: 'Ayesha',
        relationship: 'spouse',
        contact: '01711-000000',
        notes: null,
        isArchived: false,
      });
      expect(member.createdAt).toBe(member.updatedAt);
      expect(await memberRepo.findById(member.id)).toEqual(member);
    });

    it('rejects blank names, unknown relationships, and over-long text', async () => {
      await expect(
        memberService.create({ name: '   ', relationship: 'spouse' }),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_member_name_required' });

      await expect(
        memberService.create({ name: 'x'.repeat(81), relationship: 'spouse' }),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_member_name_too_long' });

      await expect(
        memberService.create({ name: 'Ayesha', relationship: 'cousin' as never }),
      ).rejects.toMatchObject({
        code: 'validation',
        message: 'family_member_relationship_invalid',
      });

      const created = await memberService.create({ name: 'Ayesha', relationship: 'spouse' });
      await expect(
        memberService.update(created.id, { contact: 'c'.repeat(201) }),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_member_contact_too_long' });
      await expect(
        memberService.update(created.id, { notes: 'n'.repeat(1001) }),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_member_notes_too_long' });
    });

    it('updates only the given fields and clears optional text with null', async () => {
      const created = await memberService.create({
        name: 'Karim',
        relationship: 'father',
        contact: '01711-111111',
        notes: 'Diabetic',
      });

      const renamed = await memberService.update(created.id, { name: 'Karim Uddin' });
      expect(renamed).toMatchObject({
        name: 'Karim Uddin',
        relationship: 'father',
        contact: '01711-111111',
        notes: 'Diabetic',
      });
      expect(renamed.updatedAt).not.toBe(renamed.createdAt);

      const cleared = await memberService.update(created.id, { notes: null, contact: '  ' });
      expect(cleared.notes).toBeNull();
      expect(cleared.contact).toBeNull();
    });

    it('archives and restores a member idempotently', async () => {
      const created = await memberService.create({ name: 'Mitu', relationship: 'daughter' });

      const archived = await memberService.setArchived(created.id, true);
      expect(archived.isArchived).toBe(true);
      const again = await memberService.setArchived(created.id, true);
      expect(again.isArchived).toBe(true);

      const restored = await memberService.setArchived(created.id, false);
      expect(restored.isArchived).toBe(false);

      const active = await memberService.list({ archived: false });
      expect(active.map((member) => member.id)).toEqual([created.id]);
    });

    it('deletes an unreferenced member but refuses while requests point at them', async () => {
      const free = await memberService.create({ name: 'Free', relationship: 'other' });
      const busy = await memberService.create({ name: 'Busy', relationship: 'father' });
      await requestService.create({ title: 'Buy medicine', memberId: busy.id });

      await expect(memberService.remove(free.id)).resolves.toBeUndefined();

      await expect(memberService.remove(busy.id)).rejects.toMatchObject({
        code: 'conflict',
        message: 'family_member_has_requests',
      });
      expect(await memberRepo.findById(busy.id)).not.toBeNull();

      const archived = await memberService.setArchived(busy.id, true);
      expect(archived.isArchived).toBe(true);

      await expect(memberService.remove('missing')).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('FamilyRequestService', () => {
    it('creates a request with defaults and a verified member', async () => {
      const member = await memberService.create({ name: 'Ayesha', relationship: 'spouse' });

      const request = await requestService.create({
        title: '  Buy medicine for father  ',
        memberId: member.id,
        category: 'medicine',
        deadline: '2026-10-20',
        estimatedCostMinor: 450_00,
        details: 'From Square Pharmacy',
      });

      expect(request).toMatchObject({
        title: 'Buy medicine for father',
        memberId: member.id,
        category: 'medicine',
        priority: 'medium',
        status: 'open',
        deadline: '2026-10-20',
        estimatedCostMinor: 450_00,
        details: 'From Square Pharmacy',
      });

      const [item] = await requestService.list({});
      expect(item.memberName).toBe('Ayesha');
      expect(item.taskId).toBeNull();
    });

    it('defaults the category to other and normalizes empty details', async () => {
      const request = await requestService.create({ title: 'Fix the fan', details: '  ' });
      expect(request.category).toBe('other');
      expect(request.details).toBeNull();
    });

    it('rejects invalid input without writing rows', async () => {
      await expect(requestService.create({ title: '   ' })).rejects.toMatchObject({
        code: 'validation',
        message: 'family_request_title_required',
      });
      await expect(
        requestService.create({ title: 'Late', deadline: '20/10/2026' }),
      ).rejects.toMatchObject({
        code: 'validation',
        message: 'family_request_deadline_invalid',
      });
      await expect(
        requestService.create({ title: 'Free?', estimatedCostMinor: 0 }),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_request_cost_invalid' });
      await expect(
        requestService.create({ title: 'Odd', category: 'travel' as never }),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_request_category_invalid' });
      await expect(
        requestService.create({ title: 'Who?', memberId: 'missing-member' }),
      ).rejects.toMatchObject({
        code: 'validation',
        message: 'family_request_member_invalid',
      });
      expect(await requestRepo.list({})).toHaveLength(0);
    });

    it('updates fields, verifies member changes, and never touches status', async () => {
      const memberA = await memberService.create({ name: 'Ayesha', relationship: 'spouse' });
      const memberB = await memberService.create({ name: 'Rahim', relationship: 'son' });
      const request = await requestService.create({
        title: 'Book appointment',
        memberId: memberA.id,
      });
      await requestService.setStatus(request.id, 'in_progress');

      const updated = await requestService.update(request.id, {
        title: 'Book cardiologist',
        memberId: memberB.id,
        deadline: '2026-10-25',
      });
      expect(updated).toMatchObject({
        title: 'Book cardiologist',
        memberId: memberB.id,
        deadline: '2026-10-25',
        status: 'in_progress',
      });

      const cleared = await requestService.update(request.id, { memberId: null });
      expect(cleared.memberId).toBeNull();

      await expect(
        requestService.update(request.id, { memberId: 'missing-member' }),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_request_member_invalid' });
    });

    it('moves a request through its lifecycle idempotently and rejects bad statuses', async () => {
      const request = await requestService.create({ title: 'Renew passport' });

      const wip = await requestService.setStatus(request.id, 'in_progress');
      expect(wip.status).toBe('in_progress');
      const stillWip = await requestService.setStatus(request.id, 'in_progress');
      expect(stillWip.status).toBe('in_progress');
      const done = await requestService.setStatus(request.id, 'done');
      expect(done.status).toBe('done');

      const outstanding = await requestService.countOutstanding();
      expect(outstanding).toBe(0);

      await expect(
        requestService.setStatus(request.id, 'closed' as never),
      ).rejects.toMatchObject({ code: 'validation', message: 'family_request_status_invalid' });
    });

    it('serves the outstanding dashboard figure and preview', async () => {
      const soon = await requestService.create({
        title: 'Soon',
        deadline: '2026-10-14',
      });
      await requestService.create({ title: 'Far', deadline: '2026-11-01' });
      await requestService.create({ title: 'No date' });
      const done = await requestService.create({ title: 'Settled' });
      await requestService.setStatus(done.id, 'done');

      expect(await requestService.countOutstanding()).toBe(3);
      const preview = await requestService.listOutstanding(2);
      expect(preview.map((request) => request.id)).toEqual([soon.id, 'request-2']);
    });

    it('generates exactly one linked task from a request', async () => {
      const member = await memberService.create({ name: 'Rahim', relationship: 'son' });
      const request = await requestService.create({
        title: 'Buy school uniform',
        details: 'White shirt, size 32',
        memberId: member.id,
        deadline: '2026-10-18',
        priority: 'high',
      });

      const task = await requestService.generateTask(request.id);
      expect(task).toMatchObject({
        title: 'Buy school uniform',
        description: 'White shirt, size 32',
        dueAt: '2026-10-18',
        priority: 'high',
        status: 'pending',
        familyRequestId: request.id,
      });

      const [item] = await requestService.list({});
      expect(item.taskId).toBe(task.id);

      await expect(requestService.generateTask(request.id)).rejects.toMatchObject({
        code: 'conflict',
        message: 'family_request_task_exists',
      });
    });

    it('keeps the generated task (link cleared) when the request is removed', async () => {
      const request = await requestService.create({ title: 'Pay electricity bill' });
      const task = await requestService.generateTask(request.id);

      await requestService.remove(request.id);
      expect(await requestRepo.findById(request.id)).toBeNull();

      const taskRepo = new SqliteTaskRepository(db);
      const survivor = await taskRepo.findById(task.id);
      expect(survivor).not.toBeNull();
      expect(survivor?.familyRequestId).toBeNull();
    });

    it('throws not_found for missing requests', async () => {
      await expect(requestService.getById('missing')).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(requestService.remove('missing')).rejects.toMatchObject({
        code: 'not_found',
      });
    });
  });
});
