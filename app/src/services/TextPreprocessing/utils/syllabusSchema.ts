
export const syllabus = {
    "name": "syllabus",
    "schema": {
      "type": "object",
      "properties": {
        "main_title": {
          "type": "string",
          "description": "The primary title of the syllabus."
        },
        "introduction": {
          "type": "string",
          "description": "An introductory overview of the syllabus content."
        },
        "learning_objective": {
          "type": "string",
          "description": "The objective that outlines what students are expected to learn."
        },
        "topics": {
          "type": "array",
          "description": "A list of topics covered in the syllabus.",
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string",
                "description": "The title of a specific topic."
              },
              "identifier": {
                "type": "string",
                "description": "A special key to identify the topic."
              }
            },
            "required": [
              "title",
              "identifier"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "main_title",
        "introduction",
        "learning_objective",
        "topics"
      ],
      "additionalProperties": false
    },
    "strict": true
  }
