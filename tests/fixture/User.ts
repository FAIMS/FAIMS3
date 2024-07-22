require('dotenv').config()
export const userFixture = {
    login: process.env.USER_NAME,
    pass: process.env.USER_PASSWORD,
    isLocal: process.env.IS_LOCAL
};