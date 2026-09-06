// Seed platform login accounts (idempotent — safe to re-run).
// Run: bun prisma/seed-users.ts
// These are STARTER accounts for the private team deployment. Change the
// passwords from the Ops Portal → Access view (or re-run with new values)
// before going live. See DEPLOYMENT.md §Auth.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const ACCOUNTS: { name: string; email: string; password: string; role: string; clientCode?: string; auditorEmail?: string }[] = [
  { name: 'Platform Admin', email: 'admin@easysourcing.in', password: 'Admin@2026', role: 'ADMIN' },
  { name: 'Meera Rangan', email: 'ops@easysourcing.in', password: 'Ops@2026', role: 'OPS' },
  { name: 'Kavita Deshpande', email: 'client@easysourcing.in', password: 'Client@2026', role: 'CLIENT', clientCode: 'MRD' },
  { name: 'Arjun Mehta', email: 'auditor@easysourcing.in', password: 'Field@2026', role: 'AUDITOR', auditorEmail: 'arjun.m@easysourcing.in' },
]

async function main() {
  for (const acc of ACCOUNTS) {
    let clientId: string | undefined
    let auditorId: string | undefined

    if (acc.clientCode) {
      const client = await db.client.findUnique({ where: { code: acc.clientCode } })
      if (!client) { console.warn(`skip ${acc.email}: client ${acc.clientCode} not found`); continue }
      clientId = client.id
    }
    if (acc.auditorEmail) {
      const auditor = await db.auditor.findUnique({ where: { email: acc.auditorEmail } })
      if (!auditor) { console.warn(`skip ${acc.email}: auditor ${acc.auditorEmail} not found`); continue }
      auditorId = auditor.id
    }

    const passwordHash = await bcrypt.hash(acc.password, 12)
    const user = await db.user.upsert({
      where: { email: acc.email },
      update: { name: acc.name, role: acc.role, clientId, auditorId, active: true },
      create: { name: acc.name, email: acc.email, role: acc.role, passwordHash, clientId, auditorId },
    })
    // keep the hash fresh on every run so re-running resets starter passwords
    await db.user.update({ where: { id: user.id }, data: { passwordHash } })
    console.log(`ok ${acc.role.padEnd(8)} ${acc.email} → ${acc.password}`)
  }
}

main().finally(() => db.$disconnect())
