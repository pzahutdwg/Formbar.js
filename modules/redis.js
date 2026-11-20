const { createClient } = require('redis')
const config = require('./config')

let redisClient = null

/**
 * Initializes the redis client
 */
function initRedis() {
    if (!config.redisEnabled) return

    redisClient = config.redisEnabled ? createClient({
        url: process.env.REDIS_URL
    }) : null

    if (!redisClient) return

    // Setup redis error listener
    redisClient.on('error', (err) => {
        console.error('Redis client error:', err)
    })

    console.log('Redis enabled.')
}

/**
 * Set a key-value pair with redis.
 * @param {string} key - Name of the key you are setting
 * @param {*} value - Value that is set
 * @returns {boolean} - Returns the function's success.
 */
async function redisSet(key, value) {
    if (!config.redisEnabled || !redisClient) return false // Break if redis is disabled or null

    if (typeof value === 'object') {
        await redisClient.hSet(key, value)
            .catch((err) => {
                console.error('Redis error:', err)
                return false
            }) // Break if there is an error
    } else {
        await redisClient.set(key, value)
            .catch((err) => {
                console.error('Redis error:', err)
                return false
            }) // Break if there is an error
    }

    return true // All good :)
}

/**
 * Gets a value from redis.
 * @param {string} key - The key for the value you are trying to get.
 * @param {...string} properties - If `key` is an object, return the specific properties of the key.
 * @returns {*} - Returns the value associated with the key.
 */
async function redisGet(key, ...properties) {
    if (!config.redisEnabled || !redisClient) return false // Break if redis is disabled or null

    let value

    if (properties.some(p => typeof p === 'object')) throw new Error('Properties can not be arrays or objects')

    if (properties) value = await redisClient.hGet(key, properties) // If a property is included, get the property
    else value = await redisClient.get(key)

    return value
}

module.exports = {
    initRedis,
    redisSet,
    redisGet
}