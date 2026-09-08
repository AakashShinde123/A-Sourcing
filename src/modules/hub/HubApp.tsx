'use client'

// Platform Hub · the shell that mounts whichever standalone module is active.
// Modules stay independent — this file only routes between them.
// The whole shell sits behind the login: no session, no platform.

import React from 'react'
import { Loader2, QrCode } from 'lucide-react'
import { Toaster } from 'sonner'
import { ESProvider, useES, surfacesForRole, homeSurfaceForRole } from '../shared/store'
import { LoginScreen } from '../shared/LoginScreen'
import { Landing } from './Landing'
import { ArchitectureMap } from './ArchitectureMap'
import { DeployPlanner } from './DeployPlanner'
import { OpsApp } from '../ops-portal/OpsApp'
import { ClientApp } from '../client-portal/ClientApp'
import { MobileApp } from '../auditor-mobile/MobileApp'

function Splash({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-[#f6f8f4] text-zinc-700">
      <div className="bg-aurora pointer-events-none absolute inset-0" aria-hidden />
      <span className="glow-emerald relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600">
        <QrCode className="h-7 w-7 text-white" />
      </span>
      <div className="relative flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> {label}
      </div>
    </div>
  )
}

function SurfaceRouter() {
  const { surface, loading, world, user, authLoading } = useES()

  if (authLoading) return <Splash label="Checking your session…" />
  if (!user) return <LoginScreen />

  // Role gate — CLIENT lands in their portal, AUDITOR in the mobile app.
  // If a stale surface is somehow active, render the role's home instead.
  const active = surfacesForRole(user.role).includes(surface) ? surface : homeSurfaceForRole(user.role)

  // world must exist before any portal renders — after sign-in the surface
  // switches instantly while the first bootstrap is still in flight.
  if (loading || !world) return <Splash label="Loading EasySourcing platform…" />

  return (
    <>
      {active === 'landing' && <Landing />}
      {active === 'architecture' && <ArchitectureMap />}
      {active === 'planner' && <DeployPlanner />}
      {active === 'ops' && <OpsApp />}
      {active === 'client' && <ClientApp />}
      {active === 'mobile' && <MobileApp />}
    </>
  )
}

export function HubApp() {
  return (
    <ESProvider>
      <SurfaceRouter />
      <Toaster position="top-center" richColors closeButton offset={12} />
    </ESProvider>
  )
}
