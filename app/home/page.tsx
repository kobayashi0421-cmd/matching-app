'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// --- 型定義 ---
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

type PartnerProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type Message = {
  id: string
  match_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

type ViewState = 'home' | 'chat'

export default function CombinedAppPage() {
  const supabase = createClient()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // --- 共通ステート ---
  const [currentView, setCurrentView] = useState<ViewState>('home')
  const [userId, setUserId] = useState<string | null>(null)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [hasUnread, setHasUnread] = useState(false)
  const [loading, setLoading] = useState(true)

  // --- ホーム画面用ステート ---
  const [users, setUsers] = useState<OtherProfile[]>([])
  const [likingId, setLikingId] = useState<string | null>(null)
  const [matchedPartner, setMatchedPartner] = useState<{
    profile: OtherProfile
    matchId: string
  } | null>(null)

  // --- チャット画面用ステート ---
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [savedIds, setSavedIds] = useState<string[]>([])   // 保存済みの相手のID一覧
  const [savingId, setSavingId] = useState<string | null>(null)  // 今まさに保存処理中のID
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')

  // 1. 初期ロード処理（ユーザー情報・おすすめユーザー・未読通知）
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      // 自分のプロフィール画像取得
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
      setMyAvatar(myProfile?.avatar_url ?? null)

      // 未読通知の確認
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (count && count > 0) {
        setHasUnread(true)
      }

      // おすすめユーザー一覧の取得
      const { data: myLikes } = await supabase
        .from('likes')
        .select('to_user_id')
        .eq('from_user_id', user.id)
      const likedIds = (myLikes ?? []).map((l) => l.to_user_id)

      const { data: mySaves } = await supabase
        .from('saves')
        .select('saved_user_id')
        .eq('user_id', user.id)
      setSavedIds((mySaves ?? []).map((s) => s.saved_user_id))

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

  // 2. リアルタイム通知の監視
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setHasUnread(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // 3. チャットデータの取得 & リアルタイム監視（activeMatchId 変更時）
  useEffect(() => {
    if (!activeMatchId || !userId) return

    // メッセージ取得
    const fetchChatData = async () => {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', activeMatchId)
        .single()

      if (matchData) {
        const partnerId = matchData.user1_id === userId ? matchData.user2_id : matchData.user1_id

        // 相手プロフィール取得
        const { data: partnerData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('id', partnerId)
          .single()

        if (partnerData) setPartner(partnerData)

        // 既読化
        await markAsRead(activeMatchId, partnerId)
      }

      // メッセージ取得
      const { data: msgData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', activeMatchId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('メッセージ取得エラー:', error)
      } else if (msgData) {
        setMessages(msgData)
      }
    }

    fetchChatData()

    // リアルタイムチャット監視
    const channel = supabase
      .channel(`chat_${activeMatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${activeMatchId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])

          if (partner && newMsg.sender_id === partner.id) {
            markAsRead(activeMatchId, partner.id)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${activeMatchId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeMatchId, userId, supabase, partner?.id])

  // チャットスクロール自動化
  useEffect(() => {
    if (currentView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, currentView])

  // --- ヘルパー関数 ---
  const markAsRead = async (matchId: string, partnerId: string) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('match_id', matchId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
  }

  // 「いいね！」処理
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
      setMatchedPartner({ profile: target, matchId: matchRow.id })
    }

    setLikingId(null)
  }
  // 「保存」処理
  const handleToggleSave = async (target: OtherProfile) => {
    if (!userId || savingId) return
    setSavingId(target.id)

    const isSaved = savedIds.includes(target.id)

    if (isSaved) {
      // すでに保存済み → 削除する
      await supabase.from('saves').delete()
        .eq('user_id', userId)
        .eq('saved_user_id', target.id)
      setSavedIds((prev) => prev.filter((id) => id !== target.id))
    } else {
      // まだ保存してない → 追加する
      await supabase.from('saves').insert({ user_id: userId, saved_user_id: target.id })
      setSavedIds((prev) => [...prev, target.id])
    }

    setSavingId(null)
  }

  // メッセージ送信
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !userId || !activeMatchId) return

    const { error } = await supabase
      .from('messages')
      .insert([
        {
          match_id: activeMatchId,
          sender_id: userId,
          content: newMessage,
        },
      ])

    if (error) {
      console.error('送信エラー:', error.message)
      alert('メッセージの送信に失敗しました')
    } else {
      setNewMessage('')
    }
  }

  // チャット画面を開始
  const openChat = (matchId: string, partnerProfile?: PartnerProfile) => {
    setActiveMatchId(matchId)
    if (partnerProfile) setPartner(partnerProfile)
    setCurrentView('chat')
  }

  const lastReadMineId = [...messages]
    .reverse()
    .find((m) => m.sender_id === userId && m.read_at)?.id

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
        {/* ================= 画面1: ホーム画面 ================= */}
        {currentView === 'home' && (
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
                          if ((e.target as HTMLElement).closest('button')) return
                          router.push(`/user/${u.id}`)
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
                            {/* ↓ ここが新しく追加する保存ボタン */}
                            <button
                              className="btn-card-action"
                              onClick={() => handleToggleSave(u)}
                              disabled={savingId === u.id}
                            >
                              <i className="fa-solid fa-bookmark"></i>
                              {savedIds.includes(u.id) ? ' 保存済み' : ' 保存'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 下部ナビゲーションバー */}
            <nav className="app-nav-bar" id="app-bottom-nav">
              <button className="nav-tab active" aria-label="ホーム" onClick={() => setCurrentView('home')}>
                <div className="nav-tab-icon icon-home"></div>
              </button>
              <button
                className="nav-tab relative"
                aria-label="通知"
                onClick={() => router.push('/notifications')}
              >
                <div className="nav-tab-icon icon-bell"></div>
                <span className="bell-badge" style={{ display: hasUnread ? 'block' : 'none' }}></span>
              </button>
              <button className="nav-tab" aria-label="トーク" onClick={() => router.push('/talk')}>
                <div className="nav-tab-icon icon-chat"></div>
              </button>
              <button className="nav-tab" aria-label="設定" onClick={() => router.push('/profile')}>
                <div className="nav-tab-icon icon-person"></div>
              </button>
            </nav>
          </section>
        )}

        {/* ================= 画面2: チャット画面 ================= */}
        {currentView === 'chat' && (
          <section id="screen-talk" className="screen active">
            <div className="talk-container" style={{ gridTemplateColumns: '1fr' }}>
              <div className="talk-main" id="talk-main">
                <div className="talk-main-header">
                  <button
                    className="btn-chat-back-mobile"
                    style={{ display: 'inline-flex' }}
                    onClick={() => {
                      setCurrentView('home')
                      setActiveMatchId(null)
                    }}
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <h3 id="active-chat-partner-name">
                    {partner?.display_name || 'トーク相手'}
                  </h3>
                  <div className="header-right-actions"></div>
                </div>

                <div className="chat-messages-area" id="chat-messages-container">
                  {messages.length === 0 ? (
                    <div className="chat-empty-state">
                      <i className="fa-regular fa-comments"></i>
                      <p>まだメッセージがありません。最初のメッセージを送ってみましょう！</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMyMessage = msg.sender_id === userId
                      return (
                        <div key={msg.id} className={`msg-row ${isMyMessage ? 'sent' : 'received'}`}>
                          {!isMyMessage && (
                            <div className="msg-avatar">
                              <img src={partner?.avatar_url || '/default-avatar.png'} alt={partner?.display_name || ''} />
                            </div>
                          )}
                          <div className="msg-bubble-wrap">
                            <div className="msg-bubble">{msg.content}</div>
                            <div className="msg-meta">
                              {isMyMessage && msg.id === lastReadMineId && (
                                <span style={{ marginRight: '4px', opacity: 0.85 }}>既読</span>
                              )}
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-bar">
                  <button type="button" className="btn-chat-add" title="ファイル添付">
                    <i className="fa-solid fa-plus"></i>
                  </button>
                  <form onSubmit={sendMessage} className="chat-send-form">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Aa"
                      required
                    />
                    <button type="submit" className="btn-chat-send" disabled={!newMessage.trim()}>
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        )}



      </div>
    </div>
  )
}