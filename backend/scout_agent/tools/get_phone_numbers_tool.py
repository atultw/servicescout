import os
import json
import requests
from typing import List, Optional
from pydantic import BaseModel
from google.adk.tools.tool_context import ToolContext


class BusinessSchema(BaseModel):
    name: str
    phone_number: str
    address: Optional[str]
    rating: Optional[float]
    review_count: Optional[int]
    picture: Optional[str]

class ResearchAgentOutputSchema(BaseModel):
    businesses: List[BusinessSchema]

def get_phone_numbers_tool(google_places_query: str, geo: str, tool_context: ToolContext) -> str:
    """Fetches phone numbers of candidate businesses given a query and geographical location.
    Args:
        google_places_query: The search query to find businesses (e.g., "plumbers in San Francisco").
        geo: The geographical location to refine the search (e.g., "San Francisco, CA").
        tool_context: The context of the tool, containing session and state information.
    """
    print(f"get_phone_numbers_tool called with: {google_places_query}, {geo}")
    # Search google places API for target businesses. return the json of business profiles with phone numbers. 
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return json.dumps({"error": "Google Maps API key not found."})

    # Step 1: Text Search to find places
    text_search_url = "https://places.googleapis.com/v1/places:searchText"
    text_search_headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.location,places.editorialSummary,places.photos"
    }
    text_search_payload = {
        "textQuery": google_places_query + " in " + geo,
    }

    try:
        text_search_response = requests.post(text_search_url, json=text_search_payload, headers=text_search_headers)
        text_search_response.raise_for_status()
        places = text_search_response.json().get("places", [])

        business_profiles = []
        for place_details in places:
            phone_number = place_details.get("nationalPhoneNumber") or place_details.get("internationalPhoneNumber")
            if phone_number:
                display_name_obj = place_details.get("displayName")
                name = display_name_obj.get("text") if isinstance(display_name_obj, dict) else display_name_obj
                
                editorial_summary_obj = place_details.get("editorialSummary")
                summary = editorial_summary_obj.get("text") if isinstance(editorial_summary_obj, dict) else None

                location = place_details.get("location")
                lat = location.get("latitude") if location else None
                lng = location.get("longitude") if location else None

                photo_url = None
                photos = place_details.get("photos")
                if photos and len(photos) > 0:
                    photo_name = photos[0].get("name")
                    if photo_name:
                        # Construct the photo URL
                        photo_url = f"https://places.googleapis.com/v1/{photo_name}/media?key={api_key}&maxHeightPx=400"

                business_profiles.append({
                    "name": name,
                    "phone_number": phone_number,
                    "biz_description": summary,
                    "lat": lat,
                    "lng": lng,
                    "picture": photo_url
                })
        print("collecting numbers finished", 
              f"found {len(business_profiles)} businesses with phone numbers.")
        # Format the output according to ResearchAgentOutputSchema
        formatted_business_profiles = ResearchAgentOutputSchema(businesses=[BusinessSchema(name=bp["name"],
                                                                   phone_number=bp["phone_number"],
                                                                   address=None,
                                                                   rating=None,
                                                                   review_count=None,
                                                                   picture=bp["picture"]) for bp in business_profiles])
        tool_context.state["formatted_businesses"] = formatted_business_profiles
        return json.dumps(business_profiles)

    except requests.exceptions.RequestException as e:
        return json.dumps({"error": str(e)})
    except Exception as e:
        return json.dumps({"error": str(e)})