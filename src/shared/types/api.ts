import type { Role } from "@shared/auth/role";

export type Gender = "male" | "female";

/**
 * Mirrors backend response.User from infrastructure/http/response/user.go
 */
export interface UserDTO {
  id: string;
  name: string | null;
  number: string | null;
  unit_id: string | null;
  joined_year: number | null;
  email: string;
  language: "en" | "id";
  birth_date: string | null;
  gender: Gender | null;
  meta: Record<string, unknown> | null;
  role: Role;
  wallet_address: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Mirrors backend response.Auth (User embedded inline + token fields).
 * Tokens are present in body but ignored when using httpOnly cookie strategy.
 */
export interface AuthResponseDTO extends UserDTO {
  access_token: string;
  refresh_token: string;
  access_token_expires_in: number;
  refresh_token_expires_in: number;
  token_type: "Bearer";
}

/**
 * Mirrors backend response.Credential
 */
export type ExtractState = "pending" | "succeeded" | "failed" | "unextracted";

export type CredentialStatus = "pending" | "approved" | "rejected" | "revoked" | "expired";

export interface CredentialDTO {
  id: string;
  holder_user_id: string;
  submitter_user_id: string;
  issuer_user_id: string | null;
  issuer_organization_id: string;
  type_id: string;
  submitted_issuer_organization_name?: string | null;
  submitted_type_name?: string | null;
  number: string | null;
  revoker_user_id: string | null;
  revocation_reason: string | null;
  name: string;
  meta: Record<string, unknown> | null;
  submitted_competencies?: SubmittedCompetencyDTO[] | null;
  unresolved_metadata?: string[];
  /** Resolved competency rows linked through competency_credential. */
  competencies?: ReferenceRow[];
  token_id: string | null;
  file_hash: string;
  file_uri: string | null;
  extract_state: ExtractState;
  extract_enqueued_at: string | null;
  extract_failed_at: string | null;
  extract_error: string | null;
  extracted_at: string | null;
  issued_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  status: CredentialStatus;
  activated_at: string | null;
  rejecter_user_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
  holder?: UserDTO;
  issuer?: UserDTO;
  revoker?: UserDTO;
  rejecter?: UserDTO;
  type?: ReferenceRow;
  issuer_organization?: ReferenceRow;
}

export interface VerificationCredentialDTO {
  issuer_organization_name: string | null;
  credential_type_name: string | null;
  id: string;
  name: string;
  status: CredentialStatus;
  is_submission: boolean;
  issuer_organization_id: string;
  number: string | null;
  file_hash: string;
  issued_at: string;
  expires_at: string | null;
}

export interface VerificationHolderDTO {
  name: string | null;
  number: string | null;
  unit_name: string | null;
  joined_year: number | null;
  email: string;
  gender: Gender | null;
  role: Role;
  wallet_address: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface VerificationPublicDetailsDTO extends VerificationCredentialDTO {
  credential_type_name: string | null;
  revoked_at: string | null;
  holder: VerificationHolderDTO | null;
  competencies: { name: string }[];
  meta: Record<string, unknown> | null;
  token_id: string | null;
  created_at: string;
  activated_at: string | null;
  rejected_at: string | null;
}

export interface CredentialVerifyDTO {
  exact_match_confirmed?: boolean;
  public_details?: VerificationPublicDetailsDTO | null;
  verdict_code: number;
  similarity_score: number | null;
  similarity_percent: string | null;
  description: string;
  credential: VerificationCredentialDTO | null;
}

export type ReferenceStatus = "pending" | "approved" | "rejected";

/**
 * Reference-data row (credential types, issuer organizations, competencies).
 * Mirrors response.CredentialType / response.IssuerOrganization / response.Competency.
 */
export interface ReferenceRow {
  id: string;
  name: string;
  active?: boolean;
  status?: ReferenceStatus;
  submitter_user_id?: string | null;
  approver_user_id?: string | null;
  rejecter_user_id?: string | null;
  rejection_reason?: string | null;
  activated_at?: string | null;
  rejected_at?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

export interface SubmittedCompetencyDTO {
  name: string;
  resolved_id: string | null;
}

export type ReferenceResource =
  | "credential-types"
  | "credential-issuer-organizations"
  | "competencies";

/**
 * Mirrors backend response.UserUnit from infrastructure/http/response/user_unit.go
 */
export interface HolderUnitDTO {
  id: string;
  parent_id: string | null;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * Paginated response shape from list endpoints.
 * Mirrors backend response.Pagination from infrastructure/http/response/pagination.go.
 * Backend exposes more URL helpers; we only declare the fields we consume.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  last_page: number;
  from: number;
  to: number;
  first_page_url: string | null;
  last_page_url: string | null;
  next_page_url: string | null;
  prev_page_url: string | null;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sorts?: string[];
  filters?: string[];
  includes?: string[];
}

export interface CredentialRecapCounts {
  total_holders: number;
  holders_with_credentials: number;
  holders_without_credentials: number;
  holders_with_active_credentials: number;
  holders_without_active_credentials: number;
  total_credentials: number;
  active_credentials: number;
  pending_credentials: number;
  rejected_credentials: number;
  expired_credentials: number;
  revoked_credentials: number;
}

export interface CredentialRecapRow extends CredentialRecapCounts {
  unit_id: string | null;
  joined_year: number | null;
}

export interface CredentialRecap {
  as_of: string;
  rows: CredentialRecapRow[];
  units: Pick<HolderUnitDTO, "id" | "parent_id" | "name" | "active">[];
}

export interface OverviewCredentialCounts {
  total: number;
  active: number;
  pending_review: number;
  rejected: number;
  expired: number;
  revoked: number;
  pending: number;
  failed: number;
}

export interface OverviewUserCounts {
  total: number;
  holder: number;
  issuer: number;
  admin: number;
  super_admin: number;
  active: number;
  trashed: number;
}

export interface OverviewChainDetails {
  authority_contract: string;
  registry_contract: string;
  last_block: number;
  relayer_address: string;
  relayer_balance: string;
}

export interface OverviewRecentCredential {
  id: string;
  name: string;
  holder?: UserDTO;
  issuer?: UserDTO;
  revoker?: UserDTO;
  issued_at: string;
  revoked_at?: string;
}

export type OverviewRecentUser = UserDTO;

export interface OverviewRecents {
  active_credentials?: OverviewRecentCredential[];
  revoked_credentials?: OverviewRecentCredential[];
  stored_users?: OverviewRecentUser[];
}

export interface OverviewDTO {
  credential_counts: OverviewCredentialCounts;
  user_counts?: OverviewUserCounts;
  recents: OverviewRecents;
  chain_details?: OverviewChainDetails;
}

export interface MetaDTO {
  issuing_organization_name: string;
  authority_contract: string;
  registry_contract: string;
  chain_id: number;
  last_block: number;
}

export type NotificationType =
  | "credential_registered"
  | "credential_approved"
  | "credential_rejected"
  | "credential_revoked"
  | "credential_type_submitted"
  | "credential_issuer_organization_submitted"
  | "competency_submitted";

export type NotificationSubjectType =
  | "credential"
  | "credential_type"
  | "credential_issuer_organization"
  | "competency";

export interface NotificationSubjectDTO {
  id: string;
  name: string;
  number: string | null;
  status?: string | null;
}

export interface NotificationDTO {
  id: string;
  notified_user_id: string;
  subject_type: NotificationSubjectType | null;
  subject_id: string | null;
  type: NotificationType;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
  read_at: string | null;
  subject: NotificationSubjectDTO | null;
}

export interface NotificationListResponse {
  items: NotificationDTO[];
  total: number;
  next_cursor: string | null;
}

export interface NotificationUnreadCountResponse {
  unread_count: number;
}

export interface NotificationReadAllResponse {
  updated_count: number;
}
