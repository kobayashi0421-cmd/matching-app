"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // 前回のユーザー名を復元
  useEffect(() => {
    const saved = localStorage.getItem("chat_username");
    if (saved) setUsername(saved);
  }, []);

  // 初期メッセージ取得 + リアルタイム購読
  useEffect(() => {
    if (!username) return;

    let isMounted = true;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);

      if (!error && isMounted) {
        setMessages(data);
      }
    }

    fetchMessages();

    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [username]);

  // 新着で自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSetName(e) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem("chat_username", trimmed);
    setUsername(trimmed);
  }

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ username, content: trimmed });

    if (!error) setText("");
    setSending(false);
  }

  if (!username) {
    return (
      <div className="name-setup">
        <h2>名前を入力してください</h2>
        <form onSubmit={handleSetName} style={{ display: "flex", gap: 8 }}>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="例: たろう"
            autoFocus
          />
          <button type="submit">入室</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">Simple Chat（{username}として参加中）</div>
      <div className="messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`message ${m.username === username ? "mine" : ""}`}
          >
            <div className="username">{m.username}</div>
            <div>{m.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="form" onSubmit={handleSend}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力..."
        />
        <button type="submit" disabled={sending}>
          送信
        </button>
      </form>
    </div>
  );
}
