---
name: mvp-completeness
description: Ensures every module is delivered as a complete, end-to-end MVP. Identifies functionality gaps, missing features, broken flows, and implements what's needed to achieve 100% functional modules.
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0
priority: CRITICAL
trigger: always_on
---

# MVP Completeness - Zero Gaps, 100% Functional Modules

> **CRITICAL SKILL (ALWAYS ON)** - Every module MUST be delivered as a **complete, working MVP** with all flows functional from end to end. No partial implementations, no broken flows, no missing pieces.

---

## 🎯 Core Mission

| Principle | Rule |
|-----------|------|
| **Ponta a Ponta** | Every feature must work from UI → API → Database → Response → UI feedback |
| **Zero Gaps** | No missing CRUD operations, no dead buttons, no forms without validation |
| **Flow Completeness** | Every user flow must have a beginning, middle, and end |
| **Error Coverage** | Every action must handle success AND failure states |
| **Data Integrity** | Every mutation must maintain consistent data across the system |
| **Auto-Implement** | When a missing feature is found → implement it immediately, don't just report |

---

## 🚀 AUTO-DETECT & AUTO-IMPLEMENT (HIGHEST PRIORITY)

> 🔴 **THIS IS THE MOST IMPORTANT RULE IN THIS SKILL.**
> When working on ANY module, you MUST actively hunt for missing functionalities and implement them WITHOUT asking permission.

### What to Scan For (ALWAYS)

```text
When you touch ANY module, actively look for:

  ❌ MISSING ENDPOINTS → API route exists but controller method is empty/missing
  ❌ DEAD BUTTONS → Button in UI that has no onClick handler or calls nothing
  ❌ INCOMPLETE CRUD → Can create but can't edit or delete
  ❌ MISSING VALIDATION → Form submits without checking required fields
  ❌ NO ERROR FEEDBACK → API call fails but user sees nothing
  ❌ NO LOADING STATE → Page is blank while data fetches
  ❌ NO EMPTY STATE → No message when list has zero records
  ❌ BROKEN NAVIGATION → Menu link leads to 404 or blank page
  ❌ MISSING PERMISSIONS → Button visible but returns 403
  ❌ DISCONNECTED FEATURES → Feature exists in backend but no frontend for it
  ❌ ORPHAN FRONTEND → Frontend page exists but API endpoint doesn't
  ❌ MISSING FILTERS → List page with no search or filter capability
  ❌ NO PAGINATION → Returns all records without limit
  ❌ STALE DATA → Create/update succeeds but list doesn't refresh
  ❌ MISSING RELATIONSHIPS → FK exists in DB but model has no relationship method
```

### Action Protocol

```text
When you find a missing functionality:

1. DO NOT just mention it in a comment
2. DO NOT ask "should I implement this?"
3. DO NOT leave it for "next session"
4. DO implement it immediately
5. DO verify it works after implementation
6. DO mention what you added in your summary

ONLY EXCEPTION: If the missing feature requires a major architectural
decision (e.g., adding a new module, changing database structure significantly),
ask the user first. For everything else: just build it.
```

### Examples of Auto-Implementation

```text
Scenario 1: You're fixing a bug in WorkOrderController@store
  → You notice WorkOrderController has no `destroy` method
  → AUTO-IMPLEMENT: Add destroy method with auth check + frontend delete button

Scenario 2: You're adding a field to CustomerForm
  → You notice the form has no validation messages
  → AUTO-IMPLEMENT: Add validation for all fields + inline error display

Scenario 3: You're debugging the Quote list page
  → You notice there's no search/filter functionality
  → AUTO-IMPLEMENT: Add search bar + status filter + date range filter

Scenario 4: You're working on the Expense module
  → You notice expenses can be created but there's no edit page
  → AUTO-IMPLEMENT: Add edit form + update endpoint + route
```

---

## 🔍 Module Completeness Checklist (MANDATORY)

