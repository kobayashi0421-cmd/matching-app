import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. リクエストヘッダーから Access Token を取得
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '認証トークンが提供されていません。' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // 2. リクエストしてきたユーザーを特定する（通常権限クライアント）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'ユーザーの本人確認に失敗しました。' }, { status: 401 });
    }

    // 3. 管理者権限（Service Role）で Supabase クライアントを作成
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. Supabase Storage からアバター画像を削除（もし存在すれば）
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (profile?.avatar_url) {
      // avatar_urlの末尾のファイル名（例: "uuid-xxxx.png"）を抽出
      const fileName = profile.avatar_url.split('/').pop();
      if (fileName) {
        await supabaseAdmin.storage.from('avatars').remove([fileName]);
      }
    }

    // 5. auth.users からユーザーを完全削除 (手順1のCASCADE設定により他データも自動消去)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ message: 'アカウントを削除しました。' });

  } catch (error: any) {
    console.error('Account Deletion Error:', error);
    return NextResponse.json(
      { error: error.message || 'アカウント削除中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}