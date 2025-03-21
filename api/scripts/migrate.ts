import {migrateDbs} from '@faims3/data-model';

if (!process.env.COUCHDB_USER) {
  console.log('COUCHDB_USER not set in .env');
  process.exit();
}
if (!process.env.COUCHDB_PASSWORD) {
  console.log('COUCHDB_USER not set in .env');
  process.exit();
}

const main = async filename => {
  console.log(filename);
  const jsonText = fs.readFileSync(filename, 'utf-8');
  const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
  const name = metadata.name;

  // load template
  fetch(CONDUCTOR_URL + '/api/templates/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.jwt_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata,
      ui_specification: uiSpec,
      template_name: name,
    }),
  })
    .then(response => console.log(response.status))
    .catch(error => {
      console.log(error);
    });
};

const extension = filename => {
  return (
    filename.substring(filename.lastIndexOf('.') + 1, filename.length) ||
    filename
  );
};

if (process.argv.length > 2) {
  files = process.argv.slice(2);
  files.forEach(filename => {
    if (extension(filename) === 'json') {
      main(filename);
    }
  });
}
