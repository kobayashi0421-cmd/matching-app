'use client'

import { useEffect, useState, use, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import ReportModal from '@/app/components/ReportModal'

type Message = {
  id: string
  match_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

type PartnerProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export default function ChatPage({ params }: { params: Promise<{ match_id: string }> }) {
  const { match_id } = use(params)

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [showReport, setShowReport] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 相手から届いた未読メッセージをまとめて既読にする
  const markAsRead = async (partnerId: string) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('match_id', match_id)
      .eq('sender_id', partnerId)
      .is('read_at', null)
  }

  useEffect(() => {
    let partnerId: string | null = null

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', match_id)
        .single()

      if (matchError) {
        console.error('マッチ情報取得エラー:', matchError)
        return
      }

      partnerId = matchData.user1_id === user.id ? matchData.user2_id : matchData.user1_id

      const { data: partnerData, error: partnerError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', partnerId)
        .single()

      if (partnerError) {
        console.error('相手プロフィール取得エラー:', partnerError)
      } else if (partnerData) {
        setPartner(partnerData)
      }

      // 画面を開いた時点で、相手からの未読メッセージを既読にする
      if (partnerId) {
        await markAsRead(partnerId)
      }
    }

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', match_id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('メッセージ取得エラー:', error)
      } else if (data) {
        setMessages(data)
      }
    }

    const run = async () => {
      await getUser()
      await fetchMessages()
    }
    run()

    const channel = supabase
      .channel(`chat_${match_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${match_id}`
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])

          // チャットを開いている間に相手からメッセージが届いたら、即座に既読にする
          if (partnerId && newMsg.sender_id === partnerId) {
            markAsRead(partnerId)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${match_id}`
        },
        (payload) => {
          // 相手が自分のメッセージを既読にした時など、read_at の変化を反映する
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
  }, [match_id, router, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !userId) return

    const { error } = await supabase
      .from('messages')
      .insert([
        {
          match_id: match_id,
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

  // 自分が送ったメッセージのうち、相手が読んだ一番新しいものだけに「既読」を出す(LINEと同じ見せ方)
  const lastReadMineId = [...messages]
    .reverse()
    .find((m) => m.sender_id === userId && m.read_at)?.id

  return (
    <div className="outer-wrap">
      <div className="app-container">
        <section id="screen-talk" className="screen active">
          <div className="talk-container" style={{ gridTemplateColumns: '1fr' }}>
            <div className="talk-main" id="talk-main">
              <div className="talk-main-header">
                <button
                  className="btn-chat-back-mobile"
                  style={{ display: 'inline-flex' }}
                  onClick={() => router.push('/profile')}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <h3 id="active-chat-partner-name" style={{ color: '#000' }}>
                  {partner?.display_name || 'トーク相手'}
                </h3>
                <div className="header-right-actions">
                  {userId && partner && (
                    <button
                      type="button"
                      className="btn-report"
                      onClick={() => setShowReport(true)}
                    >
                      通報
                    </button>
                  )}
                </div>
              </div>

              {/* メッセージ一覧エリア */}
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

              {/* メッセージ入力エリア */}
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
              {showReport && userId && partner && (
                <ReportModal
                  reporterId={userId}
                  targetUserId={partner.id}
                  targetDefaultName={partner.display_name || ''}
                  onClose={() => setShowReport(false)}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
