/**
 * API Health Circuit Breaker
 *
 * Tracks consecutive API connectivity failures and "opens" the circuit
 * to prevent noisy polling when the backend is known to be unreachable.
 *
 * States:
 *   CLOSED  → requests flow normally
 *   OPEN    → backend unreachable; skip non-critical requests for `cooldownMs`
 *   PROBING → cooldown expired; next request is a health-check probe
 */

type CircuitState = 'closed' | 'open' | 'probing'

const FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 30_000
const HEALTH_ENDPOINT = '/api/v1/up'

let state: CircuitState = 'closed'
let consecutiveFailures = 0
let openedAt = 0

/** Report a successful API response — resets the breaker. */
export function reportSuccess(): void {
    if (state === 'closed' && consecutiveFailures === 0) return
    consecutiveFailures = 0
    state = 'closed'
    window.dispatchEvent(new CustomEvent('api:health-changed', { detail: { healthy: true } }))
}

/** Report a connectivity failure (network error, 502, 503). */
export function reportFailure(): void {
    consecutiveFailures++
    if (consecutiveFailures >= FAILURE_THRESHOLD && state === 'closed') {
        state = 'open'
        openedAt = Date.now()
        window.dispatchEvent(new CustomEvent('api:health-changed', { detail: { healthy: false } }))
    }
}

/** Whether the API is considered reachable. */
export function isApiHealthy(): boolean {
    if (state === 'closed') return true
    if (state === 'open' && Date.now() - openedAt >= COOLDOWN_MS) {
        state = 'probing'
        scheduleHealthProbe()
        return false
    }
    return false
}

/** Internal: fire a lightweight probe to the backend health endpoint. */
function scheduleHealthProbe(): void {
    fetch(HEALTH_ENDPOINT, { method: 'HEAD', cache: 'no-store' })
        .then((res) => {
            if (res.ok) {
                reportSuccess()
            } else {
                reopenCircuit()
            }
        })
        .catch(() => {
            reopenCircuit()
        })
}

function reopenCircuit(): void {
    state = 'open'
    openedAt = Date.now()
}
