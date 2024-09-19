import * as vscode from 'vscode';
import { getOpenTabsContexts } from './openTabs';
import { generateSlides } from './aiService';

const MAX_SPLITVIEW_TABS = 2;

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
                await generateSlides(tabContents, "", message.windowSize, message.textSize, panel);
            }
        });

        loadThumbnails(panel);
    });

    context.subscriptions.push(disposable);
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
