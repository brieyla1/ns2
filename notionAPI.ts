import config from './config';
import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { markdownToBlocks } from '@tryfabric/martian';
import { MiddlePropertiesType, convertNotionToMiddleman } from './dataConverter';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

// Notion API endpoint
export const notion = new Client({ auth: config.notion.api_key });
const n2m = new NotionToMarkdown({ notionClient: notion, config: { parseChildPages: true } });

const cache: { [id: string]: MiddlePropertiesType } = {};

async function getDatabaseItems({ refetchAll }: { refetchAll?: boolean }) {
  try {
    const response = await notion.databases.query({
      database_id: config.notion.database_id,
      archived: false,
      ...(!refetchAll && {
        filter: {
          timestamp: 'last_edited_time',
          last_edited_time: {
            // 10 minutes ago
            on_or_after: new Date(new Date().getTime() - 1 * 60 * 1000).toISOString(),
          },
        },
      }),
    });

    const results = await Promise.all(
      response.results
        // limit to 1 for testing
        // .slice(0, 1)
        .map(async (el) => ({
          ...el,
          body: n2m.toMarkdownString(await n2m.pageToMarkdown(el.id)).parent,
        }))
    );

    (results as any[]).forEach((el: NotionObject) => {
      cache[el.id] = convertNotionToMiddleman([el])[0];
    });

    console.log('Grabbed latest notion items, total: ', Object.keys(cache).length);

    return cache;
  } catch (error) {
    console.error('Error fetching Notion database items:', error);
  }
}

async function updateDatabaseItem(itemId, properties, text: string | null = null) {
  try {
    await notion.pages.update({
      page_id: itemId,
      properties,
    });

    if (text == null) return;

    const newBlocks = markdownToBlocks(text);
    const oldBlocks = await notion.blocks.children.list({
      block_id: itemId,
    });

    // Update the blocks that have the same index
    const minBlocksLength = Math.min(newBlocks.length, oldBlocks.results.length);
    for (let i = 0; i < minBlocksLength; i++) {
      await notion.blocks.update({
        block_id: oldBlocks.results[i].id,
        ...newBlocks[i],
      });
    }

    // If there are leftover blocks, delete them
    if (newBlocks.length < oldBlocks.results.length) {
      for (let i = newBlocks.length; i < oldBlocks.results.length; i++) {
        await notion.blocks.delete({ block_id: oldBlocks.results[i].id });
      }
    }

    // If there are additional new blocks, append them
    if (newBlocks.length > oldBlocks.results.length) {
      for (let i = oldBlocks.results.length; i < newBlocks.length; i++) {
        await notion.blocks.children.append({
          block_id: itemId,
          children: [newBlocks[i] as any],
        });
      }
    }

    console.log('UPDATED NOTION ITEM: ', itemId);
  } catch (error) {
    console.error('Error updating Notion database item:', error);
  }
}

export const getNotionUsers = async () => {
  try {
    const response = await notion.users.list({});
    return response.results;
  } catch (error) {
    console.error(`Error fetching Notion users: ${error}`);
    return [];
  }
};

export const deleteDatabaseItem = async (itemId: string) => {
  try {
    await notion.pages.update({
      page_id: itemId,
      archived: true,
    });
  } catch (error) {
    console.error(`Error deleting Notion item: ${error}`);
  }
};

export const createDatabaseItem = async (properties: any, text: string) => {
  const newBlocks = markdownToBlocks(text);
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: config.notion.database_id,
      },
      properties,
      content: newBlocks as BlockObjectRequest[],
    });

    return response;
  } catch (error) {
    console.error(`Error creating Notion item: ${error}`);
  }
};

export { getDatabaseItems, updateDatabaseItem };

export type NotionObject = {
  object: string;
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: {
    object: string;
    id: string;
  };
  last_edited_by: {
    object: string;
    id: string;
  };
  cover: null;
  icon: null;
  parent: {
    type: string;
    database_id: string;
  };
  archived: boolean;
  properties: {
    Status: {
      id: string;
      type: string;
      select: {
        id: string;
        name: string;
        color: string;
      };
    };
    Date: {
      id: string;
      type: string;
      date: {
        start: string;
        end: null;
        time_zone: null;
      };
    };
    Priority: {
      id: string;
      type: string;
      select: {
        id: string;
        name: string;
        color: string;
      };
    };
    Type: {
      id: string;
      type: string;
      multi_select: [
        {
          id: string;
          name: string;
          color: string;
        }
      ];
    };
    AutoLinearId: {
      id: string;
      type: string;
      rich_text: [
        {
          type: string;
          text: {
            content: string;
            link: null;
          };
          annotations: {
            bold: boolean;
            italic: boolean;
            strikethrough: boolean;
            underline: boolean;
            code: boolean;
            color: string;
          };
          plain_text: string;
          href: null;
        }
      ];
    };
    Assign: {
      id: string;
      type: string;
      people: [
        {
          id: string;
          name: string;
          avatar_url: string;
          type: string;
          person: {
            email: string;
          };
        }
      ];
    };
    Name: {
      id: string;
      type: string;
      title: [
        {
          type: string;
          text: {
            content: string;
            link: null;
          };
          annotations: {
            bold: boolean;
            italic: boolean;
            strikethrough: boolean;
            underline: boolean;
            code: boolean;
            color: string;
          };
          plain_text: string;
          href: null;
        }
      ];
    };
  };
  url: string;
  public_url: null;
  body: string;
};
