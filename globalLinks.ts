import config from './config';
import { linear } from './linearAPI';
import { getNotionUsers } from './notionAPI';

type StatusType = {
  [id: string]: string;
};
export let statuses: StatusType = {};

type LabelType = {
  [id: string]: string;
};
export let labels: LabelType = {};

export type UserType = {
  notionId: string;
  linearId: string;
  notionName: string;
  linearName: string;
  email: string;
};

export let users: UserType[] = [];

let lastUpdatedGlobals = '';

// Function to update global links
export const updateGlobalLinks = async () => {
  const now = new Date().getTime();
  const expiry = parseInt(process.env.GLOBALS_EXPIRY || '3600000'); // default to 1 hour

  var statusPromise;
  if (Object.keys(statuses).length == 0 || now - new Date(lastUpdatedGlobals).getTime() > expiry) {
    statusPromise = linear
      .workflowStates({
        filter: {
          team: {
            id: {
              eq: config.linear.team_id,
            },
          },
        },
      })
      .then((result) => result.nodes?.map((el) => ({ id: el.id, name: el.name })).reduce((acc, el) => ({ ...acc, [el.name]: el.id }), {}));
  }

  var labelPromise;
  if (Object.keys(labels).length == 0 || now - new Date(lastUpdatedGlobals).getTime() > expiry) {
    labelPromise = linear
      .issueLabels({
        // filter: {
        //   team: {
        //     id: {
        //       eq: config.linear.team_id,
        //     },
        //   },
        // },
      })
      .then((result) => result.nodes?.map((el) => ({ id: el.id, name: el.name })).reduce((acc, el) => ({ ...acc, [el.name]: el.id }), {}));
  }

  var userPromise;
  if (users.length == 0 || now - new Date(lastUpdatedGlobals).getTime() > expiry) {
    userPromise = getNotionUsers().then((notionUsers) => {
      const linearUsersPromise = linear.users({});

      return linearUsersPromise.then((linearUsers) =>
        notionUsers
          .filter((user) => user.type === 'person')
          .map((notionUser) => {
            const linearUser = linearUsers.nodes.find(
              (user) => user.email === (notionUser as any)?.person?.email || user.name.toLowerCase() === (notionUser as any)?.name.toLowerCase()
            );
            return {
              notionId: notionUser.id,
              linearId: linearUser?.id || '',
              notionName: notionUser.name,
              linearName: linearUser?.name || '',
              email: (notionUser as any).person.email,
            };
          })
      );
    });
  }

  const [statusesResult, labelsResult, usersResult] = await Promise.all([statusPromise, labelPromise, userPromise]);

  if (!!statusesResult || !!labelsResult || !!usersResult) {
    console.log('SUCCESSFULLY UPDATED GLOBAL LINKS');
    lastUpdatedGlobals = new Date(now).toISOString();
    statuses = statusesResult || statuses;
    labels = labelsResult || labels;
    users = usersResult || users;
  }
};
