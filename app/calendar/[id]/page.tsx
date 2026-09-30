'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, useCalendarUser } from '../useCalendarUser';
import { NameGate } from '../NameGate';
import { CalendarView } from '../CalendarView';

type Answer = 'ok' | 'maybe' | 'ng';
type DateRow = { id: string; date: string };
type Resp = { id: string; date_id: string; user_id: string; name: string; answer: Answer };

const label = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { userId, name, ready, login, rename, logout, loggedIn } = useCalendarUser();
  const [title, setTitle] = useState('');
  const [dates, setDates] = useState<DateRow[]>([]);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [mine, setMine] = useState<Record<string, Answer>>({});
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const prefilled = useRef(false);

  // スプラッシュ('visible' -> 'fading' -> 'hidden')
  const [splashState, setSplashState] = useState<'visible' | 'fading' | 'hidden'>('visible');

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashState('fading'), 1500); // 1.5秒後にフェードアウト開始
    const hideTimer = setTimeout(() => setSplashState('hidden'), 2100); // 2.1秒後に完全に消す
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const loadResponses = useCallback(async () => {
    const { data } = await supabase.from('responses').select('*').eq('event_id', id);
    setResponses((data as Resp[]) ?? []);
    return (data as Resp[]) ?? [];
  }, [id]);

  // 初回読み込み
  useEffect(() => {
    (async () => {
      const [{ data: ev }, { data: ds }] = await Promise.all([
        supabase.from('events').select('title').eq('id', id).single(),
        supabase.from('event_dates').select('id, date').eq('event_id', id).order('date'),
      ]);
      setTitle(ev?.title ?? '(イベントが見つかりません)');
      setDates((ds as DateRow[]) ?? []);
      await loadResponses();
    })();
  }, [id, loadResponses]);

  // 自分の前回の回答をフォームに読み込む(初回のみ)
  useEffect(() => {
    if (!userId || prefilled.current || responses.length === 0) return;
    const init: Record<string, Answer> = {};
    responses.filter((r) => r.user_id === userId).forEach((r) => (init[r.date_id] = r.answer));
    setMine(init);
    prefilled.current = true;
  }, [userId, responses]);

  // 他の人の回答をリアルタイム反映
  // (DELETEイベントにはfilterが効かないため、filterなしで購読して loadResponses 側で絞る)
  useEffect(() => {
    const ch = supabase
      .channel(`responses-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, () => loadResponses())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, loadResponses]);

  // スプラッシュ本体(名前入力画面のときも出せるよう、早期returnより前に作っておく)
  const splash =
    splashState !== 'hidden' ? (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-orange-500 to-amber-400 transition-opacity duration-500 ${splashState === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
      >
        <div className="text-center text-white splash-pop">
          <img
            src="/images/nabe.png"
            alt="日程調整"
            className="w-64 h-64 mx-auto mb-4 object-contain splash-bounce"
          />
        </div>
        <style>{`
          @keyframes splash-pop {
            from { opacity: 0; transform: translateY(16px) scale(0.92); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes splash-bounce {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-10px); }
          }
          .splash-pop    { animation: splash-pop 0.7s ease-out both; }
          .splash-bounce { animation: splash-bounce 1s ease-in-out 0.6s infinite; }
        `}</style>
      </div>
    ) : null;

  if (!ready) return null;
  if (!loggedIn)
    return (
      <>
        {splash}
        <NameGate onLogin={login} />
      </>
    );

  // タップした瞬間に画面へ反映し、そのまま自動保存
  const setAnswer = async (dateId: string, answer: Answer) => {
    setMine((prev) => ({ ...prev, [dateId]: answer }));
    const { error } = await supabase.from('responses').upsert(
      { event_id: id, date_id: dateId, user_id: userId, name, answer, updated_at: new Date().toISOString() },
      { onConflict: 'date_id,user_id' }
    );
    setMessage(error ? '保存に失敗しました: ' + error.message : '');
  };

  // ○ → △ → × → ○ …
  const cycle = (dateId: string) => {
    const cur = mine[dateId];
    const next: Answer = !cur ? 'ok' : cur === 'ok' ? 'maybe' : cur === 'maybe' ? 'ng' : 'ok';
    setAnswer(dateId, next);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setMessage('リンクをコピーしました');
  };

  const handleLogout = async () => {
    if (!confirm('ログアウトすると、あなたの回答もカレンダーから消えます。よろしいですか?')) return;
    await logout();
    setMine({});
    setMessage('');
    prefilled.current = false;
  };

  // 全員○の日(回答した人 + 自分。2人以上のときだけ判定)
  const allUsers = new Set(responses.map((r) => r.user_id));
  if (userId) allUsers.add(userId);
  const allOkDates = dates.filter((d) => {
    if (allUsers.size < 2) return false;
    return [...allUsers].every((u) =>
      u === userId
        ? mine[d.id] === 'ok'
        : responses.some((r) => r.date_id === d.id && r.user_id === u && r.answer === 'ok')
    );
  });

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-contain">
      {splash}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {editing ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={14}
              autoFocus
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
            />
            <button
              onClick={async () => {
                try {
                  await rename(draft);
                  setEditing(false);
                  setMessage('名前を変更しました');
                } catch (e: any) {
                  setMessage(e?.message ?? '変更に失敗しました');
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold"
            >
              変更
            </button>
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300">
              キャンセル
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-1">
            ログイン中: {name}{' '}
            <button
              onClick={() => {
                setDraft(name ?? '');
                setEditing(true);
              }}
              className="ml-1 underline text-indigo-600"
            >
              名前を変える
            </button>
            <button onClick={handleLogout} className="ml-2 underline text-gray-500">
              ログアウト
            </button>
          </p>
        )}

        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">{title}</h1>
          <button onClick={copyLink} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 shrink-0">🔗 リンクをコピー</button>
        </div>

        {/* カレンダー(タップで ○→△→×、みんなの回答がリアルタイムで見える) */}
        <section className="mb-8">
          <h2 className="font-bold mb-3">カレンダー</h2>
          <CalendarView
            dates={dates}
            responses={responses}
            userId={userId}
            mine={mine}
            myName={name ?? ''}
            onCycle={cycle}
          />
          {message && <p className="text-xs text-gray-600 mt-2 text-center">{message}</p>}

          {/* 全員○の日 */}
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
            {allOkDates.length > 0
              ? `🎉 ${allOkDates.map((d) => label(d.date)).join('、')}は全員参加できます`
              : '全員参加できる日はまだありません'}
          </p>

          {/* 使い方 */}
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm">
            <h3 className="font-bold mb-2">📖 使い方</h3>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                カレンダーの日にちを<b>1回押すと ○</b>、<b>2回目で △</b>、<b>3回目で ×</b> になります。もう1回押すと ○ に戻ります。
                <span className="block text-xs text-gray-500">○ = 行ける / △ = 行けるかも / × = 行けない</span>
              </li>
              <li>
                <b>1日まるまる空いている日は ○ にしてもらえると助かります！</b>
                <span className="block text-xs text-gray-500">時間帯だけ空いている日は △ にしてください。</span>
              </li>
              <li>押した瞬間に自動で保存されます。保存ボタンはありません。</li>
              <li>みんなの回答はリアルタイムで反映されます。<b>太字</b>があなたの回答です。</li>
              <li>「全員参加できる日」は、回答した人全員が ○ にした日です。</li>
              <li>名前を間違えたときは、左上の<b>「名前を変える」</b>から直せます。今までの回答の名前もまとめて変わります。</li>
              <li>
                左上の<b>「ログアウト」</b>を押すと、<b>あなたの回答がすべて消えます</b>。
                <span className="block font-bold text-red-600">
                  ※ログアウトすると自分の記録が消えちゃうので、終わったらログアウトせずタブをそのまま閉じてね。
                </span>
              </li>
              <li>同じブラウザなら、次に開いたときも自動でログインされ、回答も残っています。</li>
              <li>別のブラウザやスマホから開くと別の人として扱われます。回答するときは、いつも同じブラウザを使ってください。</li>
              <li>右上の「🔗 リンクをコピー」で、このページのリンクをみんなに送れます。</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}