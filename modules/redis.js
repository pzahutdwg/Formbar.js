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
 * @param {string} [property] - (Optional) Specifies the property of the key to set the value to.
 * @returns {boolean} - Returns the function's success.
 */
async function redisSet(key, value, property = null) {
    if (!config.redisEnabled || !redisClient) return undefined // Break if redis is disabled or null

    if (property) {
        await redisClient.hSet(key, property, value)
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
 * @param {string} [property] - (Optional) If the value for the key is an object, this gets a specific property of the value.
 * @returns {*} - Returns the value associated with the key.
 */
async function redisGet(key, property = null) {
    if (!config.redisEnabled || !redisClient) return undefined // Break if redis is disabled or null

    let value

    if (property) {
        if (typeof property !== 'string') throw new Error('Property must be a string')
        else value = await redisClient.hGet(key, properties) // If a property is included, get the property
    } 
    
    else value = await redisClient.get(key)

    return value
}

module.exports = {
    initRedis,
    redisSet,
    redisGet
}