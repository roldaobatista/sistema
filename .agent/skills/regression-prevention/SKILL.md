---
name: regression-prevention
description: Prevents regressions by mandating test creation/update for every code change, verifying existing tests pass, and documenting impact of changes.
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0
priority: CRITICAL
trigger: always_on
---

# Regression Prevention - Never Break What Already Works

> **CRITICAL SKILL (ALWAYS ON)** - Every code change MUST be protected by tests. Fixes today must NOT become bugs tomorrow. If you change it, test it.

---

## 🎯 Core Principles

| Principle | Rule |
|-----------|------|
| **Change = Test** | Every code change MUST have a corresponding test update |
| **Green Before Push** | All existing tests MUST pass after your changes |
| **Cover the Fix** | Every bug fix MUST include a test that reproduces the bug |
| **Impact Awareness** | Before changing shared code, identify ALL consumers |
| **Document Why** | Non-obvious changes MUST have a comment explaining the reason |

---

## 🔴 Mandatory Protocol (EVERY CODE CHANGE)

### Step 1: Before Changing Code

```text
1. IDENTIFY what you're changing:
   - Is it a bug fix? → You MUST write a test that reproduces the bug first
   - Is it a new feature? → You MUST write tests for the feature
   - Is it a refactor? → Existing tests MUST still pass without modification

2. CHECK existing test coverage:
   - Does a test file exist for this module? → Read it, understand it
   - Are there related tests in other files? → Check cross-module tests
   - Run existing tests BEFORE making changes → Establish baseline

3. MAP the impact:
   - What other files import/use the code you're changing?
   - Could your change break their behavior?
   - Will their tests still pass?
```

### Step 2: After Changing Code

```text
1. RUN all related tests:
   - Module-specific tests → php artisan test --filter=ModuleName
   - Cross-module tests if you changed shared code

2. VERIFY test results:
   - All green? → Proceed
   - Any red? → FIX before continuing (your change caused regression)

3. ADD/UPDATE tests:
   - Bug fix? → Add test case that would have caught the bug
   - New feature? → Add tests for happy path + edge cases
   - Changed behavior? → Update existing tests to match new behavior
```

---

## 📋 Test Requirements by Change Type

### Bug Fix

```php
// ✅ CORRECT: Test that reproduces the bug, then fix
/** @test */
public function it_correctly_calculates_commission_with_discount()
{
    // This was returning wrong values before the fix
    $workOrder = WorkOrder::factory()->create(['discount' => 10]);
    $commission = $this->service->calculateCommission($workOrder);

    // Commission should be based on total AFTER discount
    $this->assertEquals(90.00, $commission->base_amount);
}
```

### New Feature

| What to Test | Example |
|-------------|---------|
| Happy path | Create record with valid data → succeeds |
| Validation | Create with missing required field → returns 422 |
| Authorization | Create without permission → returns 403 |
| Edge cases | Create with max-length strings, zero values, etc. |
| Side effects | Creating WO deducts stock, Creating Invoice updates balance |

### Refactor

```text
Rule: If you're refactoring, NO TEST SHOULD CHANGE.
If a test breaks during refactor → you changed behavior, not just structure.
Exception: Test implementation details (mocks, setup) may change, but assertions should not.
```

---

## 🧪 Test Patterns

### Backend (PHPUnit/Pest)

```php
// ✅ CORRECT: Complete test with setup, action, assertion
/** @test */
public function user_can_create_work_order_with_items()
{
    // Arrange
    $user = User::factory()->create();
    $user->givePermissionTo('workorder.create');
    $customer = Customer::factory()->create();
    $product = Product::factory()->create(['stock_quantity' => 10]);

    // Act
    $response = $this->actingAs($user)->postJson('/api/v1/work-orders', [
        'customer_id' => $customer->id,
        'items' => [
            ['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 50.00]
        ]
    ]);

    // Assert
    $response->assertStatus(201);
    $this->assertDatabaseHas('work_orders', ['customer_id' => $customer->id]);
    $this->assertDatabaseHas('work_order_items', ['product_id' => $product->id]);
    $this->assertEquals(8, $product->fresh()->stock_quantity); // Stock deducted
}
```

### Frontend (React Testing or Manual)

```text
For each UI change, verify:
1. Component renders without errors
2. User interactions produce expected results
3. API calls are made with correct data
4. Error states are handled
5. Loading states appear
```

---

## 🚨 Regression Red Flags

| Red Flag | What It Means | Action |
|----------|--------------|--------|
| Changing a function signature | All callers may break | Find + update ALL callers |
| Renaming a DB column | All queries referencing it break | Update migration + all references |
| Changing API response shape | Frontend may break | Update types + components |
| Modifying validation rules | Existing data may become invalid | Check existing records |
| Changing permission names | Authorization checks break | Update seeder + all gates |
| Modifying calculation logic | Financial reports may change | Verify historical data still correct |

---

## 🔴 Self-Check Before Completing (MANDATORY)

| Check | Question |
|-------|----------|
| ✅ **Tests pass?** | Did I run ALL related tests after my changes? |
| ✅ **Bug = test?** | If fixing a bug, did I write a test that reproduces it? |
| ✅ **Feature = test?** | If adding a feature, did I write tests for it? |
| ✅ **No broken tests?** | Are all previously passing tests still passing? |
| ✅ **Impact checked?** | Did I verify all consumers of changed code? |
| ✅ **Shared code safe?** | If I changed shared code, did I update all dependents? |

> 🔴 **ABSOLUTE RULE:** Never mark a task as complete if ANY test is failing. Fix it first.

---

## Summary

| Do | Don't |
|----|-------|
| Write test for every bug fix | Fix bugs without test coverage |
| Run tests before AND after changes | Assume your change doesn't break anything |
| Check all consumers of shared code | Change a function and hope for the best |
| Update tests when behavior changes | Leave stale tests that test old behavior |
| Test happy path + edge cases | Only test the obvious scenario |

> **Remember: Every untested change is a future regression waiting to happen. The cost of writing a test now is 1/10th the cost of debugging a regression later.**
