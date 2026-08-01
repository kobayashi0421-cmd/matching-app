'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Props = {
  reporterId: string
  targetUserId: string
  targetDefaultName: string
  onClose: () => void
}

export default function ReportModal({ reporterId, targetUserId, targetDefaultName, onClose }: Props) {
  const supabase = createClient()
  const [targetName, setTargetName] = useState(targetDefaultName)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSending(true)
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      target_user_id: targetUserId,
      target_name: targetName,
      content,
    })
    setSending(false)
    if (!error) {
      setSent(true)
    } else {
      alert('送信に失敗しました。もう一度お試しください。')
    }
  }

  if (sent) {
    return (
      <div className="report-modal-overlay">
        <div className="report-modal">
          <p>運営に送信されました！</p>
          <button onClick={onClose}>talkに戻る</button>
        </div>
      </div>
    )
  }

  return (
    <div className="report-modal-overlay">
      <div className="report-modal">
        <h3>通報する</h3>
        <label>
          相手
          <input value={targetName} onChange={(e) => setTargetName(e.target.value)} />
        </label>
        <label>
          通報内容
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
        </label>
        <div className="report-modal-actions">
          <button onClick={handleSubmit} disabled={sending || !content.trim()}>送信</button>
          <button onClick={onClose}>talkに戻る</button>
        </div>
      </div>
    </div>
  )
}