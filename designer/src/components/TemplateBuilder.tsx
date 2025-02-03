import {
  Add as AddIcon,
  Code as CodeIcon,
  Delete as DeleteIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import React, {useEffect, useState} from 'react';

// Types for template building blocks
type BlockType = 'text' | 'variable' | 'if' | 'unless' | 'each' | 'helper';

type HelperType = 'uppercase' | 'lowercase' | 'dateFormat' | 'numberFormat';

interface TemplateBlock {
  id: string;
  type: BlockType;
  content: string;
  children?: TemplateBlock[];
  helper?: HelperType;
  helperArgs?: string[];
}

interface Variable {
  name: string;
  displayName: string;
  type: 'field' | 'system';
  value?: string; // For preview purposes
}

interface MustacheBuilderProps {
  initialTemplate?: string;
  variables: Variable[];
  systemVariables: Variable[];
  onSave: (template: string) => void;
  open: boolean;
  onClose: () => void;
}

/**
 * Parses a Mustache template string into template blocks
 */
const parseTemplate = (template: string): TemplateBlock[] => {
  const blocks: TemplateBlock[] = [];
  let currentText = '';

  // Helper to add accumulated text as a block
  const addTextBlock = () => {
    if (currentText) {
      blocks.push({
        id: Math.random().toString(36).substring(2, 9),
        type: 'text',
        content: currentText,
      });
      currentText = '';
    }
  };

  // Helper to parse a section (like if/unless/each) until its closing tag
  const parseSection = (
    template: string,
    startIndex: number
  ): [TemplateBlock | null, number] => {
    const tagMatch = template.slice(startIndex).match(/^\{\{([#^])([^}]+)\}\}/);
    if (!tagMatch) return [null, startIndex];

    const [fullTag, prefix, content] = tagMatch;
    const tagType =
      prefix === '#' ? (content === 'each' ? 'each' : 'if') : 'unless';
    const tagContent = content.trim();

    // Find the matching closing tag
    const searchStart = startIndex + fullTag.length;
    let nested = 0;
    let currentPos = searchStart;

    while (currentPos < template.length) {
      const openTag = template.slice(currentPos).match(/\{\{[#^]/);
      const closeTag = template
        .slice(currentPos)
        .match(`\\{\\{/${tagContent}\\}\\}`);

      if (!closeTag) break; // No matching close tag found

      if (!openTag || closeTag.index! < openTag.index!) {
        if (nested === 0) {
          // Parse the content between tags recursively
          const innerContent = template.slice(
            searchStart,
            currentPos + closeTag.index!
          );
          const children = parseTemplate(innerContent);

          return [
            {
              id: Math.random().toString(36).substring(2, 9),
              type: tagType,
              content: tagContent,
              children,
            },
            currentPos + closeTag.index! + closeTag[0].length,
          ];
        }
        nested--;
      } else {
        nested++;
      }
      currentPos =
        currentPos + (openTag ? openTag.index! + 2 : closeTag.index! + 3);
    }

    return [null, startIndex + fullTag.length];
  };

  let currentPos = 0;
  while (currentPos < template.length) {
    const nextTag = template.slice(currentPos).match(/\{\{([#^])?([^}]+)\}\}/);

    if (!nextTag) {
      currentText += template.slice(currentPos);
      break;
    }

    const [fullTag, prefix, content] = nextTag;
    const tagStart = currentPos + nextTag.index!;

    // Add any text before the tag
    if (tagStart > currentPos) {
      currentText += template.slice(currentPos, tagStart);
    }

    // Handle different tag types
    if (prefix === '#' || prefix === '^') {
      addTextBlock();
      const [sectionBlock, newPos] = parseSection(template, tagStart);
      if (sectionBlock) {
        blocks.push(sectionBlock);
      }
      currentPos = newPos;
    } else {
      // Handle regular variables and helpers
      addTextBlock();
      if (content.includes(' ')) {
        // Helper
        const [helper, variable] = content.trim().split(/\s+/);
        blocks.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'helper',
          helper: helper as HelperType,
          content: variable,
        });
      } else {
        // Variable
        blocks.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'variable',
          content: content.trim(),
        });
      }
      currentPos = tagStart + fullTag.length;
    }
  }

  addTextBlock();
  return blocks;
};

const HELPER_FUNCTIONS: Record<
  HelperType,
  {
    display: string;
    description: string;
    example: string;
  }
> = {
  uppercase: {
    display: 'Uppercase',
    description: 'Convert text to uppercase',
    example: '{{uppercase name}}',
  },
  lowercase: {
    display: 'Lowercase',
    description: 'Convert text to lowercase',
    example: '{{lowercase name}}',
  },
  dateFormat: {
    display: 'Date Format',
    description: 'Format a date (YYYY-MM-DD)',
    example: '{{dateFormat date "YYYY-MM-DD"}}',
  },
  numberFormat: {
    display: 'Number Format',
    description: 'Format a number',
    example: '{{numberFormat number "0.00"}}',
  },
};

/**
 * Component for displaying and editing a single template block
 */
const TemplateBlockEditor: React.FC<{
  block: TemplateBlock;
  variables: Variable[];
  systemVariables: Variable[];
  onUpdate: (block: TemplateBlock) => void;
  onDelete: () => void;
  level?: number;
}> = ({block, variables, systemVariables, onUpdate, onDelete, level = 0}) => {
  const allVariables = [...variables, ...systemVariables];

  const updateBlockContent = (content: string) => {
    onUpdate({...block, content});
  };

  const addChildBlock = () => {
    const newBlock: TemplateBlock = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'text',
      content: '',
    };
    onUpdate({
      ...block,
      children: [...(block.children || []), newBlock],
    });
  };

  return (
    <Box sx={{pl: 3, borderLeft: '2px solid', borderColor: 'divider', mb: 2}}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm="auto">
          <FormControl fullWidth sx={{minWidth: 120}}>
            <InputLabel>Block Type</InputLabel>
            <Select
              value={block.type}
              label="Block Type"
              onChange={e =>
                onUpdate({...block, type: e.target.value as BlockType})
              }
            >
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="variable">Variable</MenuItem>
              <MenuItem value="if">If Condition</MenuItem>
              <MenuItem value="unless">Unless</MenuItem>
              <MenuItem value="each">Each Loop</MenuItem>
              <MenuItem value="helper">Helper</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {block.type === 'variable' && (
          <Grid item xs={12} sm>
            <FormControl fullWidth>
              <InputLabel>Variable</InputLabel>
              <Select
                value={block.content}
                label="Variable"
                onChange={e => updateBlockContent(e.target.value)}
              >
                <MenuItem value="">Choose variable...</MenuItem>
                {allVariables.map(v => (
                  <MenuItem key={v.name} value={v.name}>
                    {v.displayName} ({v.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {block.type === 'helper' && (
          <>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Helper</InputLabel>
                <Select
                  value={block.helper}
                  label="Helper"
                  onChange={e =>
                    onUpdate({...block, helper: e.target.value as HelperType})
                  }
                >
                  {Object.entries(HELPER_FUNCTIONS).map(([key, value]) => (
                    <MenuItem key={key} value={key}>
                      {value.display}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Apply To</InputLabel>
                <Select
                  value={block.content}
                  label="Apply To"
                  onChange={e => updateBlockContent(e.target.value)}
                >
                  {allVariables.map(v => (
                    <MenuItem key={v.name} value={v.name}>
                      {v.displayName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </>
        )}

        {block.type === 'text' && (
          <Grid item xs>
            <TextField
              fullWidth
              value={block.content}
              onChange={e => updateBlockContent(e.target.value)}
              placeholder="Enter text..."
              size="small"
            />
          </Grid>
        )}

        {(block.type === 'if' ||
          block.type === 'unless' ||
          block.type === 'each') && (
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Variable</InputLabel>
              <Select
                value={block.content}
                label="Variable"
                onChange={e => updateBlockContent(e.target.value)}
              >
                {allVariables.map(v => (
                  <MenuItem key={v.name} value={v.name}>
                    {v.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        <Grid item>
          <IconButton onClick={onDelete} size="small" color="error">
            <DeleteIcon />
          </IconButton>
        </Grid>
      </Grid>

      {(block.type === 'if' ||
        block.type === 'unless' ||
        block.type === 'each') && (
        <Box sx={{mt: 2, mb: 1}}>
          {block.children?.map((child, index) => (
            <TemplateBlockEditor
              key={child.id}
              block={child}
              variables={variables}
              systemVariables={systemVariables}
              onUpdate={updatedChild => {
                const newChildren = [...(block.children || [])];
                newChildren[index] = updatedChild;
                onUpdate({...block, children: newChildren});
              }}
              onDelete={() => {
                const newChildren = [...(block.children || [])];
                newChildren.splice(index, 1);
                onUpdate({...block, children: newChildren});
              }}
              level={level + 1}
            />
          ))}
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={addChildBlock}
            sx={{mt: 1}}
          >
            Add Block
          </Button>
        </Box>
      )}
    </Box>
  );
};

/**
 * Enhanced preview component with proper conditional handling
 */
const TemplatePreview: React.FC<{
  template: TemplateBlock[];
  variables: Variable[];
  systemVariables: Variable[];
}> = ({template, variables, systemVariables}) => {
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(
    {}
  );
  const allVariables = [...variables, ...systemVariables];

  const evaluateCondition = (variableName: string): boolean => {
    const value = previewValues[variableName];
    // Consider the condition true if the value exists and isn't empty
    return !!value && value.trim() !== '';
  };

  const applyHelper = (helper: HelperType, value: string): string => {
    switch (helper) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'dateFormat':
        try {
          const date = new Date(value);
          return date.toISOString().split('T')[0]; // YYYY-MM-DD
        } catch {
          return value;
        }
      case 'numberFormat':
        try {
          return parseFloat(value).toFixed(2);
        } catch {
          return value;
        }
    }
  };

  const renderBlock = (block: TemplateBlock): string => {
    switch (block.type) {
      case 'text':
        return block.content;
      case 'variable':
        return previewValues[block.content] || '';
      case 'helper':
        if (block.helper && block.content) {
          const value = previewValues[block.content] || '';
          return applyHelper(block.helper, value);
        }
        return '';
      case 'if':
        if (evaluateCondition(block.content)) {
          return block.children?.map(renderBlock).join('') || '';
        }
        return '';
      case 'unless':
        if (!evaluateCondition(block.content)) {
          return block.children?.map(renderBlock).join('') || '';
        }
        return '';
      case 'each':
        // For preview, we'll treat 'each' as a simple if condition
        if (evaluateCondition(block.content)) {
          return block.children?.map(renderBlock).join('') || '';
        }
        return '';
      default:
        return '';
    }
  };

  return (
    <Box sx={{mt: 3}}>
      <Grid container spacing={2}>
        {allVariables.map(variable => (
          <Grid item xs={12} sm={6} key={variable.name}>
            <TextField
              fullWidth
              label={variable.displayName}
              value={previewValues[variable.name] || ''}
              onChange={e =>
                setPreviewValues({
                  ...previewValues,
                  [variable.name]: e.target.value,
                })
              }
              size="small"
              placeholder={`Enter ${variable.displayName.toLowerCase()}...`}
            />
          </Grid>
        ))}
      </Grid>

      <Card sx={{mt: 3}}>
        <CardHeader title="Preview" />
        <CardContent>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: 'grey.50',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              minHeight: '100px',
            }}
          >
            {template.map(renderBlock).join('')}
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
};

/**
 * Main Mustache template builder dialog component
 */
export const MustacheTemplateBuilder: React.FC<MustacheBuilderProps> = ({
  initialTemplate,
  variables,
  systemVariables,
  onSave,
  open,
  onClose,
}) => {
  const [template, setTemplate] = useState<TemplateBlock[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (initialTemplate) {
      const parsedTemplate = parseTemplate(initialTemplate);
      setTemplate(
        parsedTemplate.length
          ? parsedTemplate
          : [
              {
                id: Math.random().toString(36).substring(2, 9),
                type: 'text',
                content: '',
              },
            ]
      );
    } else if (!template.length) {
      setTemplate([
        {
          id: Math.random().toString(36).substring(2, 9),
          type: 'text',
          content: '',
        },
      ]);
    }
  }, [initialTemplate]);

  const compileTemplate = (blocks: TemplateBlock[]): string => {
    return blocks
      .map(block => {
        switch (block.type) {
          case 'text':
            return block.content;
          case 'variable':
            return `{{${block.content}}}`;
          case 'helper':
            return `{{${block.helper} ${block.content}}}`;
          case 'if':
            return `{{#if ${block.content}}}${block.children ? compileTemplate(block.children) : ''}{{/if}}`;
          case 'unless':
            return `{{^${block.content}}}${block.children ? compileTemplate(block.children) : ''}{{/unless}}`;
          case 'each':
            return `{{#each ${block.content}}}${block.children ? compileTemplate(block.children) : ''}{{/each}}`;
          default:
            return '';
        }
      })
      .join('');
  };

  const handleSave = () => {
    const compiledTemplate = compileTemplate(template);
    onSave(compiledTemplate);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Mustache Template Builder</DialogTitle>

      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{borderBottom: 1, borderColor: 'divider', mb: 2}}
        >
          <Tab icon={<CodeIcon />} label="Builder" />
          <Tab icon={<PreviewIcon />} label="Preview" />
        </Tabs>

        {activeTab === 0 && (
          <Box sx={{mt: 2}}>
            {template.map((block, index) => (
              <TemplateBlockEditor
                key={block.id}
                block={block}
                variables={variables}
                systemVariables={systemVariables}
                onUpdate={updatedBlock => {
                  const newTemplate = [...template];
                  newTemplate[index] = updatedBlock;
                  setTemplate(newTemplate);
                }}
                onDelete={() => {
                  const newTemplate = [...template];
                  newTemplate.splice(index, 1);
                  setTemplate(newTemplate);
                }}
              />
            ))}
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={() =>
                setTemplate([
                  ...template,
                  {
                    id: Math.random().toString(36).substring(2, 9),
                    type: 'text',
                    content: '',
                  },
                ])
              }
              sx={{mt: 2}}
            >
              Add Block
            </Button>
          </Box>
        )}

        {activeTab === 1 && (
          <TemplatePreview
            template={template}
            variables={variables}
            systemVariables={systemVariables}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};
