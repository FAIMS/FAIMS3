/*
 * This module exports the configuration of the build, including things like
 * which server to use and whether to include test data
 */

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];
const FALSEY_STRINGS = ['false', '0', 'off', 'no'];

function prod_build(): boolean {
  const prodbuild = process.env.REACT_APP_PRODUCTION_BUILD;
  if (
    prodbuild === '' ||
    prodbuild === undefined ||
    FALSEY_STRINGS.includes(prodbuild.toLowerCase())
  ) {
    return false;
  } else if (TRUTHY_STRINGS.includes(prodbuild.toLowerCase())) {
    return true;
  } else {
    console.error('REACT_APP_PRODUCTION_BUILD badly defined, assuming false');
    return false;
  }
}
/*
 * This isn't exported, instead to help reduce the number of environment
 * variables to set to get a production build for real users. Can be used in the
 * rest of the configuartion.
 */
const PROD_BUILD = prod_build();

function use_real_data(): boolean {
  const userealdata = process.env.REACT_APP_USE_REAL_DATA;
  if (
    userealdata === '' ||
    userealdata === undefined ||
    FALSEY_STRINGS.includes(userealdata.toLowerCase())
  ) {
    return false;
  } else if (TRUTHY_STRINGS.includes(userealdata.toLowerCase())) {
    return true;
  } else {
    console.error('REACT_APP_USE_REAL_DATA badly defined, assuming false');
    return false;
  }
}

function directory_protocol(): string {
  const usehttps = process.env.REACT_APP_USE_HTTPS;
  if (PROD_BUILD) {
    return 'https';
  } else if (
    usehttps === '' ||
    usehttps === undefined ||
    FALSEY_STRINGS.includes(usehttps.toLowerCase())
  ) {
    return 'http';
  } else if (TRUTHY_STRINGS.includes(usehttps.toLowerCase())) {
    return 'https';
  } else {
    console.error('REACT_APP_USE_HTTPS badly defined, assuming false');
    return 'http';
  }
}

function directory_host(): string {
  const host = process.env.REACT_APP_DIRECTORY_HOST;
  if (host === '' || host === undefined) {
    return '10.80.11.44';
  }
  return host;
}

function directory_port(): number {
  const port = process.env.REACT_APP_DIRECTORY_PORT;
  if (port === '' || port === undefined) {
    if (PROD_BUILD) {
      return 443;
    }
    return 5984;
  }
  try {
    return parseInt(port);
  } catch (err) {
    console.error(err);
    console.error('Falling back to default port');
    return 5984;
  }
}

function is_testing() {
  const jest_worker_is_running = process.env.JEST_WORKER_ID !== undefined;
  const jest_imported = typeof jest !== 'undefined';
  const test_node_env = process.env.NODE_ENV === 'test';
  return jest_worker_is_running || jest_imported || test_node_env;
}

export const USE_REAL_DATA = PROD_BUILD || use_real_data();
export const DIRECTORY_PROTOCOL = directory_protocol();
export const DIRECTORY_HOST = directory_host();
export const DIRECTORY_PORT = directory_port();
export const RUNNING_UNDER_TEST = is_testing();
