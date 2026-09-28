'use client';

import { useState } from 'react';

export function NameGate({ onLogin }: { onLogin: (name: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onLogin(value);
    } catch (e: any) {
      setError(e?.message ?? 'ログインに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <h2 className="text-lg font-bold mb-1">名前を入力してはじめる</h2>
      <p className="text-xs text-gray-500 mb-4">パスワードは不要です。同じブラウザなら次回から自動でログインされます。</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        maxLength={14}
        placeholder="例: たろう"
        className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full mt-4 py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '...' : 'はじめる'}
      </button>
    </div>
  );
}
