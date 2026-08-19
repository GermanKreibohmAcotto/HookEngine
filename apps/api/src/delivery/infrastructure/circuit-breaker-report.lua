-- Records the outcome of a real dispatch attempt (never a deferred one) and
-- applies the state transition. Failures are counted in a sliding window via
-- a sorted set, scored by timestamp, so "N failures in the last W ms" — not
-- just N consecutive failures — trips the breaker.
--
-- KEYS[1] = state hash key, e.g. "circuit:<subscriberId>:state"
-- KEYS[2] = failures zset key, e.g. "circuit:<subscriberId>:failures"
-- ARGV[1] = outcome, 'success' | 'failure'
-- ARGV[2] = now, unix ms
-- ARGV[3] = window_ms
-- ARGV[4] = failure_threshold
-- ARGV[5] = state key ttl, seconds
--
-- Returns the resulting state string.

local state_key = KEYS[1]
local failures_key = KEYS[2]
local outcome = ARGV[1]
local now = tonumber(ARGV[2])
local window_ms = tonumber(ARGV[3])
local threshold = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local state = redis.call('HGET', state_key, 'state')
if state == false then
  state = 'closed'
end

if outcome == 'success' then
  redis.call('DEL', failures_key)
  redis.call('HSET', state_key, 'state', 'closed')
  redis.call('EXPIRE', state_key, ttl)
  return 'closed'
end

-- A probe (half-open) that fails goes straight back to open and resets the cooldown clock.
if state == 'half-open' then
  redis.call('HSET', state_key, 'state', 'open', 'opened_at', now)
  redis.call('EXPIRE', state_key, ttl)
  redis.call('DEL', failures_key)
  return 'open'
end

redis.call('ZADD', failures_key, now, now .. '-' .. math.random(1000000))
redis.call('ZREMRANGEBYSCORE', failures_key, 0, now - window_ms)
redis.call('EXPIRE', failures_key, math.ceil(window_ms / 1000) + 60)
local count = redis.call('ZCARD', failures_key)

if count >= threshold and state ~= 'open' then
  redis.call('HSET', state_key, 'state', 'open', 'opened_at', now)
  redis.call('EXPIRE', state_key, ttl)
  return 'open'
end

return state
