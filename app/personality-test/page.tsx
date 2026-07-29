'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// 診断の質問定義
const QUESTIONS = [
  {
    id: 'q1',
    text: '空きコマや休日の過ごし方は？',
    options: [
      { label: 'みんなでワイワイ話す・遊びに行く', score: { E: 2, I: 0 } },
      { label: '1人で静かに図書館やカフェで過ごす', score: { E: 0, I: 2 } },
    ],
  },
  {
    id: 'q2',
    text: 'グループワークでの立ち位置は？',
    options: [
      { label: 'リーダーとして議論をまとめる', score: { L: 2, S: 0 } },
      { label: 'サポート役に回って資料作成や作業を進める', score: { L: 0, S: 2 } },
    ],
  },
  {
    id: 'q3',
    text: '何かを決める時に重視するのは？',
    options: [
      { label: '効率や合理的なデータ', score: { T: 2, F: 0 } },
      { label: 'みんなの気持ちや人間関係', score: { T: 0, F: 2 } },
    ],
  },
]

// タイプごとの簡単な説明文(結果画面用)
const TYPE_DESCRIPTIONS: Record<string, string> = {
  'ムードメーカー型リーダー': 'みんなの輪の中心に立ち、場を盛り上げながら引っ張っていくタイプです。フットワークが軽く、新しい出会いや企画を楽しめる相手と相性が良さそうです。',
  'フレンドリーサポーター': '人当たりが良く、周りをそっと支えるのが得意なタイプです。じっくり話を聞いてくれる関係を築きたい人に向いています。',
  'じっくり思考派リーダー': '一人の時間を大切にしながらも、いざという時は筋道立てて周りを引っ張るタイプです。落ち着いたコミュニケーションを好みます。',
  'マイペースクリエイター': '自分のペースを大切にしながら、自分なりのやり方で物事を進めるタイプです。マイペースさを理解してくれる相手と良い関係を築けそうです。',
}

export default function PersonalityTestPage() {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [resultType, setResultType] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 選択肢を選んだ時の処理
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  // 診断結果の計算処理
  const calculateResult = () => {
    const q1Ans = answers['q1']
    const q2Ans = answers['q2']

    if (q1Ans === 0 && q2Ans === 0) return 'ムードメーカー型リーダー'
    if (q1Ans === 0 && q2Ans === 1) return 'フレンドリーサポーター'
    if (q1Ans === 1 && q2Ans === 0) return 'じっくり思考派リーダー'
    return 'マイペースクリエイター'
  }

  // 結果の送信・Supabase保存処理
  const handleSubmit = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      alert('ユーザーセッションが切れています。ログインし直してください。')
      router.push('/login')
      return
    }

    const type = calculateResult()

    // 既存のプロフィールを取得して存在確認
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    let error
    if (existingProfile) {
      // 既存プロフィールの場合は personality_type のみ更新
      // （すでに氏名や他項目が存在する場合に null で上書きしないようにする）
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ personality_type: type })
        .eq('id', user.id)
      error = updateError
    } else {
      // 新規登録などプロフィールが存在しない場合は新規に作成する
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name ?? null,
          furigana: user.user_metadata?.furigana ?? null,
          personality_type: type,
        })
      error = insertError
    }

    if (error) {
      console.error('診断結果の保存エラー詳細:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      alert(`診断結果の保存に失敗しました: ${error.message}`)
      setLoading(false)
      return
    }

    // 保存が終わったら結果画面を表示する
    setResultType(type)
    setLoading(false)
  }

  const isAllAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined)

  // 結果画面
  if (resultType) {
    return (
      <div className="outer-wrap">
        <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div className="result-card">
            <div className="result-header">
              <h2>あなたの診断結果</h2>
            </div>
            <div style={{ textAlign: 'center', margin: '20px 0 30px 0' }}>
              <h3 style={{ color: 'var(--primary-color)', fontSize: '22px', fontWeight: 'bold' }}>
                【{resultType}】
              </h3>
            </div>
            <div className="result-explanation">
              {TYPE_DESCRIPTIONS[resultType] ?? ''}
            </div>
            <button
              className="btn-primary submit-btn-full"
              onClick={() => router.push('/home')}
              style={{ marginTop: '20px' }}
            >
              ホームへ移動
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 質問回答画面
  return (
    <div className="outer-wrap">
      <div className="app-container" style={{ padding: '20px', overflowY: 'auto' }}>
        <div className="auth-card" style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
          <div className="auth-header">
            <span className="vertical-bar"></span>
            <h2>性格診断</h2>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px' }}>
            あなたにピッタリのマッチングを提供するため、簡単な質問にお答えください。
          </p>

          {QUESTIONS.map((q, idx) => (
            <div key={q.id} style={{ marginBottom: '24px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '10px' }}>
                Q{idx + 1}. {q.text}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.options.map((opt, optionIdx) => {
                  const isSelected = answers[q.id] === optionIdx
                  return (
                    <button
                      key={optionIdx}
                      type="button"
                      onClick={() => handleSelectOption(q.id, optionIdx)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--primary-color, #ff6b81)' : '1px solid #ccc',
                        backgroundColor: isSelected ? 'rgba(255, 107, 129, 0.1)' : '#fff',
                        color: isSelected ? 'var(--primary-color, #ff6b81)' : '#333',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn-primary auth-submit-btn"
            disabled={!isAllAnswered || loading}
            onClick={handleSubmit}
            style={{ marginTop: '20px' }}
          >
            {loading ? '診断結果を保存中...' : '診断を完了して次へ'}
          </button>
        </div>
      </div>
    </div>
  )
}