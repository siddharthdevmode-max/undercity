import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { forumAPI } from "../services/forum";
import type { Category, Thread } from "../services/forum";
import { toast } from "../utils/toast";
import "../styles/Forum.css";

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Forum() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [totalThreads, setTotalThreads] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    Promise.all([
      forumAPI.getCategories(),
      forumAPI.getThreads(categoryId, page),
    ])
      .then(([catR, thrR]) => { setCategories(catR.categories); setThreads(thrR.threads); setTotalThreads(thrR.total); })
      .catch((err: unknown) => { const m = err instanceof Error ? err.message : "Failed to load forum"; setError(m); toast.error(m); })
      .finally(() => setLoading(false));
  }, [categoryId, page]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleCreate = async () => {
    if (!categoryId || creating) { toast.error("Select a category first"); return; }
    setCreating(true);
    try {
      await forumAPI.createThread(categoryId, newTitle, newContent);
      toast.success("Thread created");
      setCreateOpen(false); setNewTitle(""); setNewContent("");
      loadRef.current();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setCreating(false); }
  };

  const totalPages = Math.ceil(totalThreads / 20);

  if (loading) return <Shell><div className="forum-container"><h1 className="forum-title"><Icon name="forum" size={26} /> Forum</h1><Skeleton width={300} height={4} /></div></Shell>;
  if (error) return <Shell><div className="forum-error" role="alert"><p>{error}</p><button className="forum-retry-btn" onClick={() => { setPage(1); loadRef.current(); }}>Retry</button></div></Shell>;

  return (
    <Shell>
      <div className="forum-container">
        <div className="forum-header">
          <h1 className="forum-title"><Icon name="forum" size={26} className="icon-accent" /> Forum</h1>
          <button className="forum-create-btn" disabled={!categoryId} onClick={() => setCreateOpen(true)}>New Thread</button>
        </div>

        <div className="forum-cats">
          <button className={`forum-cat ${!categoryId ? "active" : ""}`} onClick={() => { setCategoryId(undefined); setPage(1); }}>All</button>
          {categories.map((c) => (
            <button key={c.id} className={`forum-cat ${categoryId === c.id ? "active" : ""}`} onClick={() => { setCategoryId(c.id); setPage(1); }}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="forum-threads">
          {threads.length === 0 ? <p className="forum-empty">No threads in this category yet.</p> : (
            <>
              {threads.map((t) => (
                <a key={t.id} href={`/forum/thread/${t.id}`} className="forum-thread" onClick={(e) => { e.preventDefault(); navigate(`/forum/thread/${t.id}`); }}>
                  <div className="forum-thread-main">
                    <span className="forum-thread-title">{t.is_pinned && "📌 "}{t.title}</span>
                    <span className="forum-thread-meta">by {t.username} &middot; {formatDate(t.created_at)}</span>
                  </div>
                  <span className="forum-thread-count">{t.post_count} replies</span>
                </a>
              ))}
              {totalPages > 1 && (
                <div className="forum-pages">
                  <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                  <span>{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Thread">
          <div className="forum-create-form">
            <select className="forum-create-select" value={categoryId || ""} onChange={(e) => setCategoryId(parseInt(e.target.value))}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="forum-create-input" placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <textarea className="forum-create-textarea" placeholder="Content" rows={5} value={newContent} onChange={(e) => setNewContent(e.target.value)} />
            <button className="forum-create-submit" disabled={creating || !newTitle.trim() || !newContent.trim()} onClick={() => void handleCreate()}>
              {creating ? "Creating..." : "Post Thread"}
            </button>
          </div>
      </Modal>
    </Shell>
  );
}

