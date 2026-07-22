# Simple Chat（動作確認用）

Next.js + Supabase Realtime を使った、2端末間でリアルタイムに動くシンプルなチャットです。
GitHubで管理し、Vercelにデプロイしてスマホ・PCなど別々の端末からアクセスして動作確認できます。

---

## 1. Supabaseの準備

1. https://supabase.com にログインし、新しいプロジェクトを作成する
2. 左メニューの「SQL Editor」を開く
3. このフォルダ内の `supabase-schema.sql` の中身を全部コピーして貼り付け、実行（Run）する
   - `messages` テーブルが作られ、Realtime配信も有効になります
4. 左メニューの「Project Settings」→「API」を開き、以下をメモする
   - Project URL（例: `https://xxxxx.supabase.co`）
   - `anon` `public` キー

---

## 2. ローカルで動作確認

1. このフォルダをPCの好きな場所に置く
2. `.env.local.example` をコピーして `.env.local` という名前にする
3. `.env.local` の中身を、1でメモしたURLとanonキーに書き換える

```
NEXT_PUBLIC_SUPABASE_URL=あなたのProject URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのanonキー
```

4. ターミナル（PowerShell）でこのフォルダに移動し、以下を実行

```
npm install
npm run dev
```

5. `http://localhost:3000` をブラウザで開く
6. 名前を入力して入室し、メッセージが送れるか確認する

---

## 3. GitHubにアップロード

1. GitHubで新しいリポジトリを作成する（例: `simple-chat`）
2. このフォルダで以下を実行

```
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/simple-chat.git
git push -u origin main
```

※ `.env.local` は `.gitignore` に入っているのでGitHubには上がりません（安全）

---

## 4. Vercelにデプロイ

1. https://vercel.com にログインし、「Add New Project」から今作ったGitHubリポジトリを選ぶ
2. 「Environment Variables」の設定画面で、以下の2つを追加する
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   （値は`.env.local`と同じもの）
3. 「Deploy」ボタンを押す
4. デプロイが終わると `https://simple-chat-xxxx.vercel.app` のようなURLが発行される

---

## 5. 2端末で動作確認

1. スマホとPC（または別のPC）で、同じVercelのURLを開く
2. それぞれ違う名前で入室する
3. 片方で送信したメッセージが、もう片方にリアルタイムで表示されればOK

---

## 補足

- `messages` テーブルは今、誰でも読み書きできる設定になっています（動作確認用のため）。
  本番で使う場合はSupabaseのRLSポリシーを見直してください。
- チャット履歴は直近100件のみ読み込みます。
