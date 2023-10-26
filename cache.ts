const NodeCache = require('node-cache');
const myCache = new NodeCache();

function setCache(key, value) {
  myCache.set(key, value);
}

function getCache(key) {
  return myCache.get(key);
}

function deleteCache(key) {
  myCache.del(key);
}

export { setCache, getCache, deleteCache };
