'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 既にアプリ共通のSupabaseクライアントがあれば、そちらをimportして置き換えてOK
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NAME_KEY = 'calendar_name';

export function useCalendarUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user.id ?? null);
      setName(localStorage.getItem(NAME_KEY));
      setReady(true);
    })();
  }, []);

  // 名前を入れるだけでログイン(匿名ログイン)
  const login = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('名前を入力してください');
    const { data: s } = await supabase.auth.getSession();
    let uid = s.session?.user.id;
    if (!uid) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      uid = data.user!.id;
    }
    localStorage.setItem(NAME_KEY, trimmed);
    setUserId(uid);
    setName(trimmed);
  }, []);

  return { userId, name, ready, login, loggedIn: !!userId && !!name };
}
