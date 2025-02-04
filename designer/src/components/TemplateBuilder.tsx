import {
  Add as AddIcon,
  Code as CodeIcon,
  Delete as DeleteIcon,
  Error as ErrorIcon,
  Preview as PreviewIcon,
  ArrowDropUpRounded as ArrowDropUpRoundedIcon,
  ArrowDropDownRounded as ArrowDropDownRoundedIcon,
} from '@mui/icons-material';
import {
  Alert,
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
  Tooltip,
  Typography,
} from '@mui/material';
import Mustache from 'mustache';
import React, {useCallback, useEffect, useMemo, useState} from 'react';

/**
 * Maintains a counter for generating unique block IDs within a session
 */
let blockCounter = 0;

/**
 * Generates a unique identifier for template blocks
 * Format: block_[timestamp]_[counter]
 * 
 * @returns {string} A unique identifier string
 */
export const generateBlockId = (): string => {
  // Get current timestamp
  const timestamp = Date.now();
  
  // Increment counter
  blockCounter++;
  
  // Create unique ID combining timestamp and counter
  return `block_${timestamp}_${blockCounter}`;
};

/**
 * Supported block types in the template builder
 */
type BlockType = 'text' | 'variable' | 'if' | 'unless';

/**
 * Represents a single building block in the template
 */
interface TemplateBlock {
  id: string;
  type: BlockType;
  content: string;
  children?: TemplateBlock[];
}

/**
 * Represents a variable that can be used in the template
 */
interface Variable {
  name: string;
  displayName: string;
  type: 'field' | 'system';
  value?: string; // For preview purposes
}

/**
 * Props for the MustacheTemplateBuilder component
 */
interface MustacheBuilderProps {
  /** Initial template string to populate the builder */
  initialTemplate?: string;
  /** Available field variables */
  variables: Variable[];
  /** Available system variables */
  systemVariables: Variable[];
  /** Callback fired when template is saved */
  onSave: (template: string) => void;
  /** Controls dialog visibility */
  open: boolean;
  /** Callback fired when dialog is closed */
  onClose: () => void;
}

/**
 * Safely parses a Mustache template string into TemplateBlock format
 */
const parseTemplate = (
  template: string
): {blocks: TemplateBlock[]; error: string | null} => {
  try {
    const tokens = Mustache.parse(template);
    const blocks = tokens
      .map(convertMustacheTokenToBlock)
      .filter(isTemplateBlock);
    return {blocks, error: null};
  } catch (error) {
    return {
      blocks: [
        {
          id: generateBlockId(),
          type: 'text',
          content: template || '',
        },
      ],
      error: error instanceof Error ? error.message : 'Invalid template syntax',
    };
  }
};

/**
 * Converts a Mustache AST token into our TemplateBlock format
 */
const convertMustacheTokenToBlock = (token: any): TemplateBlock | null => {
  const [tokenType, content, ...rest] = token;

  try {
    switch (tokenType) {
      case 'text':
        return {
          id: generateBlockId(),
          type: 'text',
          content: content,
        };

      case 'name':
        return {
          id: generateBlockId(),
          type: 'variable',
          content: content,
        };

      case '#':
        return {
          id: generateBlockId(),
          type: 'if',
          content: content,
          children: rest[2].map(convertMustacheTokenToBlock).filter(Boolean),
        };

      case '^':
        return {
          id: generateBlockId(),
          type: 'unless',
          content: content,
          children: rest[2].map(convertMustacheTokenToBlock).filter(Boolean),
        };

      default:
        return null;
    }
  } catch (error) {
    console.warn('Error converting token:', error);
    return null;
  }
};

/**
 * Type guard for TemplateBlock
 */
function isTemplateBlock(block: TemplateBlock | null): block is TemplateBlock {
  return block !== null;
}

/**
 * Component for editing a single template block
 */
