# Wiki Porting Implementation Plan

This document turns the high-level checklist in [PORTING_CHECKLIST.md](PORTING_CHECKLIST.md) into a file-by-file implementation plan for this codebase.

## Scope

Target assumptions captured from the current porting notes:

1. The wiki will render as an embedded panel under the host app's main nav/header.
2. Wiki GraphQL fields and resolvers will live directly in the host schema.
3. Uploads will write to `$dataDir/wikiAssets` instead of the current local dev upload path.
4. Wiki groups will map to existing directory or authorization groups in the host platform.
5. The host app will provide the current user id and current user groups.
6. User directory data should load only inside the admin manage experience.

## Delivery Strategy

Implement the port in four phases:

1. Decouple the React wiki from demo identity.
2. Isolate admin-only user loading.
3. Replace standalone transport and backend integration.
4. Remove demo-only files after production cutover.

## File-by-File Plan

### [src/App.jsx](src/App.jsx)

Current role:
Demo shell that loads wiki users and groups, lets the user switch identity, derives `currentUser`, and renders the wiki.

Production target:
This file should not survive in its current form. The host application should own identity and shell layout.

Implementation steps:

1. Remove `loadIdentityData`, `handleSwitchUser`, and all localStorage identity management.
2. Remove the signed-in-as selector and role or group banner UI.
3. Stop calling `wikiApi.getWikiUsers()` during initial render.
4. Stop deriving `currentUser` from a loaded user list.
5. Replace the current wiki mount with either:
   1. A minimal demo adapter for local development only, or
   2. A host-facing wrapper component that accepts `currentUserId`, `currentUserGroups`, and `isAdmin` as props.
6. If this repository remains a standalone dev harness, rename its purpose explicitly to `WikiDemoShell` behavior rather than production app behavior.

Suggested end state:

1. Either delete this file after integration.
2. Or reduce it to a thin adapter that passes host-provided props into the wiki feature.

Acceptance criteria:

1. No user directory load occurs when the app starts.
2. No demo user switching remains.
3. The wiki renders only from externally supplied identity props.

### [src/main.jsx](src/main.jsx)

Current role:
Bootstraps the demo React app.

Production target:
The host application should mount the wiki module inside its own routing and layout tree.

Implementation steps:

1. Stop treating this file as the production entrypoint.
2. If the repo stays runnable as a standalone sandbox, keep `main.jsx` only for local demo and testing.
3. In the host app, create a dedicated route or panel entry that mounts the wiki wrapper component.

Acceptance criteria:

1. Production integration does not depend on this file.
2. If retained, this file is clearly demo-only.

### [src/Wiki.jsx](src/Wiki.jsx)

Current role:
Contains the main wiki UI, permission helpers, admin panel, page viewer, editor, approval flows, and data loading.

Production target:
This becomes the core reusable feature component. It should be identity-aware only through explicit props, not through internal user bootstrapping.

Implementation steps:

1. Change the exported component contract from:
   1. `currentUser`
   2. `users`
   3. `groups`
   4. `onIdentityDataChange`
   to a production-oriented contract such as:
   1. `currentUserId`
   2. `currentUserGroups`
   3. `isAdmin`
   4. `groups`
   5. `loadAdminUsers`
   6. `api`
2. Replace all `currentUser.id` usages with `currentUserId`.
3. Replace all `currentUser.groups` usages with `currentUserGroups`.
4. Replace all `currentUser.isAdmin` usages with `isAdmin`.
5. Refactor helper functions like `hasGroupAccess` and `canApprovePageReview` to accept primitive identity inputs instead of the current user object.
6. Remove any assumption that identity can be refreshed from inside the wiki.
7. Keep page reads, page saves, approval, reject, and history loading independent from user-directory data.
8. Move admin-only user loading behind the admin panel boundary.
9. Make `AdminPanel` request users lazily only when the group-membership editor is needed.
10. Keep group and section configuration available without loading the full user directory unless the admin is editing members.

Recommended internal refactor:

1. Introduce a `wikiIdentity` object near the top of the component with:
   1. `currentUserId`
   2. `currentUserGroups`
   3. `isAdmin`
2. Pass that object, or just primitives, to subcomponents instead of the full current user model.
3. Split admin-only code paths from regular reading or editing code paths.

Acceptance criteria:

1. The main wiki feature renders without a `users` prop.
2. Non-admin page browsing never loads user-directory data.
3. All permission checks still behave the same for read, write, review, and approval.

### [src/wikiApi.js](src/wikiApi.js)

Current role:
Hardcoded GraphQL client and upload helper with direct fetch calls to the standalone server.

Production target:
This should become an adapter boundary, not a hardcoded transport implementation.

Implementation steps:

1. Remove hardcoded `API_URL` and `ASSET_URL` constants.
2. Remove `getCurrentWikiUserId` and any localStorage-based user fallback logic.
3. Stop implicitly injecting `X-User-ID` from the wiki client unless the host platform explicitly requires it.
4. Convert this module into one of these shapes:
   1. A factory: `createWikiApi({ graphqlRequest, uploadAsset })`
   2. A thin wrapper over a host-provided Apollo client
   3. A host-owned integration module outside this repo
