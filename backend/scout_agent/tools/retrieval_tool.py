import math
from google.cloud import firestore
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
import google.genai as genai
from google.genai.types import EmbedContentConfig

def firestore_retrieval_tool(customer_need: str, lat: float, lng: float) -> str:
    """
    Performs a similarity search in Firestore for a customer's need,
    filtered by a 10-mile geographic square.

    Args:
        customer_need: The customer's need as a string.
        lat: The latitude of the search center.
        lng: The longitude of the search center.

    Returns:
        A string containing the search results.
    """
    db = firestore.Client()

    # Create embedding for the customer need
    try:
        client = genai.Client()
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=[customer_need],
            config=EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",  # Optional
                output_dimensionality=2048,  # Optional
            ),
        )
        embedding = response.embeddings[0].values
    except Exception as e:
        return f"Error creating embedding: {e}"

    # Define the search radius in miles
    radius_miles = 10.0

    # Approximate conversions from miles to degrees
    lat_degrees_per_mile = 1.0 / 69.0
    lng_degrees_per_mile = 1.0 / (69.0 * math.cos(math.radians(lat)))

    # Calculate the bounding box
    lat_offset = radius_miles * lat_degrees_per_mile
    lng_offset = radius_miles * lng_degrees_per_mile

    lat_min = lat - lat_offset
    lat_max = lat + lat_offset
    lng_min = lng - lng_offset
    lng_max = lng + lng_offset

    try:
        query = db.collection("provider_conversations")
        # .where("lat", ">=", lat_min).where("lat", "<=", lat_max).where("lng", ">=", lng_min).where("lng", "<=", lng_max)
        
        nearest_docs = query.find_nearest(
            vector_field="transcript_embedding",
            query_vector=Vector(embedding),
            limit=5,
            distance_measure=DistanceMeasure.COSINE
        ).get()

        results = []
        for doc in nearest_docs:
            doc_data = doc.to_dict()
            # Assuming the document has 'biz_name' and 'transcript' fields
            biz_name = doc_data.get("biz_name", "N/A")
            transcript_text = " ".join([f'{t["role"]}: {t["text"]}' for t in doc_data.get("transcript", [])])
            results.append(f"Business: {biz_name}\nConversation: {transcript_text}\n---")

        if not results:
            return "I searched ServiceScout but found no relevant conversations in that area."

        return "I searched ServiceScout and found the following conversations:\n\n" + "\n".join(results)

    except Exception as e:
        print(e)
        return f"Error during Firestore search: {e}"
