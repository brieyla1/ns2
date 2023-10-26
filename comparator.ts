import { getCache, setCache } from './cache';
import { MiddlePropertiesType, convertLinearToMiddleman, convertMiddlemanToNotion, convertNotionToMiddleman } from './dataConverter';
import { createLinearItem, getLinearItems, updateLinearItem } from './linearAPI';
import { createDatabaseItem, updateDatabaseItem } from './notionAPI';
const util = require('node:util');
import _ from 'lodash';

type CompareResultType = {
  source: string;
  data: MiddlePropertiesType;
  conflict: boolean;
  updateTextIfNotion?: boolean; // Notion is expensive when updating Text
  created?: boolean; // New item created in either Linear or Notion
  deleted?: boolean; // Item deleted in either Linear or Notion
};

const prepareStringForCompare = (str: string, type: 'linear' | 'notion') =>
  str
    .replace(/!\[.*?\]\(.*?\)/g, '![](link)')
    .replace(/[\s#]/g, '')
    .toLowerCase()
    .replace(/[*_\-/\\]/g, '')
    .replace(/\[image\]/g, '[]')
    .trim();

export const initiateCache = (notionData: { [id: string]: MiddlePropertiesType }) => {
  const cacheData: MiddlePropertiesType[] = [];

  Object.keys(notionData).forEach((id) => {
    const data = JSON.parse(JSON.stringify(notionData[id] || '{}'));
    data.description = prepareStringForCompare(data.description ?? '', 'notion');
    delete data.url;

    cacheData.push(data);
  });

  setCache('syncData', cacheData);
};

console.log('IS DEEP STRICT EQUAL', _.isEqual({ b: 1, a: 1 }, { a: 1, b: 1 }));

export const compareDataAndSaveToCache = async ({
  notionData,
  linearData,
}: {
  notionData: { [id: string]: MiddlePropertiesType };
  linearData: { [id: string]: MiddlePropertiesType };
}): Promise<CompareResultType[]> => {
  const cacheData: MiddlePropertiesType[] = getCache('syncData') || [];
  const result: CompareResultType[] = [];

  cacheData.forEach((cacheItem, i) => {
    const notionItemO = notionData[cacheItem.id];
    const linearItemO = linearData[cacheItem.id];

    let notionItem: any = undefined;
    if (notionItemO) {
      notionItem = JSON.parse(JSON.stringify(notionItemO || '{}'));
      delete notionItem.url;
      notionItem.description = prepareStringForCompare(notionItem.description ?? '', 'notion');
    }

    let linearItem: any = undefined;
    if (linearItemO) {
      linearItem = JSON.parse(JSON.stringify(linearItemO || '{}'));
      delete linearItem.url;
      linearItem.description = prepareStringForCompare(linearItem.description ?? '', 'linear');
    }

    console.log(JSON.stringify(notionItem ?? {}).length, JSON.stringify(linearItem ?? {}).length, JSON.stringify(cacheItem ?? {}).length);

    // console.log({
    //   notionItem,
    //   linearItem,
    //   cacheItem,
    // });

    if (notionItem && linearItem) {
      if (!_.isEqual(notionItem, linearItem) && !_.isEqual(notionItem, cacheItem) && !_.isEqual(linearItem, cacheItem)) {
        // Conflict: same ID got modified on both sides
        console.log('CONFLICT', notionItem, linearItem, cacheItem);
        result.push({ source: 'notion', data: notionItemO, conflict: true });
        cacheData[i] = notionItem;
      } else if (_.isEqual(notionItem ?? {}, linearItem ?? {}) && !_.isEqual(notionItem, cacheItem)) {
        console.log('CACHE OUTDATED', notionItem, linearItem, cacheItem);
        cacheData[i] = notionItem;
      } else if (!_.isEqual(notionItem, cacheItem)) {
        // Notion is the source of truth
        console.log('NOTION IS THE SOURCE OF TRUTH', notionItemO.description);
        result.push({ source: 'notion', data: notionItemO, conflict: false });
        cacheData[i] = notionItem;
      } else if (!_.isEqual(linearItem, cacheItem)) {
        console.log({ linearItem, cacheItem }, _.isEqual(linearItem, cacheItem), _.isEqual(linearItem, cacheItem));
        // Linear is the source of truth
        result.push({ source: 'linear', data: linearItemO, conflict: false, updateTextIfNotion: notionItem.description !== linearItem.description });
        cacheData[i] = linearItem;
      } else {
        // No diff
        result.push({ source: 'NODIFF', data: notionItemO, conflict: false });
        cacheData[i] = cacheItem;
      }
      // Item deleted
    } else if ((notionItem && cacheItem && !linearItem) || (linearItem && cacheItem && !notionItem)) {
      result.push({ source: notionItem && cacheItem && !linearItem ? 'linear' : 'notion', data: cacheItem, conflict: false, deleted: true });
      cacheData.splice(i, 1);
    } else {
      // For some reason they are both deleted, remove from cache ?
      if (!notionItem && !linearItem && cacheItem) {
        console.log('THIS SHOULD NOT HAPPEN');
        // cacheData.splice(i, 1);
      }
    }
  });

  for (let i = 0; i < Object.values(notionData).length; i++) {
    const item = Object.values(notionData)[i];
    if (!cacheData.find((el) => el.id === item.id) && result.find((el) => el.data.id === item.id) === undefined) {
      console.log('CREATING NEW LINEAR ITEM', item.id, item.title);
      const issue = await createLinearItem(item);
      item.linearId = issue!.id;
      cacheData.push(item);
      updateDatabaseItem(item.id, convertMiddlemanToNotion(item).properties);
      linearData[item.id] = await convertLinearToMiddleman([item])[0];
    }
  }

  for (let i = 0; i < Object.values(linearData).length; i++) {
    const item = Object.values(linearData)[i];
    if (!cacheData.find((el) => el.id === item.id) && result.find((el) => el.data.id === item.id) === undefined) {
      const issue = await createDatabaseItem(convertMiddlemanToNotion(item).properties, item.description ?? '');
      item.id = issue!.id;
      cacheData.push(item);
      updateLinearItem(item.linearId, item);
      notionData[item.id] = await convertNotionToMiddleman([issue])[0];
    }
  }

  // for (let i = 0; i < leftOver.length; i++) {
  //   for (let j = 0; j < leftOver[i].length; j++) {
  //     let item = leftOver[i][j];
  //     result.push({ source: i === 0 ? 'notion' : 'linear', data: item, conflict: false, created: true });

  //     if (i === 0) {
  // const issue = await createitem(item);
  // item.linearId = issue!.id;
  //     } else {
  //       const issue = await createDatabaseItem(convertMiddlemanToNotion(item).properties, item.description ?? '');
  //       item.id = issue!.id;
  //     }

  //     cacheData.push(item);
  //   }
  // }

  setCache('syncData', cacheData);

  return result;
};
