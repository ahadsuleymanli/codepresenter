import * as vscode from 'vscode';

// Azure OpenAI API Configuration
const OPENAI_API_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT ?? "";
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY  ?? "";

const MAX_SPLITVIEW_TABS = 2;

const CullFullTabContext = true;

if (!AZURE_OPENAI_API_KEY) {
    console.error('Environment variable AZURE_OPENAI_API_KEY is not defined.');
}
if (!OPENAI_API_ENDPOINT) {
    console.error('Environment variable OPENAI_API_ENDPOINT is not defined.');
}

interface CodeSection{
	section_signature: string;
	span: { start: number; end: number };
}

interface TabContext {
	name: string;
	full_code?: string;
	code_sections: CodeSection[];
}

interface Slide {
    tab_names: string[];
    tab_code_sections: [number, number][];
	slide_talking_points: string[]
}

interface Response {
    slides: Slide[];
}

interface OpenAIChoice {
    message: {
        role: string;
        content: string;
    };
}

interface OpenAIResponse {
    choices: OpenAIChoice[];
}

export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand('codepresenter.showUI', async () => {
        const panel = vscode.window.createWebviewPanel(
            'codePresenter',
            'Code Presenter',
            vscode.ViewColumn.Beside,  // Open in a new editor column
            {
                enableScripts: true,
            }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'generateSlides') {
                const tabContents = await getOpenTabsContexts();  // Get the actual open tabs' content
                await generateSlides(tabContents, message.windowSize, message.textSize, panel);
            }
        });

        loadThumbnails(panel);
    });

    context.subscriptions.push(disposable);
}

async function generateSlides(tabContexts: TabContext[], windowSize: [number, number], textSize: number, panel: vscode.WebviewPanel) {
    const linesThatFit = Math.floor(windowSize[1] / textSize);  // Calculate lines that fit in the window

    const systemPrompt = `
        Create a presentation based on the following:
        - Relevant tabs: ${JSON.stringify(tabContexts)}
        - Max lines per window: ${linesThatFit}
        - Select code sections for each tab you recommend for the presentation by creating a slide object, naming one or two tabs to show in split view and denote code sections by providing starting and ending line numbers.
        - Add if it would help any talking points slide_talking_points to each slide 
        - Create as many or little slide objects as necessary to show off parts of code and in the order of your choosing
        
        The response model to return:

        interface Slide {
            tab_names: string[];
            tab_code_sections: [number, number][];
            slide_talking_points: string[];
        }

        interface Response {
            slides: Slide[];
        }
    `;

    const userPrompt = "Create a presentation based on the provided code.";

    const requestBody = {
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 800
    };

    try {
        // Send request to the OpenAI endpoint
        const response = await fetch(OPENAI_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': AZURE_OPENAI_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        // Parse response
        const data = await response.json();
        console.log(data);
        vscode.window.showInformationMessage(`OpenAI response:\n ${JSON.stringify(data)}`);

        const openAIResponse = data as OpenAIResponse;
        const content = openAIResponse.choices[0]?.message?.content;
        const slides = parseAIResponse(content) || [];

        vscode.window.showInformationMessage(`Generated ${slides.length} slides.`);

        panel.webview.postMessage({
            command: 'displaySlides',
            slides
        });

    } catch (error) {
        vscode.window.showErrorMessage('Failed to generate slides: ' + (error as Error)?.message ?? error);
    }
}

function parseAIResponse(aiResponse: string): Slide[] {
    try {
        // Attempt to extract JSON from the AI response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/); // Matches the first JSON-like structure in the response
        
        if (!jsonMatch) {
            throw new Error('No JSON structure found in AI response.');
        }

        const jsonResponse = jsonMatch[0];

        // Attempt to parse the JSON
        let parsedResponse: any;
        try {
            parsedResponse = JSON.parse(jsonResponse);
        } catch (e) {
            throw new Error('Failed to parse JSON from AI response.');
        }

        // Validate the structure against the Response interface
        if (!isValidResponse(parsedResponse)) {
            throw new Error('Invalid JSON structure in AI response.');
        }

        // Return the slides array
        return parsedResponse.slides;
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage('Failed to parse AI response: ' + error.message);
        } else {
            vscode.window.showErrorMessage('Failed to parse AI response due to an unknown error.');
        }

        // In case of error, return an empty array as fallback
        return [];
    }
}

