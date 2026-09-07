import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const asgs = await db.auditAssignment.findMany({ where: { auditorId: 'adr_1' }, select: { id: true, scope: true } })
for (const a of asgs) {
  const assets = await db.asset.findMany({ where: { assignmentId: a.id }, select: { code: true, barcode: true, description: true }, take: 3 })
  console.log(`scope ${a.id} "${a.scope}" → ${assets.length}+ assets:`, assets)
}
await db.$disconnect()
