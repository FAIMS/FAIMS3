# {{Notebook}} Templates

Data collection and management in {{FAIMS}} is done using {{notebooks}}, but it is common
to re-use the same {{notebook}} structure in multiple data collection exercises. This
facilitates common data structures so that data can be compared between and across
many data collection events. To enable this practice, {{FAIMS}} supports _{{notebook}} templates_
which can be used to create many {{notebooks}}.

## Template Structure

A template uses the same form design structure as a {{notebook}}. Templates are stored in a
separate templates database and can be marked **public** or **archived** for sharing across teams.

## Creating a Template

In the {{dashboard}} web application you can create a new template if you have
permission to do so within your team. Enter a **template name**; you may add an
optional **description** (up to 250 characters). The template can be created
from scratch or from a previously downloaded JSON file (design layout only).

Once the template has been created, you can edit the template as you would a {{notebook}} in the
designer application.

## Creating {{Notebooks}} from a Template

In the {{dashboard}} web application you can create a new {{notebook}} from a template. Enter a
**name**; you may add an optional **description** (up to 250 characters).

The {{notebook}} records the source template on the survey (**template used** in the {{dashboard}})
so you can trace which template it was created from. Design provenance from copying another
definition may also appear as **derived from template** in design metadata when applicable.

The created {{notebook}} is a snapshot copy of the template at time of creation. Any subsequent
changes to the template **will not** be reflected in the {{notebooks}} created from it.

It is possible to make changes to the {{notebook}} that was created from the template using the
{{notebook}} editor.

**Note** we are working on implementing restrictions on changes to fields within {{notebooks}}
derived from templates. A template would be able to assert that a field cannot be changed or
can be hidden but not removed, for example.
