'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type Message = {
  id: string
  match_id: string
  sender_id: string
  content: string
  created_at: string
}

export default function ChatPage({ params }: { params: Promise<{ match_id: string }> }) {
  const { match_id } = use(params)

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // 1. ログインしているユーザーの情報を取得
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
    }
    getUser()

    // 2. 過去のメッセージ履歴を取得
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', match_id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error("メッセージ取得エラー:", error)
      } else if (data) {
        setMessages(data)
      }
    }
    fetchMessages()

    // 3. ✨ リアルタイム（Realtime）の購読設定 ✨
    // 誰かがメッセージを送信してデータベースに追加されたら、自動で検知して画面を更新する
    const channel = supabase
      .channel(`chat_${match_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // データが追加された時だけ
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${match_id}` // このマッチングルームのメッセージだけ
        },
        (payload) => {
          // 新しいメッセージが届いたらリストに追加
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])
        }
      )
      .subscribe()

    // 画面を離れたらリアルタイム通信を解除する（お作法）
    return () => {
      supabase.removeChannel(channel)
    }
  }, [match_id, router, supabase])

  // メッセージ送信ボタンを押したときの処理
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !userId) return

    // Supabaseにメッセージを保存
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
      setNewMessage('') // 送信に成功したら入力欄を空にする
      // ※Realtime機能がオンになっているので、自動的にリストに追加されます
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white p-4 shadow-sm flex items-center border-b">
        <button onClick={() => router.push('/profile')} className="text-blue-500 font-medium mr-4">
          ← 戻る
        </button>
        <h1 className="text-lg font-bold text-gray-800">チャットルーム</h1>
      </header>

      {/* メッセージ一覧エリア */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMyMessage = msg.sender_id === userId
          return (
            <div key={msg.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMyMessage
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                  }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <span className={`text-[10px] mt-1 block text-right ${isMyMessage ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
      </main>

      {/* 入力エリア */}
      <footer className="bg-white p-4 border-t border-gray-200">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-500 text-white rounded-full px-6 py-2 font-bold disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            送信
          </button>
        </form>
      </footer>
    </div>
  )
}
