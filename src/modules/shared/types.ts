// Shared types for the EasySourcing demo SPA (mirrors /api/bootstrap payload)

export interface ClientUser { id: string; clientId: string; name: string; role: string; email: string }
export interface Client { id: string; code: string; name: string; industry: string; status: string; contact: string; email: string; phone: string | null; city: string; since: string; colorSeed: string; users: ClientUser[] }

export interface Location {
  id: string; clientId: string; parentId: string | null; level: string
  name: string; code: string; address: string | null; gpsLat: number | null; gpsLng: number | null; status: string
}

export interface Asset {
  id: string; clientId: string; code: string; clientAssetId: string; description: string
  category: string; subcategory: string | null; make: string | null; model: string | null
  serialNumber: string | null; barcode: string | null; qrCode: string | null
  locationId: string | null; locationLabel: string; locationPath: string
  custodian: string | null; status: string; condition: string | null
  purchaseDate: string | null; purchaseCost: number | null; currentValue: number | null
  lastVerifiedAt: string | null; assignmentId: string | null; createdAt: string
}

export interface Auditor { id: string; name: string; email: string; phone: string | null; employeeCode: string; status: string; city: string | null; colorSeed: string; lastSyncAt: string | null }

export interface Audit {
  id: string; clientId: string; code: string; name: string; type: string; status: string
  financialYear: string; startDate: string; endDate: string | null; totalInScope: number
  locationsLabel: string | null; evidenceRequired: boolean
  verifiedAssets: number; matchCount: number; byResult: Record<string, number>
  openExceptions: number; totalExceptions: number; progress: number
}

export interface Assignment { id: string; auditId: string; auditorId: string; locationId: string | null; scope: string; status: string; auditor: { id: string; name: string; colorSeed: string; status: string; lastSyncAt: string | null }; location: Location | null }

export interface Verification {
  id: string; operationId: string; auditId: string; assignmentId: string | null
  assetId: string | null; assetCode: string | null; assetDescription: string | null
  auditorId: string; auditorName: string; result: string; method: string
  gpsLat: number | null; gpsLng: number | null; gpsAccuracy: number | null; gpsStatus: string
  remarks: string | null; photoCount: number; createdOffline: boolean; verifiedAt: string; syncedAt: string
}

export interface ExceptionItem {
  id: string; code: string; clientId: string; auditId: string | null; assetId: string | null
  assetCode: string | null; assetDescription: string | null; type: string; severity: string; status: string
  title: string; description: string; locationLabel: string | null; detectedBy: string; detectedAt: string
  assignedTo: string | null; resolutionNote: string | null; resolvedAt: string | null; detail: string | null
}

export interface EvidenceItem {
  id: string; verificationId: string | null; auditId: string | null; assetId: string | null
  assetCode: string | null; clientId: string; kind: string; label: string; colorSeed: string
  capturedBy: string | null; gpsLat: number | null; gpsLng: number | null; capturedAt: string
  /** true when a real captured photo exists — served by /api/core/evidence/[id]/image */
  hasImage: boolean
}

export interface Report {
  id: string; clientId: string; auditId: string | null; code: string; name: string; type: string
  versionLabel: string; status: string; generatedBy: string; generatedAt: string; sizeLabel: string; summary: string | null
  audit?: { id: string; code: string; name: string; status: string } | null
}

export interface Approval { id: string; clientId: string; auditId: string; decision: string; byName: string; byRole: string; comment: string | null; at: string; audit?: { code: string; name: string } | null }

export interface AuditLogEntry { id: string; actor: string; role: string; action: string; entity: string; entityRef: string | null; detail: string | null; at: string }

export interface TrendPoint { date: string; label: string; matched: number; exceptions: number }

export interface WorldStats {
  activeAudits: number; assetsRegistered: number; assetsVerified: number; openExceptions: number
  inFieldAuditors: number; matchRate: number; verificationTrend: TrendPoint[]
}

export interface World {
  clients: Client[]; locations: Location[]; assets: Asset[]; auditors: Auditor[]; audits: Audit[]
  assignments: Assignment[]; verifications: Verification[]; exceptions: ExceptionItem[]
  evidence: EvidenceItem[]; reports: Report[]; approvals: Approval[]; auditLogs: AuditLogEntry[]
  stats: WorldStats
}

// Mobile offline queue op
export interface QueueOp {
  operationId: string
  auditId: string
  assignmentId: string
  auditorId: string
  assetId?: string | null
  result: string
  method?: string
  gpsLat?: number | null
  gpsLng?: number | null
  gpsAccuracy?: number | null
  gpsStatus?: 'captured' | 'unavailable'
  remarks?: string | null
  photos?: string[]
  createdOffline?: boolean
  verifiedAt?: string
  discovery?: { description: string; make?: string; model?: string; serial?: string; condition?: string; locationLabel?: string }
  label: string // display label
  queuedAt: string
}
