-- Checked before every dispatch attempt, atomically transitions open -> half-open
-- once the cooldown elapses so exactly one caller gets to be "the probe" —
-- concurrent workers checking the same subscriber can't all treat themselves
-- as the probe at once.
--
-- KEYS[1] = state hash key, e.g. "circuit:<subscriberId>:state"
-- ARGV[1] = now, unix ms
-- ARGV[2] = cooldown_ms
--
-- Returns { allowed (0|1), state (string), retry_after_ms (number) }

local key = KEYS[1]
local now = tonumber(ARGV[1])
local cooldown_ms = tonumber(ARGV[2])

local state = redis.call('HGET', key, 'state')
if state == false then
  state = 'closed'
end

if state == 'closed' then
  return { 1, 'closed', 0 }
elseif state == 'open' then
  local opened_at = tonumber(redis.call('HGET', key, 'opened_at')) or now
  local remaining = cooldown_ms - (now - opened_at)
  if remaining <= 0 then
    redis.call('HSET', key, 'state', 'half-open')
    return { 1, 'half-open', 0 }
  else
    return { 0, 'open', remaining }
  end
elseif state == 'half-open' then
  -- A probe is already in flight; don't let concurrent deliveries pile on
  -- while we wait to see whether it succeeds.
  return { 0, 'half-open', 1000 }
else
  return { 1, 'closed', 0 }
end
