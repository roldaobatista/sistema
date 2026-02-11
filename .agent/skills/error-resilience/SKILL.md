---
name: error-resilience
description: Ensures every action has complete error handling. No silent failures, no empty catches, no missing user feedback. Backend and frontend must handle ALL error scenarios gracefully.
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0
priority: CRITICAL
trigger: always_on
---

# Error Resilience - Zero Silent Failures

> **CRITICAL SKILL (ALWAYS ON)** - Every action in the system MUST handle errors explicitly. No silent failures, no empty catch blocks, no missing user feedback. If something can fail, it MUST be handled.

---

## 🎯 Core Principles

| Principle | Rule |
|-----------|------|
| **No Silent Failures** | Every catch block MUST do something: log, notify user, or retry |
| **User Always Knows** | Every error MUST result in visible feedback to the user |
| **Fail Gracefully** | Errors in one part MUST NOT crash the entire page/app |
| **Log Everything** | Backend errors MUST be logged with context (who, what, when) |
| **Recover When Possible** | Retry transient errors, show retry button, offer alternatives |

---

## 🔴 Backend Error Handling (MANDATORY)

### Controller Pattern

Every controller action MUST follow this pattern:

```php
// ✅ CORRECT: Complete error handling
public function store(StoreRequest $request)
{
    try {
        DB::beginTransaction();

        $record = $this->service->create($request->validated());

        DB::commit();

        return response()->json([
            'message' => 'Record created successfully',
            'data' => new ResourceResponse($record)
        ], 201);

    } catch (ValidationException $e) {
        DB::rollBack();
        return response()->json([
            'message' => 'Validation failed',
            'errors' => $e->errors()
        ], 422);

    } catch (AuthorizationException $e) {
        DB::rollBack();
        return response()->json([
            'message' => 'You do not have permission to perform this action'
        ], 403);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Failed to create record', [
            'user_id' => auth()->id(),
            'data' => $request->validated(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'message' => 'An unexpected error occurred. Please try again.'
        ], 500);
    }
}
```

```php
// ❌ WRONG: Silent failure, no error handling
public function store(StoreRequest $request)
{
    $record = Model::create($request->all());
    return response()->json($record);
}
```

### Backend Error Rules

| Rule | Description |
|------|-------------|
| **DB Transactions** | All write operations (create/update/delete) MUST use DB::beginTransaction/commit/rollBack |
| **Specific Catches First** | Catch specific exceptions before generic \Exception |
| **Context in Logs** | Log::error MUST include: user_id, input data, error message, stack trace |
| **HTTP Status Codes** | Use correct codes: 400 (bad request), 401 (unauthenticated), 403 (forbidden), 404 (not found), 422 (validation), 500 (server error) |
| **User-Friendly Messages** | NEVER send raw exception messages to the user. Always send translated, friendly text |
| **No Empty Catches** | `catch (\Exception $e) {}` is ABSOLUTELY FORBIDDEN |
| **Relation Safety** | Before deleting, check for dependent records and return 409 (conflict) if they exist |

### Error Response Format (Standard)

All API error responses MUST follow this format:

```json
{
    "message": "Human-readable error description",
    "errors": {
        "field_name": ["Specific validation error"]
    },
    "code": "OPTIONAL_ERROR_CODE"
}
```

---

## 🔵 Frontend Error Handling (MANDATORY)

### API Call Pattern

Every API call MUST follow this pattern:

```typescript
// ✅ CORRECT: Complete error handling with user feedback
const handleCreate = async (data: FormData) => {
    try {
        setLoading(true);
        const response = await api.post('/endpoint', data);
        toast.success('Record created successfully!');
        queryClient.invalidateQueries(['records']);
        onClose();
    } catch (error: any) {
        if (error.response?.status === 422) {
            // Validation errors - show on form fields
            const errors = error.response.data.errors;
            Object.keys(errors).forEach(field => {
                setError(field, { message: errors[field][0] });
            });
        } else if (error.response?.status === 403) {
            toast.error('You do not have permission for this action.');
        } else if (error.response?.status === 409) {
            toast.error('This record has dependencies and cannot be deleted.');
        } else {
            toast.error(
                error.response?.data?.message ||
                'An unexpected error occurred. Please try again.'
            );
        }
    } finally {
        setLoading(false);
    }
};
```

```typescript
// ❌ WRONG: Silent failure, no user feedback
const handleCreate = async (data: FormData) => {
    try {
        await api.post('/endpoint', data);
    } catch (e) {
        console.log(e); // User sees NOTHING
    }
};
```

