import { writeFileSync } from 'fs';

// Terminal, Programs, Video, and Debug schemas
const schemas = {
  'terminal.write.request.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["text"],
    "properties": {
      "text": { "type": "string", "maxLength": 1024 },
      "addNewline": { "type": "boolean", "default": true }
    }
  },

  'terminal.read.response.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "data": {
        "type": "object",
        "properties": {
          "input": { "type": "string" },
          "bytesRead": { "type": "integer" },
          "hasInput": { "type": "boolean" }
        }
      }
    }
  },

  'terminal.clear.response.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "data": {
        "type": "object",
        "properties": {
          "cleared": { "type": "boolean" },
          "bufferSize": { "type": "integer" }
        }
      }
    }
  },

  'programs.list.response.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "data": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
            "size": { "type": "integer" }
          }
        }
      }
    }
  },

  'programs.load.request.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["sampleName"],
    "properties": {
      "sampleName": {
        "type": "string",
        "enum": ["hello-world", "echo", "fibonacci", "graphics-demo", "video-demo", "hello-terminal"]
      },
      "assembled": { "type": "boolean", "default": true },
      "resetCPU": { "type": "boolean", "default": true }
    }
  },

  'programs.load.response.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "data": {
        "type": "object",
        "properties": {
          "sampleName": { "type": "string" },
          "programSize": { "type": "integer" },
          "loadAddress": { "type": "integer" },
          "source": { "type": "string" },
          "bytecode": { "type": "array", "items": { "type": "integer" } }
        }
      }
    }
  },

  'video.setPixel.request.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["x", "y", "color"],
    "properties": {
      "x": { "type": "integer", "minimum": 0, "maximum": 31 },
      "y": { "type": "integer", "minimum": 0, "maximum": 31 },
      "color": { "type": "integer", "minimum": 0, "maximum": 15 }
    }
  },

  'video.update.request.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "flush": { "type": "boolean", "default": true }
    }
  },

  'video.clear.request.json': {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "color": { "type": "integer", "minimum": 0, "maximum": 15, "default": 0 }
    }
  }
};

// Write additional schemas
Object.entries(schemas).forEach(([filename, schema]) => {
  writeFileSync(`docs/mcp_schemas/${filename}`, JSON.stringify(schema, null, 2));
  console.log(`Created ${filename}`);
});

// Create the aggregate schema file
const aggregateSchema = {
  "$schema": "https://json-schema.org/draft-07/schema#",
  "title": "iMaCoMpUtERussy MCP API Schemas",
  "type": "object",
  "properties": {
    "schemas": {
      "type": "object",
      "properties": {
        "cpu": {
          "type": "object",
          "properties": {
            "reset": {
              "type": "object",
              "properties": {
                "request": { "$ref": "cpu.reset.request.json" },
                "response": { "$ref": "cpu.reset.response.json" }
              }
            },
            "step": {
              "type": "object",
              "properties": {
                "request": { "$ref": "cpu.step.request.json" },
                "response": { "$ref": "cpu.step.response.json" }
              }
            },
            "run": {
              "type": "object",
              "properties": {
                "request": { "$ref": "cpu.run.request.json" },
                "response": { "$ref": "cpu.run.response.json" }
              }
            },
            "state": {
              "type": "object",
              "properties": {
                "response": { "$ref": "cpu.state.response.json" }
              }
            }
          }
        },
        "memory": {
          "type": "object",
          "properties": {
            "read": {
              "type": "object",
              "properties": {
                "request": { "$ref": "memory.read.request.json" },
                "response": { "$ref": "memory.read.response.json" }
              }
            },
            "write": {
              "type": "object",
              "properties": {
                "request": { "$ref": "memory.write.request.json" },
                "response": { "$ref": "memory.write.response.json" }
              }
            },
            "loadProgram": {
              "type": "object",
              "properties": {
                "request": { "$ref": "memory.loadProgram.request.json" },
                "response": { "$ref": "memory.loadProgram.response.json" }
              }
            }
          }
        },
        "assemble": {
          "type": "object",
          "properties": {
            "source": {
              "type": "object",
              "properties": {
                "request": { "$ref": "assemble.source.request.json" },
                "response": { "$ref": "assemble.source.response.json" }
              }
            },
            "loadAndRun": {
              "type": "object",
              "properties": {
                "request": { "$ref": "assemble.loadAndRun.request.json" },
                "response": { "$ref": "assemble.loadAndRun.response.json" }
              }
            }
          }
        },
        "terminal": {
          "type": "object",
          "properties": {
            "write": {
              "type": "object",
              "properties": {
                "request": { "$ref": "terminal.write.request.json" }
              }
            },
            "read": {
              "type": "object",
              "properties": {
                "response": { "$ref": "terminal.read.response.json" }
              }
            },
            "clear": {
              "type": "object",
              "properties": {
                "response": { "$ref": "terminal.clear.response.json" }
              }
            }
          }
        },
        "programs": {
          "type": "object",
          "properties": {
            "list": {
              "type": "object",
              "properties": {
                "response": { "$ref": "programs.list.response.json" }
              }
            },
            "load": {
              "type": "object",
              "properties": {
                "request": { "$ref": "programs.load.request.json" },
                "response": { "$ref": "programs.load.response.json" }
              }
            }
          }
        },
        "error": { "$ref": "error.schema.json" }
      }
    },
    "endpoints": {
      "type": "object",
      "patternProperties": {
        ".*": {
          "type": "object",
          "properties": {
            "method": { "type": "string" },
            "path": { "type": "string" },
            "rpc": { "type": "string" },
            "requestSchema": { "type": "object" },
            "responseSchema": { "type": "object" }
          }
        }
      }
    }
  }
};

writeFileSync('docs/mcp_schemas.json', JSON.stringify(aggregateSchema, null, 2));
console.log('Created docs/mcp_schemas.json');

console.log('All schema generation complete!');