> 🔴 **Before marking ANY module as "done", verify ALL items below.**

### Backend Checklist

| Check | What to Verify |
|-------|---------------|
| **Model** | All fields defined, relationships correct, fillable/guarded set |
| **Migration** | Table exists, all columns present, indexes on FK/search fields |
| **Controller** | All CRUD endpoints (index, store, show, update, destroy) implemented |
| **Routes** | All endpoints registered with proper middleware and permissions |
| **Validation** | FormRequest or inline validation on ALL store/update endpoints |
| **Permissions** | All permissions created in seeders AND checked in controllers |
| **Service Layer** | Business logic extracted from controller when complex |
| **Relationships** | All foreign keys have proper cascading (onDelete, onUpdate) |
| **Filters/Search** | List endpoints support search, pagination, and relevant filters |
| **Error Handling** | try/catch on critical operations, proper HTTP status codes |

### Frontend Checklist

| Check | What to Verify |
|-------|---------------|
| **List Page** | Table with data, pagination, search, filters, action buttons |
| **Create Form** | All required fields, validation messages, submit working |
| **Edit Form** | Pre-populated data, update working, validation messages |
| **Delete Action** | Confirmation dialog, delete working, list refreshes |
| **View/Detail** | Show page or modal with complete data display |
| **Loading States** | Skeleton/spinner while fetching data |
| **Empty States** | Friendly message when no data exists |
| **Error States** | Toast/alert on API errors with user-friendly messages |
| **Success Feedback** | Toast/notification on successful create/update/delete |
| **Navigation** | Menu item exists, routes registered, breadcrumbs if applicable |

### Integration Checklist

| Check | What to Verify |
|-------|---------------|
| **API ↔ Frontend** | All API calls match expected request/response format |
| **Types/Interfaces** | TypeScript types match API response structure |
| **Auth/Permissions** | UI elements hidden when user lacks permission |
| **Cross-Module** | Related modules updated when parent data changes |
| **Sidebar/Menu** | Module accessible from main navigation |

---

## 🧠 Gap Detection Protocol (HOW TO FIND GAPS)

> 🔴 **MANDATORY:** When working on ANY module, run this mental protocol.

### Step 1: Trace the User Journey

```
For each entity in the module:
  1. Can the user CREATE a new record? (form → API → database → confirmation)
  2. Can the user VIEW/LIST records? (table → pagination → search → filters)
  3. Can the user EDIT a record? (load data → edit → save → confirmation)
  4. Can the user DELETE a record? (confirm → API → database → list refresh)
  5. Are there SPECIAL ACTIONS? (approve, reject, export, import, etc.)
```

### Step 2: Trace the Data Flow

```
For each API endpoint:
  1. Is the ROUTE registered? → Check routes file
  2. Does the CONTROLLER method exist? → Check controller
  3. Is there VALIDATION? → Check FormRequest or inline rules
  4. Is there AUTHORIZATION? → Check middleware/permissions
  5. Does the FRONTEND call it correctly? → Check service/API file
  6. Does the FRONTEND handle the response? → Check component
```

### Step 3: Trace Error Scenarios

```
For each action:
  1. What if the API returns 422 (validation error)? → Show field errors
  2. What if the API returns 403 (forbidden)? → Show permission message
  3. What if the API returns 500 (server error)? → Show generic error
  4. What if the network is offline? → Handle timeout
  5. What if data is empty? → Show empty state
```

---

## 🚨 Common Gaps to Watch For

### Backend Gaps

| Gap | Detection | Fix |
|-----|-----------|-----|
| Missing `destroy` method | Controller has index/store/update but no destroy | Add destroy method with proper authorization |
| No validation on `update` | StoreRequest exists but no UpdateRequest | Create UpdateRequest or reuse StoreRequest |
| Hardcoded tenant | Direct DB queries without tenant scope | Use model scopes or middleware |
| Missing permissions in seeder | Controller checks permission that doesn't exist | Add to permission seeder |
| No pagination on `index` | Returns `Model::all()` instead of paginated | Use `->paginate()` |
| Missing search/filter | Index returns all records, no filter support | Add query parameters for search/filter |
| Broken relationships | Model defines relation but FK doesn't exist | Add migration or fix relationship |

