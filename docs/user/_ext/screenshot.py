from docutils import nodes
from sphinx.util.docutils import SphinxDirective
from docutils.parsers.rst import directives

# we will derive this from the VITE_THEME environment variable or use a default
import os
THEME = os.getenv('VITE_THEME', 'default')

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'screenshots')

def getThemeOptions():
    # get the names of directories in 
    # the screenshots directory and return them as a list
    return [name for name in os.listdir(SCREENSHOTS_DIR) if os.path.isdir(os.path.join(SCREENSHOTS_DIR, name))]

THEME_OPTIONS = getThemeOptions()
print(f"Available themes: {THEME_OPTIONS}")
class ScreenshotDirective(SphinxDirective):
    required_arguments = 1
    option_spec = {
        'alt': directives.unchanged,
        'class': directives.unchanged,
        'width': directives.unchanged,
        'align': directives.unchanged,
    }

    def run(self):
      screenshot_path = self.arguments[0]

      # Build the full path to the screenshot
      image_path = f'/screenshots/{THEME}/{screenshot_path}'
      
      if not os.path.exists(os.path.join(SCREENSHOTS_DIR, THEME, screenshot_path)):
        # try to find the image in another theme folder
        found = False
        for theme in THEME_OPTIONS:
          if os.path.exists(os.path.join(SCREENSHOTS_DIR, theme, screenshot_path)):
            image_path = f'/screenshots/{theme}/{screenshot_path}'
            found = True
            print(f"Warning: Screenshot '{screenshot_path}' not found in theme '{THEME}', but found in theme '{theme}'. Using that one instead.")
            break
        if not found:
          print(f"Error: Screenshot '{screenshot_path}' not found in theme '{THEME}' or any other theme. Please check the path and theme configuration.")
          return []


      # Create image node
      image_node = nodes.image()
      image_node['uri'] = image_path
      
      # Set default options
      image_node['alt'] = self.options.get('alt', 'Screenshot')
      image_node['classes'] = ['bg-primary']
      
      if 'width' in self.options:
          image_node['width'] = self.options['width']
      else:
          image_node['width'] = '200px'
          
      if 'align' in self.options:
          image_node['align'] = self.options['align']
      else:
          image_node['align'] = 'left'
      
      return [image_node]

# Usage example:
# ```{screenshot} getting-started/app-login-mobile.png
# :alt: Login Screen
# ```

# should generate something like this:
# ```{image} ../../screenshots/default/getting-started/app-login-mobile.png
# :alt: Login Screen
# :class: bg-primary
# :width: 200px
# :align: left
# ```


def setup(app):
  app.add_directive('screenshot', ScreenshotDirective)

  return {
        'version': '0.1',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
