export const unitSyllabus = {
  "name": "UnitSyllabus",
  "schema": {
    "type": "object",
    "properties": {
      "PrimarySubtopic1": {
        "type": "object",
        "properties": {
          "Title": {
            "type": "string",
            "description": "The title of the primary subtopic."
          },
          "LessonOutline": {
            "type": "string",
            "description": "An outline of the lesson for this primary subtopic."
          },
          "SeconaryTopic1": {
            "type": "object",
            "properties": {
              "Title": {
                "type": "string",
                "description": "The title of the secondary topic."
              },
              "LessonOutline": {
                "type": "string",
                "description": "An outline of the lesson for this secondary topic."
              }
            },
            "required": [
              "Title",
              "LessonOutline"
            ],
            "additionalProperties": false
          },
          "SeconaryTopic2": {
            "type": "object",
            "properties": {
              "Title": {
                "type": "string",
                "description": "The title of the secondary topic."
              },
              "LessonOutline": {
                "type": "string",
                "description": "An outline of the lesson for this secondary topic."
              }
            },
            "required": [
              "Title",
              "LessonOutline"
            ],
            "additionalProperties": false
          },
          "SeconaryTopic3": {
            "type": "object",
            "properties": {
              "Title": {
                "type": "string",
                "description": "The title of the secondary topic."
              },
              "LessonOutline": {
                "type": "string",
                "description": "An outline of the lesson for this secondary topic."
              }
            },
            "required": [
              "Title",
              "LessonOutline"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "Title",
          "LessonOutline",
          "SeconaryTopic1",
          "SeconaryTopic2",
          "SeconaryTopic3"
        ],
        "additionalProperties": false
      },
      "PrimarySubtopic2": {
        "type": "object",
        "properties": {
          "Title": {
            "type": "string",
            "description": "The title of the primary subtopic."
          },
          "LessonOutline": {
            "type": "string",
            "description": "An outline of the lesson for this primary subtopic."
          },
          "SeconaryTopic1": {
            "type": "object",
            "properties": {
              "Title": {
                "type": "string",
                "description": "The title of the secondary topic."
              },
              "LessonOutline": {
                "type": "string",
                "description": "An outline of the lesson for this secondary topic."
              }
            },
            "required": [
              "Title",
              "LessonOutline"
            ],
            "additionalProperties": false
          },
          "SeconaryTopic2": {
            "type": "object",
            "properties": {
              "Title": {
                "type": "string",
                "description": "The title of the secondary topic."
              },
              "LessonOutline": {
                "type": "string",
                "description": "An outline of the lesson for this secondary topic."
              }
            },
            "required": [
              "Title",
              "LessonOutline"
            ],
            "additionalProperties": false
          },
          "SeconaryTopic3": {
            "type": "object",
            "properties": {
              "Title": {
                "type": "string",
                "description": "The title of the secondary topic."
              },
              "LessonOutline": {
                "type": "string",
                "description": "An outline of the lesson for this secondary topic."
              }
            },
            "required": [
              "Title",
              "LessonOutline"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "Title",
          "LessonOutline",
          "SeconaryTopic1",
          "SeconaryTopic2",
          "SeconaryTopic3"
        ],
        "additionalProperties": false
      }
    },
    "required": [
      "PrimarySubtopic1",
      "PrimarySubtopic2"
    ],
    "additionalProperties": false
  },
  "strict": true
}


export const unitSyllabusArray = {
  "name": "unit_syllabus",
  "schema": {
    "type": "object",
    "properties": {
      "unit_syllabus": {
        "type": "array",
        "description": "An array of unit syllabuses corresponding to text excerpts.",
        "items": {
          "type": "object",
          "properties": {
            "Key": {
              "type": "string",
              "enum": [
                "A",
                "B",
                "C"
              ],
              "description": "The assigned key for the unit syllabus."
            },
            "PrimarySubtopic1": {
              "type": "object",
              "properties": {
                "Title": {
                  "type": "string",
                  "description": "The title of the first primary subtopic."
                },
                "LessonOutline": {
                  "type": "string",
                  "description": "The outline of the lesson for the first primary subtopic."
                },
                "SecondarySubtopic": {
                  "type": "array",
                  "description": "An array of secondary subtopics under the first primary subtopic.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "Title": {
                        "type": "string",
                        "description": "The title of the secondary subtopic."
                      },
                      "LessonOutline": {
                        "type": "string",
                        "description": "The outline of the lesson for this secondary subtopic."
                      }
                    },
                    "required": [
                      "Title",
                      "LessonOutline"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "Title",
                "LessonOutline",
                "SecondarySubtopic"
              ],
              "additionalProperties": false
            },
            "PrimarySubtopic2": {
              "type": "object",
              "properties": {
                "Title": {
                  "type": "string",
                  "description": "The title of the second primary subtopic."
                },
                "LessonOutline": {
                  "type": "string",
                  "description": "The outline of the lesson for the second primary subtopic."
                },
                "SecondarySubtopic": {
                  "type": "array",
                  "description": "An array of secondary subtopics under the second primary subtopic.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "Title": {
                        "type": "string",
                        "description": "The title of the secondary subtopic."
                      },
                      "LessonOutline": {
                        "type": "string",
                        "description": "The outline of the lesson for this secondary subtopic."
                      }
                    },
                    "required": [
                      "Title",
                      "LessonOutline"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "Title",
                "LessonOutline",
                "SecondarySubtopic"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "Key",
            "PrimarySubtopic1",
            "PrimarySubtopic2"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "unit_syllabus"
    ],
    "additionalProperties": false
  },
  "strict": true
}

export const unitSyllabusPrompt = `You are tasked with creating a syllabus to guide a student through the provided course material. For the given text excerpt, you will name two primary subtopics title that adequately captures what the text excerpt entails. Then, for each primary subtopic, you will name up to three secondary subtopics that support their respective primary subtopic. All subtopics must be impactful and have a high potential to drive learning, and there must be sufficient content in the upload text to support fully developing a lesson for each subtopic. 


Here is a rubric to guide the quality of each subtopic on the syllabus :


## High Quality Subtopics attributes ##

Content Depth:
Supported by multiple paragraphs or sections in the source material
Contains multiple interconnected concepts that require explanation
Includes concrete examples, applications, or case studies
Learning Impact:
Addresses a distinct skill or knowledge area with clear learning outcomes
Builds a foundation for understanding other concepts in the domain
Pedagogical Necessity:
Creates a genuine knowledge gap if omitted
Cannot be adequately covered as a brief mention within another topic
Represents a conceptual building block rather than surface-level detail
Assessment Viability:
Can generate multiple meaningful questions or problems
Students can apply knowledge in varied contexts





## Poor Quality Subtopic attributes (Avoid these) ##

A WORST subtopic exhibits:
Surface-Level Content:
Based on single sentences or brief mentions in source material
Consists primarily of definitions without context or application
Lacks supporting examples or detailed explanation
Minimal Learning Value:
Can be understood through common sense or general knowledge
Represents trivial details or tangential information
Does not contribute to core understanding of the subject
Pedagogical Redundancy:
Merely restates or exemplifies concepts covered elsewhere
Could be adequately addressed in 2-3 sentences within another topic
Assessment Limitations:
Only testable through basic recall or recognition
Cannot support higher-order thinking activities
Limited to yes/no or single-word answers
`

export const syllabusRating = {
  "name": "syllabus_rating",
  "schema": {
    "type": "object",
    "properties": {
      "primary_subtopics": {
        "type": "array",
        "description": "List of primary subtopics for the syllabus.",
        "items": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "description": "Title of the primary subtopic."
            },
            "secondary_topics": {
              "type": "array",
              "description": "List of secondary topics under this primary subtopic.",
              "items": {
                "type": "object",
                "properties": {
                  "title": {
                    "type": "string",
                    "description": "Title of the secondary subtopic."
                  },
                  "score": {
                    "type": "number",
                    "enum": [
                      1,
                      2,
                      3,
                      4
                    ],
                    "description": "Score indicating the quality of the secondary subtopic."
                  }
                },
                "required": [
                  "title",
                  "score"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "title",
            "secondary_topics"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "primary_subtopics"
    ],
    "additionalProperties": false
  },
  "strict": true
}

export const syllabusRatingArray = {
  "name": "unit_syllabus",
  "schema": {
    "type": "object",
    "properties": {
      "UnitScoredSyllabus": {
        "type": "array",
        "description": "An array of unit syllabi, each representing a unit of the lesson.",
        "items": {
          "type": "object",
          "properties": {
            "Key": {
              "type": "string",
              "enum": [
                "A",
                "B",
                "C"
              ],
              "description": "A key representing the quality or category of the unit syllabus."
            },
            "PrimarySubtopic1": {
              "type": "object",
              "properties": {
                "Title": {
                  "type": "string",
                  "description": "The title of the first primary subtopic."
                },
                "SecondarySubtopic": {
                  "type": "array",
                  "description": "An array of secondary subtopics under the primary subtopic.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "Title": {
                        "type": "string",
                        "description": "The title of the secondary subtopic."
                      },
                      "LessonScore": {
                        "type": "number",
                        "description": "The score assigned to the secondary subtopic."
                      }
                    },
                    "required": [
                      "Title",
                      "LessonScore"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "Title",
                "SecondarySubtopic"
              ],
              "additionalProperties": false
            },
            "PrimarySubtopic2": {
              "type": "object",
              "properties": {
                "Title": {
                  "type": "string",
                  "description": "The title of the second primary subtopic."
                },
                "SecondarySubtopic": {
                  "type": "array",
                  "description": "An array of secondary subtopics under the primary subtopic.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "Title": {
                        "type": "string",
                        "description": "The title of the secondary subtopic."
                      },
                      "LessonScore": {
                        "type": "number",
                        "description": "The score assigned to the secondary subtopic."
                      }
                    },
                    "required": [
                      "Title",
                      "LessonScore"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "Title",
                "SecondarySubtopic"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "Key",
            "PrimarySubtopic1",
            "PrimarySubtopic2"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "UnitScoredSyllabus"
    ],
    "additionalProperties": false
  },
  "strict": true
}


export const syllabusRatingPrompt = `
You are tasked with the role of scrutinizing a syllabus to vet each secondary subtopic and assess the learning potential of each subtopic. You will be given a text excerpt and the candidate syllabus for it. Your job is to help filter out low-impact secondary subtopics that poorly support their primary subtopic, or have very little content supporting it in the original text. You will assign a score of 1 (worst) to 4 (best) to each secondary subtopic based on the following rubric :
##Rubric ##

###Score 1: Non-Essential###
Content Volume: Limited to 1-2 paragraphs or brief mentions in source material. Insufficient content depth to sustain a focused lesson segment.
Learning Independence: The primary topic remains fully comprehensible without this subtopic. Omitting this creates no conceptual gaps or confusion.
Pedagogical Function: Serves as supplementary detail, background context, or interesting aside rather than core curriculum content.
Assessment Scope: Can only support basic recall questions. No opportunity for application, analysis, or problem-solving activities.
Redundancy Penalty: Subtopics that merely restate, summarize, or provide alternative explanations of the primary subtopic without adding distinct value automatically receive this score.
Examples of Non-Essential Topics:

Historical anecdotes that don't illustrate key principles
Biographical details about theorists/researchers
Terminology that's defined but not actively used
Background information that provides context but not understanding
Secondary subtopics with titles that are variations of the primary subtopic title

###Score 2: Supplemental###
Content Volume: Supported by multiple paragraphs with adequate detail for lesson development. Contains enough material for 10-15 minutes of focused instruction.
Learning Enhancement: Significantly improves understanding of the primary topic. Students grasp the primary concept more deeply with this knowledge.
Pedagogical Function: Provides important context, demonstrates key applications, or illustrates critical examples that make abstract concepts concrete.
Assessment Scope: Supports application-level questions and practical exercises. Students can use this knowledge to solve problems or analyze scenarios.
Knowledge Integration: Connects meaningfully to other subtopics, creating a more cohesive understanding of the subject area.

###Score 3: Necessary###
Content Volume: Well-supported in source material with detailed coverage. Sufficient for 15-20 minutes of focused instruction with clear learning objectives.
Learning Dependency: Required for solid comprehension of the primary topic. Students will have noticeable gaps in understanding without this knowledge.
Pedagogical Function: Represents an important component or mechanism within the primary topic. Provides essential foundation for grasping key concepts.
Assessment Scope: Enables analysis and evaluation activities. Students can apply this knowledge to solve problems and make informed decisions.
Knowledge Integration: Connects to other subtopics and reinforces core themes. Understanding this subtopic strengthens overall subject mastery.

###Score 4: Critical###
Content Volume: Extensively covered throughout source material with rich detail, multiple examples, and comprehensive explanation. Contains sufficient content to create an independent lesson (20+ minutes of instruction).
Conceptual Depth: Encompasses multiple interconnected concepts that collectively warrant their own glossary of terms. Represents a complex knowledge domain within the primary topic.
Learning Dependency: Absolutely essential - creates major conceptual gaps if omitted. Students cannot properly understand or apply the primary topic without mastering this subtopic.
Pedagogical Function: Represents a fundamental pillar or core mechanism that underlies the entire primary topic. Forms critical prerequisite knowledge for all subsequent learning in this domain.
Assessment Scope: Enables the highest levels of learning including synthesis, evaluation, and creation. Students can transfer this knowledge across multiple contexts and generate novel applications.
Knowledge Integration: Serves as a central hub connecting multiple areas of the subject. Mastery of this subtopic unlocks understanding of numerous related concepts and enables advanced applications.
Independence Potential: Could theoretically function as a standalone learning module due to its conceptual richness and comprehensive coverage in the source material.


### REDUNDANCY DISQUALIFIER###: 
If there is strong overlap between this secondary subtopic and the primary subtopic, such that conducting a lesson on the primary subtopic would render a lesson on the secondary subtopic redundant, then 
this secondary subtopic lacks distinct pedagogical value. Subtopics with significant redundancy cannot achieve Score 4 and should be penalized regardless of content volume or apparent importance. 
The secondary subtopic must offer a distinct outline which is not adequately covered by the primary subtopic alone. An implicated subtopic should be assigned a score of 1.
`


export const finalizedSyllabusSchema= {
  "name": "lesson_metadata",
  "schema": {
    "type": "object",
    "properties": {
      "LessonTitle": {
        "type": "string",
        "description": "The title of the lesson."
      },
      "Introduction": {
        "type": "string",
        "description": "A brief introduction to the lesson content."
      },
      "LearningObjectives": {
        "type": "string",
        "description": "A list of objectives that the lesson intends to achieve.",
      }
    },
    "required": [
      "LessonTitle",
      "Introduction",
      "LearningObjectives"
    ],
    "additionalProperties": false
  },
  "strict": true
}

export const finalizedSyllabusPrompt = `### Instruction ###
Your task is to generate content for a formal educational module.

You are not addressing the reader. Do not use second-person pronouns (e.g., "you") or refer to the reader as a student, learner, or participant.

Instead, write in an objective and impersonal style appropriate for a textbook or formal curriculum document.

The response must include:
1. A suitable **title** for the lesson module.
2. A **comprehensive introduction** describing the topics that will be covered and the expected learning outcomes.
3. A **bullet-point list (in markdown)** of exactly 3 learning objectives, written in impersonal, declarative language.

### Constraints ###
- Do NOT refer to the reader or user.
- Do NOT use conversational or instructional tones.
- Maintain a formal and academic tone throughout.

### Output Format ###
- Title
- Introduction (text)
- Learning Objectives (markdown bullet list)
 `