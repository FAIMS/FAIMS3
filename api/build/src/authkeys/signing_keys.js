"use strict";
/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: src/authkeys/signing_keys.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSigningKey = void 0;
const promises_1 = require("fs/promises");
const jose_1 = require("jose");
const buildconfig_1 = require("../buildconfig");
let SIGNING_KEY;
/**
 * getSigningKey - get the authoritative public/private key pair for this app
 * @returns the singing key instance
 */
const getSigningKey = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!SIGNING_KEY) {
        SIGNING_KEY = yield loadSigningKey({
            signing_algorithm: 'RS256',
            instance_name: buildconfig_1.CONDUCTOR_INSTANCE_NAME,
            key_id: buildconfig_1.CONDUCTOR_KEY_ID,
            public_key_file: buildconfig_1.CONDUCTOR_PUBLIC_KEY_PATH,
            private_key_file: buildconfig_1.CONDUCTOR_PRIVATE_KEY_PATH,
        });
    }
    return SIGNING_KEY;
});
exports.getSigningKey = getSigningKey;
const loadSigningKey = (config) => __awaiter(void 0, void 0, void 0, function* () {
    let filehandle;
    let private_key_string;
    let public_key_string;
    try {
        filehandle = yield (0, promises_1.open)(config.private_key_file, 'r');
        private_key_string = yield filehandle.readFile('utf-8');
    }
    finally {
        yield (filehandle === null || filehandle === void 0 ? void 0 : filehandle.close());
    }
    try {
        filehandle = yield (0, promises_1.open)(config.public_key_file, 'r');
        public_key_string = yield filehandle.readFile('utf-8');
    }
    finally {
        yield (filehandle === null || filehandle === void 0 ? void 0 : filehandle.close());
    }
    const private_key = yield (0, jose_1.importPKCS8)(private_key_string, config.signing_algorithm);
    const public_key = yield (0, jose_1.importSPKI)(public_key_string, config.signing_algorithm);
    return {
        private_key: private_key,
        public_key: public_key,
        public_key_string: public_key_string,
        instance_name: config.instance_name,
        alg: config.signing_algorithm,
        kid: config.key_id,
    };
});
