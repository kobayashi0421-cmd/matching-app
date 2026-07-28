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

export default function PersonalityTestPage() {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 選択肢を選んだ時の処理
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  // 診断結果の計算処理
  const calculateResult = () => {
    // 簡易的な判定ロジック（タイプを特定）
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

    // 現在ログイン中のユーザー情報を取得
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      alert('ユーザーセッションが切れています。ログインし直してください。')
      router.push('/login')
      return
    }

    const resultType = calculateResult()

    // Supabaseの profiles テーブルに診断結果を書き込む (upsert)
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name,
        furigana: user.user_metadata?.furigana,
        personality_type: resultType,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('診断結果の保存エラー:', error)
      alert('診断結果の保存に失敗しました。')
    } else {
      // 保存完了後にホームへ遷移
      router.push('/home')
      router.refresh()
    }
    setLoading(false)
  }

  const isAllAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined)

  return (
    <div className="outer-wrap">
      <div className="app-container" style={{ padding: '20px' }}>
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