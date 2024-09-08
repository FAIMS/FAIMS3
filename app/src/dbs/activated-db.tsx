import PouchDB from 'pouchdb-browser';

const db = new PouchDB<{
  _id: string;
  activated: boolean;
}>('local-activated');

export const activateProject = async (_id: string) =>
  await db.put({
    _id,
    activated: true,
  });

export const getActiveProjects = async () => {
  const {rows} = await db.allDocs({include_docs: true});

  return new Map(
    rows
      .map(({doc}) => doc)
      .filter(doc => doc !== undefined)
      .map(({_id, activated}) => [_id, activated])
  );
};
