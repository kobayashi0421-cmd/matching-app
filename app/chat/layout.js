import "./globals.css";

export const metadata = {
  title: "Simple Chat",
  description: "2端末間で動作確認するシンプルなチャット",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
