import axios, { type AxiosInstance } from "axios";
import type {
  AdminToken,
  CitizenToken,
  DocumentType,
  FileRecord,
  Institution,
  InstitutionWithLoad,
  Issue,
  IssueCategory,
  IssueStats,
  Listing,
  ListingDetail,
  MeOverview,
  Order,
  QueueStats,
  Review,
  SellerProfile,
  Ticket,
  TicketCreateResponse,
  TodayQueue,
  User,
} from "./types";

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

// WebSocket base derived from the API URL (http→ws, https→wss).
export const WS_URL: string = API_URL.replace(/^http/, "ws");

// --- Token storage ---------------------------------------------------------
const CITIZEN_KEY = "civicos_citizen_token";
const CITIZEN_USER = "civicos_citizen_user";
const ADMIN_KEY = "civicos_admin_token";
const ADMIN_INFO = "civicos_admin_info";

export const tokens = {
  citizen: () => localStorage.getItem(CITIZEN_KEY),
  citizenUser: (): User | null => {
    const raw = localStorage.getItem(CITIZEN_USER);
    return raw ? (JSON.parse(raw) as User) : null;
  },
  citizenPhone: () => tokens.citizenUser()?.phone ?? null,
  setCitizen: (t: CitizenToken) => {
    localStorage.setItem(CITIZEN_KEY, t.access_token);
    localStorage.setItem(CITIZEN_USER, JSON.stringify(t.user));
  },
  setCitizenUser: (u: User) => localStorage.setItem(CITIZEN_USER, JSON.stringify(u)),
  clearCitizen: () => {
    localStorage.removeItem(CITIZEN_KEY);
    localStorage.removeItem(CITIZEN_USER);
  },
  admin: () => localStorage.getItem(ADMIN_KEY),
  adminInfo: (): AdminToken | null => {
    const raw = localStorage.getItem(ADMIN_INFO);
    return raw ? (JSON.parse(raw) as AdminToken) : null;
  },
  setAdmin: (t: AdminToken) => {
    localStorage.setItem(ADMIN_KEY, t.access_token);
    localStorage.setItem(ADMIN_INFO, JSON.stringify(t));
  },
  clearAdmin: () => {
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(ADMIN_INFO);
  },
};

const http: AxiosInstance = axios.create({ baseURL: API_URL });