### Frontend Gaps

| Gap | Detection | Fix |
|-----|-----------|-----|
| Dead buttons | Button exists but onClick does nothing | Wire up handler + API call |
| No loading state | Data fetches but UI shows nothing during load | Add loading skeleton/spinner |
| Missing form validation | Form submits without client-side checks | Add validation before submit |
| No error handling | API call inside try/catch but catch is empty | Show toast/alert with error message |
| Stale data after mutation | Create/update succeeds but list doesn't refresh | Invalidate query cache or refetch |
| Missing route | Menu link points to undefined route | Add route in router config |
| Untyped API response | `any` type on API response data | Create proper TypeScript interface |
| No delete confirmation | Delete button directly calls API | Add confirmation dialog |

---

## ⚡ Implementation Rules

### Rule 1: Complete Before Moving On

```
❌ WRONG: Implement 5 modules at 60% each
✅ CORRECT: Implement 1 module at 100%, then move to next
```

### Rule 2: Always Close the Loop

```
❌ WRONG: Create API endpoint → Move to next feature
✅ CORRECT: Create API endpoint → Create frontend call → Wire to UI → Test flow → Handle errors → Done
```

### Rule 3: Test the Happy Path AND the Sad Path

```
❌ WRONG: Verify create works → Done
✅ CORRECT: Verify create works → Verify validation errors show → Verify permission denied shows → Done
```

### Rule 4: Fix What You Find

```
❌ WRONG: Notice a missing delete action → Ignore it, wasn't asked
✅ CORRECT: Notice a missing delete action → Flag it → Implement it → Verify it
```

### Rule 5: Cross-Reference Dependencies

```
When editing Module A, always check:
- Does Module B depend on Module A's data?
- Does deleting a record in A break references in B?
- Are cascade rules properly defined?
```

---

## 🔗 Dependency Chain Completeness (MANDATORY)

> 🔴 **CRITICAL RULE:** When working on Module X, you MUST also verify and complete ALL modules in its dependency chain. A module is NOT isolated — if its dependencies are broken, the module is broken.

### Dependency Analysis Protocol

```text
When starting work on ANY module:

1. MAP UPSTREAM (modules that Module X DEPENDS ON):
   - What data does Module X read from other modules?
   - What APIs does Module X call from other modules?
   - What foreign keys does Module X reference?
   → Verify ALL upstream modules provide what Module X needs

2. MAP DOWNSTREAM (modules that DEPEND ON Module X):
   - Who reads Module X's data?
   - Who calls Module X's APIs?
   - Who references Module X's tables via FK?
   → Verify ALL downstream modules still work after changes

3. VERIFY CONNECTIONS:
   - Are all foreign keys valid and pointing to existing columns?
   - Are all API calls returning the expected response format?
   - Are all shared types/interfaces consistent?
   - Are all cross-module navigations (links, redirects) working?

4. FIX BROKEN CHAINS:
   - If upstream module is missing an endpoint Module X needs → CREATE IT
   - If downstream module breaks after Module X changes → FIX IT
   - If a relationship has no cascade rule → ADD IT
   - If a cross-module link is dead → WIRE IT UP
```

### Common Dependency Patterns

| Module A | Depends On | Connection Point |
|----------|-----------|-----------------|
| Work Orders | Customers, Products, Technicians | FK: customer_id, items.product_id, technician_id |
| Quotes | Customers, Products | FK: customer_id, items.product_id |
| Invoices | Work Orders, Customers | FK: work_order_id, customer_id |
| Commissions | Technicians, Work Orders | FK: technician_id, work_order_id |
| Expenses | Users, Categories | FK: user_id, category_id |
| Service Calls | Customers, Technicians | FK: customer_id, technician_id |
| Stock | Products, Work Orders | FK: product_id, triggers on WO items |

