declare module 'supertest' {
  import {Express} from 'express';
  
  // Augment the existing namespace
  namespace supertest {
    function request(app: Express): SuperTest<Test>;
  }
  
  // Override the default export
  function request(app: Express): supertest.SuperTest<supertest.Test>;
  export = request;
}
