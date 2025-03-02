export const QAschema = {
    "name": "education_application",
    "schema": {
      "type": "object",
      "properties": {
        "question_title": {
          "type": "string",
          "description": "A concise title for the question being asked."
        },
        "question_response": {
          "type": "string",
          "description": "An explanation or answer provided by the AI model to the user's question."
        }
      },
      "required": [
        "question_title",
        "question_response"
      ],
      "additionalProperties": false
    },
    "strict": true
  }