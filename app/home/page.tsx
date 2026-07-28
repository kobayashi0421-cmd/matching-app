'use client'

import { useEffect, useState } from 'react'
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

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [users, setUsers] = useState<OtherProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [likingId, setLikingId] = useState<string | null>(null)
  const [matchedPartner, setMatchedPartner] = useState<OtherProfile | null>(null)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)

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

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
      setMyAvatar(myProfile?.avatar_url ?? null)

      // すでにいいね済みの相手は除外(再表示させない)
      const { data: myLikes } = await supabase
        .from('likes')
        .select('to_user_id')
        .eq('from_user_id', user.id)
      const likedIds = (myLikes ?? []).map((l) => l.to_user_id)

      let query = supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, hobby_tags, faculty, department, year')
        .neq('id', user.id)

      if (likedIds.length > 0) {
        query = query.not('id', 'in', `(${likedIds.join(',')})`)
      }

      const { data: profilesData, error } = await query.limit(30)

      if (error) {
        console.error('おすすめユーザー取得エラー:', error)
      } else if (profilesData) {
        setUsers(profilesData)
      }

      setLoading(false)
    }

    init()
  }, [router, supabase])

  const handleLike = async (target: OtherProfile) => {
    if (!userId || likingId) return
    setLikingId(target.id)

    const { error: likeError } = await supabase
      .from('likes')
      .insert({ from_user_id: userId, to_user_id: target.id })

    if (likeError) {
      console.error('いいねエラー:', likeError)
      setLikingId(null)
      return
    }

    // 相互いいねでマッチが成立したか確認(DBトリガーがすでに matches 行を作っているはず)
    const u1 = userId < target.id ? userId : target.id
    const u2 = userId < target.id ? target.id : userId

    const { data: matchRow } = await supabase
      .from('matches')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle()

    setUsers((prev) => prev.filter((u) => u.id !== target.id))

    if (matchRow) {
      setMatchedPartner(target)
    }

    setLikingId(null)
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

  return (
    <div className="outer-wrap">
      <div className="app-container">
        <section id="screen-home" className="screen active">
          <header className="main-header">
            <div className="header-left"></div>
            <div className="header-center">
              <div className="header-search-bar">
                <input type="text" placeholder="タグを検索" readOnly />
                <i className="fa-solid fa-magnifying-glass"></i>
              </div>
            </div>
            <div className="header-right"></div>
          </header>

          <div className="home-scroll-content">
            <div className="home-section">
              <h3 className="section-title">おすすめ</h3>
              {users.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--dark-light)', padding: '10px 0' }}>
                  今のところ表示できるユーザーがいません
                </p>
              ) : (
                <div className="user-grid-row">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="user-card"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        // ボタンを押した時はカード全体のクリック処理（画面遷移）を発生させない
                        if ((e.target as HTMLElement).closest('button')) return;

                        // 相手の詳細画面（またはチャット等）に移動する
                        router.push(`/user/${u.id}`); // ※移動したいパスに合わせて調整してください
                      }}
                    >
                      <div className="card-image-box">
                        <img src={u.avatar_url || '/default-avatar.png'} alt={u.display_name || ''} />
                      </div>
                      <div className="card-body">
                        <div className="card-meta-row">
                          <span className="card-name">{u.display_name || '名前未設定'}</span>
                          <span className="card-dept">{u.year || ''}</span>
                        </div>
                        <div className="card-tags">
                          {(u.hobby_tags ?? []).slice(0, 3).map((tag) => (
                            <span key={tag} className="card-tag hobby">＃{tag}</span>
                          ))}
                        </div>
                        <p className="card-bio">{u.bio}</p>
                        <div className="card-actions">
                          <button
                            className="btn-card-action liked"
                            onClick={() => handleLike(u)}
                            disabled={likingId === u.id}
                          >
                            <i className="fa-solid fa-heart"></i> いいね！
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 下部ナビゲーション */}
        <nav className="app-nav-bar">
          <button className="nav-tab active" onClick={() => router.push('/home')}>
            <div className="nav-tab-icon icon-home"></div>
          </button>
          <button className="nav-tab" onClick={() => router.push('/profile')}>
            <div className="nav-tab-icon icon-chat"></div>
          </button>
          <button className="nav-tab" onClick={() => router.push('/profile')}>
            <div className="nav-tab-icon icon-person"></div>
          </button>
        </nav>

        {/* マッチング成立モーダル */}
        {matchedPartner && (
          <div className="modal-backdrop active">
            <div className="match-modal">
              <div className="match-heart-animation">
                <i className="fa-solid fa-heart pulse"></i>
              </div>
              <h2>マッチング成立！</h2>
              <p>お互いにいいね！を送り合いました。<br />チャットでメッセージを送ってみましょう！</p>

              <div className="match-users-row">
                <div className="match-user-avatar">
                  <img src={myAvatar || '/default-avatar.png'} alt="自分" />
                </div>
                <div className="match-divider"><i className="fa-solid fa-bolt"></i></div>
                <div className="match-user-avatar">
                  <img src={matchedPartner.avatar_url || '/default-avatar.png'} alt="相手" />
                </div>
              </div>

              <div className="match-actions">
                <button
                  className="btn-primary"
                  onClick={() => {
                    setMatchedPartner(null)
                    router.push('/profile')
                  }}
                >
                  チャットを送る
                </button>
                <button className="btn-secondary" onClick={() => setMatchedPartner(null)}>
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
