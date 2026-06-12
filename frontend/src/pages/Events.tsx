import { useState, useEffect } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { toast } from "../utils/toast";
import { apiCall } from "../services/api";
import "../styles/Events.css";

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  event_date: string;
  created_at: string;
}

export default function Events() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [creating, setCreating] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const data = await apiCall<{ events: CalendarEvent[] }>(`/v1/calendar/events?month=${month}`);
      setEvents(data.events);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !eventDate) return;
    setCreating(true);
    try {
      await apiCall<{ event: CalendarEvent }>("/v1/calendar/events", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim(), eventDate }),
      });
      toast.success("Event created!");
      setTitle("");
      setDescription("");
      setEventDate("");
      setShowCreate(false);
      await loadEvents();
    } catch {
      toast.error("Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiCall<void>(`/v1/calendar/events/${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success("Event deleted");
    } catch {
      toast.error("Failed to delete event");
    }
  };

  return (
    <Shell>
      <div className="events-container">
        <div className="events-header">
          <h1 className="events-title"><Icon name="events" size={26} className="icon-accent" /> Events</h1>
          <p className="events-desc">Upcoming events and activities in Undercity.</p>
        </div>

        <div className="events-actions">
          <button className="events-create-btn" onClick={() => setShowCreate(!showCreate)}>
            <Icon name="add" size={14} /> {showCreate ? "Cancel" : "Create Event"}
          </button>
        </div>

        {showCreate && (
          <div className="events-create-form">
            <input className="events-input" type="text" placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="events-textarea" rows={3} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className="events-input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            <button className="events-submit-btn" disabled={creating || !title.trim() || !eventDate} onClick={handleCreate}>
              {creating ? "Creating..." : "Create Event"}
            </button>
          </div>
        )}

        <div className="events-list">
          {loading ? (
            <div className="events-loading">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="events-empty">
              <Icon name="calendar" size={40} className="icon-accent" />
              <p>No events this month. Create one!</p>
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="events-card">
                <div className="events-card-header">
                  <h3 className="events-card-title">{event.title}</h3>
                  <button className="events-delete-btn" onClick={() => handleDelete(event.id)} aria-label="Delete event">
                    <Icon name="trash" size={14} className="icon-error" />
                  </button>
                </div>
                {event.description && <p className="events-card-desc">{event.description}</p>}
                <span className="events-card-date">
                  {new Date(event.event_date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long",day: "numeric" })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Shell>
  );
}