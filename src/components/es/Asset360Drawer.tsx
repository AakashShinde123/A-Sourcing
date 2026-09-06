'use client'

import React, { useMemo } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useES } from './store'
import { Pill, SimpleBadge, EvidenceThumb, EmptyState, StatRow, MicroLabel } from './ui-bits'
import { assetStatusMeta, conditionMeta, resultMeta, fmtDate, fmtDateTime, fmtMoney, fmtMoneyShort } from '@/lib/es-format'
import { QrCode, MapPin, History, FileCheck2, AlertTriangle, ImageIcon, Boxes } from 'lucide-react'

export function Asset360Drawer() {
  const { world, asset360, closeAsset360 } = useES()
  const asset = useMemo(() => world?.assets.find((a) => a.id === asset360?.assetId), [world, asset360])

  const verifs = useMemo(
    () => (asset ? world!.verifications.filter((v) => v.assetId === asset.id) : []),
    [world, asset],
  )
  const evidence = useMemo(
    () => (asset ? world!.evidence.filter((e) => e.assetId === asset.id) : []),
    [world, asset],
  )
  const exs = useMemo(
    () => (asset ? world!.exceptions.filter((e) => e.assetId === asset.id) : []),
    [world, asset],
  )
  const logs = useMemo(() => {
    if (!asset) return []
    const rows: { at: string; text: string; icon: 'verify' | 'exc' }[] = []
    verifs.forEach((v) => rows.push({ at: v.verifiedAt, text: `Verified by ${v.auditorName} — ${resultMeta[v.result]?.label ?? v.result}`, icon: 'verify' }))
    exs.forEach((e) => rows.push({ at: e.detectedAt, text: `Exception ${e.code} opened — ${e.title}`, icon: 'exc' }))
    if (asset.createdAt) rows.push({ at: asset.createdAt, text: 'Asset registered in system', icon: 'verify' })
    return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at))
  }, [asset, verifs, exs])

  return (
    <Drawer open={!!asset360} onOpenChange={(o) => !o && closeAsset360()}>
      <DrawerContent className="h-[86vh] bg-white">
        <DrawerTitle className="sr-only">Asset 360 — 360° asset record</DrawerTitle>
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
          {asset && (
            <>
              <div className="border-b border-zinc-100 px-6 pb-4 pt-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-medium text-zinc-400">{asset.code}</span>
                      <Pill meta={assetStatusMeta[asset.status] ?? assetStatusMeta.registered} size="xs" />
                      {asset.condition && <SimpleBadge label={conditionMeta[asset.condition]?.label ?? asset.condition} cls={conditionMeta[asset.condition]?.cls ?? ''} />}
                    </div>
                    <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-900">{asset.description}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-zinc-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{asset.locationPath}</span>
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 sm:flex" title="Asset QR tag">
                    <QrCode className="h-8 w-8 text-zinc-700" aria-hidden />
                    <div>
                      <div className="font-mono text-[10px] font-semibold text-zinc-700">{asset.qrCode}</div>
                      <div className="text-[10px] text-zinc-400">{asset.barcode}</div>
                    </div>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-0">
                <TabsList className="h-10 w-full justify-start gap-1 rounded-none border-b border-zinc-100 bg-transparent p-0 px-4">
                  {[
                    ['overview', 'Overview', <Boxes key="1" className="h-3.5 w-3.5" />],
                    ['verification', 'Verification', <FileCheck2 key="2" className="h-3.5 w-3.5" />],
                    ['evidence', 'Evidence', <ImageIcon key="3" className="h-3.5 w-3.5" />],
                    ['exceptions', 'Exceptions', <AlertTriangle key="4" className="h-3.5 w-3.5" />],
                    ['trail', 'Audit Trail', <History key="5" className="h-3.5 w-3.5" />],
                  ].map(([v, label, icon]) => (
                    <TabsTrigger key={v as string} value={v as string}
                      className="gap-1.5 rounded-none border-0 border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-zinc-500 data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-zinc-900">
                      {icon}{label as string}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="px-6 py-4">
                    <TabsContent value="overview" className="mt-0">
                      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                        <div>
                          <MicroLabel className="mb-1">Identity</MicroLabel>
                          <StatRow label="Internal Asset ID" value={<span className="font-mono text-xs">{asset.code}</span>} />
                          <StatRow label="Client Asset ID" value={<span className="font-mono text-xs">{asset.clientAssetId}</span>} />
                          <StatRow label="Category" value={asset.category} />
                          <StatRow label="Sub-category" value={asset.subcategory ?? '—'} />
                          <StatRow label="Make / Model" value={`${asset.make ?? '—'} ${asset.model ? `· ${asset.model}` : ''}`} />
                          <StatRow label="Serial" value={asset.serialNumber ?? '—'} />
                        </div>
                        <div>
                          <MicroLabel className="mb-1">Physical &amp; financial</MicroLabel>
                          <StatRow label="Location" value={asset.locationLabel} />
                          <StatRow label="Custodian" value={asset.custodian ?? '—'} />
                          <StatRow label="Purchase date" value={fmtDate(asset.purchaseDate)} />
                          <StatRow label="Purchase cost" value={fmtMoneyShort(asset.purchaseCost)} />
                          <StatRow label="Current value" value={fmtMoney(asset.currentValue)} />
                          <StatRow label="Last verified" value={fmtDateTime(asset.lastVerifiedAt)} />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="verification" className="mt-0">
                      {verifs.length === 0 ? <EmptyState title="No verifications yet" sub="This asset has not been field-verified in any audit so far." /> : (
                        <div className="space-y-2">
                          {verifs.map((v) => (
                            <div key={v.id} className="rounded-lg border border-zinc-200 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <Pill meta={resultMeta[v.result] ?? resultMeta.deferred} size="xs" />
                                <span className="text-xs text-zinc-400">{fmtDateTime(v.verifiedAt)}</span>
                              </div>
                              <div className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                                <div className="text-zinc-500">Auditor: <span className="font-medium text-zinc-800">{v.auditorName}</span></div>
                                <div className="text-zinc-500">Method: <span className="font-medium capitalize text-zinc-800">{v.method}</span>{v.createdOffline && <span className="ml-1.5 rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium text-zinc-500">offline sync</span>}</div>
                                {v.gpsStatus === 'captured' ? (
                                  <div className="flex items-center gap-1 text-zinc-500"><MapPin className="h-3 w-3" />{v.gpsLat?.toFixed(5)}, {v.gpsLng?.toFixed(5)} <span className="text-zinc-400">(±{v.gpsAccuracy}m)</span></div>
                                ) : <div className="text-zinc-400">GPS unavailable at capture</div>}
                                {v.remarks && <div className="text-zinc-500 sm:col-span-2">&ldquo;{v.remarks}&rdquo;</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="evidence" className="mt-0">
                      {evidence.length === 0 ? <EmptyState title="No evidence captured" sub="Photos, GPS pins and documents will appear here once the asset is verified in the field." /> : (
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {evidence.map((e) => (
                            <div key={e.id}>
                              <EvidenceThumb seed={e.colorSeed} code={asset.code} kind={e.kind} />
                              <div className="mt-1 truncate text-[11px] text-zinc-500">{e.label}</div>
                              <div className="text-[10px] text-zinc-400">{fmtDate(e.capturedAt)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="exceptions" className="mt-0">
                      {exs.length === 0 ? <EmptyState title="No exceptions" sub="Nothing flagged against this asset — clean record." /> : (
                        <div className="space-y-2">
                          {exs.map((e) => (
                            <div key={e.id} className="rounded-lg border border-zinc-200 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] text-zinc-400">{e.code}</span>
                                <span className="text-xs text-zinc-400">{fmtDate(e.detectedAt)}</span>
                              </div>
                              <div className="mt-1 text-[13px] font-medium text-zinc-800">{e.title}</div>
                              <p className="mt-0.5 text-xs text-zinc-500">{e.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="trail" className="mt-0">
                      <div className="relative space-y-0 pl-4">
                        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-zinc-200" aria-hidden />
                        {logs.map((l, i) => (
                          <div key={i} className="relative flex items-start gap-3 py-2.5">
                            <span className={`absolute -left-4 top-3.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${l.icon === 'exc' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <div className="min-w-0">
                              <div className="text-[13px] text-zinc-700">{l.text}</div>
                              <div className="text-[11px] text-zinc-400">{fmtDateTime(l.at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
              <Separator />
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
