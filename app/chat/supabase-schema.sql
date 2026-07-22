-- messagesテーブルを作成
create table if not exists messages (
  id bigint generated always as identity primary key,
  username text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- RLS(行レベルセキュリティ)を有効化
alter table messages enable row level security;

-- 動作確認用アプリなので誰でも読み書きできるポリシーにする
-- (本番運用する場合はここを見直してください)
create policy "Allow public read" on messages
  for select using (true);

create policy "Allow public insert" on messages
  for insert with check (true);

-- Realtime配信を有効化
alter publication supabase_realtime add table messages;
