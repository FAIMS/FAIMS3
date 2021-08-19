import express from 'express';

const app = express();
app.get('/', (req, res) => {
  res.send('Hello World - here an Express project with TS');
});
app.listen(8080, () => {
  console.log('The hello is listening on port 8080!');
});
