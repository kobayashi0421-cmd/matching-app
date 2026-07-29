'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type LikerProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

export default function LikesHistoryPage() {
  const [likers, setLikers] = useState<LikerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('likes')
        .select('from_user_id, profiles!likes_from_user_id_fkey(id, display_name, avatar_url, bio)')
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('いいね履歴取得エラー:', error)
      } else if (data) {
        setLikers(
          data
            .map((row: any) => row.profiles)
            .filter(Boolean)
        )
      }
      setLoading(false)
    }
    load()
  }, [router, supabase])

  return (
    <div className="outer-wrap">
      <div className="app-container">
        <header className="main-header border-bottom">
          <div className="header-left">
            <button onClick={() => router.push('/profile')} className="btn-secondary-link">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          </div>
          <div className="header-center">
            <h2 className="page-title">いいね履歴</h2>
          </div>
          <div className="header-right"></div>
        </header>

        <div style={{ padding: '15px', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--dark-light)' }}>読み込み中...</p>
          ) : likers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--dark-light)', marginTop: '40px' }}>
              まだ「いいね」はありません
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {likers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/user/${p.id}`)}
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <img
                    src={p.avatar_url || '/default-avatar.png'}
                    alt={p.display_name ?? ''}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '8px' }}>
                    <p style={{ fontWeight: 600, fontSize: '14px' }}>{p.display_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}