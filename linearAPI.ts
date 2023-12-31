import axios from 'axios';
import config from './config';

import { Issue, LinearClient } from '@linear/sdk';
import { MiddlePropertiesType, convertLinearToMiddleman } from './dataConverter';
import { labels, statuses } from './globalLinks';
import { IssueCreateInput, IssueUpdateInput } from '@linear/sdk/dist/_generated_documents';

export const linear = new LinearClient({ apiKey: config.linear.api_key });

const cache: { [id: string]: MiddlePropertiesType } = {};

async function getLinearItems({ refetchAll }: { refetchAll?: boolean }) {
  try {
    const response = await linear.issues({
      filter: {
        team: {
          id: {
            eq: config!.linear!.team_id!,
          },
        },
        ...(!refetchAll && {
          updatedAt: {
            gte: new Date(new Date().getTime() - 10 * 60 * 1000),
          },
        }),
      },
    });

    const results = response.nodes;

    for (const el of results) {
      const middleManItem = await convertLinearToMiddleman([el])[0];
      cache[middleManItem.id] = middleManItem;

      if (cache[middleManItem.linearId] && middleManItem.id !== middleManItem.linearId) delete cache[middleManItem.linearId];
    }

    // console.log(cache);

    return cache;
  } catch (error) {
    console.error('Error fetching Linear items:', error);
  }
}

export const Priority: any = {
  'No Priority': 0,
  Urgent: 1,
  High: 2,
  Medium: 3,
  Low: 4,
};

function parseLinearMutateObject(properties: MiddlePropertiesType): IssueUpdateInput {
  console.log(properties.type?.map((el) => labels[el]));
  console.log(labels[properties.type[0]]);
  console.log(labels);

  return {
    teamId: config.linear.team_id,
    title: properties.title,
    description: '[Notion Link](' + properties.url + ')\n' + (properties.description || ''),
    stateId: statuses[properties.status || ''] || statuses['Todo'],
    priority: Priority[properties.priority || ''] || 0,
    labelIds: properties.type?.map((el) => labels[el]),
    assigneeId: properties.assign?.linearId,
    dueDate: properties.dueDate,
  };
}

async function updateLinearItem(itemId: string, properties: MiddlePropertiesType) {
  try {
    await linear.updateIssue(itemId, parseLinearMutateObject(properties));
  } catch (error) {
    console.error('Error updating Linear item:', error);
  }
}

async function createLinearItem(properties: MiddlePropertiesType) {
  try {
    const issuePayload = await linear.createIssue(parseLinearMutateObject(properties));
    return (await issuePayload.issue) as Issue;
  } catch (error) {
    console.error('Error creating Linear item:', error);
  }
}

async function deleteLinearItem(itemId: string) {
  try {
    await linear.deleteIssue(itemId);
  } catch (error) {
    console.error('Error deleting Linear item:', error);
  }
}

export { getLinearItems, updateLinearItem, createLinearItem, deleteLinearItem };
