'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const router = useRouter()
  const supabase = createClient()

  // 新規登録ボタンが押されたときの処理
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage(`エラー: ${error.message}`)
    } else {
      setMessage('登録用のメールを送信しました！大学のメールボックスを確認して、リンクをクリックしてください。')
    }
    setLoading(false)
  }

  // ログインボタン(1段階目: パスワード確認)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // まずパスワードで本人確認
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setMessage('エラー: メールアドレスかパスワードが間違っています。')
      setLoading(false)
      return
    }

    // パスワード確認OK → 2段階目としてメールにOTPコードを送信
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${location.origin}/auth/callback`,   // ← この行を追加
      },
    })

    if (otpError) {
      setMessage(`エラー: 確認コードの送信に失敗しました。(${otpError.message})`)
    } else {
      setMessage('確認コードをメールに送信しました。届いた6桁のコードを入力してください。')
      setStep('otp')
    }
    setLoading(false)
  }

  // OTPコード確認ボタン(2段階目)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (error) {
      setMessage(`エラー: コードが正しくないか、期限切れです。(${error.message})`)
    } else {
      router.push('/profile')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg border border-blue-100">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-blue-600 tracking-tight">
            UniMatch
          </h1>
          <p className="text-sm text-gray-500 mt-2">大学生限定のマッチングアプリ</p>
        </div>

        {step === 'credentials' && (
          <form className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                大学のメールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="s.do-johodai.ac.jp"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                パスワード（6文字以上）
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="••••••••"
                required
              />
            </div>

            {message && (
              <div className={`p-4 rounded-xl text-sm font-medium ${message.includes('エラー') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                ログイン
              </button>
              <button
                onClick={handleSignUp}
                disabled={loading}
                className="w-full bg-white text-blue-600 font-bold py-3 px-4 rounded-xl border-2 border-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                新規登録
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                確認コード（6桁）
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 tracking-widest text-center text-lg"
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>

            {message && (
              <div className={`p-4 rounded-xl text-sm font-medium ${message.includes('エラー') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                コードを確認してログイン
              </button>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="text-sm text-gray-500 hover:underline"
              >
                戻る
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}