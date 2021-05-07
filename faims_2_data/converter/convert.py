#!/usr/bin/env python3
'''
FAIMS 2->3 converter
Brian Ballsun-Stanton
Take in data/ui files of a FAIMS2 module and spit out ... useful things for FAIMS 3. Ignores logic for now.
'''

import click
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
from pprint import pprint
from collections import defaultdict, OrderedDict
import re

CONTAINER="""
import {{setUiSpecForProject}} from './uiSpecification';
import {{ProjectUIModel}} from './datamodel';

const example_ui_specs: {{[key: string]: ProjectUIModel}} = {{
  'default/{project_name}': {{
    fields: {{
      {fields}
    }},
    views:{{
      {view_containers}
    }},
    start_view: {first_view}
  }}
}}

"""

STR_FIELD="""
'{element_name}': {{
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {{
    fullWidth: true,
    name: '{element_name}',
    id: '{element_name}',
    helperText: '{description}',
    variant: 'outlined',
    required: true,
    InputProps: {{
          type: 'string',
        }},
    SelectProps: {{}},
    InputLabelProps: {{
          label: '{display_name}',
        }},
    FormHelperTextProps: {{}},
  }},
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}}
"""

SELECT_FIELD="""
'{element_name}':{{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {{
                  fullWidth: true,
                  name: '{element_name}',
                  id: '{element_name}',
                  helperText: '{display_name}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {{
                                      type: 'string',
                                    }},
                  SelectProps: {{
                                options: [
                                  {option_list}
                                ],
                              }},
                  InputLabelProps: {{
                                      label: '{label}',
                                    }},
                  FormHelperTextProps: {{children: 'Some helper text'}},
                }},
        validationSchema: [['yup.string']],
        initialValue: '',
      }}
"""

VOCAB = """
{{
  value: '{value}',
  label: '{label}',
}}
"""

VIEW="""
'{view_name}':{{
  fields:[{field_list}]
}},
'next-view': '{next_view_id}',
'next-view-label': '{next_view_name}',
"""


def get_module_files(module_dir):
  """Loads module files into memory"""
  module_path = Path(module_dir)
  data_schema = ET.parse(module_path / "data_schema.xml").getroot()  
  ui_schema = ET.parse(module_path / "ui_schema.xml").getroot()
  return (data_schema, ui_schema)


def get_archents(data_schema):
  archents = defaultdict(dict)
  for entity in data_schema:
    # We're going to ignore relns for now. The FAIMS 1-2 implementation never panned out the way I wanted.
    if entity.tag == "ArchaeologicalElement":
      archent = entity.attrib['name']
      archents[archent]['properties'] = {}
      archents[archent]['name'] = archent
      for element in entity:
        if element.tag == "description" and element.text:
          archents[archent]['description'] = element.text
        elif element.tag == "property":
          element_name = element.attrib['name']
          archents[archent]['properties'][element_name] = {'name':element_name,
                                                           'type':element.attrib['type'],
                                                           'isIdentifier':element.attrib.get('isIdentifier', False),
                                                           }
          archents[archent]['properties'][element_name]['description'] = element.find('description').text
          archents[archent]['properties'][element_name]['formatString'] = element.find('formatString').text
          archents[archent]['properties'][element_name]['appendCharacterString'] = element.find('appendCharacterString').text
          if lookup := element.find("lookup"):
            archents[archent]['properties'][element_name]['vocab'] = []
            for vocab in lookup:
              
              archents[archent]['properties'][element_name]['vocab'].append({'term':vocab.text.strip(), 
                                                                             'desc':vocab.find("description").text.strip(),
                                                                             'pictureURL':vocab.get("pictureUrl", None)
                                                                             })
  #pprint(archents, indent=1, compact=True, width=200)
  return archents
