"use client";

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Source = { title: string; url: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  model?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

const STORAGE_KEY = "mini-ai-chats-v1";
const ACTIVE_KEY = "mini-ai-active-chat-v1";
const THEME_KEY = "mini-ai-theme-v1";

const starterPrompts = [
  { title: "Explain something", prompt: "Explain how neural networks learn, in a simple way." },
  { title: "Help me code", prompt: "Write a clean Java function to find duplicates in an integer array." },
  { title: "Brainstorm ideas", prompt: "Give me 10 creative weekend project ideas for a CS student." },
  { title: "Improve my writing", prompt: "Help me write a concise and professional internship introduction." },
];

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function emptyChat(): Chat {
  return { id: uid(), title: "New chat", messages: [], createdAt: Date.now() };
}

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function SparkIcon({ size = 18 }: { size?: number }) {
  return <Icon size={size}><path d="M12 3c.7 3.8 2.2 5.3 6 6-3.8.7-5.3 2.2-6 6-.7-3.8-2.2-5.3-6-6 3.8-.7 5.3-2.2 6-6Z" /><path d="M19 16c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" /></Icon>;
}

function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>;
}

function SendIcon() {
  return <Icon><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Icon>;
}

function GlobeIcon() {
  return <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z" /></Icon>;
}

function MoonIcon() {
  return <Icon><path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /></Icon>;
}

function SunIcon() {
  return <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
}

function MenuIcon() {
  return <Icon><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
}

function TrashIcon() {
  return <Icon size={16}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></Icon>;
}

function CopyIcon() {
  return <Icon size={16}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></Icon>;
}

function CheckIcon() {
  return <Icon size={16}><path d="m5 12 4 4L19 6" /></Icon>;
}

function MessageIcon() {
  return <Icon size={16}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></Icon>;
}

