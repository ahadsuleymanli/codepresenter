
from fastapi import FastAPI
from pydantic import BaseModel
import openai
from typing import List, Tuple
import os

# Set these variables with your Azure OpenAI details
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
MODEL_NAME = "gpt-4o-mini"
# MODEL_NAME = "gpt-4"

# Configure OpenAI client for Azure
openai.api_type = "azure"
openai.azure_endpoint = AZURE_OPENAI_ENDPOINT
openai.api_key = AZURE_OPENAI_API_KEY
openai.api_version = "2024-02-15-preview"

MAX_SPLITVIEW_TABS = 2

app = FastAPI()

class Request(BaseModel):
    tab_contents: dict
    window_size: Tuple[int, int]
    text_size: int
    lines_that_fit: int
    prompt: str

class Slide(BaseModel):
    tab_names: List[str]
    tab_code_sections: List[Tuple[int, int]]

class Response(BaseModel):
    slides: List[Slide]

@app.post("/generateslides", response_model=Response)
async def generate_slides(request: Request):
    system_prompt = f"""
    Create a presentation based on the following:
    - Relevant tabs: {request.tab_contents}
    - Max lines per window: {request.lines_that_fit}
    - Select code sections and tabs to fit, using split view if needed, with up to {MAX_SPLITVIEW_TABS} tabs per slide.
    
    The response model to return:

    class Slide(BaseModel):
        tab_names: List[str]
        tab_code_sections: List[Tuple[int, int]]

    class Response(BaseModel):
        slides: List[Slide]
    """
    print(request)
    try:
        response = openai.chat.completions.create(
            model= MODEL_NAME,
            messages=[
                {"role": "system", "type": "text", "content": system_prompt},
                {"role": "user", "type": "text", "content": request.prompt}
            ]
        )
    except Exception as e:
        print(e)
        # handle it somehow
    
    # Call the OpenAI API to generate slides


    # Process the OpenAI response

    print(response.json())
    # Mocked example of processing the OpenAI response
    slides_data = [
        {
            "tab_names": ["tab1", "tab2"],
            "tab_code_sections": [(0, 50), (51, 100)]
        },
        {
            "tab_names": ["tab3"],
            "tab_code_sections": [(0, 75)]
        }
    ]

    response_slides = Response(slides=[Slide(**slide) for slide in slides_data])
    return response_slides
