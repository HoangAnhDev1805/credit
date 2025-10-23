/**
 * Redis Cache Service for Card Results
 * 
 * Cache DIE card results to avoid re-checking
 * 
 * Installation:
 *   npm install ioredis
 * 
 * Config (.env):
 *   REDIS_URL=redis://localhost:6379
 *   REDIS_TTL_SECONDS=604800  # 7 days
 */

let redis = null;
let redisEnabled = false;

try {
  const Redis = require('ioredis');
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redis = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
    redisEnabled = true;
  });

  redis.on('error', (err) => {
    console.warn('⚠️  Redis error (cache disabled):', err.message);
    redisEnabled = false;
  });

  // Try to connect
  redis.connect().catch(err => {
    console.warn('⚠️  Redis connection failed (cache disabled):', err.message);
    redisEnabled = false;
  });

} catch (err) {
  console.warn('⚠️  Redis not available (ioredis not installed). Cache disabled.');
  redisEnabled = false;
}

const DEFAULT_TTL = parseInt(process.env.REDIS_TTL_SECONDS || '604800', 10); // 7 days

/**
 * Get cached card result
 * @param {string} fullCard - Full card string (cardNumber|mm|yy|cvv)
 * @param {string} typeCheck - Type check (1 or 2)
 * @returns {Promise<object|null>} Cached result or null
 */
exports.get = async (fullCard, typeCheck) => {
  if (!redisEnabled || !redis) return null;
  
  try {
    const key = `card:${typeCheck}:${fullCard}`;
    const cached = await redis.get(key);
    if (!cached) return null;
    
    const result = JSON.parse(cached);
    return result;
  } catch (error) {
    console.warn('Redis get error:', error.message);
    return null;
  }
};

/**
 * Set card result in cache (only for DIE cards)
 * @param {string} fullCard - Full card string
 * @param {string} typeCheck - Type check (1 or 2)
 * @param {object} result - Result object { status, response, checkedAt }
 * @param {number} ttl - TTL in seconds (optional, default 7 days)
 */
exports.set = async (fullCard, typeCheck, result, ttl = DEFAULT_TTL) => {
  if (!redisEnabled || !redis) return;
  
  // Only cache DIE cards (not worth caching LIVE/UNKNOWN)
  if (result.status !== 'die' && result.status !== 'Die') return;
  
  try {
    const key = `card:${typeCheck}:${fullCard}`;
    await redis.setex(key, ttl, JSON.stringify(result));
  } catch (error) {
    console.warn('Redis set error:', error.message);
  }
};

/**
 * Delete cached card result
 * @param {string} fullCard - Full card string
 * @param {string} typeCheck - Type check (1 or 2)
 */
exports.del = async (fullCard, typeCheck) => {
  if (!redisEnabled || !redis) return;
  
  try {
    const key = `card:${typeCheck}:${fullCard}`;
    await redis.del(key);
  } catch (error) {
    console.warn('Redis del error:', error.message);
  }
};

/**
 * Flush all cache (admin utility)
 */
exports.flushAll = async () => {
  if (!redisEnabled || !redis) return;
  
  try {
    await redis.flushdb();
    console.log('✅ Redis cache flushed');
  } catch (error) {
    console.warn('Redis flush error:', error.message);
  }
};

/**
 * Get cache stats
 */
exports.getStats = async () => {
  if (!redisEnabled || !redis) {
    return { enabled: false, connected: false };
  }
  
  try {
    const info = await redis.info('stats');
    const keyspace = await redis.info('keyspace');
    
    // Parse total keys
    const dbMatch = keyspace.match(/db0:keys=(\d+)/);
    const totalKeys = dbMatch ? parseInt(dbMatch[1], 10) : 0;
    
    return {
      enabled: true,
      connected: redisEnabled,
      totalKeys,
      info: info.split('\n').slice(0, 5).join('\n') // First 5 lines
    };
  } catch (error) {
    return { enabled: true, connected: false, error: error.message };
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (redis) {
    try {
      await redis.quit();
      console.log('✅ Redis disconnected');
    } catch {}
  }
});
