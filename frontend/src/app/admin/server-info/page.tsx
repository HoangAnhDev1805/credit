'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSocket } from '@/hooks/use-socket'
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Activity, Cpu, HardDrive, MemoryStick } from 'lucide-react'

interface StatPayload {
  ts: number
  cpu: { percent: number; load1: number; cores: number }
  mem: { total: number; used: number; free: number; percent: number }
  disk: { total: number; used: number; free: number; percent: number }
}

function toGiB(n: number) {
  return (n / (1024 ** 3)).toFixed(1)
}

export default function ServerInfoPage() {
  const { on, emit, isConnected, connected } = useSocket({ enabled: true })
  const [stat, setStat] = useState<StatPayload | null>(null)
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    // Attach listener whenever socket connects
    const off = on('server:stats', (payload: any) => {
      try { setStat(payload as StatPayload) } catch {}
    })
    // Request immediate stats when connected
    if (isConnected()) emit('server:stats:request')
    return () => { try { off && off() } catch {} }
  }, [on, emit, isConnected, connected])

  // đo latency sơ bộ
  useEffect(() => {
    if (!isConnected()) return
    const id = setInterval(() => {
      const start = Date.now()
      emit('server:stats:request')
      const handler = (p: any) => { setLatency(Date.now() - start) }
      const off = on('server:stats', handler)
      setTimeout(() => { try { off() } catch {} }, 200)
    }, 5000)
    return () => clearInterval(id)
  }, [isConnected, emit, on])

  const items = useMemo(() => {
    if (!stat) return []
    return [
      {
        key: 'cpu',
        title: 'CPU',
        icon: Cpu,
        percent: Math.max(0, Math.min(100, stat.cpu.percent)),
        extra: `${stat.cpu.load1.toFixed(2)} load / ${stat.cpu.cores} cores`
      },
      {
        key: 'ram',
        title: 'Memory',
        icon: MemoryStick,
        percent: Math.max(0, Math.min(100, stat.mem.percent)),
        extra: `${toGiB(stat.mem.used)} / ${toGiB(stat.mem.total)} GiB`
      },
      {
        key: 'disk',
        title: 'Disk (/)',
        icon: HardDrive,
        percent: Math.max(0, Math.min(100, stat.disk.percent)),
        extra: `${toGiB(stat.disk.used)} / ${toGiB(stat.disk.total)} GiB`
      }
    ]
  }, [stat])

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5" /> Thông tin server
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={isConnected() ? 'default' : 'secondary'}>
              {isConnected() ? 'Realtime connected' : 'Disconnected'}
            </Badge>
            {latency != null && <span>Latency ~ {latency} ms</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const Icon = it.icon
            return (
              <UICard key={it.key}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><Icon className="h-5 w-5" /> {it.title}</span>
                    <span className="text-sm text-muted-foreground">{it.percent}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={it.percent} className="h-3" />
                  <div className="mt-2 text-sm text-muted-foreground">{it.extra}</div>
                </CardContent>
              </UICard>
            )
          })}
        </div>

        {!stat && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Đang đợi dữ liệu server...</span>
            <button className="px-2 py-1 border rounded" onClick={() => emit('server:stats:request')}>Request now</button>
          </div>
        )}
      </div>
  )
}
