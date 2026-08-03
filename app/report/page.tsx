// app/report/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import styles from './report.module.css'

const PASSCODE = 'koba'

type Report = {
  id: string
  target_user_id: string
  target_name: string
  content: string
  created_at: string
}

type ActionState = {
  reportId: string
  action: 'delete' | 'suspend' | 'unsuspend'
} | null

export default function ReportAdminPage() {
  const supabase = createClient()

  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const codeInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [query, setQuery] = useState('')

  const [minutesByReport, setMinutesByReport] = useState<Record<string, number>>({})
  const [confirming, setConfirming] = useState<{ reportId: string; action: 'delete' | 'suspend' } | null>(null)
  const [processing, setProcessing] = useState<ActionState>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (unlocked) fetchReports()
  }, [unlocked])

  useEffect(() => {
    codeInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const fetchReports = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
    setReports(data ?? [])
    setLoading(false)
  }

  const handleUnlock = () => {
    if (code === PASSCODE) {
      setUnlocked(true)
      setCodeError(false)
    } else {
      setCodeError(true)
      setCode('')
      codeInputRef.current?.focus()
    }
  }

  const callAction = async (
    reportId: string,
    action: 'delete' | 'suspend' | 'unsuspend',
    targetUserId: string,
    minutes?: number
  ) => {
    setProcessing({ reportId, action })
    try {
      const res = await fetch('/api/admin/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetUserId, minutes }),
      })
      if (!res.ok) throw new Error()

      const label = action === 'delete' ? 'アカウントを削除しました' : action === 'suspend' ? '利用停止にしました' : '利用停止を解除しました'
      setToast(label)
      setConfirming(null)
      await fetchReports()
    } catch {
      setToast('処理に失敗しました。もう一度お試しください')
    } finally {
      setProcessing(null)
    }
  }

  const filteredReports = reports.filter((r) =>
    r.target_name.toLowerCase().includes(query.toLowerCase())
  )

  if (!unlocked) {
    return (
      <div className={styles.lockScreen}>
        <div className={styles.lockCard}>
          <p className={styles.lockLabel}>暗号を入力</p>
          <input
            ref={codeInputRef}
            className={`${styles.lockInput} ${codeError ? styles.lockInputError : ''}`}
            maxLength={4}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setCodeError(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="****"
            autoComplete="off"
          />
          {codeError && <p className={styles.lockError}>暗号が違います</p>}
          <button className={styles.lockButton} onClick={handleUnlock}>開く</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>通報一覧</h1>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="対象ユーザー名で検索"
        />
      </div>

      {loading && <p className={styles.hint}>読み込み中...</p>}

      {!loading && filteredReports.length === 0 && (
        <p className={styles.hint}>
          {query ? '該当する通報はありません' : '通報はまだありません'}
        </p>
      )}

      <div className={styles.list}>
        {filteredReports.map((r) => {
          const isConfirmingDelete = confirming?.reportId === r.id && confirming.action === 'delete'
          const isConfirmingSuspend = confirming?.reportId === r.id && confirming.action === 'suspend'
          const isBusy = processing?.reportId === r.id
          const minutes = minutesByReport[r.id] ?? 60

          return (
            <div key={r.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.targetName}>{r.target_name}</span>
                <span className={styles.date}>
                  {new Date(r.created_at).toLocaleString('ja-JP')}
                </span>
              </div>
              <p className={styles.content}>{r.content}</p>

              {isConfirmingDelete ? (
                <div className={styles.confirmRow}>
                  <span>本当に削除しますか？</span>
                  <button
                    className={styles.dangerButton}
                    disabled={isBusy}
                    onClick={() => callAction(r.id, 'delete', r.target_user_id)}
                  >
                    {isBusy ? '削除中...' : '削除する'}
                  </button>
                  <button className={styles.ghostButton} onClick={() => setConfirming(null)}>
                    キャンセル
                  </button>
                </div>
              ) : isConfirmingSuspend ? (
                <div className={styles.confirmRow}>
                  <div className={styles.presets}>
                    {[
                      { label: '1時間', v: 60 },
                      { label: '1日', v: 1440 },
                      { label: '1週間', v: 10080 },
                    ].map((p) => (
                      <button
                        key={p.v}
                        className={`${styles.presetButton} ${minutes === p.v ? styles.presetButtonActive : ''}`}
                        onClick={() => setMinutesByReport((prev) => ({ ...prev, [r.id]: p.v }))}
                      >
                        {p.label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      className={styles.minutesInput}
                      value={minutes}
                      onChange={(e) =>
                        setMinutesByReport((prev) => ({ ...prev, [r.id]: Number(e.target.value) }))
                      }
                    />
                    <span className={styles.hint}>分</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <button
                      className={styles.warnButton}
                      disabled={isBusy}
                      onClick={() => callAction(r.id, 'suspend', r.target_user_id, minutes)}
                    >
                      {isBusy ? '処理中...' : 'この内容で停止する'}
                    </button>
                    <button className={styles.ghostButton} onClick={() => setConfirming(null)}>
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <button className={styles.dangerOutline} onClick={() => setConfirming({ reportId: r.id, action: 'delete' })}>
                    アカウント削除
                  </button>
                  <button className={styles.warnOutline} onClick={() => setConfirming({ reportId: r.id, action: 'suspend' })}>
                    利用停止
                  </button>
                  <button
                    className={styles.ghostButton}
                    disabled={isBusy}
                    onClick={() => callAction(r.id, 'unsuspend', r.target_user_id)}
                  >
                    {isBusy && processing?.action === 'unsuspend' ? '処理中...' : '停止解除'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}