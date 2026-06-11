import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import { Skeleton } from "../components/ui/Skeleton";
import { forumAPI } from "../services/forum";
import type { Thread, Post } from "../services/forum";
import { toast } from "../utils/toast";
import "../styles/Forum.css";

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ForumThread() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replying, setReplying] = useState(false);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    forumAPI.getThread(parseInt(id, 10))
      .then((r) => { setThread(r.thread); setPosts(r.posts); })
      .catch(() => { setError("Thread not found"); })
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleReply = async () => {
    if (!id || !replyContent.trim() || replying) return;
    setReplying(true);
    try {
      await forumAPI.reply(parseInt(id, 10), replyContent);
      toast.success("Reply posted");
      setReplyContent("");
      loadRef.current();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setReplying(false); }
  };

  if (loading) return <Shell><div className="forum-container"><Skeleton width={400} height={4} /></div></Shell>;
  if (error) return <Shell><div className="forum-error"><p>{error}</p><button className="forum-retry-btn" onClick={() => navigate("/forum")}>Back to Forum</button></div></Shell>;

  return (
    <Shell>
      <div className="forum-container">
        <button className="forum-back-btn" onClick={() => navigate("/forum")}>&larr; Back to Forum</button>
        {thread && (
          <>
            <div className="forum-thread-header">
              <h1 className="forum-thread-title">{thread.is_pinned && "📌 "}{thread.title}</h1>
              <span className="forum-thread-meta">by {thread.username} &middot; {formatDate(thread.created_at)}</span>
            </div>

            <div className="forum-posts">
              <div className="forum-post forum-op">
                <div className="forum-post-author">{thread.username}</div>
                <div className="forum-post-content">{thread.content}</div>
                <div className="forum-post-date">{formatDate(thread.created_at)}</div>
              </div>
              {posts.map((p) => (
                <div key={p.id} className="forum-post">
                  <div className="forum-post-author">{p.username}</div>
                  <div className="forum-post-content">{p.content}</div>
                  <div className="forum-post-date">{formatDate(p.created_at)}</div>
                </div>
              ))}
            </div>

            {!thread.is_locked && (
              <div className="forum-reply-area">
                <textarea
                  className="forum-reply-textarea"
                  placeholder="Write a reply..."
                  rows={4}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
                <button
                  className="forum-reply-btn"
                  disabled={replying || !replyContent.trim()}
                  onClick={() => void handleReply()}
                >
                  {replying ? "Posting..." : "Reply"}
                </button>
              </div>
            )}
            {thread.is_locked && <p className="forum-locked-msg">This thread is locked.</p>}
          </>
        )}
      </div>
    </Shell>
  );
}
