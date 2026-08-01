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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    color: '#000',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#000',
    fontWeight: 600,
    fontSize: '14px',
    marginTop: '16px',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    color: '#000',
    backgroundColor: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
  }

  const primaryBtnStyle: React.CSSProperties = {
    backgroundColor: 'var(--primary-color, #ff6b81)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontWeight: 600,
    cursor: 'pointer',
  }

  const secondaryBtnStyle: React.CSSProperties = {
    backgroundColor: '#f1f1f1',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontWeight: 600,
    cursor: 'pointer',
  }

  if (sent) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...modalStyle, textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>運営に送信されました！</p>
          <button onClick={onClose} style={primaryBtnStyle}>talkに戻る</button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ color: '#000', margin: 0, fontSize: '18px' }}>通報する</h3>

        <label style={labelStyle}>
          相手
          <input
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          通報内容
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtnStyle}>talkに戻る</button>
          <button onClick={handleSubmit} disabled={sending || !content.trim()} style={primaryBtnStyle}>
            送信
          </button>
        </div>
      </div>
    </div>
  )
}