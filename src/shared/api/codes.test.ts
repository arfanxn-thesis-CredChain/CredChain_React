import { describe, expect, it } from "vitest";
import { CODE_TO_MESSAGE_KEY, codeToMessageKey } from "./codes";

describe("CODE_TO_MESSAGE_KEY", () => {
  it("mirrors a representative sample of backend codes", () => {
    expect(CODE_TO_MESSAGE_KEY[100000]).toBe("system.success");
    expect(CODE_TO_MESSAGE_KEY[200200]).toBe("auth.login.success");
    expect(CODE_TO_MESSAGE_KEY[300100]).toBe("user.fetch.success");
    expect(CODE_TO_MESSAGE_KEY[400200]).toBe("credential.issue.success");
    expect(CODE_TO_MESSAGE_KEY[400401]).toBe("credential.verify.verdict.authentic");
  });

  it("maps the step-3 user unit CRUD codes", () => {
    expect(CODE_TO_MESSAGE_KEY[300650]).toBe("error_user_unit_destroy_in_use");
    expect(CODE_TO_MESSAGE_KEY[301000]).toBe("success_user_unit_fetch");
    expect(CODE_TO_MESSAGE_KEY[301001]).toBe("success_user_unit_store");
    expect(CODE_TO_MESSAGE_KEY[301002]).toBe("success_user_unit_update");
    expect(CODE_TO_MESSAGE_KEY[301003]).toBe("success_user_unit_destroy");
    expect(CODE_TO_MESSAGE_KEY[301040]).toBe("error_user_unit_not_found");
    expect(CODE_TO_MESSAGE_KEY[301041]).toBe("error_user_unit_parent_invalid");
  });

  it("maps the step-3 issue extension codes", () => {
    expect(CODE_TO_MESSAGE_KEY[400247]).toBe("error_credential_issue_type_not_found");
    expect(CODE_TO_MESSAGE_KEY[400248]).toBe("error_credential_issue_type_inactive");
    expect(CODE_TO_MESSAGE_KEY[400249]).toBe("error_credential_issue_organization_not_found");
    expect(CODE_TO_MESSAGE_KEY[400250]).toBe("error_credential_issue_number_duplicate");
    expect(CODE_TO_MESSAGE_KEY[400251]).toBe("error_credential_issue_competency_not_found");
  });

  it("maps the step-3 lookup destroy guards", () => {
    expect(CODE_TO_MESSAGE_KEY[400741]).toBe("error_credential_type_destroy_in_use");
    expect(CODE_TO_MESSAGE_KEY[400742]).toBe("error_issuer_organization_destroy_in_use");
    expect(CODE_TO_MESSAGE_KEY[400743]).toBe("error_competency_destroy_in_use");
  });

  it("maps the step-3 credential type CRUD codes", () => {
    expect(CODE_TO_MESSAGE_KEY[400800]).toBe("success_credential_type_fetch");
    expect(CODE_TO_MESSAGE_KEY[400801]).toBe("success_credential_type_store");
    expect(CODE_TO_MESSAGE_KEY[400802]).toBe("success_credential_type_update");
    expect(CODE_TO_MESSAGE_KEY[400803]).toBe("success_credential_type_destroy");
    expect(CODE_TO_MESSAGE_KEY[400840]).toBe("error_credential_type_not_found");
    expect(CODE_TO_MESSAGE_KEY[400841]).toBe("error_credential_type_name_duplicate");
  });

  it("maps the step-3 issuer organization CRUD codes", () => {
    expect(CODE_TO_MESSAGE_KEY[400900]).toBe("success_issuer_organization_fetch");
    expect(CODE_TO_MESSAGE_KEY[400901]).toBe("success_issuer_organization_store");
    expect(CODE_TO_MESSAGE_KEY[400902]).toBe("success_issuer_organization_update");
    expect(CODE_TO_MESSAGE_KEY[400903]).toBe("success_issuer_organization_destroy");
    expect(CODE_TO_MESSAGE_KEY[400940]).toBe("error_issuer_organization_not_found");
    expect(CODE_TO_MESSAGE_KEY[400941]).toBe("error_issuer_organization_name_duplicate");
  });

  it("maps the step-3 competency CRUD codes", () => {
    expect(CODE_TO_MESSAGE_KEY[401000]).toBe("success_competency_fetch");
    expect(CODE_TO_MESSAGE_KEY[401001]).toBe("success_competency_store");
    expect(CODE_TO_MESSAGE_KEY[401002]).toBe("success_competency_update");
    expect(CODE_TO_MESSAGE_KEY[401003]).toBe("success_competency_destroy");
    expect(CODE_TO_MESSAGE_KEY[401040]).toBe("error_competency_not_found");
    expect(CODE_TO_MESSAGE_KEY[401041]).toBe("error_competency_name_duplicate");
  });

  it("maps the step-3 submission and review codes", () => {
    expect(CODE_TO_MESSAGE_KEY[401100]).toBe("success_credential_submit");
    expect(CODE_TO_MESSAGE_KEY[401141]).toBe("error_credential_submit_storage_failed");
    expect(CODE_TO_MESSAGE_KEY[401200]).toBe("success_credential_review");
    expect(CODE_TO_MESSAGE_KEY[401240]).toBe("error_credential_review_not_found");
    expect(CODE_TO_MESSAGE_KEY[401241]).toBe("error_credential_review_already_approved");
    expect(CODE_TO_MESSAGE_KEY[401242]).toBe("error_credential_review_already_rejected");
    expect(CODE_TO_MESSAGE_KEY[401243]).toBe("error_credential_review_already_revoked");
    expect(CODE_TO_MESSAGE_KEY[401244]).toBe("error_credential_review_blockchain_sync_failed");
  });

  it("maps the step-3 competency link and credential update codes", () => {
    expect(CODE_TO_MESSAGE_KEY[401300]).toBe("success_credential_competency_link");
    expect(CODE_TO_MESSAGE_KEY[401340]).toBe("error_credential_competency_link_credential_not_found");
    expect(CODE_TO_MESSAGE_KEY[401341]).toBe("error_credential_competency_link_competency_not_found");
    expect(CODE_TO_MESSAGE_KEY[401400]).toBe("success_credential_update");
    expect(CODE_TO_MESSAGE_KEY[401440]).toBe("error_credential_update_not_found");
    expect(CODE_TO_MESSAGE_KEY[401441]).toBe("error_credential_update_not_pending");
  });

  it("maps the step-13 metadata resolution codes", () => {
    expect(CODE_TO_MESSAGE_KEY[401500]).toBe("success_credential_metadata_resolve");
    expect(CODE_TO_MESSAGE_KEY[401540]).toBe("error_credential_metadata_resolve_not_found");
    expect(CODE_TO_MESSAGE_KEY[401541]).toBe("error_credential_metadata_resolve_not_pending");
    expect(CODE_TO_MESSAGE_KEY[401542]).toBe("error_credential_metadata_resolve_nothing_staged");
    expect(CODE_TO_MESSAGE_KEY[401543]).toBe("error_credential_metadata_resolve_target_not_found");
    expect(CODE_TO_MESSAGE_KEY[401544]).toBe("error_credential_metadata_resolve_target_inactive");
    expect(CODE_TO_MESSAGE_KEY[401545]).toBe("error_credential_metadata_resolve_number_duplicate");
    expect(CODE_TO_MESSAGE_KEY[401546]).toBe("error_credential_approve_unresolved_metadata");
  });

  it("maps the expired verify verdict", () => {
    expect(CODE_TO_MESSAGE_KEY[400413]).toBe("error_credential_verify_expired");
  });
});

describe("codeToMessageKey", () => {
  it("resolves a known code to its message key", () => {
    expect(codeToMessageKey(300100)).toBe("user.fetch.success");
    expect(codeToMessageKey(401001)).toBe("success_competency_store");
  });

  it("falls back to system.internal_error for unknown codes", () => {
    expect(codeToMessageKey(999999)).toBe("system.internal_error");
  });

  it("falls back to system.internal_error for undefined codes", () => {
    expect(codeToMessageKey(undefined)).toBe("system.internal_error");
    expect(codeToMessageKey()).toBe("system.internal_error");
  });
});
