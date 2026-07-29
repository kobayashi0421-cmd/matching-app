'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  hobby_tags: string[] | null
  full_name: string | null
  furigana: string | null
  faculty: string | null
  department: string | null
  year: string | null
  gender: string | null
}

type MatchWithProfile = {
  match_id: string
  partner: Profile
  latestMsg?: Message | null
  unreadCount?: number
}

type Message = {
  id: string
  match_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

export default function TalkPage() {
  const supabase = createClient()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  // チャット用ステート
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [partner, setPartner] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')

  // モバイル表示判定
  const [isMobile, setIsMobile] = useState(false)

  // 1. レスポンシブ幅の監視
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 2. ユーザー情報およびマッチリストの取得
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      // マッチ一覧の取得 (自分がuser1またはuser2である行)
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

      if (matchesError) {
        console.error('マッチ一覧取得エラー:', matchesError)
      } else if (matchesData && matchesData.length > 0) {
        const partnerIds = matchesData.map((m) =>
          m.user1_id === user.id ? m.user2_id : m.user1_id
        )

        // マッチ相手のプロフィールの取得
        const { data: partnerProfiles, error: partnerError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, bio, hobby_tags, full_name, furigana, faculty, department, year, gender')
          .in('id', partnerIds)

        if (partnerError) {
          console.error('マッチ相手プロフィール取得エラー:', partnerError)
        } else {
          // 各マッチに関連するメッセージを一括取得して最新テキストと未読数を算出
          const matchIds = matchesData.map((m) => m.id)
          const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .in('match_id', matchIds)
            .order('created_at', { ascending: true })

          const combined: MatchWithProfile[] = matchesData
            .map((m): MatchWithProfile | null => {
              const partnerId = m.user1_id === user.id ? m.user2_id : m.user1_id
              const partnerInfo = partnerProfiles?.find((p) => p.id === partnerId)
              if (!partnerInfo) return null

              const matchMsgs = (messagesData ?? []).filter((msg) => msg.match_id === m.id)
              const latestMsg = matchMsgs[matchMsgs.length - 1] || null
              const unreadCount = matchMsgs.filter(
                (msg) => msg.sender_id === partnerId && !msg.read_at
              ).length

              return {
                match_id: m.id,
                partner: partnerInfo,
                latestMsg,
                unreadCount
              }
            })
            .filter((x): x is MatchWithProfile => x !== null)

          // メッセージ受信時間順にソート
          combined.sort((a, b) => {
            const timeA = a.latestMsg ? new Date(a.latestMsg.created_at).getTime() : 0
            const timeB = b.latestMsg ? new Date(b.latestMsg.created_at).getTime() : 0
            return timeB - timeA
          })

          setMatches(combined)
        }
      }
      setLoading(false)
    }

    init()
  }, [router, supabase])

  // 3. チャット詳細データのフェッチとリアルタイム購読（activeMatchId 変更時）
  useEffect(() => {
    if (!activeMatchId || !userId) return

    const fetchChatMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', activeMatchId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('メッセージ取得エラー:', error)
      } else if (data) {
        setMessages(data)
      }

      // 既読にする処理
      if (partner) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('match_id', activeMatchId)
          .eq('sender_id', partner.id)
          .is('read_at', null)
      }
    }

    fetchChatMessages()

    const channel = supabase
      .channel(`chat_talk_realtime_${activeMatchId}`)
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

          // チャットを開いているなら即座に既読にする
          if (partner && newMsg.sender_id === partner.id) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('match_id', activeMatchId)
              .eq('sender_id', partner.id)
              .is('read_at', null)
              .then()
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
  }, [activeMatchId, userId, supabase, partner])

  // 4. チャットの新着メッセージ自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 5. メッセージの送信
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !userId || !activeMatchId) return

    const { error } = await supabase
      .from('messages')
      .insert([
        {
          match_id: activeMatchId,
          sender_id: userId,
          content: newMessage,
        }
      ])

    if (error) {
      console.error('送信エラー:', error.message)
      alert('メッセージの送信に失敗しました')
    } else {
      setNewMessage('')
    }
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

  // 表示制御フラグ
  const showSidebar = !isMobile || !activeMatchId
  const showChatPane = !isMobile || !!activeMatchId

  return (
    <div className="outer-wrap">
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <section id="screen-talk" className="screen active" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%' }}>

          <div className="talk-container" style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '240px 1fr',
            flexGrow: 1,
            height: isMobile && activeMatchId ? '100%' : 'calc(100% - 60px)',
            overflow: 'hidden'
          }}>

            {/* Left Panel: Chat List */}
            {showSidebar && (
              <div className="talk-sidebar" id="talk-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="sidebar-header">
                  <button className="btn-sidebar-back" id="btn-talk-sidebar-back" onClick={() => router.push('/home')}>
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <h2>トーク</h2>
                </div>
                <div className="chat-list" id="chat-rooms-list" style={{ flexGrow: 1, overflowY: 'auto' }}>
                  {matches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--dark-light)' }}>
                      <p style={{ fontSize: '13px' }}>マッチした相手がまだいません</p>
                    </div>
                  ) : (
                    matches.map((m) => {
                      const isActive = m.match_id === activeMatchId
                      return (
                        <div
                          key={m.match_id}
                          className={`chat-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            setPartner(m.partner)
                            setActiveMatchId(m.match_id)
                          }}
                          style={{
                            backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                          }}
                        >
                          <div className="chat-item-avatar">
                            <img src={m.partner.avatar_url || '/default-avatar.png'} alt={m.partner.display_name || ''} />
                          </div>
                          <div className="chat-item-info">
                            <div className="chat-item-header">
                              <span className="chat-item-name">{m.partner.display_name || '名前未設定'}</span>
                              {m.latestMsg && (
                                <span className="chat-item-time" style={{ fontSize: '10px', color: '#a0aec0' }}>
                                  {new Date(m.latestMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <div className="chat-item-preview-row">
                              <span className="chat-item-preview">
                                {m.latestMsg ? m.latestMsg.content : (m.partner.hobby_tags ?? []).slice(0, 3).join(' / ') || '趣味未登録'}
                              </span>
                              {m.unreadCount && m.unreadCount > 0 ? (
                                <span className="chat-unread-badge">{m.unreadCount}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Right Panel: Active Chat Room */}
            {showChatPane && (
              <div className="talk-main" id="talk-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
                <div className="talk-main-header">
                  <button
                    className="btn-chat-back-mobile"
                    id="btn-chat-back-mobile"
                    style={{ display: isMobile ? 'inline-flex' : 'none' }}
                    onClick={() => {
                      setActiveMatchId(null)
                      setPartner(null)
                    }}
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <h3 id="active-chat-partner-name">{partner?.display_name || 'トーク相手'}</h3>
                  <div className="header-right-actions">
                    {/* Placeholder if needed */}
                  </div>
                </div>

                {/* Message Area */}
                <div className="chat-messages-area" id="chat-messages-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
                  {!activeMatchId ? (
                    <div className="chat-empty-state">
                      <i className="fa-regular fa-comments"></i>
                      <p>トークリストから友達を選択してチャットを始めましょう！</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty-state">
                      <i className="fa-regular fa-comments"></i>
                      <p>まだメッセージがありません。最初のメッセージを送ってみましょう！</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMyMessage = msg.sender_id === userId
                      return (
                        <div
                          key={msg.id}
                          className={`msg-row ${isMyMessage ? 'sent' : 'received'}`}
                        >
                          {!isMyMessage && (
                            <div className="msg-avatar">
                              <img src={partner?.avatar_url || '/default-avatar.png'} alt={partner?.display_name || ''} />
                            </div>
                          )}
                          <div className="msg-bubble-wrap">
                            <div className="msg-bubble">
                              {msg.content}
                            </div>
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

                {/* Message Input Pane */}
                <div className="chat-input-bar">
                  <form id="form-chat-send" className="chat-send-form" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      id="chat-input-message"
                      placeholder="Aa"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      required
                      disabled={!activeMatchId}
                    />
                    <button
                      type="submit"
                      className="btn-chat-send"
                      id="btn-chat-send"
                      disabled={!activeMatchId || !newMessage.trim()}
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* 下部ナビゲーション */}
          {(!isMobile || !activeMatchId) && (
            <nav className="app-nav-bar" id="app-bottom-nav" style={{ position: 'relative', bottom: 0 }}>
              <button
                className="nav-tab"
                id="nav-tab-home"
                onClick={() => router.push('/home')}
                aria-label="ホーム"
              >
                <div className="nav-tab-icon icon-home"></div>
              </button>
              <button
                className="nav-tab relative"
                id="nav-tab-bell"
                onClick={() => router.push('/notifications')}
                aria-label="通知"
              >
                <div className="nav-tab-icon icon-bell"></div>
              </button>
              <button
                className="nav-tab active"
                id="nav-tab-talk"
                onClick={() => router.push('/talk')}
                aria-label="トーク" style={{ color: '#000' }}
              >
                <div className="nav-tab-icon icon-chat"></div>
              </button>
              <button
                className="nav-tab"
                id="nav-tab-profile"
                onClick={() => router.push('/profile')}
                aria-label="設定"
              >
                <div className="nav-tab-icon icon-person"></div>
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}