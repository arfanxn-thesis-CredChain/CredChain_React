import { describe, expect, it } from "vitest";
import { Role } from "@shared/auth/role";
import {
  genderSchema,
  userBatchDeleteSchema,
  userBatchStoreSchema,
  userBatchUpdateRoleSchema,
  userBatchUpdateSchema,
  userDetailEditSchema,
  userSelfEmailSchema,
  userSelfProfileSchema,
  userStoreSchema,
  userUpdateSchema,
} from "./user";

describe("userStoreSchema - email validation", () => {
  it("accepts valid emails", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "not-an-email",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
  });

  it("rejects email longer than 256 chars", () => {
    const longLocal = "a".repeat(250);
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: `${longLocal}@example.com`,
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
  });
});

describe("userStoreSchema - name validation", () => {
  it("rejects empty name", () => {
    const result = userStoreSchema.safeParse({
      name: "",
      email: "jane@example.com",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 256 chars", () => {
    const result = userStoreSchema.safeParse({
      name: "a".repeat(257),
      email: "jane@example.com",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
  });
});

describe("userStoreSchema - birth_date validation", () => {
  it("accepts ISO date format", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      birth_date: "1990-05-15",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-ISO date format", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      birth_date: "15/05/1990",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
  });

  it("treats empty birth_date as undefined", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      birth_date: "",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(true);
  });
});

describe("userStoreSchema - role validation", () => {
  it("accepts holder, issuer, admin", () => {
    for (const role of [Role.HOLDER, Role.ISSUER, Role.ADMIN]) {
      const result = userStoreSchema.safeParse({
        name: "Jane",
        email: "jane@example.com",
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects super_admin (cannot be created via API)", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      role: Role.SUPER_ADMIN,
    });
    expect(result.success).toBe(false);
  });
});

describe("userStoreSchema - unit_id and joined_year (D2)", () => {
  const baseValid = {
    name: "Jane",
    email: "jane@example.com",
    role: Role.HOLDER,
  };

  it("accepts absent unit_id and joined_year", () => {
    expect(userStoreSchema.safeParse(baseValid).success).toBe(true);
  });

  it("accepts unit_id up to 26 chars", () => {
    expect(
      userStoreSchema.safeParse({ ...baseValid, unit_id: "unit_0123456789abcdef" }).success,
    ).toBe(true);
  });

  it("rejects unit_id longer than 26 chars", () => {
    const result = userStoreSchema.safeParse({ ...baseValid, unit_id: "x".repeat(27) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.unitIdTooLong");
    }
  });

  it("treats empty unit_id as undefined", () => {
    const result = userStoreSchema.safeParse({ ...baseValid, unit_id: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unit_id).toBeUndefined();
  });

  it("accepts joined_year within 1900-2200", () => {
    expect(userStoreSchema.safeParse({ ...baseValid, joined_year: 2024 }).success).toBe(true);
    expect(userStoreSchema.safeParse({ ...baseValid, joined_year: 1900 }).success).toBe(true);
    expect(userStoreSchema.safeParse({ ...baseValid, joined_year: 2200 }).success).toBe(true);
  });

  it("rejects joined_year below 1900", () => {
    const result = userStoreSchema.safeParse({ ...baseValid, joined_year: 1899 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.joinedYearRange");
    }
  });

  it("rejects joined_year above 2200", () => {
    const result = userStoreSchema.safeParse({ ...baseValid, joined_year: 2201 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.joinedYearRange");
    }
  });

  it("rejects non-integer joined_year", () => {
    const result = userStoreSchema.safeParse({ ...baseValid, joined_year: 2024.5 });
    expect(result.success).toBe(false);
  });
});

describe("userStoreSchema - phone is removed (D2)", () => {
  const baseValid = {
    name: "Jane",
    email: "jane@example.com",
    role: Role.HOLDER,
  };

  it("strips phone_number from the parsed output", () => {
    const result = userStoreSchema.safeParse({
      ...baseValid,
      phone_number: "+6281234567890",
    });
    expect(result.success).toBe(true);
    if (result.success) expect("phone_number" in result.data).toBe(false);
  });

  it("does not accept a phone_number key", () => {
    const result = userStoreSchema.safeParse({
      ...baseValid,
      phone_number: "not-a-phone",
    });
    expect(result.success).toBe(true);
  });
});

describe("userBatchStoreSchema", () => {
  it("requires at least one user", () => {
    const result = userBatchStoreSchema.safeParse({ users: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 users", () => {
    const users = Array.from({ length: 101 }, (_, i) => ({
      name: `User ${i}`,
      email: `user${i}@example.com`,
      role: Role.HOLDER,
    }));
    const result = userBatchStoreSchema.safeParse({ users });
    expect(result.success).toBe(false);
  });

  it("accepts valid batch", () => {
    const result = userBatchStoreSchema.safeParse({
      users: [
        { name: "Jane", email: "jane@example.com", role: Role.HOLDER },
        { name: "John", email: "john@example.com", role: Role.ISSUER },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("userSelfProfileSchema", () => {
  it("accepts empty object (phone is optional)", () => {
    const result = userSelfProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid E.164 phone number", () => {
    const result = userSelfProfileSchema.safeParse({ phone_number: "+6281234567890" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid phone format", () => {
    const result = userSelfProfileSchema.safeParse({ phone_number: "08123456789" });
    expect(result.success).toBe(false);
  });

  it("treats empty string phone as undefined", () => {
    const result = userSelfProfileSchema.safeParse({ phone_number: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone_number).toBeUndefined();
  });
});

describe("userSelfEmailSchema", () => {
  it("requires both email and id_token", () => {
    expect(userSelfEmailSchema.safeParse({ email: "a@b.com" }).success).toBe(false);
    expect(userSelfEmailSchema.safeParse({ id_token: "abc" }).success).toBe(false);
  });

  it("accepts valid payload", () => {
    const result = userSelfEmailSchema.safeParse({
      email: "new@example.com",
      id_token: "google-id-token",
    });
    expect(result.success).toBe(true);
  });
});

describe("genderSchema", () => {
  it.each(["male", "female"] as const)("accepts %s", (value) => {
    expect(genderSchema.parse(value)).toBe(value);
  });

  it("rejects unknown values", () => {
    expect(() => genderSchema.parse("unknown")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => genderSchema.parse("")).toThrow();
  });
});

describe("userStoreSchema gender field", () => {
  const baseValid = {
    name: "Test",
    email: "test@example.com",
    role: "holder" as const,
  };

  it("accepts gender: undefined", () => {
    expect(userStoreSchema.safeParse(baseValid).success).toBe(true);
  });

  it("accepts gender: null", () => {
    expect(userStoreSchema.safeParse({ ...baseValid, gender: null }).success).toBe(true);
  });

  it("accepts valid gender values", () => {
    for (const g of ["male", "female"] as const) {
      expect(userStoreSchema.safeParse({ ...baseValid, gender: g }).success).toBe(true);
    }
  });

  it("rejects invalid gender values", () => {
    expect(userStoreSchema.safeParse({ ...baseValid, gender: "invalid" }).success).toBe(false);
  });
});

describe("userUpdateSchema gender field", () => {
  const baseValid = { id: "u1" };

  it("accepts gender: null (clear)", () => {
    expect(userUpdateSchema.safeParse({ ...baseValid, gender: null }).success).toBe(true);
  });

  it("accepts valid gender values", () => {
    expect(userUpdateSchema.safeParse({ ...baseValid, gender: "male" }).success).toBe(true);
  });

  it("rejects invalid gender values", () => {
    expect(userUpdateSchema.safeParse({ ...baseValid, gender: "x" }).success).toBe(false);
  });
});

describe("userUpdateSchema - optional fields empty-string handling", () => {
  const baseValid = { id: "u1" };

  describe("birth_date", () => {
    it("accepts undefined", () => {
      expect(userUpdateSchema.safeParse(baseValid).success).toBe(true);
    });

    it("accepts null", () => {
      expect(userUpdateSchema.safeParse({ ...baseValid, birth_date: null }).success).toBe(true);
    });

    it("treats empty string as undefined", () => {
      const result = userUpdateSchema.safeParse({ ...baseValid, birth_date: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.birth_date).toBeUndefined();
    });

    it("accepts valid ISO date", () => {
      expect(userUpdateSchema.safeParse({ ...baseValid, birth_date: "1990-01-01" }).success).toBe(
        true,
      );
    });

    it("rejects malformed date (non-empty)", () => {
      const result = userUpdateSchema.safeParse({ ...baseValid, birth_date: "01/01/1990" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("zod.user.dateFormat");
      }
    });
  });

  describe("number", () => {
    it("accepts undefined", () => {
      expect(userUpdateSchema.safeParse(baseValid).success).toBe(true);
    });

    it("accepts null", () => {
      expect(userUpdateSchema.safeParse({ ...baseValid, number: null }).success).toBe(true);
    });

    it("treats empty string as undefined", () => {
      const result = userUpdateSchema.safeParse({ ...baseValid, number: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.number).toBeUndefined();
    });

    it("accepts valid string", () => {
      expect(userUpdateSchema.safeParse({ ...baseValid, number: "EMP-001" }).success).toBe(true);
    });

    it("rejects too long", () => {
      const result = userUpdateSchema.safeParse({ ...baseValid, number: "x".repeat(257) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("zod.user.numberTooLong");
      }
    });
  });

  describe("email", () => {
    it("rejects empty string (treated as invalid email)", () => {
      const result = userUpdateSchema.safeParse({ ...baseValid, email: "" });
      expect(result.success).toBe(false);
    });

    it("accepts valid email", () => {
      expect(userUpdateSchema.safeParse({ ...baseValid, email: "a@b.com" }).success).toBe(true);
    });

    it("returns localization key on invalid email", () => {
      const result = userUpdateSchema.safeParse({ ...baseValid, email: "not-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("zod.user.emailInvalid");
      }
    });
  });

  describe("name", () => {
    it("accepts undefined (optional)", () => {
      expect(userUpdateSchema.safeParse(baseValid).success).toBe(true);
    });

    it("rejects empty string with localization key", () => {
      const result = userUpdateSchema.safeParse({ ...baseValid, name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("zod.user.nameRequired");
      }
    });
  });
});

describe("userUpdateSchema - unit_id and joined_year (D2)", () => {
  const baseValid = { id: "u1" };

  it("accepts null unit_id (backend treats as no-change, emits no branch)", () => {
    const result = userUpdateSchema.safeParse({ ...baseValid, unit_id: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unit_id).toBeNull();
  });

  it("accepts unit_id up to 26 chars", () => {
    expect(
      userUpdateSchema.safeParse({ ...baseValid, unit_id: "unit_0123456789abcdef" }).success,
    ).toBe(true);
  });

  it("rejects unit_id longer than 26 chars", () => {
    const result = userUpdateSchema.safeParse({ ...baseValid, unit_id: "x".repeat(27) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.unitIdTooLong");
    }
  });

  it("treats empty unit_id as undefined", () => {
    const result = userUpdateSchema.safeParse({ ...baseValid, unit_id: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unit_id).toBeUndefined();
  });

  it("accepts null joined_year (backend treats as no-change, emits no branch)", () => {
    const result = userUpdateSchema.safeParse({ ...baseValid, joined_year: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.joined_year).toBeNull();
  });

  it("treats empty string joined_year as undefined (clear omitted from payload)", () => {
    const result = userUpdateSchema.safeParse({ ...baseValid, joined_year: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.joined_year).toBeUndefined();
  });

  it("treats NaN joined_year as undefined (cleared number input)", () => {
    const result = userUpdateSchema.safeParse({ ...baseValid, joined_year: NaN });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.joined_year).toBeUndefined();
  });

  it("accepts valid joined_year values", () => {
    expect(userUpdateSchema.safeParse({ ...baseValid, joined_year: 2024 }).success).toBe(true);
    expect(userUpdateSchema.safeParse({ ...baseValid, joined_year: 1900 }).success).toBe(true);
    expect(userUpdateSchema.safeParse({ ...baseValid, joined_year: 2200 }).success).toBe(true);
  });

  it("rejects joined_year out of range", () => {
    const result = userUpdateSchema.safeParse({ ...baseValid, joined_year: 1899 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.joinedYearRange");
    }
  });
});

describe("userUpdateSchema - phone is removed (D2)", () => {
  it("strips phone_number from parsed output", () => {
    const result = userUpdateSchema.safeParse({
      id: "u1",
      phone_number: "+6281234567890",
    });
    expect(result.success).toBe(true);
    if (result.success) expect("phone_number" in result.data).toBe(false);
  });
});

describe("userStoreSchema - error messages are i18n keys", () => {
  it("name required uses i18n key", () => {
    const result = userStoreSchema.safeParse({
      name: "",
      email: "a@b.com",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.nameRequired");
    }
  });

  it("email invalid uses i18n key", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "not-email",
      role: Role.HOLDER,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path.includes("email"));
      expect(emailIssue?.message).toBe("zod.user.emailInvalid");
    }
  });

  it("role required uses i18n key", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "a@b.com",
      role: "invalid_role",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.roleRequired");
    }
  });
});

describe("userStoreSchema number empty-string regression", () => {
  it("treats empty number as undefined (not '')", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "a@b.com",
      role: Role.HOLDER,
      number: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.number).toBeUndefined();
  });

  it("preserves a real number value", () => {
    const result = userStoreSchema.safeParse({
      name: "Jane",
      email: "a@b.com",
      role: Role.HOLDER,
      number: "EMP-001",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.number).toBe("EMP-001");
  });
});

describe("userBatchUpdateSchema", () => {
  it("rejects empty array with i18n key", () => {
    const result = userBatchUpdateSchema.safeParse({ users: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.batch.minOne");
    }
  });

  it("rejects more than 100 users with i18n key", () => {
    const users = Array.from({ length: 101 }, (_, i) => ({ id: `u${i}` }));
    const result = userBatchUpdateSchema.safeParse({ users });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.batch.maxHundred");
    }
  });

  it("accepts valid batch", () => {
    const result = userBatchUpdateSchema.safeParse({
      users: [{ id: "u1", name: "Alice" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("userBatchUpdateRoleSchema (D2 - user_roles body)", () => {
  it("rejects empty user_id with i18n key", () => {
    const result = userBatchUpdateRoleSchema.safeParse({
      user_roles: [{ user_id: "", role: Role.HOLDER }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.idRequired");
    }
  });

  it("rejects invalid role with i18n key", () => {
    const result = userBatchUpdateRoleSchema.safeParse({
      user_roles: [{ user_id: "u1", role: "bogus" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.roleRequired");
    }
  });

  it("accepts all four roles including super_admin", () => {
    for (const role of [Role.HOLDER, Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN]) {
      expect(
        userBatchUpdateRoleSchema.safeParse({ user_roles: [{ user_id: "u1", role }] }).success,
      ).toBe(true);
    }
  });

  it("rejects empty array with i18n key", () => {
    const result = userBatchUpdateRoleSchema.safeParse({ user_roles: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.batch.minOne");
    }
  });

  it("rejects more than 100 entries with i18n key", () => {
    const user_roles = Array.from({ length: 101 }, (_, i) => ({
      user_id: `u${i}`,
      role: Role.HOLDER,
    }));
    const result = userBatchUpdateRoleSchema.safeParse({ user_roles });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.batch.maxHundred");
    }
  });

  it("accepts a valid user_roles payload", () => {
    const result = userBatchUpdateRoleSchema.safeParse({
      user_roles: [{ user_id: "u1", role: Role.ISSUER }],
    });
    expect(result.success).toBe(true);
  });
});

describe("userDetailEditSchema (D2)", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(userDetailEditSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid values", () => {
    const result = userDetailEditSchema.safeParse({
      name: "Jane",
      number: "EMP-001",
      birth_date: "1990-01-01",
      gender: "female",
      unit_id: "unit_01",
      joined_year: 2024,
      meta_entries: [{ key: "department", value: "Engineering" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects joined_year out of range", () => {
    const result = userDetailEditSchema.safeParse({ joined_year: 3000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.joinedYearRange");
    }
  });

  it("rejects unit_id longer than 26 chars", () => {
    const result = userDetailEditSchema.safeParse({ unit_id: "x".repeat(27) });
    expect(result.success).toBe(false);
  });

  it("treats empty joined_year string as undefined", () => {
    const result = userDetailEditSchema.safeParse({ joined_year: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.joined_year).toBeUndefined();
  });

  it("treats NaN joined_year as undefined (cleared number input)", () => {
    const result = userDetailEditSchema.safeParse({ joined_year: NaN });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.joined_year).toBeUndefined();
  });

  it("preserves null unit_id so callers can omit it (clear → undefined in payload)", () => {
    const result = userDetailEditSchema.safeParse({ unit_id: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unit_id).toBeNull();
  });

  it("preserves null joined_year so callers can omit it (clear → undefined in payload)", () => {
    const result = userDetailEditSchema.safeParse({ joined_year: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.joined_year).toBeNull();
  });
});

describe("userBatchDeleteSchema", () => {
  it("rejects empty inner id with i18n key", () => {
    const result = userBatchDeleteSchema.safeParse({ ids: [""] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.user.idRequired");
    }
  });

  it("rejects more than 100 ids with i18n key", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id${i}`);
    const result = userBatchDeleteSchema.safeParse({ ids });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.batch.maxHundred");
    }
  });

  it("accepts valid ids", () => {
    expect(userBatchDeleteSchema.safeParse({ ids: ["a", "b"] }).success).toBe(true);
  });
});

describe("userSelfEmailSchema email max length", () => {
  it("rejects email longer than 256 chars with i18n key", () => {
    const longLocal = "a".repeat(250);
    const result = userSelfEmailSchema.safeParse({
      email: `${longLocal}@example.com`,
      id_token: "tok",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const tooLong = result.error.issues.find((i) => i.message === "zod.user.emailTooLong");
      expect(tooLong).toBeDefined();
    }
  });
});
