import { createDatabaseItem, deleteDatabaseItem, getDatabaseItems, updateDatabaseItem } from './notionAPI';
import { createLinearItem, deleteLinearItem, getLinearItems, updateLinearItem } from './linearAPI';
import { compareDataAndSaveToCache } from './comparator';
import { convertMiddlemanToNotion } from './dataConverter';
import { initiateCache } from './cache';

let firstRun = true;

export const syncData = async () => {
  try {
    // Fetch data from Notion and Linear
    const notionData = await getDatabaseItems({ refetchAll: firstRun });
    const linearData = await getLinearItems({ refetchAll: firstRun });

    if (firstRun) initiateCache(notionData!, linearData!);
    firstRun = false;

    // Compare data
    const diffs = await compareDataAndSaveToCache({ notionData: notionData!, linearData: linearData! });

    for (const diff of diffs) {
      if (diff) {
        // Update cache
        const data = diff.data;

        // Update Notion or Linear based on the source of the most recent data
        if (diff.source === 'linear') {
          if (diff.deleted) {
            console.log('deleting notion item');
            deleteDatabaseItem(data.id);
          } else {
            console.log('updating notion item');
            await updateDatabaseItem(data.id, convertMiddlemanToNotion(data).properties, diff.updateTextIfNotion ? data.description ?? null : null);
          }
        } else if (diff.source === 'notion') {
          if (diff.deleted) {
            console.log('deleting linear item');
            await deleteLinearItem(data.linearId);
          } else {
            console.log('updating linear item');
            await updateLinearItem(data.linearId, data);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error syncing data:', error);
  }
};
