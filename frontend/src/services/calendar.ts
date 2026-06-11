import { apiCall } from "./api";

export interface CalendarEvent {
  id: number; title: string; description: string; event_date: string; created_at: string;
}

export const calendarAPI = {
  getEvents: (month: string): Promise<{ events: CalendarEvent[] }> => apiCall(`/calendar/events?month=${month}`),
  createEvent: (title: string, description: string, eventDate: string): Promise<CalendarEvent> => apiCall("/calendar/events", {
    method: "POST", body: JSON.stringify({ title, description, eventDate }),
  }),
  deleteEvent: (id: number): Promise<void> => apiCall(`/calendar/events/${id}`, { method: "DELETE" }),
};
