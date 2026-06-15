// Type definitions mirroring the CivicOS backend schemas.

export type InstitutionType =
  | "hospital"
  | "municipality"
  | "post"
  | "court"
  | "tax_office";

export type TicketStatus =
  | "waiting"
  | "called"
  | "serving"
  | "served"
  | "no_show"
  | "cancelled";

export type QueueStatus = "open" | "paused" | "closed";

export interface Institution {
  id: number;
  name: string;
  type: InstitutionType;
  address: string | null;
  city: string;
  country: string;
  avg_wait_minutes: number;
  is_active: boolean;
}

export interface InstitutionWithLoad extends Institution {
  waiting_count: number;
  current_number: number;
  queue_status: QueueStatus;
  estimated_wait_minutes: number;
}

export interface QueueWindow {
  id: number;
  window_number: number;
  agent_name: string | null;
  current_ticket_id: number | null;
}

export interface Ticket {
  id: number;
  queue_id: number;
  number: number;
  phone: string;
  service_type: string | null;
  status: TicketStatus;
  created_at: string | null;
  called_at: string | null;
  served_at: string | null;
  wait_minutes: number | null;
}

export interface TodayQueue {
  institution: Institution;
  queue_id: number | null;
  date: string | null;
  status: QueueStatus;
  current_number: number;
  total_served: number;
  waiting_count: number;
  windows: QueueWindow[];
  next_numbers: number[];
}

export interface TicketCreateResponse {
  id: number;
  number: number;
  position: number;
  estimated_wait_minutes: number;
  institution_id: number;
  status: TicketStatus;
}

export interface QueueStats {
  institution_id: number;
  date: string;
  total_tickets: number;
  served: number;
  no_show: number;
  cancelled: number;
  waiting: number;
  avg_wait_minutes: number;
  current_number: number;
  status: QueueStatus;
}

// --- Documents -------------------------------------------------------------
export type FileStatus =
  | "submitted"
  | "processing"
  | "ready"
  | "delivered"
  | "rejected";

export interface DocumentType {
  id: number;
  name: string;
  institution_id: number | null;
  required_documents: string[];
  avg_processing_days: number;
}

export interface FileUpdate {
  id: number;
  old_status: string | null;
  new_status: string;
  message: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface FileRecord {
  id: number;
  reference_number: string;
  citizen_phone: string;
  document_type_id: number;
  status: FileStatus;
  submitted_at: string;
  expected_ready_date: string | null;
  notes: string | null;
  document_type?: DocumentType | null;
  updates?: FileUpdate[];
}

// --- Market ----------------------------------------------------------------
export type Category =
  | "food"
  | "clothing"
  | "electronics"
  | "furniture"
  | "services"
  | "crafts"
  | "other";

export type ListingStatus = "active" | "sold" | "expired";

export interface Seller {
  id: number;
  name: string;
  phone: string;
  city: string;
  neighborhood: string | null;
  verified: boolean;
  rating: number;
  total_sales: number;
}

export interface Listing {
  id: number;
  seller_id: number;
  title: string;
  description: string | null;
  category: Category;
  price: number;
  negotiable: boolean;
  photos: string[];
  city: string;
  neighborhood: string | null;
  status: ListingStatus;
  views: number;
  created_at: string;
}

export interface ListingDetail extends Listing {
  seller?: Seller | null;
  review_count: number;
  avg_rating: number;
}

export interface SellerProfile extends Seller {
  listings: Listing[];
}

export interface Review {
  id: number;
  listing_id: number;
  reviewer_phone: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  listing_id: number;
  buyer_phone: string;
  buyer_name: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

// --- Issues ----------------------------------------------------------------
export type IssueStatus =
  | "reported"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "closed";

export type IssuePriority = "low" | "medium" | "high" | "urgent";

export interface IssueCategory {
  id: number;
  name: string;
  icon: string | null;
  responsible_dept: string | null;
}

export interface IssueUpdate {
  id: number;
  status: string;
  message: string | null;
  updated_by: string | null;
  photo: string | null;
  updated_at: string;
}

export interface Issue {
  id: number;
  reference_number: string;
  reporter_phone: string;
  category_id: number | null;
  title: string;
  description: string | null;
  location_lat: number | null;
  location_lng: number | null;
  address: string | null;
  city: string | null;
  photos: string[];
  status: IssueStatus;
  priority: IssuePriority;
  assigned_dept: string | null;
  upvote_count: number;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  category?: IssueCategory | null;
  updates?: IssueUpdate[];
}

export interface IssueStats {
  city: string | null;
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_category: Record<string, number>;
  resolved_rate: number;
  avg_resolution_days: number | null;
}

// --- Auth & user accounts --------------------------------------------------
export interface User {
  id: number;
  phone: string;
  name: string;
  email: string | null;
  city: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface CitizenToken {
  access_token: string;
  token_type: string;
  role: string;
  expires_in_days: number;
  user: User;
}

export interface OverviewCounts {
  tickets: number;
  documents: number;
  listings: number;
  issues: number;
}

export interface MeOverview {
  user: User;
  counts: OverviewCounts;
  tickets: Ticket[];
  documents: FileRecord[];
  listings: Listing[];
  issues: Issue[];
}

export interface AdminToken {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
  full_name: string;
  institution_id: number | null;
  institution_type: string | null;
  expires_in_days: number;
}
