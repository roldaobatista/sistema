---
name: permission-completeness
description: Ensures every CRUD operation has complete permission coverage - from seeder to middleware to controller to frontend gate. No permission gaps.
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0
priority: CRITICAL
trigger: always_on
---

# Permission Completeness - Zero Authorization Gaps

> **CRITICAL SKILL (ALWAYS ON)** - Every action in the system MUST have complete permission coverage. From database seeder → middleware → controller check → frontend gate. A missing permission at ANY level is a security hole or a broken feature.

---

## 🎯 Core Principles

| Principle | Rule |
|-----------|------|
| **Full Stack Coverage** | Permission must exist in: Seeder → Middleware → Controller → Frontend |
| **Deny by Default** | If not explicitly permitted, deny access |
| **Consistent Naming** | Follow the pattern: `module.action` (e.g., `workorder.create`) |
| **UI Reflects Permissions** | Buttons/links MUST be hidden if user lacks the permission |
| **No Orphan Permissions** | Every permission in seeder MUST be used in code and vice versa |

---

## 🔴 Permission Lifecycle (MANDATORY)

### For Every New CRUD Endpoint

When creating or modifying a module, ALL 5 layers MUST be implemented:

```text
Layer 1: SEEDER → Create the permission in the database
Layer 2: ROUTE → Apply middleware to the route
Layer 3: CONTROLLER → Check permission in the method
Layer 4: FRONTEND API → Send proper headers/handle 403
Layer 5: FRONTEND UI → Hide elements user can't access
```

### Standard Permission Set per Module

| Permission Name | Action | Where Used |
|----------------|--------|------------|
| `module.index` | List/view all records | Index route, menu visibility |
| `module.show` | View single record | Show route, detail page |
| `module.create` | Create new record | Store route, "New" button |
| `module.update` | Edit existing record | Update route, "Edit" button |
| `module.delete` | Delete record | Destroy route, "Delete" button |
| `module.export` | Export data | Export route, "Export" button |
| `module.approve` | Approve/reject (if applicable) | Special action routes |

### Example: Complete Permission Implementation

#### Layer 1: Seeder

```php
// database/seeders/PermissionSeeder.php
$permissions = [
    // Work Orders
    'workorder.index',
    'workorder.show',
    'workorder.create',
    'workorder.update',
    'workorder.delete',
    'workorder.export',
    'workorder.approve',
];

foreach ($permissions as $permission) {
    Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'api']);
}
```

#### Layer 2: Routes

```php
// routes/api.php
Route::middleware(['auth:sanctum', 'permission:workorder.index'])->get('/work-orders', [WorkOrderController::class, 'index']);
Route::middleware(['auth:sanctum', 'permission:workorder.create'])->post('/work-orders', [WorkOrderController::class, 'store']);
Route::middleware(['auth:sanctum', 'permission:workorder.show'])->get('/work-orders/{id}', [WorkOrderController::class, 'show']);
Route::middleware(['auth:sanctum', 'permission:workorder.update'])->put('/work-orders/{id}', [WorkOrderController::class, 'update']);
Route::middleware(['auth:sanctum', 'permission:workorder.delete'])->delete('/work-orders/{id}', [WorkOrderController::class, 'destroy']);
```

#### Layer 3: Controller (Defense in Depth)

```php
// app/Http/Controllers/WorkOrderController.php
public function store(StoreWorkOrderRequest $request)
{
    // Double-check even with middleware (defense in depth)
    $this->authorize('workorder.create');

    // ... create logic
}
```

#### Layer 4: Frontend API (Handle 403)

```typescript
// services/workOrderService.ts
try {
    const response = await api.post('/work-orders', data);
    return response.data;
} catch (error) {
    if (error.response?.status === 403) {
        toast.error('You do not have permission to create work orders.');
        return;
    }
    throw error;
}
```

#### Layer 5: Frontend UI (Conditional Render)

