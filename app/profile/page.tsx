'use client'

import { useEffect, useRef, useState } from 'react'
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
  personality_type: string | null
}

const HOBBY_OPTIONS = ['旅行', 'ゲーム', '映画', '読書', 'ドライブ', 'スポーツ', 'キャンプ', 'コンピュータ']

const FACULTY_DEPARTMENTS: Record<string, string[]> = {
  '情報メディア学部': ['情報メディア学科'],
  'システム情報学部': ['システム情報学科'],
  '医療情報学部': ['医療情報学科'],
  '経営情報学部': ['経営情報学科', '先端経営学科', 'スポーツマネジメント学科'],
}

const YEAR_OPTIONS = ['1年', '2年', '3年', '4年']
const GENDER_OPTIONS = ['男性', '女性', 'その他']

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null)
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
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)

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
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code === 'PGRST116') {
        const metaFullName = (user.user_metadata?.full_name as string) ?? ''
        const metaFurigana = (user.user_metadata?.furigana as string) ?? ''

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id, full_name: metaFullName, furigana: metaFurigana })
          .select()
          .single()

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

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (hobbyWrapperRef.current && !hobbyWrapperRef.current.contains(e.target as Node)) {
        setTagMenuOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [toastMessage])

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

  const handleSave = async (e: React.FormEvent) => {
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

  const handleWithdraw = async () => {
    if (!confirm('本当に退会しますか？この操作は取り消せません。プロフィール・マッチ・メッセージなど、すべてのデータが削除されます。')) {
      return
    }

    setWithdrawing(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setWithdrawing(false)
      return
    }

    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        alert(`退会処理に失敗しました: ${data.error ?? '不明なエラー'}`)
        setWithdrawing(false)
        return
      }

      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('退会エラー:', err)
      alert('退会処理中に通信エラーが発生しました。')
      setWithdrawing(false)
    }
  }

  const availableDepartments = faculty ? (FACULTY_DEPARTMENTS[faculty] ?? []) : []

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
        {toastMessage && (
          <div className="toast-container">
            <div className="toast warning">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
        <section id="screen-profile-edit" className="screen active" style={{ height: '100%' }}>
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

          <div className="profile-card settings-card" style={{ height: 'calc(100% - 120px)', overflowY: 'auto' }}>
            <div className="profile-content-scroll" style={{ padding: '0 15px 30px 15px' }}>
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
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
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
                      <label key={tag} className="checkbox-option" style={{ color: '#000000' }}>
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
                          backgroundColor: tag ? '#e8f4fc' : '#f2f4f7',
                          color: '#000000',
                          border: tag ? '1.5px solid #3498db' : '1px dashed #b0bec5',
                          borderRadius: '20px',
                          padding: tag ? '6px 8px' : '4px 8px',
                          textAlign: 'center',
                          fontSize: tag ? '13px' : '16px',
                          fontWeight: tag ? 'bold' : '500',
                        }}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 性格診断の結果表示 */}
              <div
                style={{
                  maxWidth: '320px',
                  margin: '16px auto 0 auto',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: 'var(--dark-light)',
                }}
              >
                {profile?.personality_type ? (
                  <p>
                    性格診断: <strong style={{ color: 'var(--primary-color)' }}>{profile.personality_type}</strong>{' '}
                    <button
                      type="button"
                      className="btn-secondary-link"
                      onClick={() => router.push('/personality-test')}
                    >
                      もう一度診断する
                    </button>
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary-link"
                    onClick={() => router.push('/personality-test')}
                  >
                    性格診断がまだです。診断してみる
                  </button>
                )}
              </div>

              <form className="profile-form" onSubmit={handleSave}>
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

                {/* 学部・学科 */}
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

                {/* 学年・性別 */}
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
              {/* マイページメニュー */}
              <div className="mypage-menu-list" style={{ maxWidth: '320px', margin: '20px auto 0 auto' }}>
                <div
                  className="mypage-menu-item"
                  id="menu-item-likes-history"
                  onClick={() => router.push('/likes-history')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 12px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                  }}
                >
                  <div className="mypage-menu-item-left" style={{ display: 'flex', alignItems: 'center' }}>
                    <i className="fa-solid fa-heart" style={{ color: '#3498db', width: 18, marginRight: 8 }}></i>
                    <span>いいね履歴</span>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: '#ccc' }}></i>
                </div>

                <div
                  className="mypage-menu-item2"
                  id="menu-item-collection"
                  onClick={() => router.push('/collection')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div className="mypage-menu-item-left" style={{ display: 'flex', alignItems: 'center' }}>
                    <i className="fa-solid fa-bookmark" style={{ color: '#3498db', marginRight: 8 }}></i>
                    <span>保存</span>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: '#ccc' }}></i>
                </div>
              </div>

              {/* 退会 */}
              <div style={{ marginTop: '35px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  style={{
                    background: 'none',
                    border: '1px solid var(--error-color, #e74c3c)',
                    color: 'var(--error-color, #e74c3c)',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: withdrawing ? 'not-allowed' : 'pointer',
                    opacity: withdrawing ? 0.6 : 1,
                    width: '100%',
                    maxWidth: '320px',
                    marginInline: 'auto',
                    display: 'block'
                  }}
                >
                  {withdrawing ? '退会処理中...' : '退会する'}
                </button>
              </div>
            </div>
          </div>

          {/* 下部ナビゲーション (4つのタブに更新) */}
          <nav className="app-nav-bar" id="app-bottom-nav">
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
              <span className="bell-badge" id="bell-badge-nav"></span>
            </button>
            <button
              className="nav-tab"
              id="nav-tab-talk"
              onClick={() => router.push('/talk')}
              aria-label="トーク"
            >
              <div className="nav-tab-icon icon-chat"></div>
            </button>
            <button
              className="nav-tab active"
              id="nav-tab-profile"
              onClick={() => router.push('/profile')}
              aria-label="設定"
            >
              <div className="nav-tab-icon icon-person"></div>
            </button>
          </nav>
        </section>
      </div>
    </div>
  )
}