5. Keep the public wiki data methods roughly stable so `Wiki.jsx` can migrate incrementally.
6. For admin-only user loading, expose a dedicated `getWikiUsers` call that is invoked only from admin code paths.
7. Change upload behavior to use the host upload implementation and return the same normalized asset payload shape expected by the editor.

Acceptance criteria:

1. This module contains no hardcoded dev server URLs.
2. This module contains no identity fallback behavior.
3. Transport can be supplied by the host app.

### [src/wikiMarkdown.jsx](src/wikiMarkdown.jsx)

Current role:
Markdown rendering helper.

Production target:
Likely reusable with minimal changes.

Implementation steps:

1. Review whether the host app already has a markdown rendering stack or sanitization policy.
2. Align allowed markdown or HTML behavior with host security rules.
3. Confirm whether asset URLs, links, and code blocks behave correctly inside the host app shell.

Acceptance criteria:

1. Rendering behavior matches the host app's content security expectations.
2. No host styling conflict breaks markdown output.

### [src/Wiki.css](src/Wiki.css)

Current role:
Contains the wiki-specific UI styling.

Production target:
Either keep as feature-scoped CSS or gradually map to the host design system.

Implementation steps:

1. Review class names for collisions with host styles.
2. Decide whether to keep this stylesheet or replace parts with host design-system components.
3. Remove layout assumptions that belong to the standalone shell rather than the embedded wiki panel.
4. Verify admin layouts, sidebar behavior, banners, and editor layouts inside the production container width.

Acceptance criteria:

1. The wiki renders correctly inside the host app shell.
2. Styling does not assume ownership of the full page chrome.

### [src/App.css](src/App.css)

Current role:
Styles the standalone demo shell around the wiki.

Production target:
Mostly removable.

Implementation steps:

1. Identify styles used only by the demo shell header, user selector, and page container.
2. Delete or isolate those styles from production integration.
3. Keep only styles required for local sandboxing, if this repo remains a development harness.

Acceptance criteria:

1. Production wiki integration does not depend on `App.css`.

### [src/index.css](src/index.css)

Current role:
Global base styles and resets for the standalone demo app.

Production target:
Use the host application's global style system instead.

Implementation steps:

1. Audit which global resets are safe to keep in a shared production app.
2. Remove wiki-owned global styles that could leak into unrelated host screens.
3. If necessary, scope baseline wiki styling more narrowly under a root wiki class.

Acceptance criteria:

1. The wiki feature does not impose global CSS behavior on the host app.

### [server/server.js](server/server.js)

Current role:
Standalone Express plus Apollo server that exposes wiki GraphQL types, resolvers, and an upload endpoint.

Production target:
Its logic should be split and moved into the host application's backend, not used as a standalone runtime.

Implementation steps:

1. Move the GraphQL type definitions into the host schema modules.
2. Move the resolvers into the host resolver structure.
3. Replace the current request-context identity model with the host app's authenticated request context.
4. Remove or adapt the `X-User-ID` header logic.
5. Replace `/wiki-assets` with the host upload integration.
6. Update upload path handling so assets are stored under `$dataDir/wikiAssets`.
7. Ensure user-directory queries are admin-scoped and not part of normal page reads.

Suggested backend split in the host app:

1. `wikiSchema.graphql` or equivalent host schema module
2. `wikiResolvers.ts/js`
3. `wikiUploadService.ts/js`
4. `wikiAuthorization.ts/js`

Acceptance criteria:

1. Host GraphQL exposes wiki operations without running this standalone server.
2. Host auth context determines user identity.
3. Uploads land in the configured production asset directory.

### [server/wikiDataController.js](server/wikiDataController.js)

Current role:
Implements wiki persistence, migration, permission checks, review flow, group management, and file-backed storage.

Production target:
Keep the business rules, replace the storage implementation.

Implementation steps:

1. Identify pure business rules worth preserving:
   1. `isPageReviewRequired`
   2. `getPageApproverGroups`
   3. admin fallback behavior
   4. approval and rejection semantics
   5. page review mode behavior
2. Extract those rules into host-compatible service functions.
3. Replace `loadData` and `saveData` with database or production repository calls.
4. Remove remaining development-only identity assumptions such as the static `IDENTITY_USERS` array.
5. Stop treating wiki group membership as wiki-owned if the host directory is authoritative.
6. Replace group normalization with mapping from production directory groups to wiki permission group names.
7. Preserve audit fields like `authorId`, `approvedBy`, `approvedAt`, `timestamp`, and review state.
8. Recreate the same behavior in a host service layer before deleting the dev controller.

Suggested host split:

1. `wikiService`
2. `wikiRepository`
3. `wikiAuthorization`
4. `wikiReviewService`

Acceptance criteria:

1. Business behavior remains intact.
2. No production path depends on `wiki.json`.
3. Identity and groups come from the host platform, not from this controller.

### [server/wiki.json](server/wiki.json)

Current role:
Development-only file-backed wiki content store.

Production target:
Development seed or migration input only.

Implementation steps:

1. Decide whether existing page and revision data must be migrated into production storage.
2. If yes, write a one-time import script rather than keeping this file on the runtime path.
3. Treat this file as seed content or fixture data only.
4. Do not use it as the production source of truth.

Acceptance criteria:

1. Production runtime does not read or write this file.

### [server/uploads](server/uploads)

Current role:
Local file storage for uploaded assets.

Production target:
Replace with `$dataDir/wikiAssets` or the host platform's preferred asset storage mechanism.

Implementation steps:

1. Define the production asset root.
2. Decide how URLs are generated for host-served assets.
3. Ensure the editor upload response shape stays consistent.
4. Add migration only if any existing local assets must be preserved.

Acceptance criteria:

1. Uploaded assets are stored in the host-approved location.
2. Existing markdown asset links continue to resolve after migration.

### [server/package.json](server/package.json)

Current role:
Standalone backend package for the local dev server.

Production target:
Likely removable after backend port.

Implementation steps:

1. Treat this package as development-only until backend migration is complete.
2. After porting resolvers and uploads into the host backend, delete or archive this package.

Acceptance criteria:

1. Production deployment does not depend on this package.

### [package.json](package.json)

Current role:
Frontend app scripts and dependencies for the standalone wiki demo.

Production target:
Keep only what the reusable wiki UI actually needs.

Implementation steps:

1. Remove dependencies that exist only for the standalone shell if they are not needed in the host app.
2. If this repo remains a local development harness, keep scripts for sandbox testing.
3. Decide whether the wiki will be consumed as source, package, or copied feature module inside the host repo.

Acceptance criteria:

1. Dependency ownership is clear between the wiki module and the host app.

### [README.md](README.md)

Current role:
General repository documentation.

Production target:
Document the new integration model.

Implementation steps:

1. Add a short section explaining that the current standalone app is a development harness.
2. Link to [PORTING_CHECKLIST.md](PORTING_CHECKLIST.md) and this file.
3. Document the runtime contract expected by the embedded wiki component.
4. Document how admin user loading differs from normal wiki usage.

Acceptance criteria:

1. New contributors understand which files are demo-only and which are production-targeted.

## New Files To Create In The Host Application

These files do not exist in this repo, but creating them in the host application will reduce risk.

### Host React integration wrapper

Suggested file:

1. `src/features/wiki/WikiPanel.jsx` or equivalent

Responsibilities:

1. Receive host identity props.
2. Create the host-specific wiki API adapter.
3. Pass `currentUserId`, `currentUserGroups`, `isAdmin`, and `loadAdminUsers` into the wiki feature.
4. Mount the wiki inside the host page layout.

### Host GraphQL adapter

Suggested file:

1. `src/features/wiki/wikiApiAdapter.js`

Responsibilities:

1. Wrap Apollo or host GraphQL transport.
2. Normalize wiki queries and mutations to the interface expected by the UI.
3. Keep upload integration out of the core UI.

### Host backend wiki service

Suggested files:

1. `server/wiki/wikiResolvers.js`
2. `server/wiki/wikiService.js`
3. `server/wiki/wikiRepository.js`
4. `server/wiki/wikiAuthorization.js`
5. `server/wiki/wikiUploadService.js`

Responsibilities:

1. Separate resolver wiring from business rules.
2. Keep authorization logic explicit and testable.
3. Centralize audit behavior.
4. Isolate persistence from transport.

## Recommended Execution Order

1. Create the host-facing React wrapper and define the new wiki component props.
2. Refactor [src/Wiki.jsx](src/Wiki.jsx) to use `currentUserId`, `currentUserGroups`, and `isAdmin`.
3. Strip demo identity behavior from [src/App.jsx](src/App.jsx).
4. Refactor [src/wikiApi.js](src/wikiApi.js) into an injectable adapter boundary.
5. Make admin user loading lazy inside `AdminPanel`.
6. Port schema and resolvers from [server/server.js](server/server.js) into the host backend.
7. Port business rules from [server/wikiDataController.js](server/wikiDataController.js) into host services backed by production storage.
8. Replace upload handling and asset storage.
9. Migrate any seed data or legacy assets needed from [server/wiki.json](server/wiki.json) and [server/uploads](server/uploads).
10. Remove or archive standalone demo-only files.

## First PR Breakdown

A low-risk first implementation PR should touch only the client-side integration contract.

1. Update [src/Wiki.jsx](src/Wiki.jsx) to consume primitive identity props.
2. Update [src/wikiApi.js](src/wikiApi.js) to remove localStorage identity fallback.
3. Update [src/App.jsx](src/App.jsx) to become a thin adapter or demo shell.
4. Leave backend behavior unchanged for that PR.

This isolates the largest UI contract change before the GraphQL and storage migration begins.