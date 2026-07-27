'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  hobby_tags: string[] | null
}

type MatchWithProfile = {
  match_id: string
  partner: Profile
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [hobbyTagsInput, setHobbyTagsInput] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchWithProfile[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

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
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id })
          .select()
          .single()

        if (insertError) {
          console.error('プロフィール作成エラー:', insertError)
        } else if (newProfile) {
          setProfile(newProfile)
          setDisplayName(newProfile.display_name ?? '')
          setBio(newProfile.bio ?? '')
          setHobbyTagsInput((newProfile.hobby_tags ?? []).join(', '))
          setAvatarPreview(newProfile.avatar_url)
        }
      } else if (profileError) {
        console.error('プロフィール取得エラー:', profileError)
      } else if (profileData) {
        setProfile(profileData)
        setDisplayName(profileData.display_name ?? '')
        setBio(profileData.bio ?? '')
        setHobbyTagsInput((profileData.hobby_tags ?? []).join(', '))
        setAvatarPreview(profileData.avatar_url)
      }

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
          .select('id, display_name, avatar_url, bio, hobby_tags')
          .in('id', partnerIds)

        if (partnerError) {
          console.error('マッチ相手プロフィール取得エラー:', partnerError)
        } else {
          const combined: MatchWithProfile[] = matchesData
            .map((m) => {
              const partnerId = m.user1_id === user.id ? m.user2_id : m.user1_id
              const partner = partnerProfiles?.find((p) => p.id === partnerId)
              if (!partner) return null
              return { match_id: m.id, partner }
            })
            .filter((x): x is MatchWithProfile => x !== null)

          setMatches(combined)
        }
      }

      setLoading(false)
    }

    init()
  }, [router, supabase])

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

    const hobbyTags = hobbyTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        bio: bio,
        hobby_tags: hobbyTags,
        avatar_url: avatarUrl,
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
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>

              {/* プロフィール編集フォーム */}
              <form className="profile-form" onSubmit={handleSave}>
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

                <div className="form-group">
                  <label htmlFor="settings-profile-hobby">趣味タグ(カンマ区切り)</label>
                  <input
                    type="text"
                    id="settings-profile-hobby"
                    placeholder="例: 読書, 映画鑑賞, カフェ巡り"
                    value={hobbyTagsInput}
                    onChange={(e) => setHobbyTagsInput(e.target.value)}
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
                        onClick={() => router.push(`/chat/${m.match_id}`)}
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
      </div>
    </div>
  )
}
