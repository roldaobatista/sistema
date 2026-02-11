---
name: migration-safety
description: Ensures all database migrations are safe, reversible, and non-destructive. Proper rollback, column safety, and seeder consistency.
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0
priority: HIGH
trigger: always_on
---

# Migration Safety - No Destructive DB Changes

> **HIGH PRIORITY SKILL (ALWAYS ON)** - Every migration MUST be safe, reversible, and non-destructive. Never drop data without explicit user confirmation. Always have a rollback plan.

---

## 🎯 Core Principles

| Principle | Rule |
|-----------|------|
| **Reversible** | Every migration MUST have a working `down()` method |
| **Non-Destructive** | Never drop columns/tables with data without explicit confirmation |
| **Incremental** | One migration = one logical change. No mega-migrations |
| **Idempotent** | Running migration twice should not cause errors |
| **Seed Consistent** | Seeders must stay in sync with schema changes |

---

## 🔴 Migration Rules (MANDATORY)

### Always Include Rollback

```php
// ✅ CORRECT: Complete up() and down()
public function up(): void
{
    Schema::table('work_orders', function (Blueprint $table) {
        $table->string('priority')->default('normal')->after('status');
        $table->index('priority');
    });
}

public function down(): void
{
    Schema::table('work_orders', function (Blueprint $table) {
        $table->dropIndex(['priority']);
        $table->dropColumn('priority');
    });
}
```

```php
// ❌ WRONG: No rollback
public function down(): void
{
    // Nothing here
}
```

### Column Safety Rules

| Action | Safety Level | Rules |
|--------|-------------|-------|
| **Add column** | ✅ Safe | Always provide default value or make nullable |
| **Add nullable column** | ✅ Safe | No issues |
| **Add index** | ✅ Safe | May be slow on large tables |
| **Rename column** | ⚠️ Caution | Update ALL code references first |
| **Change column type** | ⚠️ Caution | Verify data compatibility |
| **Drop column** | 🔴 Dangerous | Check ALL code references, backup data |
| **Drop table** | 🔴 Dangerous | Check ALL foreign keys, NEVER in production |
| **Drop index** | ⚠️ Caution | May impact query performance |

### New Column Rules

```php
// ✅ CORRECT: New column with default (won't break existing records)
$table->string('priority')->default('normal');

// ✅ CORRECT: New column nullable (won't break existing records)
$table->text('notes')->nullable();

// ❌ WRONG: New required column without default (breaks existing records)
$table->string('priority'); // All existing rows will fail NOT NULL constraint
```

---

## 🛡️ Before Dropping Anything

### Pre-Drop Checklist

```text
Before dropping a column or table:

1. SEARCH all code for references:
   - grep -r "column_name" app/ --include="*.php"
   - grep -r "column_name" resources/ --include="*.tsx"
   - grep -r "column_name" database/ --include="*.php"

2. CHECK foreign keys:
   - Is this column a FK in another table?
   - Does another table reference this table?

3. CHECK seeders:
   - Does any seeder reference this column/table?
   - Update seeders BEFORE running migration

4. BACKUP strategy:
   - For production: Create backup migration that copies data first
   - For development: Verify no critical data exists
```

### Safe Column Removal Pattern

```php
// Phase 1: Make column nullable (deploy first)
public function up(): void
{
    Schema::table('orders', function (Blueprint $table) {
        $table->string('old_field')->nullable()->change();
    });
}

// Phase 2: Remove code references (deploy second)
// Update all code to stop using old_field

// Phase 3: Drop column (deploy third)
public function up(): void
{
    Schema::table('orders', function (Blueprint $table) {
        $table->dropColumn('old_field');
    });
}
```

---

## 📋 Foreign Key Rules

### Always Define Cascade Behavior

```php
// ✅ CORRECT: Explicit cascade behavior
$table->foreignId('customer_id')
    ->constrained('customers')
    ->onUpdate('cascade')
    ->onDelete('restrict'); // Prevent deleting customer with orders

// ✅ CORRECT: Cascade delete for child records
$table->foreignId('work_order_id')
    ->constrained('work_orders')
    ->onUpdate('cascade')
    ->onDelete('cascade'); // Delete items when WO is deleted

// ❌ WRONG: No cascade behavior defined
$table->foreignId('customer_id');  // What happens when customer is deleted?
```

### FK Cascade Strategy

| Relationship | onDelete Strategy | Reason |
|-------------|-------------------|--------|
| WorkOrder → Items | `cascade` | Items are meaningless without WO |
| Quote → Items | `cascade` | Items are meaningless without Quote |
| Customer → WorkOrders | `restrict` | Don't lose work order history |
| Customer → Quotes | `restrict` | Don't lose quote history |
| User → Expenses | `restrict` | Keep financial records |
| Product → Stock Movements | `restrict` | Keep audit trail |

---

## 🔄 Seeder Consistency

### When to Update Seeders

| Migration Change | Seeder Update Needed? |
|-----------------|----------------------|
| New table | ✅ YES - create factory + seeder |
| New required column | ✅ YES - update factory |
| New permission-related table | ✅ YES - update permission seeder |
| Dropped column | ✅ YES - remove from factory |
| Renamed column | ✅ YES - update factory |
| New enum values | ✅ YES - update factory if it generates random values |

```php
// ✅ CORRECT: Factory matches current schema
class WorkOrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'status' => fake()->randomElement(['draft', 'pending', 'in_progress', 'completed']),
            'priority' => fake()->randomElement(['low', 'normal', 'high', 'urgent']), // NEW COLUMN
            'total' => fake()->randomFloat(2, 100, 10000),
        ];
    }
}
```

---

## 🔴 Self-Check Before Completing (MANDATORY)

| Check | Question |
|-------|----------|
| ✅ **down() exists?** | Does every migration have a working rollback? |
| ✅ **Defaults set?** | Do new columns have defaults or are nullable? |
| ✅ **FKs cascaded?** | Do all foreign keys have explicit onDelete/onUpdate? |
| ✅ **No blind drops?** | Did I check all code refs before dropping anything? |
| ✅ **Seeders updated?** | Are factories and seeders consistent with schema? |
| ✅ **Tests updated?** | Do test assertions match new schema? |
| ✅ **Migrate fresh works?** | Does `php artisan migrate:fresh --seed` complete? |

> 🔴 **Rule:** If ANY check fails, **FIX IT** before completing. A broken migration can destroy production data.

---

## Summary

| Do | Don't |
|----|-------|
| Always write down() method | Leave empty rollback |
| Add columns as nullable or with defaults | Add required columns without defaults |
| Check all code refs before dropping | Blindly drop columns |
| Define explicit FK cascade behavior | Leave FK behavior undefined |
| Keep seeders in sync with schema | Forget to update factories |
| Test migrate:fresh --seed | Only test forward migration |

> **Remember: A migration runs ONCE in production. If it's wrong, you can't easily undo it. Get it right the first time.**
