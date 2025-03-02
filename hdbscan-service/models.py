from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class TextChunk(BaseModel):
    chunk_id: str
    text: str
    embedding: List[float]

class LessonModuleInput(BaseModel):
    file_id: str
    text_chunks: List[TextChunk]
    clustering_options: Optional[Dict[str, Any]] = None

class Depth2Subtopic(BaseModel):
    node_id: str
    parent_node_id: str
    aggregated_text: str
    generated_title: Optional[str] = ""

class Depth1Subtopic(BaseModel):
    node_id: str
    node_type: str  # "leaf" or "parent"
    aggregated_text: str
    generated_title: Optional[str] = ""
    depth2_subtopics: Optional[List[Depth2Subtopic]] = None

class LessonModuleOutput(BaseModel):
    full_text_reference: str
    depth1_subtopics: List[Depth1Subtopic]
