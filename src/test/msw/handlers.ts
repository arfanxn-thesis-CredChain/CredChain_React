import { http, HttpResponse } from "msw";
import type { HolderUnitDTO, ReferenceRow, UserDTO } from "@shared/types/api";
import { mockUsers } from "../fixtures";

const envelope = <T>(code: number, message: string, data?: T) =>
  HttpResponse.json({ code, message, ...(data !== undefined ? { data } : {}) });

const mockCredentialTypes: ReferenceRow[] = [
  { id: "ctype_01", name: "Bachelor's Degree", active: true },
  { id: "ctype_02", name: "Professional Certificate", active: true },
];
const mockIssuerOrganizations: ReferenceRow[] = [
  { id: "iorg_01", name: "University of Indonesia" },
  { id: "iorg_02", name: "Tech Academy" },
];
const mockCompetencies: ReferenceRow[] = [
  { id: "comp_01", name: "Machine Learning" },
  { id: "comp_02", name: "Data Analysis" },
];

const mockUserUnits: HolderUnitDTO[] = [
  {
    id: "unit_01",
    parent_id: null,
    name: "Faculty of Engineering",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  },
  {
    id: "unit_02",
    parent_id: "unit_01",
    name: "Computer Science Department",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  },
];

function paginated<T>(items: T[]): Record<string, unknown> {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 100,
    last_page: 1,
    from: 1,
    to: items.length,
    first_page_url: null,
    last_page_url: null,
    next_page_url: null,
    prev_page_url: null,
  };
}

function upsertRow(store: ReferenceRow[], prefix: string, name: string): ReferenceRow {
  const existing = store.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const created: ReferenceRow = { id: `${prefix}_${store.length + 1}`, name };
  store.push(created);
  return created;
}

// Mirrors backend filter syntax: column<operator><value>.
// Supports operators used by the frontend: `_` (IS NULL), `!_` (IS NOT NULL), `=`.
function applyFilters(users: UserDTO[], filters: string[]): UserDTO[] {
  let result = users;
  for (const f of filters) {
    if (f.endsWith("!_")) {
      const col = f.slice(0, -2);
      result = result.filter((u) => (u as unknown as Record<string, unknown>)[col] != null);
    } else if (f.endsWith("_")) {
      const col = f.slice(0, -1);
      result = result.filter((u) => (u as unknown as Record<string, unknown>)[col] == null);
    } else if (f.includes("=")) {
      const [col, val] = f.split("=", 2);
      result = result.filter((u) => String((u as unknown as Record<string, unknown>)[col]) === val);
    }
  }
  return result;
}

function applySorts(users: UserDTO[], sorts: string[]): UserDTO[] {
  if (sorts.length === 0) return users;
  const out = [...users];
  out.sort((a, b) => {
    for (const s of sorts) {
      const desc = s.startsWith("-");
      const col = desc ? s.slice(1) : s.startsWith("+") ? s.slice(1) : s;
      const av = (a as unknown as Record<string, unknown>)[col];
      const bv = (b as unknown as Record<string, unknown>)[col];
      if (av === bv) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av) < String(bv) ? -1 : 1;
      return desc ? -cmp : cmp;
    }
    return 0;
  });
  return out;
}

