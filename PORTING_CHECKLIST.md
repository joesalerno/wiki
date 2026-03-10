# Wiki Production Porting Checklist

## Target State

The production port should end with the wiki becoming a feature module, not a standalone app.

1. The demo identity shell is removed.
2. The host app passes the current user id and current user groups into the wiki.
3. The wiki no longer owns user selection, local user identity state, or user persistence.
4. The wiki reads and writes wiki data through the production GraphQL API.
5. User lists are loaded only inside the admin/manage experience, and only for admins.
6. The standalone Express/Apollo server and file-backed `wiki.json` storage are either retired or treated as temporary migration tooling.

## Current Integration Seams

These are the main places that will change during the port:

1. Identity bootstrap currently lives in [src/App.jsx](src/App.jsx).
2. The wiki feature currently expects a `currentUser` object and also receives `users` and `groups` in [src/Wiki.jsx](src/Wiki.jsx).
3. GraphQL transport and request shaping live in [src/wikiApi.js](src/wikiApi.js).
4. The standalone schema and resolvers live in [server/server.js](server/server.js).
5. File-backed data and permission logic live in [server/wikiDataController.js](server/wikiDataController.js).

## Porting Checklist

1. Define the production ownership boundary.
   Decide whether the wiki UI will be mounted as a route, tab, or embedded panel inside the host React app. *embedded panel under the main nav header*
   Decide whether wiki GraphQL types and resolvers will live in the host schema directly or behind a gateway/subgraph boundary. *they will exist in the host schema*
   Decide whether uploads will use the host app's file service instead of the current `/wiki-assets` endpoint. *configure the uploads folder to $dataDir/wikiAssets*
   Confirm whether wiki groups are separate from enterprise groups, or whether they map directly to existing authorization groups. *wiki groups map directory to existing groups*

2. Freeze the runtime contract before coding.
   Define the minimum runtime props the embedded wiki will receive from the host app.
   Recommended contract: `currentUserId`, `currentUserGroups`, `isAdmin`, GraphQL client or request function, upload handler, and optional feature flags.
   Remove any requirement for the wiki to load or infer the signed-in user outside the admin panel.
   Document the exact group names the wiki will treat as admin-equivalent in production.

3. Replace demo identity ownership on the client.
   Remove the signed-in-as selector and all localStorage-based user switching from [src/App.jsx](src/App.jsx).
   Remove wiki-owned user bootstrap calls from initial app load.
   Change the top-level wiki component API so the host app passes `currentUserId` and `currentUserGroups` directly.
   Prefer splitting `currentUser` into primitive inputs rather than passing the whole app-specific user model.
   Keep `isAdmin` either as a passed boolean or derive it once from `currentUserGroups` in a small adapter layer.

4. Refactor the wiki feature to be identity-agnostic.
   In [src/Wiki.jsx](src/Wiki.jsx), replace uses of `currentUser.id` with a dedicated `currentUserId` prop.
   Replace uses of `currentUser.groups` with `currentUserGroups`.
   Replace uses of `currentUser.isAdmin` with either an explicit `isAdmin` prop or a local derived flag.
   Remove assumptions that the wiki can reload identity state by calling back into the shell.
   Remove `onIdentityDataChange` from the wiki public API unless it is repurposed to mean refresh admin directory data only.

5. Separate regular wiki data from admin-only identity data.
   Do not load wiki users during normal page browsing, editing, approval, or history flows.
   Load users only when an admin opens the manage panel and only if the active tab actually needs user data.
   Keep sections and group metadata available for normal permission checks, but avoid resolving user display data unless needed in admin tooling.
   If the admin panel needs names for group members, add a dedicated admin query that returns only what that panel needs.

6. Redesign the GraphQL client contract.
   Remove the hardcoded API URL from [src/wikiApi.js](src/wikiApi.js).
   Stop relying on the `X-User-ID` header from the client module unless the host platform explicitly wants that pattern.
   Prefer one of these production-safe approaches:
   1. The host app injects an Apollo client or request executor.
   2. The host app injects a `fetchGraphQL` function that already carries auth/session context.
   3. The host app wraps the wiki API in its own service layer and the wiki imports only that adapter.
   Keep `userId` as an explicit argument only if the production backend requires it for auditing or impersonation-safe operations.
   Otherwise, let the backend derive identity from the host app session and remove `userId` arguments from mutations over time.

7. Decide the production identity model at the API boundary.
   Choose one model and enforce it consistently:
   1. Session-derived identity: backend reads authenticated user from request context.
   2. Explicit identity: frontend passes current user id and groups for every call.
   If you use explicit identity initially, treat it as a transitional model and validate it server-side.
   Do not trust client-passed group membership without server verification in production.
   Ensure audit fields like `authorId` and `approvedBy` come from verified identity, not unchecked client input.

8. Move wiki schema into the production GraphQL schema.
   Port the wiki query and mutation types from [server/server.js](server/server.js) into the host schema.
   Preserve the current wiki domain types: pages, sections, revisions, pending revisions, review mode, and review metadata.
   Reassess the need for `WikiUser` in the public schema.
   Make user-directory queries admin-scoped and avoid exposing them in the normal wiki read path.
   Align naming, nullability, pagination, error handling, and authorization style with the host GraphQL standards.