http.interceptors.request.use((config) => {
  const url = config.url || "";
  const isAdmin = url.startsWith("/admin") && url !== "/admin/login";
  const token = isAdmin ? tokens.admin() : tokens.citizen();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const unwrap = <T>(p: Promise<{ data: T }>): Promise<T> => p.then((r) => r.data);

// --- API surface -----------------------------------------------------------
export const api = {
  // Auth & accounts
  auth: {
    register: (body: {
      phone: string;
      name: string;
      email?: string;
      password?: string;
      city?: string;
    }) =>
      unwrap<{ message: string; is_new_user: boolean; debug_otp: string | null }>(
        http.post("/auth/register", body)
      ),
    requestOtp: (phone: string) =>
      unwrap<{ message: string; is_new_user: boolean; debug_otp: string | null }>(
        http.post("/auth/request-otp", { phone })
      ),
    verifyOtp: (phone: string, otp: string, profile?: { name?: string; email?: string; city?: string }) =>
      unwrap<CitizenToken>(http.post("/auth/verify-otp", { phone, otp, ...profile })),
    login: (identifier: string, password: string) =>
      unwrap<CitizenToken>(http.post("/auth/login", { identifier, password })),
    me: () => unwrap<User>(http.get("/auth/me")),
    updateMe: (body: Partial<Pick<User, "name" | "email" | "city" | "avatar_url">> & { password?: string }) =>
      unwrap<User>(http.put("/auth/me", body)),
    overview: () => unwrap<MeOverview>(http.get("/me/overview")),
    adminLogin: (username: string, password: string) =>
      unwrap<AdminToken>(http.post("/admin/login", { username, password })),
  },

  // Module 1 — Queue
  institutions: {
    list: (params?: Record<string, string | boolean | undefined>) =>
      unwrap<InstitutionWithLoad[]>(http.get("/institutions", { params })),
    today: (id: number) => unwrap<TodayQueue>(http.get(`/institutions/${id}/today`)),
  },
  tickets: {
    create: (body: { institution_id: number; phone: string; service_type?: string }) =>
      unwrap<TicketCreateResponse>(http.post("/tickets", body)),
    byPhone: (phone: string) => unwrap<Ticket[]>(http.get(`/tickets/${encodeURIComponent(phone)}`)),
    cancel: (id: number) => unwrap<Ticket>(http.delete(`/tickets/${id}`)),
  },
  queueAdmin: {
    dashboard: (institutionId?: number) =>
      unwrap<TodayQueue>(http.get("/admin/dashboard", { params: { institution_id: institutionId } })),
    open: (institutionId?: number, windows = 3) =>
      unwrap<TodayQueue>(
        http.post("/admin/queue/open", { windows }, { params: { institution_id: institutionId } })
      ),
    pause: (institutionId?: number) =>
      unwrap<TodayQueue>(http.post("/admin/queue/pause", {}, { params: { institution_id: institutionId } })),
    close: (institutionId?: number) =>
      unwrap<TodayQueue>(http.post("/admin/queue/close", {}, { params: { institution_id: institutionId } })),
    next: (institutionId?: number) =>
      unwrap(http.post("/admin/queue/next", {}, { params: { institution_id: institutionId } })),
    call: (number: number, institutionId?: number) =>
      unwrap(http.post(`/admin/queue/call/${number}`, {}, { params: { institution_id: institutionId } })),
    noShow: (ticketId: number) => unwrap<Ticket>(http.post(`/admin/tickets/${ticketId}/no-show`)),
    served: (ticketId: number) => unwrap<Ticket>(http.post(`/admin/tickets/${ticketId}/served`)),
    stats: (institutionId?: number) =>
      unwrap<QueueStats>(http.get("/admin/stats", { params: { institution_id: institutionId } })),
  },

  // Module 2 — Documents
  documents: {
    types: (institutionId?: number) =>
      unwrap<DocumentType[]>(http.get("/document-types", { params: { institution_id: institutionId } })),
    submit: (body: { citizen_phone: string; document_type_id: number; notes?: string }) =>
      unwrap<FileRecord>(http.post("/files", body)),
    track: (reference: string) => unwrap<FileRecord>(http.get(`/files/${reference}`)),
    byPhone: (phone: string) => unwrap<FileRecord[]>(http.get(`/files/phone/${encodeURIComponent(phone)}`)),
    history: (reference: string) => unwrap<FileUpdateList>(http.get(`/files/${reference}/history`)),
  },
  documentsAdmin: {
    list: (params?: Record<string, string | undefined>) =>
      unwrap<FileRecord[]>(http.get("/admin/files", { params })),
    updateStatus: (
      id: number,
      body: { status: string; message?: string; expected_date?: string }
    ) => unwrap<FileRecord>(http.put(`/admin/files/${id}/status`, body)),
    notify: (id: number, message?: string) =>
      unwrap<{ message: string }>(http.post(`/admin/files/${id}/notify`, { message })),
  },

  // Module 3 — Market
  listings: {
    browse: (params?: Record<string, string | number | undefined>) =>
      unwrap<Listing[]>(http.get("/listings", { params })),
    detail: (id: number) => unwrap<ListingDetail>(http.get(`/listings/${id}`)),
    create: (body: Record<string, unknown>) => unwrap<ListingDetail>(http.post("/listings", body)),
    update: (id: number, body: Record<string, unknown>) =>
      unwrap<ListingDetail>(http.put(`/listings/${id}`, body)),
    remove: (id: number) => unwrap<{ message: string }>(http.delete(`/listings/${id}`)),
    contact: (id: number, body: { buyer_phone: string; buyer_name?: string; message: string }) =>
      unwrap<Order>(http.post(`/listings/${id}/contact`, body)),
    review: (id: number, body: { reviewer_phone: string; rating: number; comment?: string }) =>
      unwrap<Review>(http.post(`/listings/${id}/review`, body)),
  },
  sellers: {
    profile: (phone: string) => unwrap<SellerProfile>(http.get(`/sellers/${encodeURIComponent(phone)}`)),
  },

  // Module 4 — Issues
  issues: {
    categories: () => unwrap<IssueCategory[]>(http.get("/issue-categories")),
    report: (body: Record<string, unknown>) => unwrap<Issue>(http.post("/issues", body)),
    browse: (params?: Record<string, string | number | undefined>) =>
      unwrap<Issue[]>(http.get("/issues", { params })),
    track: (reference: string) => unwrap<Issue>(http.get(`/issues/${reference}`)),
    upvote: (id: number, voter_phone: string) =>
      unwrap<{ message: string }>(http.post(`/issues/${id}/upvote`, { voter_phone })),
    stats: (city?: string) => unwrap<IssueStats>(http.get("/issues/stats", { params: { city } })),
  },
  issuesAdmin: {
    list: (params?: Record<string, string | undefined>) =>
      unwrap<Issue[]>(http.get("/admin/issues", { params })),
    updateStatus: (id: number, body: { status: string; message?: string; photo?: string }) =>
      unwrap<Issue>(http.put(`/admin/issues/${id}/status`, body)),
    assign: (id: number, body: { department: string; priority?: string }) =>
      unwrap<Issue>(http.post(`/admin/issues/${id}/assign`, body)),
  },
};

// Convenience alias used by the documents history endpoint.
type FileUpdateList = import("./types").FileUpdate[];

export default api;
