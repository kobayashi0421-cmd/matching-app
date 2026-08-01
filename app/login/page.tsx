'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from "next/link"

type Step = 'login' | 'register' | 'otp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // splash state ('visible' -> 'fading' -> 'hidden')
  const [splashState, setSplashState] = useState<'visible' | 'fading' | 'hidden'>('visible')

  useEffect(() => {
    // 1.5秒後にフェードアウトを開始
    const fadeTimer = setTimeout(() => {
      setSplashState('fading')
    }, 1500)

    // 2.3秒後に完全に非表示（DOM削除）
    const hideTimer = setTimeout(() => {
      setSplashState('hidden')
    }, 2300)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  // login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // register fields
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerFurigana, setRegisterFurigana] = useState('')
  const [termsAgree, setTermsAgree] = useState(false)
  const [privacyAgree, setPrivacyAgree] = useState(false)

  // otp
  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpType, setOtpType] = useState<'email' | 'signup'>('email')
  console.log('現在のotpType:', otpType)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (signInError) {
      setMessage('エラー: メールアドレスかパスワードが間違っています。')
      setLoading(false)
      return
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (otpError) {
      setMessage(`エラー: 確認コードの送信に失敗しました。(${otpError.message})`)
    } else {
      setOtpEmail(loginEmail)
      setOtpType('email')
      setMessage('')
      setStep('otp')
    }
    setLoading(false)
  }

  // 新規登録(氏名・フリガナを user_metadata として一緒に送る)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email: registerEmail,
      password: registerPassword,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: {
          // ★ ここに入れたメタデータは /profile 側で初回プロフィール作成時に読み取って保存する
          full_name: registerName,
          furigana: registerFurigana,
        },
      },
    })

    if (error) {
      setMessage(`エラー: ${error.message}`)
    } else {
      setOtpEmail(registerEmail)
      setOtpType('signup')
      setMessage('')
      setStep('otp')
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail,
      token: otp,
      type: otpType,
    })

    if (error) {
      setMessage(`エラー: コードが正しくないか、期限切れです。(${error.message})`)
    } else {
      // ★ ここを修正！
      // 新規登録の時だけ「/personality-test（性格診断）」へ移動させます
      if (otpType === 'signup') {
        router.push('/personality-test')
      } else {
        // 2回目以降の通常のログイン時はそのままホーム画面へ
        router.push('/home')
      }
      router.refresh()
    }
    setLoading(false)
  }

  const canSubmitRegister = termsAgree && privacyAgree

  return (
    <div className="outer-wrap">
      {splashState !== 'hidden' && (
        <div className={`splash-overlay ${splashState === 'fading' ? 'fade-out' : ''}`}>
          <div className="splash-content">
            <img
              src="/images/unifure-logo.png"
              alt="unifure-logo"
              className="splash-logo-img"
            />
            <h1 className="splash-title">unifure</h1>
            <p className="splash-subtitle">大学生のためのマッチングアプリ</p>
          </div>
        </div>
      )}

      <div className="app-container">

        {step === 'login' && (
          <section id="screen-login" className="screen active">
            <div className="auth-card">
              <div className="auth-header">
                <span className="vertical-bar"></span>
                <h2>ログイン</h2>
              </div>
              <form id="form-login" className="auth-form" onSubmit={handleSignIn}>
                <div className="form-group">
                  <label htmlFor="login-email">メールアドレス</label>
                  <input
                    type="email"
                    id="login-email"
                    placeholder="メールアドレスを入力してください"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-password">パスワード</label>
                  <input
                    type="password"
                    id="login-password"
                    placeholder="パスワードを入力してください"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>

                {message && (
                  <div className={`form-message ${message.includes('エラー') ? 'is-error' : 'is-success'}`}>
                    {message}
                  </div>
                )}

                <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
                  ログイン
                </button>
              </form>
              <div className="auth-footer">
                <p>アカウントをお持ちでないですか？</p>
                <button
                  className="btn-secondary-link"
                  id="goto-register"
                  onClick={() => { setMessage(''); setStep('register') }}
                >
                  新規会員登録はこちら
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 'register' && (
          <section id="screen-register" className="screen active">
            <div className="auth-card">
              <div className="auth-header">
                <span className="vertical-bar"></span>
                <h2>会員登録</h2>
              </div>
              <form id="form-register" className="auth-form" onSubmit={handleSignUp}>
                <div className="form-group">
                  <label htmlFor="register-email">メールアドレス</label>
                  <input
                    type="email"
                    id="register-email"
                    placeholder="メールアドレスを入力してください"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="register-password">パスワード</label>
                  <input
                    type="password"
                    id="register-password"
                    placeholder="パスワードを入力してください"
                    minLength={6}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="register-name">氏名</label>
                  <input
                    type="text"
                    id="register-name"
                    placeholder="氏名を入力してください"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="register-furigana">氏名（フリガナ）</label>
                  <input
                    type="text"
                    id="register-furigana"
                    placeholder="氏名（フリガナ）を入力してください"
                    value={registerFurigana}
                    onChange={(e) => setRegisterFurigana(e.target.value)}
                    required
                  />
                </div>

                {/* 利用規約 */}
                <div className="form-group terms-checkbox-group">
                  <input
                    type="checkbox"
                    id="register-terms-agree"
                    checked={termsAgree}
                    onChange={(e) => setTermsAgree(e.target.checked)}
                    required
                  />

                  <Link href="/terms" className="btn-secondary-link" target="_blank">
                    利用規約
                  </Link>
                  に同意します。

                </div>

                {/* プライバシーポリシー */}
                <div className="form-group terms-checkbox-group">
                  <input
                    type="checkbox"
                    id="register-privacy-agree"
                    checked={privacyAgree}
                    onChange={(e) => setPrivacyAgree(e.target.checked)}
                    required
                  />

                  <Link href="/privacy" className="btn-secondary-link" target="_blank">
                    プライバシーポリシー
                  </Link>
                  に同意します。

                </div>

                {message && (
                  <div className={`form-message ${message.includes('エラー') ? 'is-error' : 'is-success'}`}>
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary auth-submit-btn"
                  id="btn-register-submit"
                  disabled={!canSubmitRegister || loading}
                >
                  同意して次へ
                </button>
              </form>
              <div className="auth-footer">
                <button
                  className="btn-secondary-link"
                  id="back-to-login"
                  onClick={() => { setMessage(''); setStep('login') }}
                >
                  ← ログインに戻る
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 'otp' && (
          <section id="screen-verify" className="screen active">
            <div className="auth-card">
              <div className="auth-header">
                <span className="vertical-bar"></span>
                <h2>2段階認証</h2>
              </div>
              <div className="verify-desc">
                <p id="verify-email-target">{otpEmail} 宛に認証コードを送信しました。</p>
                <p>メールボックスを確認し、送られた8桁のコードを入力してください。</p>
              </div>
              <form id="form-verify" className="auth-form" onSubmit={handleVerifyOtp}>
                <div className="form-group code-input-group">
                  <input
                    type="text"
                    id="verify-code"
                    inputMode="numeric"
                    placeholder="8桁のコード"
                    maxLength={8}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>

                {message && (
                  <div className={`form-message ${message.includes('エラー') ? 'is-error' : 'is-success'}`}>
                    {message}
                  </div>
                )}

                <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
                  認証する

                </button>
              </form>
              <div className="auth-footer">
                <button
                  className="btn-secondary-link"
                  onClick={() => { setMessage(''); setStep('login') }}
                >
                  ← ログインに戻る
                </button>
              </div>
            </div>
          </section>
        )}


      </div>
    </div>
  )
}
