'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, useCalendarUser } from './useCalendarUser';
import { NameGate } from './NameGate';

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarCreatePage() {
  const router = useRouter();
  const { userId, name, ready, login, loggedIn } = useCalendarUser();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const today = fmt(new Date());

  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const blanks = Array(new Date(y, m, 1).getDay()).fill(null);
    const days = Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => fmt(new Date(y, m, i + 1)));
    return [...blanks, ...days] as (string | null)[];
  }, [month]);

  if (!ready) return null;
  if (!loggedIn) return <NameGate onLogin={login} />;

  const toggle = (d: string) => {
    const next = new Set(selected);
    next.has(d) ? next.delete(d) : next.add(d);
    setSelected(next);
  };

  const create = async () => {
    if (!title.trim()) return setError('タイトルを入力してください');
    if (selected.size === 0) return setError('候補日を1つ以上選んでください');
    setBusy(true);
    setError('');
    const { data: ev, error: e1 } = await supabase
      .from('events')
      .insert({ title: title.trim(), created_by: userId })
      .select('id')
      .single();
    if (e1 || !ev) {
      setBusy(false);
      return setError('作成に失敗しました: ' + e1?.message);
    }
    const { error: e2 } = await supabase
      .from('event_dates')
      .insert([...selected].sort().map((date) => ({ event_id: ev.id, date })));
    setBusy(false);
    if (e2) return setError('日程の保存に失敗しました: ' + e2.message);
    router.push(`/calendar/${ev.id}`);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <p className="text-xs text-gray-500 mb-1">ログイン中: {name}</p>
      <h1 className="text-2xl font-bold mb-6">日程調整をつくる</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="イベント名(例: 打ち上げ)"
        className="w-full px-4 py-3 rounded-xl border border-gray-300 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="px-3 py-1 rounded-lg hover:bg-gray-100">←</button>
          <div className="font-bold">{month.getFullYear()}年 {month.getMonth() + 1}月</div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="px-3 py-1 rounded-lg hover:bg-gray-100">→</button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
          {['日', '月', '火', '水', '木', '金', '土'].map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) =>
            d === null ? (
              <div key={i} />
            ) : (
              <button
                key={d}
                disabled={d < today}
                onClick={() => toggle(d)}
                className={`aspect-square rounded-lg text-sm transition ${
                  selected.has(d)
                    ? 'bg-indigo-600 text-white font-bold'
                    : d < today
                    ? 'text-gray-300'
                    : 'hover:bg-indigo-50'
                }`}
              >
                {Number(d.slice(8))}
              </button>
            )
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mt-3">選択中: {selected.size} 日</p>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <button
        onClick={create}
        disabled={busy}
        className="w-full mt-4 py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '作成中...' : '作成して共有リンクを発行'}
      </button>
    </div>
  );
}
