import { useState, useEffect, useCallback } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { toast } from "../utils/toast";
import { getInbox, getSentMessages, getMessage, sendMessage, deleteMessage, type Message } from "../services/messages";
import "../styles/Messages.css";

type Tab = "inbox" | "sent" | "compose" | "view";

export default function Messages() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "inbox") {
        const data = await getInbox(page);
        setMessages(data.messages);
        setTotal(data.total);
        setUnread(data.unread);
      } else if (tab === "sent") {
        const data = await getSentMessages(page);
        setMessages(data.messages);
        setTotal(data.total);
      }
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    if (tab === "inbox" || tab === "sent") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchMessages();
    }
  }, [fetchMessages, tab]);

  const handleOpenMessage = async (id: number) => {
    try {
      const data = await getMessage(id);
      setSelectedMessage(data.message);
      setTab("view");
      if (tab === "inbox") {
        fetchMessages();
      }
    } catch {
      toast.error("Failed to load message");
    }
  };

  const handleSend = async () => {
    if (!recipient.trim() || !body.trim()) {
      toast.error("Recipient and message body are required");
      return;
    }
    setSending(true);
    try {
      const data = await sendMessage(recipient.trim(), subject.trim(), body.trim());
      toast.success(`Message sent to ${data.message.recipient_username}`);
      setRecipient("");
      setSubject("");
      setBody("");
      setTab("sent");
      setPage(1);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMessage(id);
      toast.success("Message deleted");
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <Shell>
      <div className="msg-container">
        <div className="msg-header">
          <h1 className="msg-title"><Icon name="messages" size={26} className="icon-accent" /> Messages</h1>
          <p className="msg-desc">Private messaging between players.</p>
        </div>

        <div className="msg-tabs">
          <button className={`msg-tab ${tab === "inbox" ? "active" : ""}`} onClick={() => { setTab("inbox"); setPage(1); }}>
            <Icon name="inbox" size={14} />
            Inbox{unread > 0 ? ` (${unread})` : ""}
          </button>
          <button className={`msg-tab ${tab === "sent" ? "active" : ""}`} onClick={() => { setTab("sent"); setPage(1); }}>
            <Icon name="sent" size={14} />
            Sent
          </button>
          <button className={`msg-tab ${tab === "compose" ? "active" : ""}`} onClick={() => setTab("compose")}>
            <Icon name="compose" size={14} />
            Compose
          </button>
        </div>

        <div className="msg-content">
          {tab === "inbox" && (
            <div className="msg-list">
              {loading ? (
                <div className="msg-loading">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="msg-empty">
                  <Icon name="inbox" size={40} className="icon-accent" />
                  <p>No messages yet. Your inbox is empty.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`msg-row ${!msg.read ? "msg-unread" : ""}`} onClick={() => handleOpenMessage(msg.id)}>
                      <div className="msg-row-icon">
                        <Icon name={msg.read ? "message-open" : "message-closed"} size={18} className={msg.read ? "" : "icon-accent"} />
                      </div>
                      <div className="msg-row-content">
                        <span className="msg-row-sender">{msg.sender_username}</span>
                        <span className="msg-row-subject">{msg.subject || "(no subject)"}</span>
                        <span className="msg-row-date">{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                      <button className="msg-row-delete" onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }} aria-label="Delete message">
                        <Icon name="trash" size={14} className="icon-error" />
                      </button>
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div className="msg-pagination">
                      <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                      <span>Page {page} of {totalPages}</span>
                      <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "sent" && (
            <div className="msg-list">
              {loading ? (
                <div className="msg-loading">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="msg-empty">
                  <Icon name="sent" size={40} className="icon-accent" />
                  <p>No sent messages yet.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className="msg-row" onClick={() => handleOpenMessage(msg.id)}>
                      <div className="msg-row-icon">
                        <Icon name="sent" size={18} />
                      </div>
                      <div className="msg-row-content">
                        <span className="msg-row-sender">To: {msg.recipient_username}</span>
                        <span className="msg-row-subject">{msg.subject || "(no subject)"}</span>
                        <span className="msg-row-date">{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                      <button className="msg-row-delete" onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }} aria-label="Delete message">
                        <Icon name="trash" size={14} className="icon-error" />
                      </button>
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div className="msg-pagination">
                      <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                      <span>Page {page} of {totalPages}</span>
                      <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "compose" && (
            <div className="msg-compose">
              <div className="msg-compose-field">
                <label className="msg-compose-label">To</label>
                <input className="msg-compose-input" type="text" placeholder="Enter username..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </div>
              <div className="msg-compose-field">
                <label className="msg-compose-label">Subject</label>
                <input className="msg-compose-input" type="text" placeholder="Optional" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="msg-compose-field">
                <label className="msg-compose-label">Message</label>
                <textarea className="msg-compose-textarea" rows={8} placeholder="Write your message..." value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <button className="msg-compose-btn" disabled={sending || !recipient.trim() || !body.trim()} onClick={handleSend}>
                {sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          )}

          {tab === "view" && selectedMessage && (
            <div className="msg-view">
              <button className="msg-view-back" onClick={() => setTab("inbox")}>
                <Icon name="arrow-left" size={14} /> Back to Inbox
              </button>
              <div className="msg-view-header">
                <h2>{selectedMessage.subject || "(no subject)"}</h2>
                <div className="msg-view-meta">
                  <span>From: <strong>{selectedMessage.sender_username}</strong></span>
                  <span>Date: {new Date(selectedMessage.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="msg-view-body">
                {selectedMessage.body.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}