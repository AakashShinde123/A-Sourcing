'use client'

import React from 'react'
import { Loader2, QrCode } from 'lucide-react'
import { Toaster } from 'sonner'
import { ESProvider, useES } from './store'
import { Landing } from './Landing'
import { OpsApp } from './ops/OpsApp'
import { ClientApp } from './client/ClientApp'
import { MobileApp } from './mobile/MobileApp'

function SurfaceRouter() {
  const { surface, loading } = useES()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500">
          <QrCode className="h-6 w-6 text-white" />
        </span>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Loading EasySourcing workspace…
        </div>
      </div>
    )
  }

  return (
    <>
      {surface === 'landing' && <Landing />}
      {surface === 'ops' && <OpsApp />}
      {surface === 'client' && <ClientApp />}
      {surface === 'mobile' && <MobileApp />}
    </>
  )
}

export function EasySourcingApp() {
  return (
    <ESProvider>
      <SurfaceRouter />
      <Toaster position="top-center" richColors closeButton offset={12} />
    </ESProvider>
  )
}
