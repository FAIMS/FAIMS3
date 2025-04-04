
# Copyright 2021, 2022 Macquarie University
#
# Licensed under the Apache License Version 2.0 (the, "License");
# you may not use, this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing software
# distributed under the License is distributed on an "AS IS" BASIS
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
# See, the License, for the specific language governing permissions and
# limitations under the License.
#
# Filename: migrate-notebook.py
# Description:
#   Migrate a notebook from the initial coudbdb dump format to the new
#  format supported by the Conductor API. Make some changes for future
#  proofing.   Rewrite field names to be more informative rather than
#  just 'newfield1233445'. 

# Usage: python3 migrate-notebook.py <notebook.json>


import json
import sys
import unicodedata
import re
import shutil

jsonfile = sys.argv[1]

def slugify(value):
  slug = unicodedata.normalize('NFKD', value)

  slug = slug.lower()
  slug = re.sub(r'[^a-z0-9]+', '-', slug).strip('-')
  slug = re.sub(r'[-]+', '-', slug)

  return slug

def field_mapping(ui_spec):

    counters = {}
    mapping = {}
    for field in ui_spec['fields']:
        params = ui_spec['fields'][field]['component-parameters']
        component_name = ui_spec['fields'][field]['component-name']
        type_name = ''
        if field.startswith('hrid'):
            type_name = field
        elif 'InputLabelProps' in params and params['InputLabelProps']['label'] != '':
            type_name = params['InputLabelProps']['label']
        elif 'label' in params and params['label'] != '' and not component_name == 'RandomStyle':
            type_name = params['label']
        elif 'FormLabelProps' in params:
            type_name = params['FormLabelProps']['children']
        elif component_name == 'RandomStyle':
            # randomstyle is just a stupid name
            type_name = 'html-text'
        
        # final fallback
        if type_name == '':
            type_name = component_name
 
        if type_name not in counters:
            counters[type_name] = 1
        else:
            counters[type_name] += 1
        
        if type_name.startswith('hrid'):
            new_name = type_name  # don't slugify hrid field names
        elif counters[type_name] == 1:
            new_name = slugify(type_name)
        else:
            new_name = slugify(type_name + ' ' + str(counters[type_name]))
        mapping[field] = new_name

    # save the mapping for later reference, eg. updating data records
    with open('mapping.json', 'w') as f:
        json.dump(mapping, f, indent=2)

    return mapping


def process_ui_spec(ui_spec):

    ui_spec.pop('_id', None)
    ui_spec.pop('_rev', None)

    mapping = field_mapping(ui_spec)

    jsontext = json.dumps(ui_spec)
    for field in mapping:
        jsontext = jsontext.replace(field, mapping[field])
    ui_spec = json.loads(jsontext)

    return ui_spec

legacy = {}

for record in json.load(open(jsonfile)):
    legacy[record['_id']] = record

metadata = legacy['project-metadata-projectvalue']['metadata']
# update metadata to insert a version number for this notebook 
# and a schema version number in case we upgrade the schema in future
metadata['notebook_version'] = '1.0'
metadata['schema_version'] = '1.0'

# move the section description from the metadata into the ui-spec
for section in metadata['sections']:
    description = metadata['sections'][section]['sectiondescription' + section]
    if section in legacy['ui-specification']['fviews']:
        legacy['ui-specification']['fviews'][section]['description'] = description

metadata['sections'] = {}

result = {
    'metadata': metadata,
    'ui-specification': process_ui_spec(legacy['ui-specification']),
}

name = jsonfile.split('.')[0].replace('-', ' ').title()
result['metadata']['name'] = name

shutil.move(jsonfile, jsonfile + '.bak')

json.dump(result, open(jsonfile, 'w'), indent=2)

print("To update the old style git repo, run:")
print("git rm createNotebook.sh replaceNotebook.sh faims3-temp-notebook-migrator")
print("git add " + jsonfile)
print("git commit -m 'migrate notebook to new format'")