def get_ui_layout(ui_schema, archent_data):
  ns = {"h":"http://www.w3.org/1999/xhtml",
        'x':"http://www.w3.org/2002/xforms"}
  decimal_bindings = []
  for binder in ui_schema.findall("././h:head/x:model/x:bind", ns):
    decimal_bindings.append({'path':binder.get("nodeset"),
                             'type':binder.get("type")})
  #print(decimal_bindings)
  tabgroups = {}
  for group in ui_schema.findall("././h:body/x:group", ns):
    
    
    ref = group.get("ref")
    aent_link = group.get("faims_archent_type")
    
    if aent_link:
      #print(ET.tostring(group))

      tabgroups[ref] = {'view_name':ref,
                        'display_name':group.find('./x:label', ns).text.strip(),
                        'data_schema':aent_link,
                        'tabs':OrderedDict()}
      for tab in group.findall("./x:group", ns):
        tabref = tab.get("ref")
        tabgroups[ref]['tabs'][tabref] = {'view_name':tabref,
                                          'display_name':tab.find('./x:label', ns).text.strip(),
                                          'fields':OrderedDict()}
        for field in tab.findall(".//x:input", ns)+tab.findall(".//x:select1", ns):
          
          field_ref = field.get("ref")
          field_type = field.tag
          database_entry_name = field.get("faims_attribute_name")
          field_path = f"{ref}/{tabref}/{field_ref}" # Need to deal with binding elements... later
          #print(aent_link, database_entry_name)
          tabgroups[ref]['tabs'][tabref]['fields'][field_ref] = {'element_name':field_ref,
                                                      'display_name':field.find('./x:label', ns).text.strip(),
                                                      'attribute_name':database_entry_name,
                                                      'attribute_type':field.get("faims_attribute_type"),
                                                      'database_entry':archent_data[aent_link]['properties'].get(database_entry_name)}
  pprint(tabgroups, indent=1, compact=True, width=200)
  return tabgroups
def render_ts(ui_data, project_name):
  field_list = []
  view_list = []
  for tabgroup_key, tabgroup in ui_data.items():
    #pprint(tabgroup.keys())
    for tab_key, tab in tabgroup['tabs'].items():
      tab_fields = []
      #pprint(tab.keys())
      for field_key, field in tab['fields'].items():
        #pprint(field.keys())
        if field['database_entry']:
          
          #print(field['database_entry'].keys())
          if field['database_entry'].get('type') == "measure":
            new_field = STR_FIELD.format(element_name=field['element_name'],
                                     description=field['database_entry']['description'],
                                     display_name=field['display_name'],
                                     )
            field_list.append(new_field)
            tab_fields.append(f"\n'{field['element_name']}'")

          elif field['database_entry'].get('type') == "vocab":
            #print(field['database_entry']['vocab'])
            option_list = []
            for vocab in field['database_entry']['vocab']:
              option_list.append(VOCAB.format(value=vocab['term'],
                                              label=vocab['term']))
              #print(option_list)
            new_field = SELECT_FIELD.format(element_name=field['element_name'],
                                     description=field['database_entry']['description'],
                                     display_name=field['display_name'],
                                     label=field['display_name'],
                                     option_list=','.join(option_list)
                                     )
            field_list.append(new_field)
            tab_fields.append(f"\n'{field['element_name']}'")
          else:
            print(f"HELP? {tabgroup_key}/{tab_key}/{tab_key} {field['database_entry'].get('type')}")
        else:
          print(f"no db entry for {tabgroup_key}/{tab_key}/{tab_key}, skipping for now, even though this is probably a list of child-entities.")
      new_view = VIEW.format(view_name=f"{tabgroup_key}/{tab_key}",
                             field_list=f"{','.join(tab_fields)}",
                             next_view_id="FIXME",
                             next_view_name="FIXME")
      view_list.append(new_view)
  output = CONTAINER.format(project_name=project_name, fields=','.join(field_list), view_containers=','.join(view_list), first_view="first")
  return output

@click.command()
@click.option('--module-dir', prompt="Directory of FAIMS2 Module",
              help="This needs to point to a directory holding data_schema.xml and ui_schema.xml",
              default="../oral-history-doumanis/module/")
@click.option('--project-name', prompt="Name this project should be called",
              help="Any string",
              default="Oral History")
def main(module_dir, project_name):
  data_schema, ui_schema = get_module_files(module_dir)
  


  """
  We need data schemas to get formatstrings (eventually), descriptions, and controlled vocabularies. 
  Since if the name of an attribute is its key, same attribute name = same attribute, even if associated with different entities. This was silly, in retrospect.
  """
  archent_data = get_archents(data_schema)
  ui_data = get_ui_layout(ui_schema, archent_data)
  project_filename = re.sub(r"[^A-Za-z0-9]+","_", project_name)

  with open(f"converted/{project_filename}.ts", "w") as tsfile:
    tsfile.write(render_ts(ui_data, project_name))
if __name__ == '__main__':
  main()