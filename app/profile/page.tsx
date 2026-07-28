'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// --- 型定義 ---
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
}

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

// --- 定数定義 ---
const HOBBY_OPTIONS = ['旅行', 'ゲーム', '映画', '読書', 'ドライブ', 'スポーツ', 'キャンプ', 'コンピュータ']

const FACULTY_DEPARTMENTS: Record<string, string[]> = {
  '情報メディア学部': ['情報メディア学科'],
  'システム情報学部': ['システム情報学科'],
  '医療情報学部': ['医療情報学科'],
  '経営情報学部': ['経営情報学科', '先端経営学科', 'スポーツマネジメント学科'],
}

const YEAR_OPTIONS = ['1年', '2年', '3年', '4年']
const GENDER_OPTIONS = ['男性', '女性', 'その他']

export default function CombinedProfileAndChatPage() {
  const supabase = createClient()
  const router = useRouter()

  // 画面表示制御（nullの時はプロフィール画面、match_idが入っている時はチャット画面）
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)

  // 共通状態
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // --- プロフィール画面の状態 ---
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [fullName, setFullName] = useState('')
  const [furigana, setFurigana] = useState('')
  const [bio, setBio] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagMenuOpen, setTagMenuOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const hobbyWrapperRef = useRef<HTMLDivElement>(null)
  const [faculty, setFaculty] = useState('')
  const [department, setDepartment] = useState('')
  const [year, setYear] = useState('')
  const [gender, setGender] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchWithProfile[]>([])
  const [saving, setSaving] = useState(false)

  // --- チャット画面の状態 ---
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. 初回データ取得（プロフィール ＆ マッチ一覧）
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      // プロフィール取得
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError && profileError.code === 'PGRST116') {
        const metaFullName = (user.user_metadata?.full_name as string) ?? ''
        const metaFurigana = (user.user_metadata?.furigana as string) ?? ''

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id, full_name: metaFullName, furigana: metaFurigana })
          .select()
          .maybeSingle()

        if (insertError) {
          console.error('プロフィール作成エラー:', insertError)
        } else if (newProfile) {
          applyProfileToState(newProfile)
        }
      } else if (profileError) {
        console.error('プロフィール取得エラー:', profileError)
      } else if (profileData) {
        applyProfileToState(profileData)
      }

      // マッチ一覧取得
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

        const { data: partnerProfiles, error: partnerError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, bio, hobby_tags, full_name, furigana, faculty, department, year, gender')
          .in('id', partnerIds)

        if (partnerError) {
          console.error('マッチ相手プロフィール取得エラー:', partnerError)
        } else {
          const combined: MatchWithProfile[] = matchesData
            .map((m) => {
              const partnerId = m.user1_id === user.id ? m.user2_id : m.user1_id
              const partnerObj = partnerProfiles?.find((p) => p.id === partnerId)
              if (!partnerObj) return null
              return { match_id: m.id, partner: partnerObj }
            })
            .filter((x): x is MatchWithProfile => x !== null)

          setMatches(combined)
        }
      }

      setLoading(false)
    }

    const applyProfileToState = (p: Profile) => {
      setProfile(p)
      setDisplayName(p.display_name ?? '')
      setFullName(p.full_name ?? '')
      setFurigana(p.furigana ?? '')
      setBio(p.bio ?? '')
      setSelectedTags(p.hobby_tags ?? [])
      setFaculty(p.faculty ?? '')
      setDepartment(p.department ?? '')
      setYear(p.year ?? '')
      setGender(p.gender ?? '')
      setAvatarPreview(p.avatar_url)
    }

    init()
  }, [router, supabase])

  // 2. 選択されたチャット（activeMatchId）のリアルタイム購読＆初期化
  useEffect(() => {
    if (!activeMatchId || !userId) return

    let partnerId: string | null = null

    const fetchChatData = async () => {
      // マッチ情報取得
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', activeMatchId)
        .single()

      if (matchError) {
        console.error('マッチ情報取得エラー:', matchError)
        return
      }

      partnerId = matchData.user1_id === userId ? matchData.user2_id : matchData.user1_id

      // 相手のプロフィール取得
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

      // メッセージ一覧取得
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

      // 既読処理
      if (partnerId) {
        await markAsRead(activeMatchId, partnerId)
      }
    }

    fetchChatData()

    // Realtime チャネル登録
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

          if (partnerId && newMsg.sender_id === partnerId) {
            markAsRead(activeMatchId, partnerId)
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
  }, [activeMatchId, userId, supabase])

  // メッセージ追加時の自動スクロール
  useEffect(() => {
    if (activeMatchId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeMatchId])

  // 趣味タグ選択メニューの外側クリック検出
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (hobbyWrapperRef.current && !hobbyWrapperRef.current.contains(e.target as Node)) {
        setTagMenuOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  // トーストタイマー
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // --- 処理ハンドラー（プロフィール） ---
  const markAsRead = async (matchId: string, partnerId: string) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('match_id', matchId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
  }

  const handleFacultyChange = (value: string) => {
    setFaculty(value)
    const depts = FACULTY_DEPARTMENTS[value] ?? []
    if (!depts.includes(department)) {
      setDepartment('')
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag)
      }
      if (prev.length >= 6) {
        setToastMessage('趣味・タグは最大6個まで選択可能です。')
        return prev
      }
      return [...prev, tag]
    })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)

    let avatarUrl = profile?.avatar_url ?? null

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop()
      const filePath = `${userId}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true })

      if (uploadError) {
        console.error('画像アップロードエラー:', uploadError)
        alert('画像のアップロードに失敗しました')
        setSaving(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      avatarUrl = publicUrlData.publicUrl
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        full_name: fullName,
        furigana: furigana,
        bio: bio,
        hobby_tags: selectedTags,
        avatar_url: avatarUrl,
        faculty: faculty || null,
        department: department || null,
        year: year || null,
        gender: gender || null,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('プロフィール更新エラー:', updateError)
      alert('プロフィールの保存に失敗しました')
    } else {
      alert('プロフィールを保存しました')
      setAvatarFile(null)
    }

    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // --- 処理ハンドラー（チャット） ---
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

  const availableDepartments = faculty ? FACULTY_DEPARTMENTS[faculty] ?? [] : []

  // 一番最後に既読がついた自身のメッセージID
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
        {/* トースト表示 */}
        {toastMessage && (
          <div className="toast-container">
            <div className="toast warning">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* 1. チャット画面（activeMatchId が設定されている時） */}
        {/* ---------------------------------------------------- */}
        {activeMatchId ? (
          <section id="screen-talk" className="screen active">
            <div className="talk-container" style={{ gridTemplateColumns: '1fr' }}>
              <div className="talk-main" id="talk-main">
                <div className="talk-main-header">
                  <button
                    className="btn-chat-back-mobile"
                    style={{ display: 'inline-flex' }}
                    onClick={() => setActiveMatchId(null)}
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <h3 id="active-chat-partner-name">
                    {partner?.display_name || 'トーク相手'}
                  </h3>
                  <div className="header-right-actions"></div>
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
                              <img
                                src={partner?.avatar_url || '/default-avatar.png'}
                                alt={partner?.display_name || ''}
                              />
                            </div>
                          )}
                          <div className="msg-bubble-wrap">
                            <div className="msg-bubble">{msg.content}</div>
                            <div className="msg-meta">
                              {isMyMessage && msg.id === lastReadMineId && (
                                <span style={{ marginRight: '4px', opacity: 0.85 }}>既読</span>
                              )}
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* メッセージ入力バー */}
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
        ) : (
          /* ---------------------------------------------------- */
          /* 2. プロフィール編集画面（デフォルト） */
          /* ---------------------------------------------------- */
          <section id="screen-profile-edit" className="screen active">
            <header className="main-header border-bottom">
              <div className="header-left"></div>
              <div className="header-center">
                <h2 className="page-title">マイプロフィール</h2>
              </div>
              <div className="header-right">
                <button
                  onClick={handleLogout}
                  className="btn-secondary-link"
                  style={{ color: '#e74c3c' }}
                >
                  ログアウト
                </button>
              </div>
            </header>

            <div className="profile-card settings-card">
              <div className="profile-content-scroll">
                {/* アバター編集 */}
                <div className="profile-banner">
                  <div className="avatar-edit-container">
                    <div className="avatar-preview-circle" id="btn-upload-avatar-edit">
                      <img
                        src={avatarPreview || '/default-avatar.png'}
                        alt="アバタープレビュー"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <label className="camera-badge">
                      <i className="fa-solid fa-camera"></i>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        style={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* 趣味タグ */}
                <div
                  className="hobby-tags-wrapper"
                  ref={hobbyWrapperRef}
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    marginTop: '24px',
                    marginInline: 'auto',
                    position: 'relative',
                  }}
                >
                  <div className="custom-dropdown" style={{ position: 'relative', marginTop: '8px' }}>
                    <div
                      className={`dropdown-menu ${tagMenuOpen ? 'active' : ''}`}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        top: 0,
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      {HOBBY_OPTIONS.map((tag) => (
                        <label key={tag} className="checkbox-option">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={() => toggleTag(tag)}
                          />
                          {tag}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div
                    id="hobby-grid-edit"
                    onClick={() => setTagMenuOpen((open) => !open)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                      cursor: 'pointer',
                      marginTop: '8px',
                    }}
                  >
                    {Array.from({ length: 6 }).map((_, i) => {
                      const tag = selectedTags[i]
                      const label = tag
                        ? `＃${tag.length >= 4 ? `${tag.substring(0, 3)}...` : tag}`
                        : '#〇〇〇〇'

                      return (
                        <div
                          key={i}
                          className={`hobby-tag-pill ${tag ? 'active' : 'add-btn'}`}
                          style={{
                            backgroundColor: tag ? '#3498db' : '#38A1DB',
                            color: 'white',
                            borderRadius: '20px',
                            padding: tag ? '6px 8px' : '4px 8px',
                            textAlign: 'center',
                            fontSize: tag ? '13px' : '16px',
                            fontWeight: tag ? 'normal' : 'bold',
                          }}
                        >
                          {label}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* プロフィールフォーム */}
                <form className="profile-form" onSubmit={handleSaveProfile}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="settings-profile-fullname">氏名</label>
                      <input
                        type="text"
                        id="settings-profile-fullname"
                        placeholder="氏名を入力してください"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="settings-profile-furigana">氏名（フリガナ）</label>
                      <input
                        type="text"
                        id="settings-profile-furigana"
                        placeholder="氏名（フリガナ）を入力してください"
                        value={furigana}
                        onChange={(e) => setFurigana(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-profile-nickname">表示名</label>
                    <input
                      type="text"
                      id="settings-profile-nickname"
                      placeholder="表示名を入力してください"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="settings-profile-faculty">学部</label>
                      <select
                        id="settings-profile-faculty"
                        value={faculty}
                        onChange={(e) => handleFacultyChange(e.target.value)}
                        required
                      >
                        <option value="" disabled>学部を選択してください</option>
                        {Object.keys(FACULTY_DEPARTMENTS).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="settings-profile-department">学科</label>
                      <select
                        id="settings-profile-department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={!faculty}
                        required
                      >
                        <option value="" disabled>
                          {faculty ? '学科を選択してください' : '学部を先に選択してください'}
                        </option>
                        {availableDepartments.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="settings-profile-year">学年</label>
                      <select
                        id="settings-profile-year"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        required
                      >
                        <option value="" disabled>学年を選択してください</option>
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="settings-profile-gender">性別</label>
                      <select
                        id="settings-profile-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        required
                      >
                        <option value="" disabled>性別を選択してください</option>
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="settings-profile-bio">自己紹介</label>
                    <textarea
                      id="settings-profile-bio"
                      rows={4}
                      placeholder="自己紹介や趣味などを自由に記入してください（任意）"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn-primary submit-btn-full" disabled={saving}>
                    {saving ? '保存中...' : '保存する'}
                  </button>
                </form>

                {/* マッチした相手一覧 */}
                <div style={{ marginTop: '35px' }}>
                  <h3 className="section-title">マッチした相手</h3>
                  {matches.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--dark-light)', padding: '10px 0' }}>
                      まだマッチした相手がいません
                    </p>
                  ) : (
                    <div className="chat-list" style={{ border: '1px solid var(--secondary-border)', borderRadius: '8px', overflow: 'hidden' }}>
                      {matches.map((m) => (
                        <div
                          key={m.match_id}
                          className="chat-item"
                          onClick={() => setActiveMatchId(m.match_id)}
                        >
                          <div className="chat-item-avatar">
                            <img src={m.partner.avatar_url || '/default-avatar.png'} alt={m.partner.display_name || ''} />
                          </div>
                          <div className="chat-item-info">
                            <div className="chat-item-header">
                              <span className="chat-item-name">{m.partner.display_name || '名前未設定'}</span>
                            </div>
                            <div className="chat-item-preview-row">
                              <span className="chat-item-preview">
                                {(m.partner.hobby_tags ?? []).slice(0, 3).join(' / ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}