export const handlers = [
  http.get("*/api/health", () => envelope(100000, "OK", { status: "ok" })),

  http.get("*/api/meta", () =>
    envelope(100200, "OK", {
      issuing_organization_name: "University of Indonesia",
      authority_contract: "0x0000000000000000000000000000000000000000",
      registry_contract: "0x0000000000000000000000000000000000000000",
      chain_id: 31337,
      last_block: 0,
    }),
  ),

  http.get("*/api/users/self", () => envelope(100200, "OK", mockUsers[0])),

  http.get("*/api/users", ({ request }) => {
    const url = new URL(request.url);
    const sorts = url.searchParams.getAll("sorts");
    const filters = url.searchParams.getAll("filters");
    const search = url.searchParams.get("search") ?? "";

    let items: UserDTO[] = mockUsers;
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(
        (u) => (u.name?.toLowerCase().includes(s) ?? false) || u.email.toLowerCase().includes(s),
      );
    }
    items = applyFilters(items, filters);
    items = applySorts(items, sorts);

    return envelope(100200, "OK", {
      items,
      total: items.length,
      page: 1,
      limit: 10,
      last_page: 1,
      from: 1,
      to: items.length,
      first_page_url: null,
      last_page_url: null,
      next_page_url: null,
      prev_page_url: null,
    });
  }),

  http.get("*/api/users/:id", ({ params }) => {
    const user = mockUsers.find((u: UserDTO) => u.id === params.id);
    return user
      ? envelope(100200, "OK", user)
      : HttpResponse.json({ code: 400200, message: "Not found" }, { status: 404 });
  }),

  http.post("*/api/auth/google", () =>
    envelope(100100, "OK", {
      ...mockUsers[0],
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      access_token_expires_in: 900,
      refresh_token_expires_in: 86400,
      token_type: "Bearer",
    }),
  ),

  http.post("*/api/auth/refresh", () => envelope(100101, "OK")),
  http.post("*/api/auth/logout", () => envelope(100102, "OK")),

  http.post("*/api/users/self/transfer-super-admin", () =>
    envelope(300600, "Super admin role transferred successfully.", null),
  ),

  http.delete("*/api/users/batch", () =>
    envelope(300700, "User(s) deleted successfully.", { deleted_count: 1 }),
  ),

  http.put("*/api/users/batch", () =>
    envelope(300800, "User(s) updated successfully.", { updated_count: 1 }),
  ),

  http.put("*/api/users/batch/role", () =>
    envelope(300500, "User role(s) updated successfully.", { updated_count: 1 }),
  ),

  http.put("*/api/users/batch/restore", () =>
    envelope(300900, "User(s) restored successfully.", { restored_count: 1 }),
  ),

  http.get("*/api/credentials", () => {
    return HttpResponse.json({
      code: 400100,
      message: "Credentials retrieved",
      data: {
        items: [
          {
            id: "cred_01HX",
            holder_user_id: "usr_01",
            issuer_user_id: "usr_02",
            revoker_user_id: null,
            name: "Bachelor's Degree",
            meta: { institution: "University of Indonesia" },
            token_id: "123456",
            file_hash: "0xabcd1234",
            file_uri: "local:///uploads/test.pdf",
            extract_status: "succeeded",
            lifecycle_status: "approved",
            extract_error: null,
            extracted_at: "2024-01-15T10:00:00Z",
            issued_at: "2024-01-15T10:00:00Z",
            revoked_at: null,
            holder: {
              id: "usr_01",
              name: "John Doe",
              email: "john@example.com",
              role: "holder",
              wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
            issuer: {
              id: "usr_02",
              name: "University Admin",
              email: "admin@university.edu",
              role: "issuer",
              wallet_address: "0xabcdef1234567890abcdef1234567890abcdef12",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
          },
          {
            id: "cred_02HY",
            holder_user_id: "usr_03",
            issuer_user_id: "usr_02",
            revoker_user_id: "usr_02",
            name: "Employment Certificate",
            meta: null,
            token_id: "123457",
            file_hash: "0xefgh5678",
            file_uri: null,
            extract_status: "succeeded",
            lifecycle_status: "revoked",
            extract_error: null,
            extracted_at: "2024-03-20T14:00:00Z",
            issued_at: "2024-03-20T14:00:00Z",
            revoked_at: "2024-06-01T08:00:00Z",
            holder: {
              id: "usr_03",
              name: "Jane Smith",
              email: "jane@company.com",
              role: "holder",
              wallet_address: "0x1111111111111111111111111111111111111111",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
            issuer: {
              id: "usr_02",
              name: "University Admin",
              email: "admin@university.edu",
              role: "issuer",
              wallet_address: "0xabcdef1234567890abcdef1234567890abcdef12",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
            revoker: {
              id: "usr_02",
              name: "University Admin",
              email: "admin@university.edu",
              role: "issuer",
              wallet_address: "0xabcdef1234567890abcdef1234567890abcdef12",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
          },
          {
            id: "cred_03HZ",
            holder_user_id: "usr_04",
            issuer_user_id: "usr_02",
            revoker_user_id: null,
            name: "Failed Extraction Credential",
            meta: null,
            token_id: "123458",
            file_hash: "0xdeadbeef",
            file_uri: null,
            extract_status: "failed",
            lifecycle_status: "pending",
            extract_error: "OCR failed",
            extracted_at: null,
            issued_at: "2024-04-01T10:00:00Z",
            revoked_at: null,
            holder: {
              id: "usr_04",
              name: "Bob Wilson",
              email: "bob@example.com",
              role: "holder",
              wallet_address: "0x2222222222222222222222222222222222222222",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
            issuer: {
              id: "usr_02",
              name: "University Admin",
              email: "admin@university.edu",
              role: "issuer",
              wallet_address: "0xabcdef1234567890abcdef1234567890abcdef12",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
          },
        ],
        total: 3,
        page: 1,
        limit: 30,
        last_page: 1,
        from: 1,
        to: 3,
        first_page_url: "/api/credentials?page=1",
        last_page_url: "/api/credentials?page=1",
        next_page_url: null,
        prev_page_url: null,
      },
    });
  }),

  http.get("*/api/credentials/:id", () => {
    return HttpResponse.json({
      code: 400100,
      message: "Credential retrieved",
      data: {
        id: "cred_01HX",
        holder_user_id: "usr_01",
        issuer_user_id: "usr_02",
        issuer_organization_id: "iorg_01",
        type_id: "ctype_01",
        number: null,
        revoker_user_id: null,
        name: "Bachelor's Degree",
        meta: { institution: "University of Indonesia" },
        token_id: "123456",
        file_hash: "0xabcd1234",
        file_uri: "local:///uploads/test.pdf",
        extract_status: "succeeded",
        lifecycle_status: "approved",
        extract_error: null,
        extracted_at: "2024-01-15T10:00:00Z",
        issued_at: "2024-01-15T10:00:00Z",
        revoked_at: null,
        expires_at: null,
        holder: {
          id: "usr_01",
          name: "John Doe",
          email: "john@example.com",
          role: "holder",
          wallet_address: "0x1234",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          deleted_at: null,
        },
        issuer: {
          id: "usr_02",
          name: "University Admin",
          email: "admin@university.edu",
          role: "issuer",
          wallet_address: "0x5678",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          deleted_at: null,
        },
      },
    });
  }),

  http.get("*/api/credentials/:id/file", () => {
    const testPdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
    return new HttpResponse(testPdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="test.pdf"',
      },
    });
  }),

  http.get("*/api/users/self/credentials", () => {
    return HttpResponse.json({
      code: 400100,
      message: "Credentials retrieved",
      data: {
        items: [
          {
            id: "cred_01HX",
            holder_user_id: "usr_01",
            issuer_user_id: "usr_02",
            revoker_user_id: null,
            name: "Bachelor's Degree",
            meta: null,
            token_id: "123456",
            file_hash: "0xabcd1234",
            file_uri: "local:///uploads/test.pdf",
            extract_status: "succeeded",
            lifecycle_status: "approved",
            extract_error: null,
            extracted_at: "2024-01-15T10:00:00Z",
            issued_at: "2024-01-15T10:00:00Z",
            revoked_at: null,
            holder: {
              id: "usr_01",
              name: "John Doe",
              email: "john@example.com",
              role: "holder",
              wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
            issuer: {
              id: "usr_02",
              name: "University Admin",
              email: "admin@university.edu",
              role: "issuer",
              wallet_address: "0xabcdef1234567890abcdef1234567890abcdef12",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              deleted_at: null,
            },
          },
        ],
        total: 1,
        page: 1,
        limit: 30,
        last_page: 1,
        from: 1,
        to: 1,
        first_page_url: "/api/users/self/credentials?page=1",
        last_page_url: "/api/users/self/credentials?page=1",
        next_page_url: null,
        prev_page_url: null,
      },
    });
  }),

  http.post("*/api/credentials/batch/issue", () => {
    return HttpResponse.json({
      code: 400200,
      message: "Credential(s) issued successfully",
      data: [
        {
          id: "cred_NEW1",
          holder_user_id: "usr_01",
          issuer_user_id: "usr_02",
          revoker_user_id: null,
          name: "New Certificate",
          meta: null,
          token_id: "123458",
          file_hash: "0xnewhash1",
          file_uri: "local:///uploads/new.pdf",
          extract_status: "pending",
          lifecycle_status: "pending",
          extract_error: null,
          extracted_at: null,
          issued_at: new Date().toISOString(),
          revoked_at: null,
        },
      ],
    });
  }),

  http.post("*/api/credentials/batch/submit", () => {
    return HttpResponse.json({
      code: 401100,
      message: "Credential(s) submitted successfully",
      data: [],
    });
  }),

  http.get("*/api/credential-types", () =>
    envelope(400600, "Credential types retrieved", paginated(mockCredentialTypes)),
  ),

  http.post("*/api/credential-types", async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    return envelope(
      400600,
      "Credential type stored",
      upsertRow(mockCredentialTypes, "ctype", body.name ?? ""),
    );
  }),

  http.put("*/api/credential-types/:id", async ({ request, params }) => {
    const row = mockCredentialTypes.find((r) => r.id === params.id);
    if (!row) {
      return HttpResponse.json(
        { code: 400840, message: "Credential type not found." },
        { status: 404 },
      );
    }
    const body = (await request.json()) as { name?: string; active?: boolean };
    if (body.name !== undefined) row.name = body.name;
    if (body.active !== undefined) row.active = body.active;
    return envelope(400600, "Credential type updated", row);
  }),

  http.delete("*/api/credential-types/:id", ({ params }) => {
    const index = mockCredentialTypes.findIndex((r) => r.id === params.id);
    if (index >= 0) mockCredentialTypes.splice(index, 1);
    return envelope(400600, "Credential type destroyed", null);
  }),

  http.get("*/api/issuer-organizations", () =>
    envelope(400600, "Issuer organizations retrieved", paginated(mockIssuerOrganizations)),
  ),

  http.post("*/api/issuer-organizations", async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    return envelope(
      400600,
      "Issuer organization stored",
      upsertRow(mockIssuerOrganizations, "iorg", body.name ?? ""),
    );
  }),

  http.put("*/api/issuer-organizations/:id", async ({ request, params }) => {
    const row = mockIssuerOrganizations.find((r) => r.id === params.id);
    if (!row) {
      return HttpResponse.json(
        { code: 400940, message: "Issuer organization not found." },
        { status: 404 },
      );
    }
    const body = (await request.json()) as { name?: string };
    if (body.name !== undefined) row.name = body.name;
    return envelope(400600, "Issuer organization updated", row);
  }),

  http.delete("*/api/issuer-organizations/:id", ({ params }) => {
    const index = mockIssuerOrganizations.findIndex((r) => r.id === params.id);
    if (index >= 0) mockIssuerOrganizations.splice(index, 1);
    return envelope(400600, "Issuer organization destroyed", null);
  }),

  http.get("*/api/competencies", () =>
    envelope(400600, "Competencies retrieved", paginated(mockCompetencies)),
  ),

  http.post("*/api/competencies", async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    return envelope(
      400600,
      "Competency stored",
      upsertRow(mockCompetencies, "comp", body.name ?? ""),
    );
  }),

  http.put("*/api/competencies/:id", async ({ request, params }) => {
    const row = mockCompetencies.find((r) => r.id === params.id);
    if (!row) {
      return HttpResponse.json({ code: 401040, message: "Competency not found." }, { status: 404 });
    }
    const body = (await request.json()) as { name?: string };
    if (body.name !== undefined) row.name = body.name;
    return envelope(400600, "Competency updated", row);
  }),

  http.delete("*/api/competencies/:id", ({ params }) => {
    const index = mockCompetencies.findIndex((r) => r.id === params.id);
    if (index >= 0) mockCompetencies.splice(index, 1);
    return envelope(400600, "Competency destroyed", null);
  }),

  http.get("*/api/user-units", () =>
    envelope(301000, "User units retrieved successfully.", mockUserUnits),
  ),

  http.post("*/api/user-units", async ({ request }) => {
    const body = (await request.json()) as { name?: string; parent_id?: string | null };
    const created: HolderUnitDTO = {
      id: `unit_${mockUserUnits.length + 1}`,
      parent_id: body.parent_id ?? null,
      name: body.name ?? "",
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    mockUserUnits.push(created);
    return envelope(301001, "User unit stored successfully.", created);
  }),

  http.put("*/api/user-units/:id", async ({ request, params }) => {
    const row = mockUserUnits.find((u) => u.id === params.id);
    if (!row) {
      return HttpResponse.json({ code: 301040, message: "User unit not found." }, { status: 404 });
    }
    const body = (await request.json()) as { name?: string; parent_id?: string | null };
    if (body.name !== undefined) row.name = body.name;
    if (body.parent_id !== undefined) row.parent_id = body.parent_id;
    return envelope(301002, "User unit updated successfully.", row);
  }),

  http.delete("*/api/user-units/:id", ({ params }) => {
    const index = mockUserUnits.findIndex((u) => u.id === params.id);
    if (index >= 0) mockUserUnits.splice(index, 1);
    return envelope(301003, "User unit destroyed successfully.", null);
  }),

  http.post("*/api/credentials/batch/revoke", () => {
    return HttpResponse.json({
      code: 400300,
      message: "Credential(s) revoked",
      data: [],
    });
  }),

  http.post("*/api/credentials/batch/reextract", () => {
    return HttpResponse.json({
      code: 400500,
      message: "Re-extraction queued successfully",
      data: [],
    });
  }),

  http.put("*/api/credentials/batch", () => {
    return HttpResponse.json({
      code: 401400,
      message: "Credential(s) updated successfully",
      data: [],
    });
  }),

  http.put("*/api/credentials/:id/competencies", () => {
    return HttpResponse.json({
      code: 401300,
      message: "Credential competencies linked successfully",
      data: null,
    });
  }),

  http.post("*/api/credentials/batch/approve", () => {
    return HttpResponse.json({
      code: 401200,
      message: "Credential review recorded successfully.",
      data: [],
    });
  }),

  http.post("*/api/credentials/batch/reject", () => {
    return HttpResponse.json({
      code: 401200,
      message: "Credential review recorded successfully.",
      data: [],
    });
  }),

  http.post("*/api/credentials/verify", () => {
    return HttpResponse.json({
      code: 400407,
      message: "No match",
      data: {
        verdict_code: 400407,
        similarity_score: 0.23,
        similarity_percent: "23.0%",
        description: "No Match",
        credential: null,
      },
    });
  }),

  http.get("*/api/overview", () => {
    return HttpResponse.json({
      code: 100100,
      data: {
        credential_counts: { total: 500, active: 450, revoked: 40, pending: 10, failed: 3 },
        user_counts: {
          total: 150,
          holder: 120,
          issuer: 20,
          admin: 8,
          super_admin: 1,
          active: 145,
          trashed: 5,
        },
        recents: {
          active_credentials: [
            {
              id: "01J1",
              name: "Bachelor's Degree",
              holder: { id: "01H1", name: "John", email: "john@example.com", role: "holder" },
              issuer: { id: "01I1", name: "UI", email: "admin@ui.ac.id", role: "issuer" },
              issued_at: "2026-06-20T10:00:00Z",
            },
          ],
          revoked_credentials: [
            {
              id: "01J2",
              name: "Diploma",
              holder: { id: "01H2", name: "Jane", email: "jane@example.com", role: "holder" },
              revoker: { id: "01R1", name: "Admin", email: "admin@example.com", role: "admin" },
              issued_at: "2026-04-01T00:00:00Z",
              revoked_at: "2026-06-19T08:00:00Z",
            },
          ],
          stored_users: [
            {
              id: "01H3",
              name: "Jane",
              email: "jane@example.com",
              role: "holder",
              created_at: "2026-06-18T00:00:00Z",
            },
          ],
        },
        chain_details: {
          authority_contract: "0x9A5f",
          registry_contract: "0x8B3c",
          last_block: 12345678,
          relayer_address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          relayer_balance: "10499.98",
        },
      },
    });
  }),
];
