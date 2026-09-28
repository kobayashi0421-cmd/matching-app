'use client';

import { useMemo, useState } from 'react';

type Answer = 'ok' | 'maybe' | 'ng';
type DateRow = { id: string; date: string };
type Resp = { id: string; date_id: string; user_id: string; name: string; answer: Answer };

const SYMBOL: Record<Answer, string> = { ok: '○', maybe: '△', ng: '×' };
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MAX_CHIPS = 3;

export function CalendarView({
  dates,
  responses,
  userId,
}: {
  dates: DateRow[];
  responses: Resp[];
  userId: string | null;
}) {
  const [offset, setOffset] = useState(0);

  // 最初の候補日がある月を基準に表示
  const base = useMemo(() => {
    const d = dates.length ? new Date(dates[0].date + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [dates]);
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);

  const candidateByDate = useMemo(() => new Map(dates.map((d) => [d.date, d])), [dates]);

  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const blanks = Array(new Date(y, m, 1).getDay()).fill(null);
    const days = Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => fmt(new Date(y, m, i + 1)));
    return [...blanks, ...days] as (string | null)[];
  }, [month]);

  // その日の表示対象: ○と△の人 + 自分(×でも自分の分は表示)
  const chipsFor = (dateId: string) => {
    const list = responses.filter((r) => r.date_id === dateId && (r.answer !== 'ng' || r.user_id === userId));
    const order = { ok: 0, maybe: 1, ng: 2 } as const;
    return list.sort((a, b) => {
      if (a.user_id === userId) return -1;   // 自分を先頭に
      if (b.user_id === userId) return 1;
      return order[a.answer] - order[b.answer];
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setOffset(offset - 1)} className="px-3 py-1 rounded-lg hover:bg-gray-100">←</button>
        <div className="font-bold">{month.getFullYear()}年 {month.getMonth() + 1}月</div>
        <button onClick={() => setOffset(offset + 1)} className="px-3 py-1 rounded-lg hover:bg-gray-100">→</button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-900 mb-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((w) => <div key={w}>{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const cand = candidateByDate.get(d);
          if (!cand) {
            return (
              <div key={d} className="min-h-[3.5rem] rounded-lg p-1 text-xs text-gray-900">
                {Number(d.slice(8))}
              </div>
            );
          }
          const chips = chipsFor(cand.id);
          return (
            <div key={d} className="min-h-[4.5rem] rounded-lg border border-indigo-200 bg-indigo-50 p-1">
              <div className="text-xs font-bold text-indigo-700 mb-0.5">{Number(d.slice(8))}</div>
              <div className="space-y-0.5">
                {chips.slice(0, MAX_CHIPS).map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-0.5 rounded px-1 text-[10px] leading-4 ${
                      r.user_id === userId
                        ? 'bg-indigo-600 text-white font-bold'
                        : r.answer === 'ok'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <span className="shrink-0">{SYMBOL[r.answer]}</span>
                    <span className="truncate">{r.name}</span>
                  </div>
                ))}
                {chips.length > MAX_CHIPS && (
                  <div className="text-[10px] text-gray-500 px-1">+{chips.length - MAX_CHIPS}人</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500 mt-2">
        名前の左は回答です(○=行ける / △=微妙)。<span className="font-bold text-indigo-600">濃い青</span>があなたです。
      </p>
    </div>
  );
}
