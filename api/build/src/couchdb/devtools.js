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
 * Filename: devtools.ts
 * Description:
 *    Tools used in development and testing of FAIMS
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
exports.createRandomRecord = exports.createManyRandomRecords = void 0;
const faims3_datamodel_1 = require("faims3-datamodel");
const notebooks_1 = require("./notebooks");
const crypto_1 = require("crypto");
const node_fs_1 = require("node:fs");
const createManyRandomRecords = (project_id, count) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('creating', count, 'random records');
    const record_ids = [];
    for (let i = 0; i < count; i++) {
        const r_id = yield (0, exports.createRandomRecord)(project_id);
        record_ids.push(r_id);
    }
    return record_ids;
});
exports.createManyRandomRecords = createManyRandomRecords;
/**
 * Create a new record for this notebook with random data values for all fields
 * @param project_id Project id
 */
const createRandomRecord = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    // get the project uiSpec
    // select one form from the notebook
    // get a list of fields and their types
    // generate data for each field
    // create the record object and call upsertFAIMSData
    const uiSpec = yield (0, notebooks_1.getNotebookUISpec)(project_id);
    if (uiSpec) {
        const forms = Object.keys(uiSpec.viewsets);
        if (forms.length === 0) {
            return;
        }
        const formName = forms[(0, crypto_1.randomInt)(forms.length)];
        const form = uiSpec.viewsets[formName];
        const views = form.views;
        const fields = [];
        views.map((view) => {
            uiSpec.fviews[view].fields.map((f) => fields.push(f));
        });
        // get the types of the fields
        const field_types = {};
        fields.map((field) => {
            field_types[field] =
                uiSpec.fields[field]['type-returned'] || 'faims-core::String';
        });
        const values = {};
        fields.map((field) => {
            values[field] = generateValue(uiSpec.fields[field]);
        });
        const annotations = {};
        fields.map((field) => {
            annotations[field] = { annotations: '', uncertainty: false };
        });
        const newRecord = {
            record_id: (0, faims3_datamodel_1.generateFAIMSDataID)(),
            data: values,
            type: formName,
            updated_by: 'admin',
            updated: new Date(),
            field_types: field_types,
            ugc_comment: '',
            relationship: {},
            deleted: false,
            revision_id: null,
            annotations: annotations,
        };
        const result = yield (0, faims3_datamodel_1.upsertFAIMSData)(project_id, newRecord);
        return result;
    }
    else {
        throw new Error(`notebook not found with id ${project_id}`);
    }
});
exports.createRandomRecord = createRandomRecord;
const SAMPLE_IMAGE_FILE = 'test/test-attachment-image.jpg';
const generateValue = (field) => {
    //console.log('generateValue', field);
    const fieldType = field['type-returned'];
    if (field['component-parameters'].hrid) {
        // create a nice HRID like thing
        return 'Bobalooba' + (0, crypto_1.randomInt)(10000).toString();
    }
    if (field['component-name'] === 'Select') {
        const options = field['component-parameters'].ElementProps.options.map((o) => o.value);
        return options[(0, crypto_1.randomInt)(options.length)];
    }
    // TODO: use 'faker' to generate more realistic data
    switch (fieldType) {
        case 'faims-core::String':
            return 'Bobalooba';
        case 'faims-attachment::Files': {
            const image = (0, node_fs_1.readFileSync)(SAMPLE_IMAGE_FILE);
            const buffer = Buffer.from(image);
            return [{ type: 'image/jpeg', data: buffer }];
        }
        case 'faims-core::Integer':
            return (0, crypto_1.randomInt)(100);
        case 'faims-core::Bool':
            return (0, crypto_1.randomInt)(10) > 5;
        case 'faims-core::Date':
            return new Date().toISOString();
        case 'faims-pos::Location':
            return {
                type: 'Feature',
                properties: {
                    timestamp: Date.now(),
                    altitude: null,
                    speed: null,
                    heading: null,
                    accuracy: 20,
                    altitude_accuracy: null,
                },
                geometry: {
                    type: 'Point',
                    coordinates: [
                        (0, crypto_1.randomInt)(180) + (0, crypto_1.randomInt)(10000) / 10000,
                        (0, crypto_1.randomInt)(180) - 90 + (0, crypto_1.randomInt)(10000) / 10000,
                    ],
                },
            };
        default:
            return '';
    }
};
