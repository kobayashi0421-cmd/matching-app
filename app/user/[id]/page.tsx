'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type OtherProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  hobby_tags: string[] | null
  faculty: string | null
  department: string | null
  year: string | null
}

export default function OtherUserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<OtherProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [alreadyLiked, setAlreadyLiked] = useState(false)
  const [liking, setLiking] = useState(false)
  const [matched, setMatched] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, hobby_tags, faculty, department, year')
        .eq('id', id)
        .single()

      if (profileError) {
        console.error('相手プロフィール取得エラー:', profileError)
      } else if (profileData) {
        setProfile(profileData)
      }

      const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('from_user_id', user.id)
        .eq('to_user_id', id)
        .maybeSingle()

      setAlreadyLiked(!!existingLike)
      setLoading(false)
    }

    init()
  }, [id, router, supabase])

  const handleLike = async () => {
    if (!userId || liking || alreadyLiked) return
    setLiking(true)

    const { error } = await supabase
      .from('likes')
      .insert({ from_user_id: userId, to_user_id: id })

    if (error) {
      console.error('いいねエラー:', error)
      setLiking(false)
      return
    }

    setAlreadyLiked(true)

    // 相互いいねでマッチが成立したか確認
    const u1 = userId < id ? userId : id
    const u2 = userId < id ? id : userId

    const { data: matchRow } = await supabase
      .from('matches')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle()

    if (matchRow) {
      setMatched(true)
    }

    setLiking(false)
  }

  if (loading) {
    return (
      <div className="outer-wrap">
        <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--dark-light)' }}>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="outer-wrap">
        <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--dark-light)' }}>ユーザーが見つかりませんでした</p>
        </div>
      </div>
    )
  }

  const deptInfo = [profile.faculty, profile.department, profile.year].filter(Boolean).join(' ')

  return (
    <div className="outer-wrap">
      <div className="app-container">
        <section id="screen-other-profile" className="screen active">
          <header className="main-header">
            <div className="header-left">
              <button className="btn-header-icon" onClick={() => router.back()}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="header-right"></div>
          </header>

          <div className="other-profile-scroll-content">
            <div className="other-profile-photo-container">
              <img src={profile.avatar_url || '/default-avatar.png'} alt={profile.display_name || ''} />
            </div>

            <div className="other-profile-body">
              <div className="other-profile-meta">
                <h2>{profile.display_name || '名前未設定'}</h2>
                {deptInfo && <p>{deptInfo}</p>}
              </div>

              {(profile.hobby_tags ?? []).length > 0 && (
                <div className="other-section">
                  <div className="other-tags-row">
                    {(profile.hobby_tags ?? []).map((tag) => (
                      <span key={tag} className="tag-badge">＃{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="other-section">
                <h4 className="other-section-title">ひとこと</h4>
                <div className="other-bio-text">
                  {profile.bio || 'まだ自己紹介が入力されていません。'}
                </div>
              </div>

              <div className="other-profile-actions">
                <button
                  className={`btn-other-action btn-like ${alreadyLiked ? 'active' : ''}`}
                  onClick={handleLike}
                  disabled={liking || alreadyLiked}
                >
                  <i className="fa-solid fa-heart"></i>
                  <span>{alreadyLiked ? 'いいね済み' : 'いいね！'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {matched && (
          <div className="modal-backdrop active">
            <div className="match-modal">
              <div className="match-heart-animation">
                <i className="fa-solid fa-heart pulse"></i>
              </div>
              <h2>マッチング成立！</h2>
              <p>お互いにいいね！を送り合いました。<br />チャットでメッセージを送ってみましょう！</p>
              <div className="match-actions">
                <button className="btn-primary" onClick={() => router.push('/profile')}>
                  マッチ一覧を見る
                </button>
                <button className="btn-secondary" onClick={() => setMatched(false)}>
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
