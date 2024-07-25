# Task in Refactoring

* datamodel/typesystem.ts should be types.ts and have all exported types
 and only have types, currently it has some functions and other types are
 defined elsewhere

* External modules that are imported - need a way to handle these
  * getDataDB from 'sync' - returns the dataDB for a project_id
  * shouldDisplayRecord from 'users' - used to filter records, might
  be best to move this inside this library since it will be useful
  in conductor as well
  * local_state_db - from 'sync' is used in autoincrement.ts and fieldpersistent.ts
  might need to move that functionality back into FAIMS?
  * getProjectDB - from 'sync' is used in autoincrement.ts to get project
    autoincrementers.

* the type TokenInfo references KeyLike from jose, in FAIMS3 it's only
  used in the 'user' module so could probably be local to that module
  (unless we also want users in conductor).

* in typesystem.ts we have isAttachment which checks to see if it's argument
  is an instance of Blob.  Blob isn't there in node by default so we will need
  a better test that will work on both browser and node.  Initially just having
  that fn return false to get the tests to run 

* the exported interface 'option' could do with a better name!

* data_storage/validation.ts is about form validation and relies on getting the
 uiSpec for a notebook via modules not included here.  Remove it from here for
 now but consider pulling all of the metadata manipulation code into here at some
 later time

* to get a list of records we have getRecordsWithRegex (data_storage/index.ts) 
 and getAllRecordsWithRegex (data_storage/queries.ts).   getRecords calls getAllRecords
 and then calls filterRecordMetadata to optionally remove deleted records and those
 that shouldn't be visible to the user (shouldDisplayRecord).   Both are 
 used in FAIMS but surely only getRecordsWithRegex should be used because we
 always want to remove hidden records...actually the use of getAll is in my
 code to navigate via QR code so is not correct.  getAll should not be
 exported here and that QR code (in gui/components/notebook/add_record_by_type.tsx)
 should be modified.

 

