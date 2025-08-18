# {{Notebook}} Templates

Data collection and management in {{FAIMS}} is done using {{notebooks}}, but it is common
to re-use the same {{notebook}} structure in multiple data collection exercises. This
facilitates common data structures so that data can be compared between and across
many data collection events.  To enable this practice, {{FAIMS}} supports _{{notebook}} templates_
which can be used to create many {{notebooks}}.

## Template Structure

A template is structured exactly like a {{notebook}}, the only difference is a field in the
metadata that flags it as a template.

## Creating a Template

In the {{dashboard}} web application you can create a new template if you have permission to
do so within your team.  The template can be created from scratch or from a previously downloaded
JSON file.

Once the template has been created, you can edit the template as you would a {{notebook}} in the
designer application.

## Creating {{Notebooks}} from a Template

In the {{dashboard}} web application you can create a new {{notebook}} from a template.  

The {{notebook}} will record that it has been created from this template in its metadata so it will
be possible to trace the origin of the {{notebook}}.

The created {{notebook}} is a snapshot copy of the template at time of creation.  Any subsequent
changes to the template __will not__ be reflected in the {{notebooks}} created from it.  

It is possible to make changes to the {{notebook}} that was created from the template using the
{{notebook}} editor.

__Note__ we are working on implementing restrictions on changes to fields within {{notebooks}}
derived from templates.  A template would be able to assert that a field cannot be changed or
can be hidden but not removed, for example.
