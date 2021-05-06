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

def get_module_files(module_dir):
  """Loads module files into memory"""
  module_path = Path(module_dir)
  data_schema = ET.parse(module_path / "data_schema.xml").getroot()  
  ui_schema = ET.parse(module_path / "ui_schema.xml").getroot()
  return (data_schema, ui_schema)

@click.command()
@click.option('--module-dir', prompt="Directory of FAIMS2 Module",
              help="This needs to point to a directory holding data_schema.xml and ui_schema.xml",
              default="../oral-history-doumanis/module/")
def main(module_dir):
  data_schema, ui_schema = get_module_files(module_dir)
  print("hi")

  pprint(data_schema)
  pprint(ui_schema)
  
if __name__ == '__main__':
  main()