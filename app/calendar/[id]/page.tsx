'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, useCalendarUser } from '../useCalendarUser';
import { NameGate } from '../NameGate';
import { CalendarView } from '../CalendarView';

type Answer = 'ok' | 'maybe' | 'ng';
type DateRow = { id: string; date: string };
type Resp = { id: string; date_id: string; user_id: string; name: string; answer: Answer };

const SYMBOL: Record<Answer, string> = { ok: '○', maybe: '△', ng: '×' };
const COLOR: Record<Answer, string> = {
  ok: 'bg-emerald-500 text-white',
  maybe: 'bg-amber-400 text-white',
  ng: 'bg-gray-400 text-white',
};

const label = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { userId, name, ready, login, rename, loggedIn } = useCalendarUser();
  const [title, setTitle] = useState('');
  const [dates, setDates] = useState<DateRow[]>([]);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [mine, setMine] = useState<Record<string, Answer>>({});
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const prefilled = useRef(false);

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
  useEffect(() => {
    const ch = supabase
      .channel(`responses-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: `event_id=eq.${id}` }, () => loadResponses())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, loadResponses]);

  if (!ready) return null;
  if (!loggedIn) return <NameGate onLogin={login} />;

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

  // 集計
  const participants = Array.from(new Map(responses.map((r) => [r.user_id, r.name])).entries());
  const count = (dateId: string, a: Answer) => responses.filter((r) => r.date_id === dateId && r.answer === a).length;
  const maxOk = Math.max(0, ...dates.map((d) => count(d.id, 'ok')));

  return (
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
      </section>

      {/* 自分の回答 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm mb-8">
        <h2 className="font-bold mb-3">あなたの回答(タップで自動保存)</h2>
        <div className="space-y-2">
          {dates.map((d) => (
            <div key={d.id} className="flex items-center justify-between">
              <span className="text-sm font-medium">{label(d.date)}</span>
              <div className="flex gap-1.5">
                {(['ok', 'maybe', 'ng'] as Answer[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAnswer(d.id, a)}
                    className={`w-10 h-10 rounded-lg font-bold transition ${mine[d.id] === a ? COLOR[a] : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    {SYMBOL[a]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* みんなの回答 */}
      <section>
        <h2 className="font-bold mb-3">みんなの回答({participants.length}人)</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm text-center">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left">名前</th>
                {dates.map((d) => (
                  <th key={d.id} className={`p-3 whitespace-nowrap ${maxOk > 0 && count(d.id, 'ok') === maxOk ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                    {label(d.date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map(([uid, pname]) => (
                <tr key={uid} className="border-t border-gray-100">
                  <td className={`p-3 text-left font-medium ${uid === userId ? 'text-indigo-600' : ''}`}>{pname}{uid === userId && '(あなた)'}</td>
                  {dates.map((d) => {
                    const r = responses.find((x) => x.user_id === uid && x.date_id === d.id);
                    return <td key={d.id} className="p-3 font-bold">{r ? SYMBOL[r.answer] : '-'}</td>;
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                <td className="p-3 text-left">○ / △</td>
                {dates.map((d) => (
                  <td key={d.id} className="p-3">{count(d.id, 'ok')} / {count(d.id, 'maybe')}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">緑の日程が、○がいちばん多い候補日です。</p>
      </section>
    </div>
  );
}