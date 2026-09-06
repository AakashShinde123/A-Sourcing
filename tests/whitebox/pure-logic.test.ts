/**
 * WHITE-BOX UNIT TESTS — pure domain logic in @/lib/core-logic.
 * Every branch of the extraction is exercised without any I/O.
 */
import { describe, expect, test } from 'bun:test'
import {
  VERIFICATION_RESULTS, EXCEPTION_TYPES, severityFor, validateSyncOp,
  discoveryAssetCode, nextExceptionCode, LEGAL_EXCEPTION_TRANSITIONS,
  isLegalTransition, nextVersionLabel, isValidDecision, APPROVAL_DECISIONS,
} from '@/lib/core-logic'

describe('severityFor', () => {
  test('missing assets are high severity', () => {
    expect(severityFor('missing')).toBe('high')
  })
  test('location / serial / custodian mismatches are medium', () => {
    expect(severityFor('location_mismatch')).toBe('medium')
    expect(severityFor('serial_mismatch')).toBe('medium')
    expect(severityFor('custodian_mismatch')).toBe('medium')
  })
  test('condition exceptions are low severity', () => {
    expect(severityFor('condition_exception')).toBe('low')
  })
  test('unknown results default to medium', () => {
    expect(severityFor('anything_else')).toBe('medium')
  })
})

describe('EXCEPTION_TYPES mapping', () => {
  test('condition_exception maps to damaged type', () => {
    expect(EXCEPTION_TYPES.condition_exception).toBe('damaged')
  })
  test('matched / deferred / unregistered open no exception via this map', () => {
    expect(EXCEPTION_TYPES.matched).toBeUndefined()
    expect(EXCEPTION_TYPES.deferred).toBeUndefined()
    expect(EXCEPTION_TYPES.unregistered).toBeUndefined()
  })
  test('every mapped type is part of the schema comment domain', () => {
    const schemaTypes = ['missing', 'location_mismatch', 'custodian_mismatch', 'serial_mismatch', 'damaged', 'unregistered', 'duplicate', 'tag_issue']
    for (const t of Object.values(EXCEPTION_TYPES)) expect(schemaTypes).toContain(t)
  })
})

