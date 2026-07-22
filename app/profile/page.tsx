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

      // 自分のプロフィールを取得
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('プロフィール取得エラー:', profileError)
      } else if (profileData) {
        setProfile(profileData)
        setDisplayName(profileData.display_name ?? '')
        setBio(profileData.bio ?? '')
        setHobbyTagsInput((profileData.hobby_tags ?? []).join(', '))
        setAvatarPreview(profileData.avatar_url)
      }

      // マッチ相手一覧を取得
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

  // アバター画像選択時のプレビュー
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  // プロフィール保存処理
  const handleSave = async () => {
    if (!userId) return
    setSaving(true)

    let avatarUrl = profile?.avatar_url ?? null

    // 新しい画像が選択されていればアップロード
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
      <div className="flex items-center justify-center h-screen text-gray-500">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">マイプロフィール</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 font-medium"
        >
          ログアウト
        </button>
      </header>

      {/* プロフィール編集 */}
      <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col items-center gap-3">
          <img
            src={avatarPreview || '/default-avatar.png'}
            alt="アバター"
            className="w-24 h-24 rounded-full object-cover border"
          />
          <label className="text-sm text-blue-500 cursor-pointer">
            画像を変更
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            表示名
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            自己紹介
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            趣味タグ(カンマ区切り)
          </label>
          <input
            type="text"
            value={hobbyTagsInput}
            onChange={(e) => setHobbyTagsInput(e.target.value)}
            placeholder="例: 読書, 映画鑑賞, カフェ巡り"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-500 text-white rounded-full py-2 font-bold disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </section>

      {/* マッチ相手一覧 */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-3">マッチした相手</h2>
        {matches.length === 0 ? (
          <p className="text-gray-500 text-sm">まだマッチした相手がいません</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <button
                key={m.match_id}
                onClick={() => router.push(`/chat/${m.match_id}`)}
                className="w-full flex items-center gap-3 bg-white rounded-xl shadow-sm p-3 hover:bg-gray-50 transition-colors"
              >
                <img
                  src={m.partner.avatar_url || '/default-avatar.png'}
                  alt={m.partner.display_name || ''}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="text-left">
                  <p className="font-medium text-gray-800">
                    {m.partner.display_name || '名前未設定'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {(m.partner.hobby_tags ?? []).slice(0, 3).join(' / ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}