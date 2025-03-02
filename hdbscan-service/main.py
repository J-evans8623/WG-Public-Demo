import numpy as np
import logging
from typing import List, Dict, Any
from fastapi import FastAPI
from models import TextChunk, LessonModuleInput, LessonModuleOutput, Depth1Subtopic, Depth2Subtopic
from scipy.spatial.distance import pdist
from scipy.cluster.hierarchy import linkage, fcluster

# Configure logging to output to stdout
logging.basicConfig(
    level=logging.DEBUG,  # Use DEBUG for detailed logs; change to INFO in production if needed
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI()

def perform_depth1_clustering(
    embeddings: List[List[float]], 
    text_chunks: List[TextChunk],
    options: Dict[str, Any] = None
) -> List[Depth1Subtopic]:
    if options is None:
        options = {}
    # Dynamically adjust parameters via options
    num_depth1 = options.get("num_depth1", 4)              # target number of depth-1 clusters
    min_cluster_size = options.get("min_cluster_size", 5)    # for hierarchical linkage (not used directly in fcluster)
    min_depth1_size = options.get("min_depth1_size", 3)      # threshold to mark cluster as trivial (leaf)
    metric = options.get("metric", "cosine")
    
    logger.info("Starting depth1 clustering with %d embeddings using metric '%s'", len(embeddings), metric)
    emb_array = np.array(embeddings)
    logger.debug("Embeddings array shape: %s", emb_array.shape)
    
    # Compute pairwise distances using the specified metric
    distance_vector = pdist(emb_array, metric=metric)
    logger.debug("Computed pairwise distances using metric '%s'", metric)
    
    # Build the linkage matrix (dendrogram) using average linkage
    Z = linkage(distance_vector, method='average')
    logger.debug("Linkage matrix computed")
    
    # Use fcluster with the 'maxclust' criterion to force a fixed number of clusters
    labels = fcluster(Z, num_depth1, criterion='maxclust')
    logger.debug("fcluster labels: %s", labels)
    
    unique_labels = set(labels)
    logger.info("Unique clusters found (depth1): %s", unique_labels)
    depth1_subtopics = []
    
    for i, label in enumerate(sorted(unique_labels)):
        cluster_chunks = [chunk for idx, chunk in enumerate(text_chunks) if labels[idx] == label]
        logger.info("Depth1 Cluster %d: Found %d text chunks", label, len(cluster_chunks))
        aggregated_text = " ".join([chunk.text for chunk in cluster_chunks])
        # Mark as 'leaf' if the cluster is too small; otherwise mark as 'parent'
        node_type = "leaf" if len(cluster_chunks) < min_depth1_size else "parent"
        
        subtopic = Depth1Subtopic(
            node_id=f"depth1node{i+1}",
            node_type=node_type,
            aggregated_text=aggregated_text,
            generated_title=""
        )
        depth1_subtopics.append(subtopic)
    
    logger.info("Depth1 clustering produced %d subtopics", len(depth1_subtopics))
    return depth1_subtopics

def perform_depth2_clustering(
    parent_subtopic: Depth1Subtopic, 
    text_chunks: List[TextChunk],
    options: Dict[str, Any] = None
) -> List[Depth2Subtopic]:
    if options is None:
        options = {}
    num_depth2 = options.get("num_depth2", 2)              # target number of depth-2 clusters
    min_depth2_size = options.get("min_depth2_size", 3)      # threshold to filter trivial subclusters
    metric = options.get("metric", "cosine")
    
    logger.info("Starting depth2 clustering for parent subtopic %s", parent_subtopic.node_id)
    parent_chunks = [chunk for chunk in text_chunks if chunk.text in parent_subtopic.aggregated_text]
    logger.info("Depth2 clustering: %d parent chunks selected", len(parent_chunks))
    
    if len(parent_chunks) < min_depth2_size:
        logger.info("Not enough chunks for depth2 clustering; returning empty list")
        return []
    
    parent_embeddings = np.array([chunk.embedding for chunk in parent_chunks])
    # Compute pairwise distances using the specified metric
    distance_vector = pdist(parent_embeddings, metric=metric)
    logger.debug("Depth2: Computed pairwise distances using metric '%s'", metric)
    
    # Build the linkage matrix for depth2 clustering
    Z = linkage(distance_vector, method='average')
    logger.debug("Depth2: Linkage matrix computed")
    
    # Use fcluster to force a fixed number of subclusters
    num_subclusters = min(num_depth2, len(parent_chunks))
    labels = fcluster(Z, num_subclusters, criterion='maxclust')
    logger.debug("Depth2: fcluster labels: %s", labels)
    
    unique_labels = set(labels)
    logger.info("Depth2 unique clusters: %s", unique_labels)
    depth2_subtopics = []
    
    for j, sub_label in enumerate(sorted(unique_labels)):
        sub_cluster_chunks = [parent_chunks[k] for k, lbl in enumerate(labels) if lbl == sub_label]
        logger.info("Depth2 Cluster %s: Found %d chunks", sub_label, len(sub_cluster_chunks))
        if len(sub_cluster_chunks) < min_depth2_size:
            logger.info("Skipping depth2 cluster %s due to insufficient chunks", sub_label)
            continue
        sub_aggregated_text = " ".join([chunk.text for chunk in sub_cluster_chunks])
        depth2_subtopic = Depth2Subtopic(
            node_id=f"depth2node{j+1}_of_{parent_subtopic.node_id}",
            parent_node_id=parent_subtopic.node_id,
            aggregated_text=sub_aggregated_text,
            generated_title=""
        )
        depth2_subtopics.append(depth2_subtopic)
    
    logger.info("Depth2 clustering produced %d subtopics for parent %s", len(depth2_subtopics), parent_subtopic.node_id)
    return depth2_subtopics

@app.post("/generate_subtopics", response_model=LessonModuleOutput)
def generate_subtopics(input_data: LessonModuleInput):
    logger.info("Received generate_subtopics request for file_id: %s", input_data.file_id)
    full_text_ref = " ".join([chunk.text for chunk in input_data.text_chunks])
    embeddings = [chunk.embedding for chunk in input_data.text_chunks]
    logger.debug("Number of text chunks: %d", len(input_data.text_chunks))
    
    # Extract optional clustering options from the payload (if provided)
    clustering_options = {}
    if hasattr(input_data, "clustering_options"):
        clustering_options = input_data.clustering_options
    else:
        # Alternatively, if not present, try to fetch it from the underlying dict
        clustering_options = input_data.__dict__.get("clustering_options", {})

    # Perform depth1 clustering with dynamic options
    depth1_results = perform_depth1_clustering(embeddings, input_data.text_chunks, clustering_options)
    
    # For each depth1 cluster marked as "parent", try to extract depth2 subtopics
    for subtopic in depth1_results:
        if subtopic.node_type == "parent":
            logger.info("Performing depth2 clustering for subtopic %s", subtopic.node_id)
            depth2_subtopics = perform_depth2_clustering(subtopic, input_data.text_chunks, clustering_options)
            if depth2_subtopics:
                subtopic.depth2_subtopics = depth2_subtopics
                logger.info("Depth2 subtopics added to subtopic %s", subtopic.node_id)
    
    result = LessonModuleOutput(
        full_text_reference=full_text_ref,
        depth1_subtopics=depth1_results
    )
    logger.info("Returning generate_subtopics result with %d depth1 subtopics", len(depth1_results))
    return result
