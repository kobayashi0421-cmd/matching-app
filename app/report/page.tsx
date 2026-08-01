'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const PASSCODE = 'koba'

type Report = {
  id: string
  target_user_id: string
  target_name: string
  content: string
  created_at: string
}

export default function ReportAdminPage() {
  const supabase = createClient()
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [reports, setReports] = useState<Report[]>([])
  const [minutesByReport, setMinutesByReport] = useState<Record<string, number>>({})

  useEffect(() => {
    if (unlocked) fetchReports()
  }, [unlocked])

  const fetchReports = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
    setReports(data ?? [])
  }

  const handleUnlock = () => {
    if (code === PASSCODE) setUnlocked(true)
    else alert('暗号が違います')
  }

  const callAction = async (action: string, targetUserId: string, minutes?: number) => {
    await fetch('/api/admin/user-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, targetUserId, minutes }),
    })
  }

  if (!unlocked) {
    return (
      <div className="report-lock-screen">
        <input maxLength={4} value={code} onChange={(e) => setCode(e.target.value)} placeholder="暗号" />
        <button onClick={handleUnlock}>開く</button>
      </div>
    )
  }

  return (
    <div className="report-admin">
      <h1>通報一覧</h1>
      {reports.map((r) => (
        <div key={r.id} className="report-card">
          <p>対象: {r.target_name}</p>
          <p>内容: {r.content}</p>
          <p>{new Date(r.created_at).toLocaleString()}</p>
          <div className="report-card-actions">
            <button onClick={async () => {
              if (confirm('このユーザーのアカウントを削除しますか？')) {
                await callAction('delete', r.target_user_id)
                fetchReports()
              }
            }}>アカウント削除</button>

            <input
              type="number"
              min={1}
              value={minutesByReport[r.id] ?? 60}
              onChange={(e) => setMinutesByReport((p) => ({ ...p, [r.id]: Number(e.target.value) }))}
            /> 分
            <button onClick={() => callAction('suspend', r.target_user_id, minutesByReport[r.id] ?? 60)}>利用停止</button>
            <button onClick={() => callAction('unsuspend', r.target_user_id)}>停止解除</button>
          </div>
        </div>
      ))}
    </div>
  )
}