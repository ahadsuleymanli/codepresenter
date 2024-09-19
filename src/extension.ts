import * as vscode from 'vscode';
import axios from 'axios';

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
                await generateSlides(message.tabContents, message.windowSize, message.textSize);
            }
        });

        // Initial load of thumbnails when the webview is opened
        loadThumbnails(panel);
    });

    context.subscriptions.push(disposable);
}

async function generateSlides(tabContents: Record<string, string>, windowSize: [number, number], textSize: number) {
    const linesThatFit = Math.floor(windowSize[1] / textSize);  // Calculate lines that fit in the window

    const requestBody = {
        tab_contents: tabContents,
        window_size: windowSize,
        text_size: textSize,
        lines_that_fit: linesThatFit,
        prompt: "Create a presentation based on the provided code."
    };

    try {
        const response = await axios.post('http://localhost:8000/generateslides', requestBody);
        const slides = response.data.slides;
        
        // Handle the slides (e.g., display them in the webview)
        vscode.window.showInformationMessage(`Generated ${slides.length} slides.`);
        // Further processing can be added here
    } catch (error) {
        vscode.window.showErrorMessage('Failed to generate slides.');
    }
}

async function loadThumbnails(panel: vscode.WebviewPanel) {
    try {
        const response = await axios.get('http://localhost:8000/generateslides');  // Change as needed
        const thumbnails = response.data.thumbnails;

        panel.webview.postMessage({ command: 'loadThumbnails', thumbnails });
    } catch (error) {
        vscode.window.showErrorMessage('Failed to load thumbnails from backend.');
    }
}

function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <body>
            <h1>Code Presenter</h1>
            <div id="thumbnails" style="display: flex; flex-wrap: wrap;"></div>
            <button id="generateSlides">Generate Slides</button>

            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('generateSlides').onclick = () => {
                    const tabContents = {}; // Replace with actual tab contents
                    const windowSize = [800, 600]; // Example size
                    const textSize = 14; // Example text size

                    vscode.postMessage({ command: 'generateSlides', tabContents, windowSize, textSize });
                };

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;

                    if (message.command === 'loadThumbnails') {
                        const thumbnailsDiv = document.getElementById('thumbnails');
                        thumbnailsDiv.innerHTML = '';  // Clear existing content

                        // Display thumbnails and make them clickable
                        message.thumbnails.forEach(tab => {
                            const img = document.createElement('img');
                            img.src = tab.thumbnail; // Thumbnail image data
                            img.alt = tab.name;
                            img.style = 'width: 150px; height: 100px; margin: 10px; cursor: pointer;';
                            img.onclick = () => switchToTab(tab.name);  // Click to switch tab

                            thumbnailsDiv.appendChild(img);
                        });
                    }
                });
                
                function switchToTab(tabName) {
                    vscode.postMessage({ command: 'switchTab', tabName });
                }
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}
