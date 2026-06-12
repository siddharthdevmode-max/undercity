import { apiCall } from "./api";

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
  sender_username: string;
  recipient_username: string;
}

export interface InboxResponse {
  messages: Message[];
  total: number;
  unread: number;
}

export async function getInbox(page: number = 1): Promise<InboxResponse> {
  return apiCall<InboxResponse>(`/v1/messages/inbox?page=${page}`);
}

export async function getSentMessages(page: number = 1): Promise<{ messages: Message[]; total: number }> {
  return apiCall<{ messages: Message[]; total: number }>(`/v1/messages/sent?page=${page}`);
}

export async function getMessage(id: number): Promise<{ message: Message }> {
  return apiCall<{ message: Message }>(`/v1/messages/${id}`);
}

export async function getUnreadCount(): Promise<{ unread: number }> {
  return apiCall<{ unread: number }>("/v1/messages/unread-count");
}

export async function sendMessage(recipient: string, subject: string, body: string): Promise<{ message: Message }> {
  return apiCall<{ message: Message }>("/v1/messages/send", {
    method: "POST",
    body: JSON.stringify({ recipient, subject, body }),
  });
}

export async function deleteMessage(id: number): Promise<void> {
  await apiCall<void>(`/v1/messages/${id}`, { method: "DELETE" });
}
