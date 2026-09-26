/**
 * Backend domain code (AABBCC) -> i18n message key mapping.
 * Mirrors CredChain_Golang/infrastructure/http/responder/mapper.go.
 *
 * Keep this file in sync with the backend's CodeToMessageKey map.
 * When the backend adds a new code, add it here and in both locale files.
 */

export const CODE_TO_MESSAGE_KEY: Record<number, string> = {
  // System (10)
  100000: "system.success",
  100050: "system.internal_error",
  100040: "system.validation",

  // Overview (10 + 01)
  100100: "overview.success",
  100150: "overview.internal_error",

  // Meta (10 + 02)
  100200: "system.meta.success",
  100250: "system.meta.internal_error",

  // Auth (20)
  200200: "auth.login.success",
  200140: "auth.unauthorized",
  200141: "auth.token.invalid",
  200142: "auth.forbidden",
  200241: "auth.login.failed",
  200143: "system.rate_limited",
  200242: "auth.login.failed",
  200243: "auth.login.account_deleted",
  200250: "auth.login.failed",
  200300: "auth.refresh.success",
  200340: "auth.refresh.invalid_token",
  200341: "auth.token.expired",
  200342: "auth.refresh.token_revoked",
  200343: "auth.refresh.user_not_found",
  200350: "auth.refresh.jwt_failed",
  200400: "auth.logout.success",

  // User (30 + 00-09)
  300100: "user.fetch.success",
  300140: "user.fetch.not_found",
  300200: "user.store.success",
  300241: "user.store.email_duplicate_in_batch",
  300242: "user.store.email_duplicate",
  300243: "user.store.wallet_generation_failed",
  300244: "user.store.blockchain_sync_failed",
  300245: "user.store.super_admin_forbidden",
  300246: "user.store.admin_create_admin_forbidden",
  300300: "user.profile.success",
  300400: "user.email_update.success",
  300440: "user.email.conflict",
  300441: "user.email.mismatched_id_token",
  300442: "user.email.invalid_id_token",
  300500: "user.role_update.success",
  300541: "user.update.admin_to_admin_forbidden",
  300542: "user.update.below_admin_forbidden",
  300543: "user.update.same_role_skipped",
  300544: "user.update.super_admin_promotion_forbidden",
  300545: "user.role.blockchain_sync_failed",
  300546: "user.update.self_target_forbidden",
  300547: "user.update.role_trashed_forbidden",
  300700: "user.delete.success",
  300741: "user.delete.admin_forbidden",
  300742: "user.delete.blockchain_sync_failed",
  300743: "user.delete.self_target_forbidden",
  300800: "user.update.success",
  300841: "user.update.not_found",
  300842: "user.update.admin_to_admin_forbidden",
  300843: "user.update.super_admin_forbidden",
  300844: "user.update.self_forbidden",
  300845: "user.update.blockchain_sync_failed",
  300846: "user.update.trashed_forbidden",
  300847: "user.update.self_email_forbidden",
  300900: "user.restore.success",
  300941: "user.restore.below_admin_forbidden",
  300942: "user.restore.self_target_forbidden",
  300943: "user.restore.super_admin_target_forbidden",
  300944: "user.restore.not_trashed_forbidden",
  300945: "user.restore.blockchain_sync_failed",

  // Transfer Super Admin (30 + 06)
  300600: "user.transfer.success",
  300641: "user.transfer.self_target_forbidden",
  300642: "user.transfer.target_not_found",
  300643: "user.transfer.target_trashed_forbidden",
  300645: "user.transfer.blockchain_sync_failed",

  // User unit CRUD (30 + 10) + destroy guard
  300650: "error_user_unit_destroy_in_use",
  301000: "success_user_unit_fetch",
  301001: "success_user_unit_store",
  301002: "success_user_unit_update",
  301003: "success_user_unit_destroy",
  301040: "error_user_unit_not_found",
  301041: "error_user_unit_parent_invalid",
  301042: "error_user_unit_parent_inactive",

  // Credential (40)
  400100: "credential.fetch.success",
  400140: "credential.fetch.not_found",
  400141: "credential.fetch.validation",
   400200: "credential.issue.success",
   400241: "credential.issue.validation",
  400242: "credential.issue.duplicate_file_hash",
  400243: "credential.issue.holder_not_found",
  400244: "credential.issue.blockchain_sync_failed",
  400245: "credential.issue.storage_failed",
  400246: "credential.issue.hash_failed",

  // Issue extensions (40 + 02)
  400247: "error_credential_issue_type_not_found",
  400248: "error_credential_issue_type_inactive",
  400249: "error_credential_issue_organization_not_found",
  400250: "error_credential_issue_number_duplicate",
  400251: "error_credential_issue_competency_not_found",
  400252: "error_credential_issue_organization_inactive",
  400253: "error_credential_issue_competency_inactive",

  400300: "credential.revoke.success",
  400340: "credential.revoke.failed",
  400341: "credential.revoke.not_found",
  400342: "credential.revoke.already_revoked",
  400344: "credential.revoke.not_approved",
  400345: "error_credential_revoke_already_expired",
  400343: "credential.revoke.blockchain_sync_failed",
  400400: "credential.verify.success",
  400440: "credential.verify.failed",
  400441: "credential.verify.validation",
  400442: "credential.verify.extract_not_ready",
  400443: "credential.verify.extract_failed",
  400444: "credential.verify.ai_service_failed",
  400445: "credential.verify.credential_not_found",
  400446: "credential.verify.document_unreadable",
  400401: "credential.verify.verdict.authentic",
  400402: "credential.verify.verdict.revoked",
  400403: "credential.verify.verdict.integrity_warning",
  400404: "credential.verify.verdict.tampered",
  400405: "credential.verify.verdict.suspicious",
  400406: "credential.verify.verdict.low_similarity",
  400407: "credential.verify.verdict.not_similar",
  400408: "credential.verify.verdict.no_identifiers",
  400409: "credential.verify.verdict.no_match",
  400410: "credential.verify.verdict.holder_disabled",
  400411: "credential.verify.verdict.issuer_disabled",
  400412: "credential.verify.verdict.party_disabled",

  // Verify — expired verdict
  400413: "error_credential_verify_expired",

  400500: "credential.reextract.success",
  400540: "credential.reextract.not_found",
  400541: "credential.reextract.not_eligible",
  400600: "credential.file_download.success",
  400640: "credential.file_download.not_found",
  400641: "credential.file_download.forbidden",
  400642: "credential.file_download.decryption_failed",
  400643: "credential.file_download.no_file",

  // Lookup destroy guards
  400741: "error_credential_type_destroy_in_use",
  400742: "error_issuer_organization_destroy_in_use",
  400743: "error_competency_destroy_in_use",

  // Credential type CRUD (40 + 08)
  400800: "success_credential_type_fetch",
  400801: "success_credential_type_store",
  400802: "success_credential_type_update",
  400803: "success_credential_type_destroy",
  400840: "error_credential_type_not_found",
  400841: "error_credential_type_name_duplicate",

  // Issuer organization CRUD (40 + 09)
  400900: "success_issuer_organization_fetch",
  400901: "success_issuer_organization_store",
  400902: "success_issuer_organization_update",
  400903: "success_issuer_organization_destroy",
  400940: "error_issuer_organization_not_found",
  400941: "error_issuer_organization_name_duplicate",

  // Competency CRUD (40 + 10)
  401000: "success_competency_fetch",
  401001: "success_competency_store",
  401002: "success_competency_update",
  401003: "success_competency_destroy",
  401040: "error_competency_not_found",
  401041: "error_competency_name_duplicate",

  // Submission (40 + 11)
  401100: "success_credential_submit",
  401141: "error_credential_submit_storage_failed",

  // Review (40 + 12)
  401200: "success_credential_review",
  401240: "error_credential_review_not_found",
  401241: "error_credential_review_already_approved",
  401242: "error_credential_review_already_rejected",
  401243: "error_credential_review_already_revoked",
  401244: "error_credential_review_blockchain_sync_failed",
  401245: "error_credential_review_already_expired",

  // Competency link (40 + 13)
  401300: "success_credential_competency_link",
  401340: "error_credential_competency_link_credential_not_found",
  401341: "error_credential_competency_link_competency_not_found",

  // Credential update (40 + 14)
  401400: "success_credential_update",
  401440: "error_credential_update_not_found",
  401441: "error_credential_update_not_pending",

  // Metadata resolution (40 + 15)
  401500: "success_credential_metadata_resolve",
  401540: "error_credential_metadata_resolve_not_found",
  401541: "error_credential_metadata_resolve_not_pending",
  401542: "error_credential_metadata_resolve_nothing_staged",
  401543: "error_credential_metadata_resolve_target_not_found",
  401544: "error_credential_metadata_resolve_target_inactive",
  401545: "error_credential_metadata_resolve_number_duplicate",
  401546: "error_credential_approve_unresolved_metadata",
  401547: "error_credential_approve_inactive_metadata",
};

export function codeToMessageKey(code?: number): string {
  if (!code) return "system.internal_error";
  return CODE_TO_MESSAGE_KEY[code] ?? "system.internal_error";
}
