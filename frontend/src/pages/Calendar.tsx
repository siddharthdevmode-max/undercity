import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { calendarAPI } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { toast } from "../utils/toast";
import "../styles/Calendar.css";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function formatDate(d: string): string { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [adding, setAdding] = useState(false);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    calendarAPI.getEvents(monthKey)
      .then((r) => setEvents(r.events))
      .catch((err: unknown) => { const m = err instanceof Error ? err.message : "Failed"; setError(m); toast.error(m); })
      .finally(() => setLoading(false));
  }, [monthKey]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleAdd = async () => {
    if (!newDate || !newTitle.trim()) return;
    setAdding(true);
    try {
      await calendarAPI.createEvent(newTitle, newDesc, newDate);
      toast.success("Event added");
      setAddOpen(false); setNewTitle(""); setNewDesc(""); setNewDate("");
      loadRef.current();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await calendarAPI.deleteEvent(id);
      toast.success("Event deleted");
      loadRef.current();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const eventMap = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = e.event_date.slice(8, 10);
    if (!eventMap.has(d)) eventMap.set(d, []);
    eventMap.get(d)!.push(e);
  }

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  if (loading) return <Shell><div className="cal-container"><h1 className="cal-title"><Icon name="calendar" size={26} /> Calendar</h1><Skeleton width={300} height={4} /></div></Shell>;
  if (error) return <Shell><div className="cal-error" role="alert"><p>{error}</p><button className="cal-retry-btn" onClick={() => loadRef.current()}>Retry</button></div></Shell>;

  return (
    <Shell>
      <div className="cal-container">
        <div className="cal-header">
          <h1 className="cal-title"><Icon name="calendar" size={26} className="icon-accent" /> Calendar</h1>
          <button className="cal-add-btn" onClick={() => { setNewDate(monthKey + "-01"); setAddOpen(true); }}>Add Event</button>
        </div>

        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>&larr;</button>
          <span className="cal-nav-label">{MONTHS[month - 1]} {year}</span>
          <button className="cal-nav-btn" onClick={nextMonth}>&rarr;</button>
        </div>

        <div className="cal-grid">
          {DAYS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
          {Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} className="cal-day cal-day-empty" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = String(i + 1).padStart(2, "0");
            const dayEvents = eventMap.get(day) || [];
            const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && i + 1 === now.getDate();
            return (
              <div key={day} className={`cal-day ${isToday ? "cal-day-today" : ""} ${dayEvents.length > 0 ? "cal-day-has" : ""}`}>
                <span className="cal-day-num">{i + 1}</span>
                {dayEvents.length > 0 && (
                  <div className="cal-day-events">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="cal-day-event" title={e.title}>
                        <span className="cal-day-event-text">{e.title}</span>
                        <button className="cal-day-event-del" onClick={() => void handleDelete(e.id)}>&times;</button>
                      </div>
                    ))}
                    {dayEvents.length > 2 && <span className="cal-day-more">+{dayEvents.length - 2} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="cal-list">
          <h3 className="cal-list-title">Events this month</h3>
          {events.length === 0 ? <p className="cal-empty">No events. Add one!</p> : (
            events.map(e => (
              <div key={e.id} className="cal-list-item">
                <div className="cal-list-info">
                  <span className="cal-list-date">{formatDate(e.event_date)}</span>
                  <span className="cal-list-title-text">{e.title}</span>
                  {e.description && <span className="cal-list-desc">{e.description}</span>}
                </div>
                <button className="cal-list-del" onClick={() => void handleDelete(e.id)}>&times;</button>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Event">
          <div className="cal-add-form">
            <label className="cal-add-label">Date</label>
            <input className="cal-add-input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <label className="cal-add-label">Title</label>
            <input className="cal-add-input" placeholder="Event title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <label className="cal-add-label">Description (optional)</label>
            <textarea className="cal-add-textarea" placeholder="Description" rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <button className="cal-add-submit" disabled={adding || !newTitle.trim() || !newDate} onClick={() => void handleAdd()}>
              {adding ? "Adding..." : "Save"}
            </button>
          </div>
      </Modal>
    </Shell>
  );
}

