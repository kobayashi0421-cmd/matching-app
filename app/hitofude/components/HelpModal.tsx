'use client';

import React, { useEffect } from 'react';

interface HelpModalProps {
  kind: 'game' | 'admin';
  onClose: () => void;
}

interface Section {
  icon: string;
  title: string;
  items: string[];
}

const GAME_SECTIONS: Section[] = [
  {
    icon: '🎮',
    title: '遊びかた',
    items: [
      '画面に番号のついた丸が並びます。1 → 2 → 3 … と、番号の順番にタップ(クリック)してつなぎます。',
      '最後の番号まで押せたらクリア！すぐに次の問題へ進みます。',
      '順番をまちがえると「次は○番です！」と出ます。タイムのペナルティはありません。',
      '全5問をいちばん速く終えた人が1位です。',
    ],
  },
  {
    icon: '🚪',
    title: '対戦の流れ',
    items: [
      '「参加する」で名前・アバター・カラーを決めて参加します。',
      '待機画面で「準備OK」を押します。まちがえたら「準備を取り消す」で戻せます。',
      '全員が準備OKになると、3秒のカウントダウンのあとにスタートします。',
      '対戦が始まったあとはプレイヤーとして参加できません。「視聴する」で観戦できます。',
      '全員が終わると順位表が出ます。「ロビーへ戻る」で次の対戦へ。',
    ],
  },
  {
    icon: '🌀',
    title: '問題の難しさ',
    items: [
      '問題は5段階でだんだん難しくなります。対戦のたびに、ちがう問題が出ます。',
      '後半の問題は、数字がバラバラに散らばったり、背景の模様で目の錯覚が起きたり、盤面がゆらゆらゆれたりします。',
      '数字のない丸は「ニセの丸」です。タップしても反応しません。',
      '「💡ヒントを見る」で、完成する絵のヒントが見られます。',
    ],
  },
  {
    icon: '❓',
    title: 'こまったとき',
    items: [
      'このヘルプを開いても、対戦中のタイマーは止まりません。',
      '対戦中に退出すると、そこまでの記録が順位表に「退出」として残ります。',
      '管理者に強制退出されると、画面にお知らせが出ます。',
    ],
  },
];

const ADMIN_SECTIONS: Section[] = [
  {
    icon: '👀',
    title: '画面の見かた',
    items: [
      '「ルームの状態」は、待機中・カウントダウン・ゲーム進行中・終了のどれかを表します。',
      '「プレイヤー / 観戦者」は、いま参加している人数です。',
      '参加者の表で、一人ひとりの状態・何問目か・タイムが、リアルタイムで更新されます。',
    ],
  },
  {
    icon: '🛠️',
    title: '操作',
    items: [
      '「🚫 強制退出」: 選んだ人をルームから外します。本人の画面には「管理者によりキックされました」と出ます。',
      '「🏁 強制終了して結果を出す」: 対戦中だけ表示されます。走っている人がいても、そこで終了して順位表を出します。',
      '「🔄 ルームをリセット」: ルームを初期化して、参加者を全員ロビーに戻します。観戦者は残ります。',
    ],
  },
  {
    icon: '⚙️',
    title: '自動で動くしくみ',
    items: [
      '管理者がいなくても、全員が「準備OK」を押すと自動でスタートします。',
      '結果画面で全員が「ロビーへ戻る」を押すと、ルームは自動で初期化されます。',
      '放置されたルームは、対戦中なら15分、結果画面なら5分たつと、次に誰かが参加するときに初期化されます。',
      '対戦ごとに、5段階から1問ずつ選ばれます。前回と同じ問題は、同じ段階では避けられます。',
    ],
  },
  {
    icon: '🔑',
    title: '合言葉',
    items: [
      '環境変数 NEXT_PUBLIC_KANRI_PASS を設定すると、この画面を開くときに合言葉が必要になります。',
      'ブラウザ側から見える値なので、簡易的なロックです。大切な操作を完全には守れません。',
    ],
  },
];

export const HelpModal: React.FC<HelpModalProps> = ({ kind, onClose }) => {
  const sections = kind === 'admin' ? ADMIN_SECTIONS : GAME_SECTIONS;

  // Esc キーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 60 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={kind === 'admin' ? '管理画面のヘルプ' : '遊びかたのヘルプ'}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-lg font-extrabold text-slate-100">
            {kind === 'admin' ? '👑 管理画面の使いかた' : '❓ 遊びかた・操作方法'}
          </h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-lg font-bold"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {sections.map((s) => (
            <section key={s.title}>
              <h3 className="text-sm font-extrabold text-indigo-300 mb-2 flex items-center gap-2">
                <span>{s.icon}</span> {s.title}
              </h3>
              <ul className="space-y-2">
                {s.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-200 leading-relaxed">
                    <span className="text-indigo-400 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
};
