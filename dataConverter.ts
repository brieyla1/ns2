import { Issue } from '@linear/sdk';
import { Priority } from './linearAPI';
// const config = require('./config.json');
import config from './config';
import { NotionObject, notion } from './notionAPI';
import { UserType, users } from './globalLinks';

export type MiddlePropertiesType = {
  id: string;
  url: string;
  linearId: string;
  title: string;
  status: string | undefined;
  priority: string;
  description: string | undefined;
  type: string[];
  assign: UserType | undefined;
  dueDate: string;
};

const convertNotionToMiddleman = (notionData: NotionObject[]): MiddlePropertiesType[] => {
  return notionData.map((item) => {
    return {
      id: item.id,
      url: item.url,
      linearId: item.properties?.AutoLinearId?.rich_text?.[0]?.plain_text || '',
      title: item.properties.Name.title[0].text.content,
      description: item.body,
      status: item.properties.Status?.select?.name || 'ToDo',
      priority: item.properties?.Priority?.select?.name || 'No Priority',
      type: item.properties.Type.multi_select.map((type) => type.name),
      assign: users.find((el: any) => el.notionId === item.properties?.Assign?.people?.[0]?.id),
      dueDate: item.properties?.Date?.date?.start,
    };
  });
};

const convertMiddlemanToNotion = (item: MiddlePropertiesType): NotionObject => {
  return {
    id: item.id,
    properties: {
      AutoLinearId: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: item.linearId,
            },
          },
        ],
      },
      Name: {
        title: [
          {
            text: {
              content: item.title,
              link: null,
            },
          },
        ],
      },
      Status: {
        select: {
          name: item.status || '',
        },
      },
      Priority: {
        select: {
          name: item.priority,
        },
      },
      Type: {
        multi_select: item.type.map((type) => ({ name: type })),
      },

      Assign: {
        people: item?.assign ? [{ id: item?.assign?.notionId }] : [],
      },

      ...(item.dueDate && {
        Date: {
          date: {
            start: item.dueDate,
          },
        },
      }),
    },
    body: item.description || '',
  } as any;
};

const convertLinearToMiddleman = (linearData: Issue[]): Promise<MiddlePropertiesType>[] => {
  return linearData.map(async (item) => {
    const notionItem = (
      await notion.databases.query({
        database_id: config.notion.database_id,
        filter: {
          property: 'AutoLinearId',
          rich_text: {
            equals: item.id,
          },
        },
      })
    ).results[0];

    const assignee = await item.assignee;

    // regex the body for the notion link
    // [Notion Link](https://www.notion.so/Linear-Notion-Integration-0a5e2e5e4b5c4e2e9b2b2b2b2b2b2b2b)
    // Remove the first Line
    const description = item.description?.split('\n').slice(1).join('\n');

    return {
      id: notionItem?.id || item.id,
      url: (notionItem as any)?.url,
      linearId: item.id,
      title: item.title,
      description: description,
      status: (await item.state)?.name,
      priority: Object.keys(Priority).find((key) => Priority[key] === item.priority) || '',
      type: (await item?.labels?.())?.nodes.map((label) => label.name),
      assign: users.find((el: any) => el.linearId === assignee?.id),
      dueDate: item.dueDate,
    };
  });
};

export { convertNotionToMiddleman, convertMiddlemanToNotion, convertLinearToMiddleman };
