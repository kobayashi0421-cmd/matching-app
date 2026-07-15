import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    // 受け取ったコードを使って、ログイン状態を確定させる
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 成功したらプロフィール画面へ移動
      return NextResponse.redirect(new URL('/profile', request.url))
    }
  }

  // 失敗した場合はログイン画面に戻す
  return NextResponse.redirect(new URL('/login?error=auth-failed', request.url))
}