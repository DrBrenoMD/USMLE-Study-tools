# Security Specification: USMLE Study Tools Cloud Sync

## Data Invariants
1. A user profile `/users/{userId}` can only be read and written by the authenticated user whose `request.auth.uid == userId`.
2. A data document `/users/{userId}/data/{dataType}` can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid == userId`.
3. In `UserDataSync`, `incoming().userId` must strictly match `request.auth.uid`.
4. Document IDs must conform to `isValidId(id)`: length <= 128, matching '^[a-zA-Z0-9_\\-]+$'.
5. All string fields must have bounded sizes. Payload string size <= 950,000 bytes (Firestore doc limit guard).
6. Unauthenticated requests are completely rejected by default.

## The Dirty Dozen Payloads (Designed to break laws of Identity and State)
1. Anonymous write attempt to `/users/user123` -> Rejected (Not signed in).
2. Authenticated user A writing to `/users/userB` -> Rejected (UID mismatch).
3. Authenticated user A reading `/users/userB` -> Rejected (Cannot read another user's PII/profile).
4. Authenticated user A creating `/users/userA/data/study_tracker` with `userId: "userB"` -> Rejected (Identity spoofing).
5. Document ID containing path traversal `../../../admin` -> Rejected (isValidId fails).
6. Document ID with junk 2KB string -> Rejected (isValidId size check fails).
7. Payload exceeding safe limits (> 950KB) -> Rejected (String size check).
8. DataType containing invalid characters or excessive length -> Rejected.
9. Missing required field `payload` -> Rejected (Schema validation).
10. Attempting to update `userId` during an update -> Rejected (Immutable identity field).
11. Listing another user's subcollection `/users/userB/data` -> Rejected (Query Enforcer).
12. Global arbitrary collection read `/{document=**}` -> Rejected (Default-deny catch-all).