describe('validateSyncOp', () => {
  const base = { operationId: 'op-1', auditId: 'aud-1', auditorId: 'usr-1', assetId: 'ast-1', result: 'matched' }

  test('accepts a minimal valid op and normalizes defaults', () => {
    const r = validateSyncOp(base)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.method).toBe('scan')
      expect(r.value.photos).toEqual([])
      expect(r.value.createdOffline).toBe(false)
      expect(r.value.gpsStatus).toBe('captured')
      expect(r.value.assignmentId).toBeNull()
    }
  })
  test('rejects non-object payloads', () => {
    expect(validateSyncOp(null).ok).toBe(false)
    expect(validateSyncOp('x').ok).toBe(false)
    expect(validateSyncOp(42).ok).toBe(false)
  })
  test('rejects missing operationId / auditId / auditorId', () => {
    expect(validateSyncOp({ ...base, operationId: '' }).ok).toBe(false)
    expect(validateSyncOp({ ...base, auditId: 7 }).ok).toBe(false)
    expect(validateSyncOp({ ...base, auditorId: undefined }).ok).toBe(false)
  })
  test('rejects results outside the contract', () => {
    const r = validateSyncOp({ ...base, result: 'hacked' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('result must be one of')
  })
  test('rejects unregistered without discovery.description', () => {
    expect(validateSyncOp({ ...base, result: 'unregistered' }).ok).toBe(false)
    expect(validateSyncOp({ ...base, result: 'unregistered', discovery: {} }).ok).toBe(false)
    expect(validateSyncOp({ ...base, result: 'unregistered', discovery: { description: 'Pallet pump' } }).ok).toBe(true)
  })
  test('rejects non-array photos, filters non-string entries', () => {
    expect(validateSyncOp({ ...base, photos: 'x' }).ok).toBe(false)
    const r = validateSyncOp({ ...base, photos: ['a', 5, null, 'b'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.photos).toEqual(['a', 'b'])
  })
  test('covers the full contract: all 8 result values accepted', () => {
    for (const result of VERIFICATION_RESULTS) {
      const op = result === 'unregistered' ? { ...base, result, discovery: { description: 'x' } } : { ...base, result }
      expect(validateSyncOp(op).ok).toBe(true)
    }
  })
})

describe('discoveryAssetCode / nextExceptionCode', () => {
  test('discovery code pads to 5 digits', () => {
    expect(discoveryAssetCode(0)).toBe('ES-DSC-00001')
    expect(discoveryAssetCode(164)).toBe('ES-DSC-00165')
  })
  test('exception code scans the max suffix — no collision after deletes', () => {
    expect(nextExceptionCode([])).toBe('EX-2026-0001')
    expect(nextExceptionCode(['EX-2026-0007', 'EX-2026-0003'])).toBe('EX-2026-0008')
    // count-based logic would regress to a colliding code here
    expect(nextExceptionCode(['EX-2026-0025'])).toBe('EX-2026-0026')
  })
  test('ignores malformed codes', () => {
    expect(nextExceptionCode(['garbage', 'EX-26-9', 'EXXX-2026-12'])).toBe('EX-2026-0001')
  })
})

describe('exception lifecycle state machine', () => {
  test('each action maps to exactly the UI-documented source state', () => {
    expect(LEGAL_EXCEPTION_TRANSITIONS).toEqual({
      assign: 'open', investigate: 'assigned', resolve: 'investigating',
      review: 'resolved', approve: 'reviewer_review', close: 'approved',
    })
  })
  test('legal transitions accepted', () => {
    expect(isLegalTransition('assign', 'open')).toBe(true)
    expect(isLegalTransition('close', 'approved')).toBe(true)
  })
  test('stage skipping rejected', () => {
    expect(isLegalTransition('approve', 'open')).toBe(false)
    expect(isLegalTransition('close', 'open')).toBe(false)
    expect(isLegalTransition('resolve', 'assigned')).toBe(false)
  })
  test('backwards moves on terminal states rejected', () => {
    expect(isLegalTransition('assign', 'closed')).toBe(false)
    expect(isLegalTransition('approve', 'closed')).toBe(false)
    expect(isLegalTransition('assign', 'approved')).toBe(false)
  })
  test('unknown actions rejected', () => {
    expect(isLegalTransition('foo', 'open')).toBe(false)
    expect(isLegalTransition('', 'open')).toBe(false)
  })
})

describe('nextVersionLabel', () => {
  test('first report is v1', () => {
    expect(nextVersionLabel([])).toBe('v1')
  })
  test('monotonic sequence with no duplicates', () => {
    expect(nextVersionLabel([{ versionLabel: 'v1' }])).toBe('v2')
    expect(nextVersionLabel([{ versionLabel: 'v2' }, { versionLabel: 'v1' }])).toBe('v3')
    expect(nextVersionLabel([{ versionLabel: 'v3' }, { versionLabel: 'v2' }, { versionLabel: 'v1' }])).toBe('v4')
  })
  test('finalize (Final label) does not regress the sequence', () => {
    expect(nextVersionLabel([{ versionLabel: 'Final' }])).toBe('v2')
    expect(nextVersionLabel([{ versionLabel: 'Final', summary: '{"version":3}' }])).toBe('v4')
  })
  test('prefers the persisted numeric version in summary JSON', () => {
    expect(nextVersionLabel([
      { versionLabel: 'Final', summary: '{"version":5}' },
      { versionLabel: 'v2', summary: '{"version":2}' },
    ])).toBe('v6')
  })
  test('tolerates malformed summary JSON', () => {
    expect(nextVersionLabel([{ versionLabel: 'v2', summary: 'not-json{' }])).toBe('v3')
  })
})

describe('approval decisions', () => {
  test('valid decisions accepted', () => {
    for (const d of APPROVAL_DECISIONS) expect(isValidDecision(d)).toBe(true)
  })
  test('invalid / hostile decisions rejected', () => {
    expect(isValidDecision('maybe')).toBe(false)
    expect(isValidDecision('')).toBe(false)
    expect(isValidDecision(null)).toBe(false)
    expect(isValidDecision(1)).toBe(false)
  })
})