function InlineText({ text }: { text: string }) {
  const pieces = text.split(/(\*\*[^*]+\*\*|\`[^\`]+\`)/g);
  return (
    <>
      {pieces.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code className="inline-code" key={index}>{part.slice(1, -1)}</code>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function prettyModel(model?: string) {
  if (!model) return "";
  const labels: Record<string, string> = {
    "gemini-3.8-flash": "Gemini 3.8 Flash",
    "gemini-3.7-flash": "Gemini 3.7 Flash",
    "gemini-3.6-flash": "Gemini 3.6 Flash",
    "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
  };
  return labels[model] || model;
}

function TextBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-block">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div className="line-gap" key={index} />;
        if (/^-{3,}$/.test(trimmed)) return <hr className="message-divider" key={index} />;
        if (/^#{1,3}\s/.test(trimmed)) {
          const level = trimmed.match(/^#+/)?.[0].length ?? 1;
          const content = trimmed.replace(/^#{1,3}\s/, "");
          return level === 1 ? <h2 key={index}><InlineText text={content} /></h2> : <h3 key={index}><InlineText text={content} /></h3>;
        }
        if (/^[-*]\s/.test(trimmed)) {
          return <div className="list-line" key={index}><span className="bullet">•</span><span><InlineText text={trimmed.slice(2)} /></span></div>;
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)$/);
          return <div className="list-line" key={index}><span className="number">{match?.[1]}.</span><span><InlineText text={match?.[2] ?? trimmed} /></span></div>;
        }
        if (trimmed.startsWith("> ")) {
          return <blockquote key={index}><InlineText text={trimmed.slice(2)} /></blockquote>;
        }
        return <p key={index}><InlineText text={line} /></p>;
      })}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch {
      // Clipboard access can be unavailable in some browsers.
    }
  }
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{language || "code"}</span>
        <button onClick={copy} className="code-copy" type="button">{copied ? <CheckIcon /> : <CopyIcon />}{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  const regex = /```([\w.+-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) parts.push(<TextBlock key={`t-${last}`} text={content.slice(last, match.index)} />);
    parts.push(<CodeBlock key={`c-${match.index}`} language={match[1]} code={match[2].replace(/\n$/, "")} />);
    last = regex.lastIndex;
  }
  if (last < content.length) parts.push(<TextBlock key={`t-${last}`} text={content.slice(last)} />);
  return <>{parts}</>;
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    setTheme(storedTheme);
    document.documentElement.dataset.theme = storedTheme;

    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const stored = Array.isArray(parsed)
        ? (parsed as Chat[]).filter((chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages))
        : [];
      if (stored.length) {
        setChats(stored);
        const remembered = localStorage.getItem(ACTIVE_KEY);
        setActiveId(stored.some((c) => c.id === remembered) ? remembered! : stored[0].id);
      } else {
        const first = emptyChat();
        setChats([first]);
        setActiveId(first.id);
      }
    } catch {
      const first = emptyChat();
      setChats([first]);
      setActiveId(first.id);
    }
  }, []);

  useEffect(() => {
    if (!chats.length) return;
    try {
      const safeChats = chats.slice(0, 20).map((chat) => ({
        ...chat,
        messages: chat.messages.slice(-60),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeChats));
    } catch {
      // Storage limits should never break the chat experience.
    }
  }, [chats]);

  useEffect(() => {
    if (!activeId) return;
    try {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeId, sending]);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeId) ?? chats[0], [chats, activeId]);

  function updateActive(updater: (chat: Chat) => Chat) {
    setChats((current) => current.map((chat) => chat.id === activeId ? updater(chat) : chat));
  }

  function createChat() {
    if (sending) return;
    const next = emptyChat();
    setChats((current) => [next, ...current]);
    setActiveId(next.id);
    setInput("");
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function deleteChat(id: string) {
    if (sending) return;
    setChats((current) => {
      const filtered = current.filter((chat) => chat.id !== id);
      if (!filtered.length) {
        const next = emptyChat();
        setActiveId(next.id);
        return [next];
      }
      if (id === activeId) setActiveId(filtered[0].id);
      return filtered;
    });
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Theme still applies for the current session.
    }
  }

  async function sendMessage(value?: string) {
    const text = (value ?? input).trim();
    if (!text || sending || !activeChat) return;

    const userMessage: Message = { id: uid(), role: "user", content: text };
    const previousMessages = activeChat.messages;
    const nextMessages = [...previousMessages, userMessage];

    updateActive((chat) => ({
      ...chat,
      title: chat.title === "New chat" ? text.replace(/\s+/g, " ").slice(0, 44) : chat.title,
      messages: nextMessages,
    }));
    setInput("");
    setSending(true);

    if (textareaRef.current) textareaRef.current.style.height = "52px";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages
            .filter((message) =>
              !(message.role === "assistant" &&
                (message.error || message.content.startsWith("I couldn't complete that request.")))
            )
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Something went wrong.");

      const assistant: Message = {
        id: uid(),
        role: "assistant",
        content: data.message,
        sources: Array.isArray(data.sources) ? data.sources : [],
        model: typeof data.model === "string" ? data.model : undefined,
        error: false,
      };
      updateActive((chat) => ({ ...chat, messages: [...chat.messages, assistant] }));
    } catch (error) {
      const assistant: Message = {
        id: uid(),
        role: "assistant",
        content: error instanceof Error
          ? `I couldn't complete that request. ${error.message}`
          : "I couldn't complete that request. Please try again.",
        error: true,
      };
      updateActive((chat) => ({ ...chat, messages: [...chat.messages, assistant] }));
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function onInput(value: string) {
    setInput(value);
    const area = textareaRef.current;
    if (!area) return;
    area.style.height = "52px";
    area.style.height = `${Math.min(area.scrollHeight, 180)}px`;
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessage(message.id);
      setTimeout(() => setCopiedMessage(null), 1300);
    } catch {
      // Clipboard access can be unavailable in some browsers.
    }
  }

  if (!activeChat) return <div className="boot"><div className="orb" /></div>;

  return (
    <main className="app-shell">
      <div className={`sidebar-backdrop ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><SparkIcon size={19} /></div>
          <div><strong>Mini AI</strong><span>Personal assistant</span></div>
        </div>

        <button className="new-chat" onClick={createChat} type="button"><PlusIcon />New chat</button>

        <div className="history-label">Recent</div>
        <div className="history">
          {chats.map((chat) => (
            <div className={`history-item ${chat.id === activeId ? "active" : ""}`} key={chat.id}>
              <button className="history-select" onClick={() => { setActiveId(chat.id); setSidebarOpen(false); }} type="button">
                <MessageIcon /><span>{chat.title}</span>
              </button>
              <button className="history-delete" onClick={() => deleteChat(chat.id)} aria-label="Delete chat" title="Delete chat" type="button"><TrashIcon /></button>
            </div>
          ))}
        </div>

        <div className="sidebar-foot">
          <div className="privacy-note"><span className="status-dot" />Powered by Gemini</div>
          <span>Your key stays on the server.</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu" type="button"><MenuIcon /></button>
            <div className="model-name"><span>Mini AI</span><div className="model-pill"><SparkIcon size={13} />Gemini Flash</div></div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme" type="button">{theme === "dark" ? <SunIcon /> : <MoonIcon />}</button>
          </div>
        </header>

        <div className="conversation">
          {activeChat.messages.length === 0 ? (
            <div className="welcome">
              <div className="hero-mark"><SparkIcon size={31} /></div>
              <h1>What can I help with?</h1>
              <p>Ask a question, build an idea, learn something new, or work through code.</p>
              <div className="starter-grid">
                {starterPrompts.map((item) => (
                  <button key={item.title} onClick={() => void sendMessage(item.prompt)} type="button">
                    <strong>{item.title}</strong><span>{item.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {activeChat.messages.map((message) => (
                <article className={`message-row ${message.role}`} key={message.id}>
                  <div className="avatar">{message.role === "assistant" ? <SparkIcon size={17} /> : <span>R</span>}</div>
                  <div className="message-main">
                    <div className="message-meta">
                      {message.role === "assistant"
                        ? `Mini AI${message.model ? ` · ${prettyModel(message.model)}` : ""}`
                        : "You"}
                    </div>
                    <div className={`message-bubble ${message.role}`}>
                      <MessageContent content={message.content} />
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="sources">
                        <span>Sources</span>
                        <div className="source-list">
                          {message.sources.slice(0, 5).map((source, index) => (
                            <a href={source.url} target="_blank" rel="noreferrer" key={source.url + index}>{index + 1}<span>{source.title}</span></a>
                          ))}
                        </div>
                      </div>
                    )}
                    {message.role === "assistant" && (
                      <button className="message-action" onClick={() => copyMessage(message)} type="button">
                        {copiedMessage === message.id ? <CheckIcon /> : <CopyIcon />}{copiedMessage === message.id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {sending && (
                <article className="message-row assistant">
                  <div className="avatar"><SparkIcon size={17} /></div>
                  <div className="message-main">
                    <div className="message-meta">Mini AI</div>
                    <div className="thinking"><span /><span /><span /></div>
                  </div>
                </article>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={onSubmit}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message Mini AI"
              rows={1}
              maxLength={12000}
              disabled={sending}
              aria-label="Message Mini AI"
            />
            <div className="composer-bottom composer-bottom-end">
              <button className="send-button" type="submit" disabled={!input.trim() || sending} aria-label="Send message"><SendIcon /></button>
            </div>
          </form>
          <div className="disclaimer">Mini AI can make mistakes. Check important information.</div>
        </div>
      </section>
    </main>
  );
}
