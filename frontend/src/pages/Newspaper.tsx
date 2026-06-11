import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { newspaperAPI } from "../services/newspaper";
import type { Article } from "../services/newspaper";
import "../styles/Newspaper.css";

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CATS = ["all", "general", "crime", "economy", "world"];

export default function Newspaper() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [cat, setCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setLoading(true);
    newspaperAPI.getArticles(cat === "all" ? undefined : cat)
      .then(r => setArticles(r.articles)).catch(() => {}).finally(() => setLoading(false));
  }, [cat]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);
  return (
    <Shell>
      <div className="np-container">
        <h1 className="np-title"><Icon name="newspaper" size={26} className="icon-accent" /> Undercity Times</h1>
        <div className="np-cats">{CATS.map(c => <button key={c} className={`np-cat ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>)}</div>
        {loading ? <Skeleton width={400} height={4} /> : <div className="np-list">{articles.map(a => <div key={a.id} className={`np-card ${a.important ? "np-important" : ""}`}><div className="np-card-header"><h3 className="np-card-title">{a.important && "★ "}{a.title}</h3><span className="np-card-cat">{a.category}</span></div><p className="np-card-content">{a.content}</p><span className="np-card-date">{formatDate(a.created_at)}</span></div>)}</div>}
      </div>
    </Shell>
  );
}
