import {
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material';
import PouchDB from 'pouchdb-browser';
import {useEffect, useState} from 'react';

const listDatabaseContents = async (dbName: string) => {
  const db = new PouchDB<any>(dbName);
  try {
    const result = await db.allDocs({include_docs: true});
    return result.rows.map(row => row.doc);
  } catch (error) {
    console.error(`Error fetching documents from ${dbName}:`, error);
    return [];
  }
};

export const PouchExplorer = () => {
  const [databaseName, setDatabaseName] = useState<string | null>(null);

  return (
    <>
      <DatabaseSelector onSelect={dbName => setDatabaseName(dbName)} />
      <DatabaseDumper dbName={databaseName || ''} />
      <DatabaseViewer dbName={databaseName || ''} />
    </>
  );
};

const DatabaseSelector = ({onSelect}: {onSelect: (dbName: string) => void}) => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [databaseName, setDatabaseName] = useState<string | null>(null);

  // Get all pouchDB DBs by looking directly at the IDB
  // databases on the device, return an array of database names
  const getPouchDatabases = async () => {
    const PREFIX = '_pouch_';
    const dbList = await indexedDB.databases();
    // find all idb databases that start with the prefix and don't include 'mrview'
    // which is used by pouchdb for views
    const dbs = dbList.filter(
      db => db.name && db.name.startsWith(PREFIX) && !db.name.includes('mrview')
    );
    return dbs.map(db => {
      const name =
        db.name ||
        'this will never happen because we filter out undefined names above, but typescript...';
      // get the pouchdb database name from the IDB name
      const dbName = name.replace(PREFIX, '');
      return dbName;
    });
  };

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const dbs = await getPouchDatabases();
        setDatabases(dbs);
      } catch (error) {
        console.error('Error fetching databases:', error);
      }
    };

    fetchDatabases();
  }, []);

  return (
    <FormControl fullWidth>
      <InputLabel id="database-select-label" sx={{backgroundColor: '#FAFAFB'}}>
        Select Database
      </InputLabel>
      <Select
        labelId="database-select-label"
        value={databaseName || ''}
        onChange={e => {
          const dbName = e.target.value;
          setDatabaseName(dbName);
          onSelect(dbName);
        }}
      >
        {databases.map(dbName => (
          <MenuItem key={dbName} value={dbName}>
            {dbName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const DatabaseViewer = ({dbName}: {dbName: string}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>({});
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  useEffect(() => {
    // reset page when dbName changes
    setPage(0);
    // and clear selected doc
    setSelectedDoc({});
    // and get the docs from this db
    const fetchData = async () => {
      const docs = await listDatabaseContents(dbName);
      setDocuments(docs);
    };

    if (dbName) {
      fetchData();
    }
  }, [dbName]);

  return (
    <Stack direction={'row'} spacing={2} sx={{padding: 2}}>
      <Container>
        <TextField
          sx={{width: '100%'}}
          value={filter}
          placeholder="Filter by ID"
          onChange={e => setFilter(e.target.value)}
        />
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Document ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents
                .filter(doc => {
                  return doc._id.includes(filter);
                })
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map(doc => (
                  <TableRow
                    sx={{
                      backgroundColor:
                        selectedDoc?._id === doc._id ? '#f0f0f0' : 'inherit',
                    }}
                    key={doc._id}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <TableCell>{doc._id}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={documents.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Container>
      <Container>
        <Paper sx={{padding: 2}}>
          <pre>{JSON.stringify(selectedDoc, null, 2)}</pre>
        </Paper>
      </Container>
    </Stack>
  );
};

const DatabaseDumper = ({dbName}: {dbName: string}) => {
  const handleDownload = async () => {
    if (!dbName) {
      console.error('No database selected for download');
      return;
    }

    const docs = await listDatabaseContents(dbName);
    if (docs.length === 0) {
      console.warn('No documents found in the database');
      return;
    }

    const blob = new Blob([docs.map(doc => JSON.stringify(doc)).join('\n')], {
      type: 'application/jsonl',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${dbName}-dump.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Database ${dbName} downloaded successfully.`);
  };

  return <Button onClick={handleDownload}>Download Database Contents</Button>;
};