const TemplateBlockEditor: React.FC<{
  block: TemplateBlock;
  variables: Variable[];
  systemVariables: Variable[];
  onUpdate: (block: TemplateBlock) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  level?: number;
}> = ({
  block,
  variables,
  systemVariables,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  level = 0,
}) => {
  const allVariables = [...variables, ...systemVariables];

  const updateBlockContent = (content: string) => {
    onUpdate({...block, content});
  };

  const addChildBlock = () => {
    const newBlock: TemplateBlock = {
      id: generateBlockId(),
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
              <MenuItem value="if">Conditional</MenuItem>
              <MenuItem value="unless">Unless</MenuItem>
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

        {(block.type === 'if' || block.type === 'unless') && (
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
          <Box sx={{display: 'flex', alignItems: 'center'}}>
            {onMoveUp && !isFirst && (
              <IconButton onClick={onMoveUp} size="small">
                <ArrowDropUpRoundedIcon />
              </IconButton>
            )}
            {onMoveDown && !isLast && (
              <IconButton onClick={onMoveDown} size="small">
                <ArrowDropDownRoundedIcon />
              </IconButton>
            )}
            <IconButton onClick={onDelete} size="small" color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
        </Grid>
      </Grid>

      {(block.type === 'if' || block.type === 'unless') && (
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
              onMoveUp={() => {
                if (index > 0) {
                  const newChildren = [...(block.children || [])];
                  [newChildren[index - 1], newChildren[index]] = [
                    newChildren[index],
                    newChildren[index - 1],
                  ];
                  onUpdate({...block, children: newChildren});
                }
              }}
              onMoveDown={() => {
                if (index < (block.children?.length || 0) - 1) {
                  const newChildren = [...(block.children || [])];
                  [newChildren[index], newChildren[index + 1]] = [
                    newChildren[index + 1],
                    newChildren[index],
                  ];
                  onUpdate({...block, children: newChildren});
                }
              }}
              isFirst={index === 0}
              isLast={index === (block.children?.length || 0) - 1}
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
 * Component for previewing the template with sample data
 */
const TemplatePreview: React.FC<{
  template: TemplateBlock[];
  variables: Variable[];
  systemVariables: Variable[];
  onTemplateError?: (error: string | null) => void;
}> = ({template, variables, systemVariables, onTemplateError}) => {
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const allVariables = [...variables, ...systemVariables];

  // Function to find all variables used in a block and its children
  const findUsedVariables = useCallback(
    (blocks: TemplateBlock[]): Set<string> => {
      const usedVars = new Set<string>();

      const processBlock = (block: TemplateBlock) => {
        if (
          block.type === 'variable' ||
          block.type === 'if' ||
          block.type === 'unless'
        ) {
          usedVars.add(block.content);
        }
        if (block.children) {
          block.children.forEach(processBlock);
        }
      };

      blocks.forEach(processBlock);
      return usedVars;
    },
    []
  );

  // Get the list of variables actually used in the template
  const usedVariables = useMemo(() => {
    const usedVarNames = findUsedVariables(template);
    return allVariables.filter(v => usedVarNames.has(v.name));
  }, [template, allVariables, findUsedVariables]);

  const compileTemplate = useCallback((blocks: TemplateBlock[]): string => {
    return blocks
      .map(block => {
        switch (block.type) {
          case 'text':
            return block.content;
          case 'variable':
            return `{{${block.content}}}`;
          case 'if':
            return `{{#${block.content}}}${block.children ? compileTemplate(block.children) : ''}{{/${block.content}}}`;
          case 'unless':
            return `{{^${block.content}}}${block.children ? compileTemplate(block.children) : ''}{{/${block.content}}}`;
          default:
            return '';
        }
      })
      .join('');
  }, []);

  const compiledTemplate = compileTemplate(template);

  const renderPreview = useCallback(() => {
    try {
      const result = Mustache.render(compiledTemplate, {
        ...previewValues,
      });
      if (previewError) {
        setPreviewError(null);
        onTemplateError?.(null);
      }
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error rendering template';
      if (previewError !== errorMessage) {
        setPreviewError(errorMessage);
        onTemplateError?.(errorMessage);
      }
      return 'Preview unavailable - check the builder tab to fix template errors';
    }
  }, [compiledTemplate, previewValues, previewError, onTemplateError]);

  return (
    <Box sx={{mt: 3}}>
      {usedVariables.length > 0 ? (
        <Grid container spacing={2}>
          {usedVariables.map(variable => (
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
      ) : (
        <Typography color="text.secondary" sx={{mb: 2}}>
          No variables used in this template
        </Typography>
      )}

      {previewError && (
        <Alert severity="error" sx={{mt: 2}}>
          <Typography variant="subtitle2">Template Error:</Typography>
          {previewError}
        </Alert>
      )}

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
            {renderPreview()}
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
};

/**
 * Main Mustache template builder dialog component
 * This component provides a user interface for building and editing Mustache templates
 * with support for variables, text and conditionals.
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
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTemplate) {
      const {blocks, error} = parseTemplate(initialTemplate);
      setTemplate(blocks);
      setParseError(error);
    } else if (!template.length) {
      setTemplate([
        {
          id: generateBlockId(),
          type: 'text',
          content: '',
        },
      ]);
    }
  }, [initialTemplate]);

  const compileTemplate = useCallback((blocks: TemplateBlock[]): string => {
    return blocks
      .map(block => {
        switch (block.type) {
          case 'text':
            return block.content;
          case 'variable':
            return `{{${block.content}}}`;
          case 'if':
            return `{{#${block.content}}}${block.children ? compileTemplate(block.children) : ''}{{/${block.content}}}`;
          case 'unless':
            return `{{^${block.content}}}${block.children ? compileTemplate(block.children) : ''}{{/${block.content}}}`;
          default:
            return '';
        }
      })
      .join('');
  }, []);

  // Validates template syntax without blocking editing
  const validateTemplate = useCallback(
    (templateString: string): string | null => {
      try {
        // First try to parse the template
        Mustache.parse(templateString);
        return null;
      } catch (error) {
        // Return error but don't prevent further editing
        return error instanceof Error
          ? error.message
          : 'Invalid template syntax';
      }
    },
    []
  );

  const handleSave = () => {
    const compiledTemplate = compileTemplate(template);
    const error = validateTemplate(compiledTemplate);

    if (error) {
      setParseError(error);
      setActiveTab(0); // Switch to builder tab to show error
      return;
    }

    onSave(compiledTemplate);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Grid container alignItems="center" spacing={1}>
          <Grid item>Template Builder</Grid>
          {parseError && (
            <Grid item>
              <Tooltip title={parseError}>
                <ErrorIcon color="error" />
              </Tooltip>
            </Grid>
          )}
        </Grid>
      </DialogTitle>

      <DialogContent>
        {/* Instructions */}
        <Paper sx={{p: 2, mb: 3, bgcolor: 'background.default'}}>
          <Typography variant="subtitle2" gutterBottom>
            How to use this template editor:
          </Typography>
          <Typography variant="body2">
            {
              '• Add blocks using the + button. Each block can be text, a variable, or a condition'
            }
            <br />
            {
              '• Variables: Use {{variableName}} syntax to insert dynamic content'
            }
            <br />
            {
              '• Conditional: Use {{#variableName}} to show content only when variable is defined'
            }
            <br />
            {
              '• Unless: Use {{^variableName}} to show content only when variable is undefined'
            }
          </Typography>
        </Paper>

        {/* Live Template String Preview */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'grey.50',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            fontSize: '0.875rem',
            maxHeight: '100px',
            overflow: 'auto',
          }}
        >
          <Typography
            variant="caption"
            display="block"
            gutterBottom
            color="text.secondary"
          >
            Template String:
          </Typography>
          {compileTemplate(template)}
        </Paper>

        {parseError && (
          <Alert severity="error" sx={{mb: 2}}>
            <Typography variant="subtitle2">Template Error:</Typography>
            {parseError}
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{borderBottom: 1, borderColor: 'divider', mb: 2}}
        >
          <Tab
            icon={<CodeIcon />}
            label="Builder"
            wrapped
            sx={{minWidth: 120}}
          />
          <Tab
            icon={<PreviewIcon />}
            label="Preview"
            wrapped
            sx={{minWidth: 120}}
          />
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
                  // Don't automatically clear parse errors - let validation determine if error is fixed
                  const compiledTemplate = compileTemplate(newTemplate);
                  const error = validateTemplate(compiledTemplate);
                  setParseError(error);
                }}
                onDelete={() => {
                  const newTemplate = [...template];
                  newTemplate.splice(index, 1);
                  setTemplate(newTemplate);
                }}
                onMoveUp={() => {
                  if (index > 0) {
                    const newTemplate = [...template];
                    [newTemplate[index - 1], newTemplate[index]] = [
                      newTemplate[index],
                      newTemplate[index - 1],
                    ];
                    setTemplate(newTemplate);
                  }
                }}
                onMoveDown={() => {
                  if (index < template.length - 1) {
                    const newTemplate = [...template];
                    [newTemplate[index], newTemplate[index + 1]] = [
                      newTemplate[index + 1],
                      newTemplate[index],
                    ];
                    setTemplate(newTemplate);
                  }
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
                    id: generateBlockId(),
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
            onTemplateError={error => {
              setParseError(error);
              if (error) {
                // If there's an error, show the builder tab so user can fix it
                setActiveTab(0);
              }
            }}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={!!parseError}
        >
          Save Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MustacheTemplateBuilder;
