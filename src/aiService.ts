import * as vscode from 'vscode';
import { TabContext, Slide, OpenAIResponse, OpenAIResponseObj } from './types';

const OPENAI_API_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT ?? "";
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY ?? "";

if (!AZURE_OPENAI_API_KEY || !OPENAI_API_ENDPOINT) {
    console.error('OpenAI API configuration missing.');
}

export async function generateSlides(
    tabContexts: TabContext[], 
    userCustomPrompt: string, 
    windowSize: [number, number], 
    textSize: number, 
    panel: vscode.WebviewPanel
) {
    const linesThatFit = Math.floor(windowSize[1] / textSize);

    const systemPrompt = `
        Create a presentation based on the json object in the user Prompt by following these instructions:
        - Select code sections for each tab you recommend for the presentation by creating a slide object, naming one or two tabs to show in split view and denote code sections by providing starting and ending line numbers on the code. 
        - Create as many or little slide objects as necessary to show off parts of code and in the order of your choosing
        - Add if it would help any talking points slide_talking_points to each slide.
        - Return only a Json Object with the structure of OpenAIResponseObj specified below, only add ai_notes if you feel an additional text response from you is warranted.

        export interface Slide {
            tab_names: string[];
            tab_code_sections: [number, number][];
            slide_talking_points: string[];
        }

        export interface OpenAIResponseObj {
            slides: Slide[];
            ai_notes: string;
        }
    `;

    const userPromptContent = `User's custom prompt: ${userCustomPrompt}
    Max lines per window: ${linesThatFit}
    tabContexts:${JSON.stringify(tabContexts)}
    `;

    const requestBody = {
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPromptContent
            }
        ],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 800
    };

    try {
        const response = await fetch(OPENAI_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': AZURE_OPENAI_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        const openAIResponse = data as OpenAIResponse;
        const slides = parseAIResponse(openAIResponse.choices[0]?.message?.content || '');

        // Create a map for full paths
        const tabContextsMap = new Map<string, string>();
        tabContexts.forEach(context => {
            tabContextsMap.set(context.name, context.full_code ?? "");
        });

        // Replace slide names with full paths
        const slidesWithFullPaths = slides.map(slide => {
            return {
                ...slide,
                tab_names: slide.tab_names.map(name => tabContextsMap.get(name) || name),
                text: slide.slide_talking_points.join(', ') // Combine talking points into a single string
            };
        });

        vscode.window.showInformationMessage(`Generated ${slidesWithFullPaths.length} slides.`);

        return slidesWithFullPaths; // Ensure the slides are returned

    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage('Failed to generate slides: ' + error.message);
        } else {
            vscode.window.showErrorMessage('Failed to generate slides: due to an unknown error.');
        }
        return []; // Return an empty array in case of error
    }
}

function parseAIResponse(aiResponse: string): Slide[] {
    try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON structure found in AI response.');
        }

        const jsonResponse = jsonMatch[0];
        let parseObj: any;

        try {
            parseObj = JSON.parse(jsonResponse);
        } catch (e) {
            throw new Error('Failed to parse JSON from AI response.');
        }

        if (!isValidResponse(parseObj)) {
            throw new Error('Invalid JSON structure in AI response.');
        }

        return parseObj.slides;
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage('Failed to parse AI response: ' + error.message);
        }
        return [];
    }
}

function isValidResponse(response: any): response is OpenAIResponseObj {
    return (
        Array.isArray(response.slides) && 
        response.slides.every(isValidSlide)
    );
}

function isValidSlide(slide: any): slide is Slide {
    return (
        Array.isArray(slide.tab_names) &&
        slide.tab_names.every((name: any) => typeof name === 'string') &&
        Array.isArray(slide.tab_code_sections) &&
        slide.tab_code_sections.every(
            (section: any) => 
                Array.isArray(section) &&
                section.length === 2 &&
                typeof section[0] === 'number' &&
                typeof section[1] === 'number'
        )
    );
}

function findFullPath(shortName: string, tabContextsMap: Map<string, string>): string {
    for (const [fullName, _] of tabContextsMap) {
        if (fullName.endsWith(shortName)) {
            return fullName;
        }
    }
    return shortName;
}
