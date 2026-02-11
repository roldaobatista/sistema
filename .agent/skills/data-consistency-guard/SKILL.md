---
name: data-consistency-guard
description: Ensures every data mutation maintains consistency across the entire system. DB transactions, cache invalidation, audit trails, and orphan prevention.
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0
priority: CRITICAL
trigger: always_on
---

# Data Consistency Guard - No Orphans, No Stale Data

> **CRITICAL SKILL (ALWAYS ON)** - Every data mutation MUST maintain consistency across the entire system. No orphaned records, no stale cache, no inconsistent states between modules.

---

## 🎯 Core Principles

| Principle | Rule |
|-----------|------|
| **Atomic Operations** | Multi-step writes MUST succeed or fail as a unit (transactions) |
| **No Orphans** | Deleting a parent MUST handle all children (cascade or prevent) |
| **Single Source of Truth** | Same data MUST NOT be duplicated without sync mechanism |
| **Cache Coherence** | After mutation, all caches showing that data MUST be invalidated |
| **Audit Trail** | Critical data changes MUST be traceable (who, what, when, old→new) |

---

## 🔴 Database Transaction Rules (MANDATORY)

### When to Use Transactions

| Operation | Transaction Required? |
|-----------|----------------------|
| Single INSERT | ⚠️ Recommended |
| Single UPDATE | ⚠️ Recommended |
| INSERT + related records | ✅ MANDATORY |
| UPDATE + side effects | ✅ MANDATORY |
| DELETE with dependencies | ✅ MANDATORY |
| Batch operations | ✅ MANDATORY |
| Financial calculations | ✅ MANDATORY |
| Stock adjustments | ✅ MANDATORY |

### Transaction Pattern

```php
// ✅ CORRECT: Atomic multi-step operation
public function convertQuoteToWorkOrder(Quote $quote): WorkOrder
{
    return DB::transaction(function () use ($quote) {
        // 1. Create work order
        $workOrder = WorkOrder::create([...]);

        // 2. Copy items (deduct stock for each)
        foreach ($quote->items as $item) {
            $woItem = $workOrder->items()->create([...]);
            $this->stockService->deduct($item->product_id, $item->quantity);
        }

        // 3. Update quote status
        $quote->update(['status' => 'converted']);

        // All succeed or all fail
        return $workOrder;
    });
}
```

```php
// ❌ WRONG: Non-atomic - if step 3 fails, stock is already deducted
public function convertQuoteToWorkOrder(Quote $quote): WorkOrder
{
    $workOrder = WorkOrder::create([...]);
    foreach ($quote->items as $item) {
        $this->stockService->deduct($item->product_id, $item->quantity);
    }
    $quote->update(['status' => 'converted']); // If this fails, data is inconsistent
    return $workOrder;
}
```

---

## 🛡️ Deletion Safety (MANDATORY)

### Before Deleting ANY Record

```text
1. CHECK: Does this record have child/dependent records?
   - If YES with cascade: Ensure cascade rules are intentional
   - If YES without cascade: PREVENT deletion, return 409 with message
   - If NO: Safe to delete

2. CHECK: Is this record referenced by other modules?
   - Work Order → referenced by Invoices, Commissions
   - Customer → referenced by Quotes, Work Orders, Service Calls
   - Product → referenced by Quote Items, WO Items, Stock
   - Technician → referenced by WO assignments, Commissions, Service Calls

3. IMPLEMENT: Proper deletion strategy
```

### Deletion Strategies

| Strategy | When to Use | Implementation |
|----------|------------|----------------|
| **Cascade Delete** | Children are meaningless without parent | `onDelete('cascade')` in migration |
| **Restrict Delete** | Children must be handled first | `onDelete('restrict')` + check before delete |
| **Soft Delete** | Data must be recoverable | `SoftDeletes` trait + `deleted_at` column |
| **Nullify** | Keep child but remove reference | `onDelete('set null')` + nullable FK |