### Frontend Error Rules

| Rule | Description |
|------|-------------|
| **Always Show Feedback** | Every API error MUST show a toast, alert, or inline message |
| **Loading States** | Set loading=true before request, loading=false in `finally` block |
| **Validation on Fields** | 422 errors MUST show messages on the specific form fields |
| **No console.log Only** | `console.log(error)` alone is NOT error handling |
| **Disable During Submit** | Submit button MUST be disabled while request is in progress |
| **Retry Option** | For 500/network errors, offer a "Try Again" button when appropriate |
| **Optimistic UI Rollback** | If using optimistic updates, ROLLBACK on error |
| **Empty Catch = Violation** | `catch (e) {}` or `catch (e) { console.log(e) }` is FORBIDDEN |

### Error State Components

Every page/component that fetches data MUST handle these states:

```typescript
// ✅ CORRECT: All states handled
if (isLoading) return <LoadingSkeleton />;
if (isError) return <ErrorState message={error.message} onRetry={refetch} />;
if (!data?.length) return <EmptyState message="No records found" />;
return <DataTable data={data} />;
```

```typescript
// ❌ WRONG: Only handles success
return <DataTable data={data} />;
```

---

## 🛡️ Error Boundary Pattern (React)

Every major section of the app MUST have an Error Boundary:

```typescript
// Pages should be wrapped
<ErrorBoundary fallback={<ErrorFallback />}>
    <PageContent />
</ErrorBoundary>
```

| Where | Error Boundary? |
|-------|----------------|
| App root | ✅ YES - catches everything |
| Each page/route | ✅ YES - prevents full app crash |
| Individual components | ⚠️ Only for complex/risky components |
| Forms | ❌ NO - use try/catch in handlers |

---

## 📊 Error Handling Checklist (MANDATORY)

> 🔴 **Before completing ANY task, verify ALL error scenarios are handled:**

### Backend Checklist

| Check | Verify |
|-------|--------|
| ✅ **try/catch on all writes?** | create, update, delete wrapped in try/catch |
| ✅ **DB transactions?** | All multi-step writes use beginTransaction/commit/rollBack |
| ✅ **Specific exceptions caught?** | ValidationException, AuthorizationException, ModelNotFoundException handled separately |
| ✅ **Errors logged?** | Log::error with user_id, input, message, trace |
| ✅ **Friendly messages?** | No raw exception text sent to frontend |
| ✅ **Correct HTTP codes?** | 422 for validation, 403 for auth, 404 for not found, 500 for server |
| ✅ **Delete constraints?** | Check for dependencies before deleting, return 409 if exist |

### Frontend Checklist

| Check | Verify |
|-------|--------|
| ✅ **Toast on every error?** | User sees feedback for EVERY failed action |
| ✅ **Loading states?** | Spinner/skeleton during fetch, disabled button during submit |
| ✅ **422 → field errors?** | Validation errors shown on specific form fields |
| ✅ **Empty states?** | Friendly message when list has no data |
| ✅ **Error states?** | Error message + retry button when fetch fails |
| ✅ **finally block?** | Loading state reset even on error |
| ✅ **No empty catches?** | Every catch block provides feedback |

---

## 🚨 Common Error Anti-Patterns

| ❌ Anti-Pattern | ✅ Correct Approach |
|----------------|-------------------|
| `catch (e) {}` | `catch (e) { toast.error(e.message); }` |
| `console.log(error)` only | `toast.error() + console.error()` |
| `Model::create()` without try/catch | Wrap in try/catch with DB transaction |
| `return response()->json($e->getMessage(), 500)` | Return friendly message, log the real error |
| No loading state on buttons | `disabled={isLoading}` + spinner |
| Delete without confirmation | Confirmation dialog → then delete |
| API returns 200 on error | Use proper HTTP status codes |
| Swallowing exceptions in services | Re-throw or handle with context |

---

## Summary

| Do | Don't |
|----|-------|
| Handle every error explicitly | Let errors pass silently |
| Show user-friendly feedback | Show raw exception messages |
| Use DB transactions on writes | Write without rollback safety |
| Log errors with full context | Log just the message |
| Handle loading/error/empty states | Only handle the success case |
| Use specific catch blocks | Catch generic Exception only |
| Disable buttons during submit | Allow double-submit |
| Offer retry on transient failures | Show "error" and do nothing |

> **Remember: If an error CAN happen, it WILL happen. Handle it BEFORE it reaches the user as a broken screen or lost data.**