> 🔴 **Example:** If you're fixing the **Work Orders** module and find that the **Products** module doesn't return stock quantities in the API, you MUST add that field to the Products API response — don't leave a broken dependency.

### Dependency Chain Rules

| Rule | Description |
|------|-------------|
| **Never Leave Broken Links** | If Module A calls Module B's API and it returns 404 → fix Module B's route |
| **Cascade Changes** | If you change Module A's response format → update ALL modules that consume it |
| **Shared Data Consistency** | If two modules display the same data → they must use the same source of truth |
| **Cross-Module Navigation** | If Module A has a link to Module B → verify Module B's route exists and works |
| **Permission Chains** | If Module A creates data used in Module B → verify permissions exist for both |

### Dependency Verification Checklist

```text
Before completing work on Module X, answer:
  ✅ Do ALL upstream modules provide the data/APIs Module X needs?
  ✅ Do ALL downstream modules still work correctly?
  ✅ Are ALL foreign keys valid with proper cascade rules?
  ✅ Are ALL cross-module API calls returning expected formats?
  ✅ Are ALL cross-module links/navigations functional?
  ✅ Are ALL shared TypeScript types/interfaces synchronized?
  ✅ Did I test the FULL chain, not just Module X in isolation?
```

> 🔴 **ABSOLUTE RULE:** A module is complete ONLY when its entire dependency chain is complete. Fixing Module X while leaving Module Y (which depends on X) broken = **TASK NOT COMPLETE**.

---

## 🔴 Self-Check Before Completing (MANDATORY)

> **Before saying ANY module task is complete, verify:**

| Check | Question |
|-------|----------|
| ✅ **CRUD Complete?** | Can user Create, Read, Update, Delete all entities? |
| ✅ **Forms Work?** | All forms validate, submit, and show feedback? |
| ✅ **Lists Work?** | Tables paginate, search, filter, and show actions? |
| ✅ **Errors Handled?** | API errors show user-friendly messages? |
| ✅ **Permissions Set?** | All permissions exist in DB and checked in code? |
| ✅ **Navigation Works?** | User can reach the module from the menu? |
| ✅ **Types Correct?** | TypeScript types match API response? |
| ✅ **No Dead Code?** | No unreachable buttons, unused routes, empty handlers? |
| ✅ **Data Consistent?** | Mutations don't leave orphaned or inconsistent data? |
| ✅ **Tests Exist?** | At least basic feature/integration tests for main flows? |

> 🔴 **Rule:** If ANY check fails, **FIX IT** before completing the task. No exceptions.

---

## 📋 Gap Report Template

When gaps are found, report them to the user in this format:

```markdown
## 🔍 Gap Analysis: [Module Name]

### ❌ Critical Gaps (Blocks Usage)
- [ ] [Description of gap + which file is affected]

### ⚠️ Important Gaps (Degrades Experience)
- [ ] [Description of gap + which file is affected]

### 💡 Enhancement Gaps (Nice to Have)
- [ ] [Description of gap + which file is affected]

### 📊 Completeness Score: X/10
```

> **After reporting:** Ask user if they want ALL gaps fixed or only Critical/Important ones.

---

## Summary

| Do | Don't |
|----|-------|
| Complete every CRUD flow end-to-end | Leave partial implementations |
| Handle all error states | Ignore error scenarios |
| Verify navigation and permissions | Assume they work |
| Fix gaps immediately when found | Log them for "later" |
| Test both happy and sad paths | Only test the happy path |
| Close every loop (UI → API → DB → UI) | Leave disconnected pieces |
| Report gaps transparently | Hide incomplete work |

> **Remember: A module is NOT done until a user can perform EVERY action from start to finish without hitting a dead end, a broken button, or a missing page.**
