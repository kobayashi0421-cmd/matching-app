# マッチングアプリ開発ログ

## システム概要

大学生同士が趣味や価値観を通じて交流できるマッチングアプリ。

- **フロントエンド**: Next.js
- **ホスティング**: Vercel
- **データベース・認証**: Supabase

主な機能：プロフィール作成（アイコン・ニックネーム・趣味タグ・自由記述）、性格診断（10問5段階評価）、キーワード/タグ検索、いいね機能、マッチング後のリアルタイムトーク、ブロック機能、お休みモード、本人確認（Googleフォーム連携）。

---

## これまでの作業内容（時系列）

### 1. Node.js のインストール
開発に必要な Node.js をインストール。

### 2. Next.js プロジェクトの作成
```bash
npx create-next-app@latest matching-app
```
設定は推奨デフォルトを使用：TypeScript / ESLint / Tailwind CSS / App Router あり、src/ディレクトリなし。

```
cd matching-app
npm run dev
```
`http://localhost:3000` で初期画面の表示を確認。

### 3. Git のインストール
最初 `git` コマンドが認識されないエラーが発生 → Git for Windows（`C:\Program Files\Git`）をインストールし、PowerShell再起動後に解決。
```
git version 2.55.0.windows.2
```

### 4. GitHub へのリポジトリ作成・push
GitHub（`kobayashi0421-cmd`）に `matching-app` リポジトリを作成。

```bash
git init
git config --global user.email "メールアドレス"
git config --global user.name "ユーザー名"
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/kobayashi0421-cmd/matching-app.git
git branch -M main
git push -u origin main
```
初回 push 時にブラウザ認証まわりで一時的なエラーが出たが、再起動後に確認したところ push は成功済み（`git status` で `origin/main` と同期済みを確認）。

### 5. Vercel へのデプロイ
- Vercelにサインアップ（GitHub連携）
- 「GitHubアカウントを追加する」からVercelにリポジトリへのアクセス権を許可
- `kobayashi0421-cmd/matching-app` をインポート → そのままデプロイ実行
- デプロイ成功。公開URL: `https://matching-app-smoky.vercel.app`（要確認・正式URL）

### 6. Supabase プロジェクトの作成
- https://supabase.com にサインアップ（大学メールアドレス `s2421162@s.do-johodai.ac.jp` を使用）
- 組織「マッチングアプリ」を作成
- 一時的に「プロジェクトを作成するには追加の権限が必要です」というエラーが出たが、リロード後に解消し、プロジェクト作成に成功

**プロジェクト情報**
- Project URL: `https://hapiqlzxwoaeallhyqkf.supabase.co`
- Region: Tokyo（想定）

### 7. APIキーの取得と環境変数の設定
- Supabaseダッシュボード「APIキー」から「公開可能なキー（Publishable key）」を取得（名前は「こば」で登録）
- `matching-app` フォルダ直下に `.env.local` を作成（途中、別プロジェクトのフォルダ「ようめい2」に誤って作成してしまうミスがあったため、`matching-app` フォルダを開き直して再作成）

```
NEXT_PUBLIC_SUPABASE_URL=https://hapiqlzxwoaeallhyqkf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```
→ 設定完了・確認済み

---

## 現在の状態

- ✅ ローカル開発環境構築済み（Next.js, Git）
- ✅ GitHubリポジトリ作成・push済み
- ✅ Vercelへのデプロイ・公開済み
- ✅ Supabaseプロジェクト作成済み
- ✅ Supabaseの接続情報（URL・APIキー）を `.env.local` に設定済み
- ⬜ Supabaseクライアントライブラリのインストール（次のステップ）
- ⬜ データベースのテーブル設計（users, profiles, likes, matches, messages など）
- ⬜ 認証機能（メール+パスワード、メール確認）の実装
- ⬜ プロフィール作成画面の実装
- ⬜ 性格診断機能の実装
- ⬜ 検索・いいね機能の実装
- ⬜ トーク機能（リアルタイムメッセージ）の実装
- ⬜ ブロック・通知設定・お休みモードの実装
- ⬜ 本人確認用Googleフォームの設置

---

## 次にやること：Supabaseクライアントライブラリのインストール

```bash
cd matching-app
npm install @supabase/supabase-js @supabase/ssr
```

その後、Supabaseクライアントを作成するファイル（例: `src/utils/supabase/client.ts` または `app/utils/supabase/client.ts`）を用意し、データベース設計に進む。