```php
// ✅ CORRECT: Check dependencies before delete
public function destroy(Customer $customer)
{
    if ($customer->workOrders()->exists()) {
        return response()->json([
            'message' => 'Cannot delete: customer has work orders. Delete or reassign them first.'
        ], 409);
    }

    if ($customer->quotes()->exists()) {
        return response()->json([
            'message' => 'Cannot delete: customer has quotes. Delete them first.'
        ], 409);
    }

    $customer->delete();
    return response()->json(['message' => 'Customer deleted successfully']);
}
```

---

## 🔄 Cache & Frontend State Consistency

### After Any Mutation, Invalidate Related Data

```typescript
// ✅ CORRECT: Invalidate all related queries after mutation
const createWorkOrder = useMutation({
    mutationFn: (data) => api.post('/work-orders', data),
    onSuccess: () => {
        // Invalidate direct data
        queryClient.invalidateQueries(['work-orders']);
        // Invalidate related data that may have changed
        queryClient.invalidateQueries(['stock']);        // Stock was deducted
        queryClient.invalidateQueries(['customers']);    // Customer stats changed
        queryClient.invalidateQueries(['dashboard']);    // Dashboard counters changed
    }
});
```

### Cache Invalidation Map

| When This Changes | Also Invalidate |
|-------------------|----------------|
| Work Order created/updated | stock, customer stats, technician agenda, dashboard |
| Quote converted | quotes list, work orders list, stock |
| Payment received | invoices, financial reports, dashboard |
| Stock adjusted | product list, work order items availability |
| Technician assigned | technician agenda, work order details |
| Expense created | financial reports, dashboard totals |

---

## 📊 Data Integrity Checks

### Foreign Key Validation

```php
// ✅ CORRECT: Validate FK exists before creating
public function rules(): array
{
    return [
        'customer_id' => ['required', 'exists:customers,id'],
        'product_id' => ['required', 'exists:products,id'],
        'technician_id' => ['nullable', 'exists:users,id'],
    ];
}
```

### Numeric Precision

```php
// ✅ CORRECT: Use bcmath or proper decimal handling for money
$total = bcadd($subtotal, $tax, 2);
$commission = bcmul($total, $rate, 2);

// ❌ WRONG: Floating point math for money
$total = $subtotal + $tax; // May produce 10.000000001
```

### Status Transitions

```php
// ✅ CORRECT: Validate status transitions
private const VALID_TRANSITIONS = [
    'draft' => ['pending', 'cancelled'],
    'pending' => ['approved', 'rejected'],
    'approved' => ['in_progress'],
    'in_progress' => ['completed', 'cancelled'],
];

public function updateStatus(Model $record, string $newStatus): void
{
    $allowed = self::VALID_TRANSITIONS[$record->status] ?? [];

    if (!in_array($newStatus, $allowed)) {
        throw new \DomainException(
            "Cannot change status from '{$record->status}' to '{$newStatus}'"
        );
    }

    $record->update(['status' => $newStatus]);
}
```

---

## 🔴 Self-Check Before Completing (MANDATORY)

| Check | Question |
|-------|----------|
| ✅ **Transactions used?** | All multi-step writes wrapped in DB::transaction? |
| ✅ **Delete safety?** | Dependencies checked before deletion? |
| ✅ **No orphans?** | Cascade rules correct on all FKs? |
| ✅ **Cache invalidated?** | Frontend queries invalidated after mutations? |
| ✅ **Money precision?** | Financial calculations use proper decimal handling? |
| ✅ **Status valid?** | Status changes follow allowed transitions? |
| ✅ **FK validated?** | All foreign keys validated with `exists` rule? |

> 🔴 **Rule:** If ANY check fails, **FIX IT** before completing.

---

## Summary

| Do | Don't |
|----|-------|
| Wrap multi-step writes in transactions | Write without rollback safety |
| Check dependencies before delete | Cascade delete without thinking |
| Invalidate related caches after mutation | Leave stale data on screen |
| Use proper decimal math for money | Use float arithmetic for currency |
| Validate status transitions | Allow any status to change to any other |
| Use `exists` validation on FK fields | Trust frontend to send valid IDs |

> **Remember: Data inconsistency is the hardest bug to fix because it corrupts silently over time. Prevent it at every mutation point.**