9. Replace the file-backed persistence layer.
   Retire [server/wikiDataController.js](server/wikiDataController.js) as the production data source.
   Map pages, sections, groups, revisions, and pending revisions to production storage.
   Add a migration plan for existing `wiki.json` content if any seed content must survive.
   Preserve approval metadata, revision timestamps, and pending review state during migration.
   Decide how uploads are stored and how URLs are generated in production.

10. Preserve authorization behavior while changing identity plumbing.
   Reimplement `hasGroupAccess`, page review rules, approver resolution, and admin fallback using production identity/group data.
   Verify the behavior for:
   1. Read access
   2. Write access
   3. Review-required sections
   4. Page-level review overrides
   5. Admin self-approval
   Ensure the same rules are enforced server-side, not just in React.
   Treat the current client permission checks as convenience UI only.

11. Simplify the wiki component public interface.
   Create a production-facing wiki module API with props similar to:
   1. `currentUserId`
   2. `currentUserGroups`
   3. `isAdmin`
   4. `api` or `graphqlClient`
   5. `onUploadAsset`
   Avoid passing the full user directory into the wiki root component.
   If admin tools need users, lazy load them inside `AdminPanel` or through an admin data hook.

12. Rework the admin panel data flow.
   Split admin panel data into:
   1. Wiki configuration data: groups, sections, pages.
   2. Admin directory data: users or group-member lookups.
   Load directory data only after the admin panel opens.
   Cache admin directory data for the session if needed, but do not make it a prerequisite for normal wiki rendering.
   Handle the empty/loading/error states for admin-only data independently of the main wiki page load.

13. Normalize production-friendly uploads.
   Replace the standalone upload endpoint with the host app's upload mechanism.
   Decide whether uploads go through GraphQL, REST, or a presigned URL flow.
   Keep the wiki editor contract simple: upload a file, get back `url`, `fileName`, `mimeType`, `isImage`, and markdown-friendly output.
   Enforce production limits, virus scanning, content type rules, and retention policy.

14. Remove demo-only assumptions from the UI.
   Remove any copy that implies the wiki controls sign-in or user switching.
   Remove localStorage identity persistence.
   Review local draft persistence keys so they remain safe when multiple host-app tenants or environments share a browser.
   Consider namespacing drafts by app instance, environment, and current user id.

15. Align styling and UX with the host application.
   Decide whether the wiki keeps its CSS as-is or is mapped to the host design system.
   Replace standalone shell layout with host page chrome.
   Audit buttons, alerts, spacing, typography, and empty states for consistency with the production app.
   Ensure admin affordances still stand out after design-system migration.

16. Add a migration adapter layer instead of editing everything inline.
   Create a thin integration wrapper around the wiki feature.
   Put host-specific identity mapping, GraphQL wiring, and upload wiring in that wrapper.
   Keep core wiki components as product-agnostic as possible.
   This reduces future maintenance and makes testing easier.

17. Define production observability before rollout.
   Add structured logging for mutations like save, approve, reject, revert, section updates, and group updates.
   Add audit trail requirements for who performed admin actions and approvals.
   Emit metrics for page reads, save failures, approval backlog, upload failures, and permission-denied events.
   Make GraphQL errors actionable and consistent with host app error handling.

18. Build a concrete test matrix.
   Verify anonymous or unauthorized access behavior if the host app can expose the route without permissions.
   Verify member browsing and editing in writable sections.
   Verify review-required flows, including pending revisions and approval.
   Verify admin self-approval warnings and behavior.
   Verify admin-only manage panel loading without user data on normal page views.
   Verify upload behavior in both image and non-image cases.
   Verify group-based visibility changes immediately affect page access.
   Verify migration of old data if existing content is imported.

19. Plan the cutover.
   Decide whether to ship behind a feature flag.
   Run the port in a staging environment backed by real identity and authorization data.
   Test with representative admin and non-admin accounts.
   Validate that existing links, uploads, review history, and permissions behave the same after migration.
   Keep a rollback plan if the production resolver or storage migration causes authorization regressions.

20. Define completion criteria.
   The wiki renders inside the host React app without the demo shell.
   Normal wiki usage requires only `currentUserId` and `currentUserGroups` from the host app.
   No normal wiki read path loads the user directory.
   Admin manage flows lazy load users only when needed.
   All authorization decisions are enforced server-side using production identity.
   File-backed development storage and standalone server code are no longer on the critical production path.

## Recommended Implementation Order

1. Introduce a host integration wrapper and new wiki props.
2. Remove demo user switching and local identity bootstrap.
3. Refactor [src/Wiki.jsx](src/Wiki.jsx) to consume only current user id, groups, and admin status.
4. Make admin user loading lazy and isolated to the manage panel.
5. Replace [src/wikiApi.js](src/wikiApi.js) transport with host GraphQL wiring.
6. Port schema and resolvers into the production backend.
7. Replace [server/wikiDataController.js](server/wikiDataController.js) persistence with production storage.
8. Migrate uploads.
9. Run authorization and regression testing.
10. Cut over behind a flag, then remove the demo server and shell.

## Highest-Risk Areas

1. Trusting client-passed user id or groups in production.
2. Accidentally loading admin-only user data on normal wiki page loads.
3. Breaking section or group authorization during schema or storage migration.
4. Losing revision approval metadata during data migration.
5. Keeping hidden coupling to the demo shell through `currentUser` shape or `onIdentityDataChange` semantics.