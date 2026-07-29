'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type SavedProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export default function CollectionPage() {
  const [saved, setSaved] = useState<SavedProfile[]>([])
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
        .from('saves')
        .select('saved_user_id, profiles!saves_saved_user_id_fkey(id, display_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('保存一覧取得エラー:', error)
      } else if (data) {
        setSaved(data.map((row: any) => row.profiles).filter(Boolean))
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
            <h2 className="page-title">保存</h2>
          </div>
          <div className="header-right"></div>
        </header>

        <div style={{ padding: '15px', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--dark-light)' }}>読み込み中...</p>
          ) : saved.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--dark-light)', marginTop: '40px' }}>
              保存した相手はいません
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {saved.map((p) => (
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