// Type guard to check if the parsed object matches the Response interface
function isValidResponse(response: any): response is Response {
    return (
        Array.isArray(response.slides) && 
        response.slides.every(isValidSlide)
    );
}

// Type guard to check if each slide matches the Slide interface
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

async function getOpenTabsContexts(): Promise<TabContext[]> {
    const tabContexts: TabContext[] = [];

    // Loop through all open text documents in the workspace
    vscode.workspace.textDocuments.forEach(document => {

        // Exclude webview tabs like "CodePresenter"
        if (document.uri.scheme === 'vscode-webview') {
            return;  // Skip webview tabs
        }

        const tabName = document.fileName;  // Get the file name of the tab
        const content = document.getText();  // Get the full content of the tab
        const codeSections = extractCodeSections(content);  // Extract the code sections

        // Push the tab context to the array
        tabContexts.push({
            name: tabName,
            full_code: content,  // Optional, but you can include it
            code_sections: codeSections,
        });
    });

    return tabContexts;
}

function extractCodeSections(content: string): CodeSection[] {
    const codeSections: CodeSection[] = [];
    const lines = content.split('\n');

    // Regular expression to capture function/method and class signatures.
    // This can be enhanced to support different languages.
    const signatureRegex = /^(?:\s*(?:class|function|def|public|private|protected|const)\s+([a-zA-Z0-9_]+))/;

    let startLine = -1;
    let currentSignature = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if the line matches a function or class signature
        const match = line.match(signatureRegex);
        if (match) {
            if (currentSignature && startLine !== -1) {
                // If we were tracking a previous code block, close it
                codeSections.push({
                    section_signature: currentSignature,
                    span: { start: startLine, end: i - 1 },
                });
            }

            // Start tracking a new code block
            currentSignature = match[0];  // Full matched signature
            startLine = i;
        }

        // You can add logic here to include comments before or after the signature
    }

    // If there’s an ongoing code block, close it at the end
    if (currentSignature && startLine !== -1) {
        codeSections.push({
            section_signature: currentSignature,
            span: { start: startLine, end: lines.length - 1 },
        });
    }

    return codeSections;
}

async function loadThumbnails(panel: vscode.WebviewPanel) {
    // Simulate loading thumbnails (for future implementation)
    // Here, you could add a request to fetch pre-generated thumbnails or handle them client-side.
    panel.webview.postMessage({ command: 'loadThumbnails', thumbnails: [] });
}

function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <body>
            <h1>Code Presenter</h1>
            <div id="thumbnails" style="display: flex; flex-wrap: wrap;"></div>
            <button id="generateSlides">Generate Slides</button>

            <div id="slides" style="margin-top: 20px;"></div>

            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('generateSlides').onclick = () => {
                    const windowSize = [window.innerWidth, window.innerHeight]; // Use actual window size
                    const textSize = 14; // Example text size, replace as needed

                    // Send message to VSCode extension backend to generate slides
                    vscode.postMessage({ command: 'generateSlides', windowSize, textSize });
                };

                // Listen for messages from the extension (for both thumbnails and slides)
                window.addEventListener('message', event => {
                    const message = event.data;

                    if (message.command === 'loadThumbnails') {
                        const thumbnailsDiv = document.getElementById('thumbnails');
                        thumbnailsDiv.innerHTML = '';  // Clear existing content

                        // Loop through thumbnails and add them
                        message.thumbnails.forEach(thumbnail => {
                            const img = document.createElement('img');
                            img.src = thumbnail.image; // Assuming image is the data URL or file path
                            img.alt = thumbnail.name;
                            img.style = 'width: 150px; height: 100px; margin: 10px; cursor: pointer;';
                            img.onclick = () => {
                                // Switch tab when clicking the thumbnail
                                vscode.postMessage({ command: 'switchTab', tabName: thumbnail.name });
                            };
                            thumbnailsDiv.appendChild(img);
                        });
                    }

                    if (message.command === 'displaySlides') {
                        const slidesDiv = document.getElementById('slides');
                        slidesDiv.innerHTML = '';  // Clear existing slides content

                        // Loop through the received slides and display them
                        message.slides.forEach(slide => {
                            const slideDiv = document.createElement('div');
                            slideDiv.innerHTML = \`
                                <h3>Slide with Tabs: \${slide.tab_names.join(', ')}</h3>
                                <p>Code Sections: \${slide.tab_code_sections.map(section => section.join('-')).join(', ')}</p>
                            \`;
                            slidesDiv.appendChild(slideDiv);
                        });
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}
