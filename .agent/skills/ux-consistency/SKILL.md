---
name: ux-consistency
description: Ensures consistent UX patterns across all modules. Same form behavior, same table patterns, same feedback mechanisms, same interaction patterns everywhere.
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0
priority: HIGH
trigger: always_on
---

# UX Consistency - Same Patterns, Every Module

> **HIGH PRIORITY SKILL (ALWAYS ON)** - Every module MUST follow the same UX patterns. Users should never feel like different parts of the app were built by different teams. Consistency = trust.

---

## 🎯 Core Principles

| Principle | Rule |
|-----------|------|
| **Pattern Once, Use Everywhere** | Define a UX pattern once and apply it consistently |
| **No Surprises** | Users should predict how things work from experience with other modules |
| **Same Actions, Same Feedback** | Create = toast success. Delete = confirm + toast. Error = toast error. Always. |
| **Visual Consistency** | Same button colors, same spacing, same typography everywhere |
| **Interaction Consistency** | Same form behavior, same table behavior, same modal behavior |

---

## 📋 Standard UI Patterns (MANDATORY)

### List Pages (All Modules)

Every list/index page MUST have:

| Element | Standard | Notes |
|---------|----------|-------|
| **Page Title** | Module name + record count | "Work Orders (42)" |
| **Create Button** | Top-right, primary color | "New Work Order" or "+ New" |
| **Search Bar** | Top-left, instant filter | Search across main fields |
| **Filters** | Below search or in dropdown | Status, date range, category |
| **Data Table** | Sortable columns, zebra striping | Consistent column order |
| **Pagination** | Bottom of table | Show total + per page selector |
| **Row Actions** | Right side of each row | View, Edit, Delete (icons or dropdown) |
| **Empty State** | Centered, with illustration/icon | "No records found" + create button |
| **Loading State** | Skeleton rows or spinner | Never blank page during load |
| **Bulk Actions** | Checkbox column + action bar | If applicable |

### Create/Edit Forms (All Modules)

Every form MUST follow:

| Element | Standard | Notes |
|---------|----------|-------|
| **Layout** | Consistent field order | Required fields first, optional after |
| **Labels** | Above fields, clear text | Never placeholder-only |
| **Required Fields** | Marked with asterisk (*) | Or "required" text |
| **Validation** | Client-side + server-side | Show inline errors below fields |
| **Submit Button** | Bottom-right, primary color | "Save" / "Create" / "Update" |
| **Cancel Button** | Next to submit, secondary style | Returns to list |
| **Loading on Submit** | Button disabled + spinner | Prevent double-submit |
| **Success** | Toast notification + redirect to list | "Record created successfully" |
| **Error** | Toast for general, inline for field-specific | Never silent failure |

### Delete Confirmation (All Modules)

Every delete action MUST follow:

```text
1. User clicks delete → Confirmation dialog appears
2. Dialog shows: "Are you sure you want to delete [record name]?"
3. Dialog has: "Cancel" (secondary) + "Delete" (danger/red)
4. On confirm → API call with loading state
5. On success → Toast "Record deleted" + list refreshes
6. On error → Toast with error message
```

### Detail/View Pages (All Modules)

| Element | Standard |
|---------|----------|
| **Header** | Record identifier + status badge |
| **Actions** | Edit, Delete, special actions in header |
| **Content** | Organized in sections/cards |
| **Related Data** | Tabs or accordion for child records |
| **Back Link** | Return to list page |

---

## 🎨 Feedback Patterns (MANDATORY)

### Toast Notifications

| Action | Type | Message Pattern |
|--------|------|----------------|
| Create success | ✅ Success (green) | "[Entity] created successfully" |
| Update success | ✅ Success (green) | "[Entity] updated successfully" |
| Delete success | ✅ Success (green) | "[Entity] deleted successfully" |
| Validation error | ⚠️ Warning (yellow) | "Please check the form fields" |
| Permission denied | 🔴 Error (red) | "You don't have permission for this action" |
| Server error | 🔴 Error (red) | "An error occurred. Please try again" |
| Network error | 🔴 Error (red) | "Connection failed. Check your internet" |

### Loading States

| Context | Pattern |
|---------|---------|
| **Page load** | Skeleton screens (preferred) or centered spinner |
| **Form submit** | Button disabled + spinner inside button |
| **Table refresh** | Subtle loading bar on top of table |
| **Delete action** | Row or button showing loading |
| **File upload** | Progress bar with percentage |

### Empty States

```text
Every empty state MUST have:
1. An icon or illustration (not just text)
2. A clear message: "No [entities] found"
3. A helpful action: "Create your first [entity]" button
4. If filtered: "No results for your search. Try different filters"
```

---

## 📐 Table Column Standards

### Standard Column Order

```text
For any entity table:
1. ID / Code (if applicable)
2. Primary identifier (name, title, number)
3. Related entity (customer name, technician)
4. Status (with badge/chip)
5. Key metrics (total, quantity, date)
6. Timestamps (created_at, updated_at) — optional
7. Actions (view, edit, delete) — always last
```

### Status Badges

| Status | Color | Example |
|--------|-------|---------|
| Draft / Pending | Gray / Blue | Awaiting action |
| Active / In Progress | Blue / Indigo | Currently being handled |
| Approved / Confirmed | Green | Positive state |
| Completed / Paid | Dark Green / Teal | Finished successfully |
| Cancelled / Rejected | Red | Negative outcome |
| Overdue / Urgent | Orange / Red | Needs attention |

---

## 🔄 Form Behavior Standards

### Field Interaction

| Pattern | Standard |
|---------|----------|
| **Date fields** | Date picker component, never free text |
| **Currency fields** | Mask with 2 decimals, right-aligned |
| **Select fields** | Dropdown with search for long lists |
| **Boolean fields** | Toggle switch, not checkbox |
| **File upload** | Drag & drop area + file browser button |
| **Multi-select** | Chip/tag style selection |
| **Long text** | Textarea with character count |

### Form Reset Behavior

```text
After successful create → Clear form OR redirect to list (consistent per app)
After successful edit → Redirect to list or detail (consistent per app)
After cancel → Return to previous page (no unsaved data prompt unless dirty)
```

---

## 🔴 Self-Check Before Completing (MANDATORY)

| Check | Question |
|-------|----------|
| ✅ **List page complete?** | Has search, filters, pagination, empty/loading states? |
| ✅ **Form consistent?** | Labels, validation, submit/cancel behave like other modules? |
| ✅ **Delete confirmed?** | Delete shows confirmation dialog before action? |
| ✅ **Toasts correct?** | Success = green, error = red, consistent messages? |
| ✅ **Loading states?** | Skeleton on page, spinner on button, never blank? |
| ✅ **Empty states?** | Friendly message with icon when no data? |
| ✅ **Status badges?** | Colors follow the standard pattern? |
| ✅ **Table order?** | Columns follow standard order? Actions always last? |
| ✅ **Same as others?** | Does this module feel identical in UX to existing ones? |

> 🔴 **Rule:** If a user can tell which module was built by which developer/AI session, you FAILED at consistency.

---

## Summary

| Do | Don't |
|----|-------|
| Use the same toast patterns everywhere | Invent new feedback for each module |
| Use consistent table column order | Put actions in random positions |
| Use confirmation before destructive actions | Delete without asking |
| Show loading/empty/error states | Leave blank screens |
| Follow the same form layout pattern | Build each form differently |
| Use standardized status badge colors | Random colors for statuses |

> **Remember: Consistency is NOT boring — it's trust. When every module behaves the same way, users learn ONCE and apply EVERYWHERE. That's the hallmark of a professional application.**