```tsx
// components/WorkOrderList.tsx
const { user } = useAuth();

return (
    <>
        {user.can('workorder.create') && (
            <Button onClick={handleCreate}>New Work Order</Button>
        )}

        <DataTable
            actions={(row) => (
                <>
                    {user.can('workorder.update') && (
                        <EditButton onClick={() => handleEdit(row.id)} />
                    )}
                    {user.can('workorder.delete') && (
                        <DeleteButton onClick={() => handleDelete(row.id)} />
                    )}
                </>
            )}
        />
    </>
);
```

---

## 🧠 Permission Gap Detection Protocol

### How to Find Missing Permissions

```text
1. CHECK SEEDER:
   - List all permissions in PermissionSeeder
   - For each module, verify all CRUD permissions exist
   - Flag: Permission used in code but NOT in seeder = CRITICAL BUG

2. CHECK ROUTES:
   - List all API routes (php artisan route:list)
   - For each route, verify permission middleware exists
   - Flag: Route without permission = SECURITY HOLE

3. CHECK CONTROLLERS:
   - For each controller method, verify authorize() or middleware
   - Flag: Controller method without auth check = SECURITY HOLE

4. CHECK FRONTEND:
   - For each action button, verify permission gate
   - Flag: Button visible without permission check = UX BUG
   - Flag: Button hidden but no API 403 handling = INCOMPLETE

5. CHECK MENU/NAVIGATION:
   - For each menu item, verify permission gate
   - Flag: Menu visible without permission = NAVIGATION BUG
```

---

## 🚨 Common Permission Gaps

| Gap | Detection | Fix |
|-----|-----------|-----|
| Permission not in seeder | Controller checks `workorder.create` but seeder doesn't have it | Add to PermissionSeeder |
| Route without middleware | Route accessible without auth | Add `permission:module.action` middleware |
| Button always visible | Delete button shown to all users | Wrap with `user.can()` check |
| Menu always visible | Module in sidebar for all users | Wrap with permission check |
| No 403 handling | Frontend doesn't handle forbidden response | Add 403 case to catch block |
| Inconsistent naming | `workorder.create` vs `work-order.create` | Standardize to dot notation, singular |
| Service-level bypass | Service called directly without auth | Add auth check in service or use policy |

---

## 📐 Naming Convention (MANDATORY)

```text
Format: {module}.{action}

Module: lowercase, singular, no hyphens
  ✅ workorder, customer, quote, expense
  ❌ work-order, Work_Order, customers

Action: standard CRUD or custom
  ✅ index, show, create, update, delete, export, approve, reject
  ❌ list, view, add, edit, remove

Examples:
  workorder.create
  customer.index
  quote.approve
  expense.delete
  report.export
  commission.calculate
```

---

## 🔴 Self-Check Before Completing (MANDATORY)

| Check | Question |
|-------|----------|
| ✅ **Seeder complete?** | All permissions for the module exist in PermissionSeeder? |
| ✅ **Routes protected?** | All API routes have permission middleware? |
| ✅ **Controller secured?** | All controller methods have authorize() or middleware? |
| ✅ **403 handled?** | Frontend handles forbidden responses gracefully? |
| ✅ **UI gated?** | Buttons/links hidden when user lacks permission? |
| ✅ **Menu gated?** | Navigation items hidden when lacking permission? |
| ✅ **Names consistent?** | Permissions follow `module.action` convention? |
| ✅ **No orphans?** | Every permission in seeder is used + every used permission is in seeder? |

> 🔴 **ABSOLUTE RULE:** A feature is NOT complete if a user can see a button they can't use, or if a route is accessible without authorization.

---

## Summary

| Do | Don't |
|----|-------|
| Create permissions in seeder + middleware + controller + UI | Only add middleware and forget the seeder |
| Hide UI elements user can't access | Show buttons that return 403 |
| Handle 403 errors with friendly messages | Let forbidden errors show as generic errors |
| Follow `module.action` naming convention | Use inconsistent naming across modules |
| Check all 5 layers for every new endpoint | Skip layers assuming others will catch it |
| Audit permissions when modifying a module | Assume existing permissions are complete |

> **Remember: A permission system is only as strong as its weakest layer. One missing middleware, one missing seeder entry, one visible button — and the entire authorization model breaks.**
