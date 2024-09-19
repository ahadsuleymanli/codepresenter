import * as vscode from 'vscode';
import axios from 'axios';

// Azure OpenAI API Configuration
const OPENAI_API_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const OPENAI_API_KEY = process.env.MY_ENV_VAR; 
if (OPENAI_API_KEY) {
	console.log(`Environment Variable: ${OPENAI_API_KEY}`);
  } else {
	console.error('Environment variable MY_ENV_VAR is not defined.');
  }

interface TabContents {
    [key: string]: string;
}

interface Slide {
    tab_names: string[];
    tab_code_sections: [number, number][];
}

interface SlideRequest {
    tab_contents: TabContents;
    window_size: [number, number];
    text_size: number;
    lines_that_fit: number;
    prompt: string;
}

interface SlideResponse {
    slides: Slide[];
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
                await generateSlides(message.tabContents, message.windowSize, message.textSize, panel);
            }
        });

        // Initial load of thumbnails when the webview is opened
        loadThumbnails(panel);
    });

    context.subscriptions.push(disposable);
}

async function generateSlides(tabContents: TabContents, windowSize: [number, number], textSize: number, panel: vscode.WebviewPanel) {
    const linesThatFit = Math.floor(windowSize[1] / textSize);  // Calculate lines that fit in the window

    const requestBody: SlideRequest = {
        tab_contents: tabContents,
        window_size: windowSize,
        text_size: textSize,
        lines_that_fit: linesThatFit,
        prompt: "Create a presentation based on the provided code."
    };

    const headers = {
        "Content-Type": "application/json",
        "api-key": OPENAI_API_KEY
    };

    try {
        const response = await axios.post<SlideResponse>(OPENAI_API_ENDPOINT, requestBody, { headers });
		console.log("response from openai:");
		console.log(response);
        // const slides = response.data.slides;

        // // Handle the slides (e.g., display them in the webview)
        // vscode.window.showInformationMessage(`Generated ${slides.length} slides.`);

        // // Post slides back to the webview
        // panel.webview.postMessage({ command: 'displaySlides', slides });

    } catch (error) {
        vscode.window.showErrorMessage('Failed to generate slides.');
    }
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
                    // Example tabContents: dynamically fetch actual open tab contents from VSCode
                    const tabContents = { "tab1": "code for tab 1", "tab2": "code for tab 2" }; 
                    const windowSize = [window.innerWidth, window.innerHeight]; // Use actual window size
                    const textSize = 14; // Example text size, replace as needed

                    // Send message to VSCode extension backend to generate slides
                    vscode.postMessage({ command: 'generateSlides', tabContents, windowSize, textSize });
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
