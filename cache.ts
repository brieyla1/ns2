import { prepareStringForCompare } from './comparator';
import { MiddlePropertiesType } from './dataConverter';

const NodeCache = require('node-cache');
const myCache = new NodeCache();

export const initiateCache = (notionData: { [id: string]: MiddlePropertiesType }, linearData: { [id: string]: MiddlePropertiesType }) => {
  const cacheData: MiddlePropertiesType[] = [];

  const mergeData = { ...notionData, ...linearData };

  Object.keys(mergeData).forEach((id) => {
    const data = JSON.parse(JSON.stringify(mergeData[id] || '{}'));
    data.description = prepareStringForCompare(data.description ?? '', 'notion');
    delete data.url;

    cacheData.push(data);
  });

  setCache('syncData', cacheData);

  console.log('DEFAULT CACHE SET');
};

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
