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
export type ExtractStatus = "pending" | "succeeded" | "failed" | "unextracted";

export type CredentialLifecycleStatus = "pending" | "approved" | "rejected" | "revoked";

export interface CredentialDTO {
  id: string;
  holder_user_id: string;
  submitter_user_id: string;
  issuer_user_id: string;
  submitted_issuer_organization_name: string | null;
  issuer_organization_id: string | null;
  submitted_type_name: string | null;
  type_id: string | null;
  number: string | null;
  revoker_user_id: string | null;
  name: string;
  meta: Record<string, unknown> | null;
  /** Staged competency names; resolved_id null means still awaiting review. */
  submitted_competencies: SubmittedCompetencyDTO[] | null;
  /** Metadata kinds blocking approval; empty means approvable. */
  unresolved_metadata: string[];
  /** Resolved competency rows linked through competency_credential. */
  competencies?: ReferenceRow[];
  token_id: string | null;
  file_hash: string;
  file_uri: string | null;
  extract_status: ExtractStatus;
  extract_error: string | null;
  extracted_at: string | null;
  issued_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  lifecycle_status: CredentialLifecycleStatus;
  approver_user_id: string | null;
  approved_at: string | null;
  rejecter_user_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
  holder?: UserDTO;
  issuer?: UserDTO;
  revoker?: UserDTO;
}

export interface CredentialVerifyDTO {
  verdict_code: number;
  similarity_score: number | null;
  similarity_percent: string | null;
  description: string;
  credential: CredentialDTO | null;
}

/**
 * Reference-data row (credential types, issuer organizations, competencies).
 * Mirrors response.CredentialType / response.IssuerOrganization / response.Competency.
 */
export interface ReferenceRow {
  id: string;
  name: string;
  active?: boolean;
}

export interface SubmittedCompetencyDTO {
  name: string;
  resolved_id: string | null;
}

/** Mirrors credential.MetadataMatch. */
export interface MetadataMatchDTO {
  id: string;
  name: string;
  active: boolean;
}

/** Mirrors credential.StagedNameSuggestion. */
export interface StagedNameSuggestionDTO {
  submitted_name: string;
  matches: MetadataMatchDTO[];
}

/** Mirrors credential.CredentialMetadataSuggestions. */
export interface CredentialMetadataSuggestionsDTO {
  credential_id: string;
  type: StagedNameSuggestionDTO | null;
  organization: StagedNameSuggestionDTO | null;
  competencies: StagedNameSuggestionDTO[];
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

export interface OverviewCredentialCounts {
  total: number;
  active: number;
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
  holder?: { id: string; name: string; email: string; role: Role };
  issuer?: { id: string; name: string; email: string; role: Role };
  revoker?: { id: string; name: string; email: string; role: Role };
  issued_at: string;
  revoked_at?: string;
}

export interface OverviewRecentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

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
