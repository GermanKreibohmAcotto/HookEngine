-- Atomic token bucket. Runs as a single Redis command (via EVALSHA) so the
-- read-refill-check-consume-write sequence can't race across worker
-- processes sharing the same Redis instance.
--
-- KEYS[1] = bucket key, e.g. "ratelimit:api.example.com"
-- ARGV[1] = refill rate, tokens per second
-- ARGV[2] = bucket capacity (max burst)
-- ARGV[3] = now, unix ms
-- ARGV[4] = tokens requested (normally 1)
--
-- Returns { allowed (0|1), retry_after_ms }

local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'timestamp')
local tokens = tonumber(bucket[1])
local timestamp = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  timestamp = now
end

local elapsed = math.max(0, now - timestamp)
tokens = math.min(capacity, tokens + (elapsed * rate / 1000))

local allowed = 0
local retry_after_ms = 0

if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
else
  local deficit = requested - tokens
  retry_after_ms = math.ceil((deficit / rate) * 1000)
end

redis.call('HMSET', key, 'tokens', tokens, 'timestamp', now)
-- Bucket is idle-expired well past its own refill horizon so it doesn't
-- linger in Redis forever for domains nothing delivers to anymore.
redis.call('EXPIRE', key, math.ceil(capacity / rate) + 60)

return { allowed, retry_after_ms }
