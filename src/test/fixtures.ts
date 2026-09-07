import { Role, type Role as RoleType } from "@shared/auth/role";
import type { CredentialDTO, UserDTO } from "@shared/types/api";

export function makeUser(overrides: Partial<UserDTO> = {}): UserDTO {
  const role: RoleType = overrides.role ?? Role.HOLDER;
  return {
    id: overrides.id ?? "usr_test_1",
    name: "Test User",
    number: null,
    unit_id: null,
    joined_year: null,
    email: "test@credchain.demo",
    birth_date: null,
    gender: null,
    role,
    meta: null,
    wallet_address: "0x" + "0".repeat(40),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

export function makeCredential(overrides: Partial<CredentialDTO> = {}): CredentialDTO {
  return {
    id: "cred_test_1",
    holder_user_id: "usr_test_1",
    submitter_user_id: "usr_test_1",
    issuer_user_id: "usr_test_2",
    submitted_issuer_organization_name: null,
    issuer_organization_id: "org_test_1",
    submitted_type_name: null,
    type_id: "type_test_1",
    number: null,
    revoker_user_id: null,
    name: "Test Credential",
    meta: null,
    submitted_competencies: null,
    unresolved_metadata: [],
    token_id: "123456",
    file_hash: "0x" + "1".repeat(64),
    file_uri: "ipfs://test",
    extract_state: "succeeded",
    extract_enqueued_at: "2026-01-01T00:00:00Z",
    extract_failed_at: null,
    extract_error: null,
    extracted_at: "2026-01-01T00:00:00Z",
    issued_at: "2026-01-01T00:00:00Z",
    revoked_at: null,
    expires_at: null,
    status: "approved",
    approver_user_id: null,
    approved_at: "2026-01-01T00:00:00Z",
    rejecter_user_id: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    holder: makeUser({ id: "usr_test_1", role: Role.HOLDER, name: "Test Holder" }),
    issuer: makeUser({ id: "usr_test_2", role: Role.ISSUER, name: "Test Issuer" }),
    ...overrides,
  };
}

export const mockUsers: UserDTO[] = [
  makeUser({
    id: "usr_1",
    email: "superadmin@credchain.demo",
    role: Role.SUPER_ADMIN,
    name: "Super Admin",
  }),
  makeUser({
    id: "usr_2",
    email: "admin@credchain.demo",
    role: Role.ADMIN,
    name: "Platform Admin",
  }),
  makeUser({
    id: "usr_3",
    email: "issuer@credchain.demo",
    role: Role.ISSUER,
    name: "Default Issuer",
    unit_id: "unit_01",
    joined_year: 2022,
  }),
  makeUser({
    id: "usr_4",
    email: "holder@credchain.demo",
    role: Role.HOLDER,
    name: "Jane Doe",
    unit_id: "unit_01",
    joined_year: 2023,
  }),
  makeUser({
    id: "usr_5",
    email: "trashed@credchain.demo",
    role: Role.HOLDER,
    name: "Trashed User",
    deleted_at: "2026-02-15T00:00:00Z",
  }),
];

export const mockUserUnits = [
  { id: "unit_01", parent_id: null, name: "Faculty of Engineering", active: true },
  { id: "unit_02", parent_id: "unit_01", name: "Computer Science Department", active: true },
];

export const mockCredentials: CredentialDTO[] = [
  makeCredential({ id: "cred_1", name: "Bachelor of Science" }),
  makeCredential({ id: "cred_2", name: "Senior Software Engineer" }),
  makeCredential({ id: "cred_3", name: "Workshop Completion", revoked_at: "2026-06-01T00:00:00Z" }),
];

export function mockUserWithMeta(overrides: Partial<UserDTO> = {}): UserDTO {
  return makeUser({
    id: "usr_meta_1",
    number: "EMP-001",
    birth_date: "1990-01-01",
    meta: { department: "Engineering", level: "L3" },
    ...overrides,
  });
}

export function mockDeletedUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return mockUserWithMeta({
    id: "usr_deleted_1",
    deleted_at: "2026-02-01T00:00:00Z",
    ...overrides,
  });
}

export function mockUserNoPhone(overrides: Partial<UserDTO> = {}): UserDTO {
  return mockUserWithMeta({
    id: "usr_nophone_1",
    ...overrides,
  });
}

export function mockUserWithGender(overrides: Partial<UserDTO> = {}): UserDTO {
  return makeUser({
    id: "usr_gender_1",
    gender: "female",
    ...overrides,
  });
}
