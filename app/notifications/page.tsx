'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type NotificationItem = {
  id: string
  type: string
  created_at: string
  is_read: boolean
  actor: {
    id: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchAndReadNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 1. 通知一覧を取得（いいねしてくれた人のプロフィール含む）
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          created_at,
          is_read,
          actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('通知取得エラー:', error)
      } else if (data) {
        // 型変換処理
        const formattedData = data.map((item: any) => ({
          ...item,
          actor: Array.isArray(item.actor) ? item.actor[0] : item.actor
        }))
        setNotifications(formattedData)
      }

      setLoading(false)

      // 2. 画面を開いたら未読通知をすべて「既読」にする
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
    }

    fetchAndReadNotifications()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="outer-wrap">
        <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--dark-light)' }}>読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="outer-wrap">
      <div className="app-container">
        <header className="main-header">
          <div className="header-center">
            <h3>通知一覧</h3>
          </div>
        </header>

        <div className="home-scroll-content" style={{ padding: '16px' }}>
          {notifications.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--dark-light)', marginTop: '20px' }}>
              まだ通知はありません
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: n.is_read ? 'transparent' : 'rgba(255, 99, 132, 0.08)',
                    borderBottom: '1px solid #eee'
                  }}
                >
                  <img
                    src={n.actor?.avatar_url || '/default-avatar.png'}
                    alt=""
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, fontSize: '14px' }}>
                    <strong>{n.actor?.display_name || '誰か'}</strong> さんがあなたに「いいね！」しました。
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 下部ナビゲーション */}
        <nav className="app-nav-bar" id="app-bottom-nav">
          <button className="nav-tab" onClick={() => router.push('/home')} aria-label="ホーム">
            <div className="nav-tab-icon icon-home"></div>
          </button>
          <button className="nav-tab active relative" onClick={() => router.push('/notifications')} aria-label="通知">
            <div className="nav-tab-icon icon-bell"></div>
          </button>
          <button className="nav-tab" onClick={() => router.push('/talk')} aria-label="トーク">
            <div className="nav-tab-icon icon-chat"></div>
          </button>
          <button className="nav-tab" onClick={() => router.push('/profile')} aria-label="設定">
            <div className="nav-tab-icon icon-person"></div>
          </button>
        </nav>
      </div>
    </div>
  )
}