import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { action, targetUserId, minutes } = await req.json();

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'パラメータが不足しています。' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === 'delete') {
      // アバター画像の削除（delete-accountと同じロジック）
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('avatar_url')
        .eq('id', targetUserId)
        .single();

      if (profile?.avatar_url) {
        const marker = '/avatars/';
        const markerIndex = profile.avatar_url.indexOf(marker);
        const filePath = markerIndex !== -1
          ? profile.avatar_url.slice(markerIndex + marker.length)
          : null;

        if (filePath) {
          await supabaseAdmin.storage.from('avatars').remove([filePath]);
        }
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (deleteError) throw deleteError;

      return NextResponse.json({ message: 'アカウントを削除しました。' });
    }

    if (action === 'suspend') {
      const mins = typeof minutes === 'number' && minutes > 0 ? minutes : 60;
      const until = new Date(Date.now() + mins * 60_000).toISOString();

      const { error: suspendError } = await supabaseAdmin
        .from('profiles')
        .update({ is_suspended: true, suspended_until: until })
        .eq('id', targetUserId);

      if (suspendError) throw suspendError;

      return NextResponse.json({ message: '利用停止にしました。' });
    }

    if (action === 'unsuspend') {
      const { error: unsuspendError } = await supabaseAdmin
        .from('profiles')
        .update({ is_suspended: false, suspended_until: null })
        .eq('id', targetUserId);

      if (unsuspendError) throw unsuspendError;

      return NextResponse.json({ message: '利用停止を解除しました。' });
    }

    return NextResponse.json({ error: '不正なactionです。' }, { status: 400 });

  } catch (error: any) {
    console.error('Admin User Action Error:', error);
    return NextResponse.json(
      { error: error.message || '処理中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}