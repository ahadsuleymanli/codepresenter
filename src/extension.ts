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
                const tabContents = await getOpenTabsContexts();
                const slides = await generateSlides(tabContents, "", message.windowSize, message.textSize, panel);
                panel.webview.postMessage({ command: 'displaySlides', slides });
            }
        
            if (message.command === 'switchTab') {
                const tabNames = message.tabName.split('-');  // Handle multiple tabs
        
                if (tabNames.length > 1) {
                    // Open two tabs in split view
                    const [firstTab, secondTab] = tabNames;
                    const doc1 = await vscode.workspace.openTextDocument(vscode.Uri.file(firstTab));
                    const doc2 = await vscode.workspace.openTextDocument(vscode.Uri.file(secondTab));
        
                    await vscode.window.showTextDocument(doc1, vscode.ViewColumn.One);
                    await vscode.window.showTextDocument(doc2, vscode.ViewColumn.Beside);
                } else {
                    // Open a single tab
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tabNames[0]));
                    await vscode.window.showTextDocument(doc);
                }
            }

            if (message.command === 'customRequest') {
                const tabContents = await getOpenTabsContexts();
                const slides = await generateSlides(tabContents, "", message.windowSize, message.textSize, panel);
                panel.webview.postMessage({ command: 'displaySlides', slides });
            }
        });

        loadThumbnails(panel);
    });

    context.subscriptions.push(disposable);
}

async function loadThumbnails(panel: vscode.WebviewPanel) {
    // Simulate loading thumbnails (for future implementation)
    panel.webview.postMessage({ command: 'loadThumbnails', thumbnails: [] });
}

function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    margin: 0;
                }
                #slides {
                    flex: 1;
                    overflow-y: auto;
                }
                #customRequestContainer {
                    display: flex;
                    padding: 10px;
                    border-top: 1px solid #ccc;
                }
                #customRequestInput {
                    flex: 1;
                    padding: 5px;
                    margin-right: 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                #submitButton {
                    padding: 5px 10px;
                    border: none;
                    border-radius: 4px;
                    background-color: #007acc;
                    color: white;
                    cursor: pointer;
                }
                #submitButton:hover {
                    background-color: #005999;
                }
                #submitButton:before {
                    content: '\u2191';  /* uparrow emoji as icon */
                    margin-right: 5px;
                }
            </style>
        </head>
        <body>
            <div id="slides"></div>
            <div id="customRequestContainer">
                <input type="text" id="customRequestInput" placeholder="Enter your request here..." value="Generate presentation from all open tabs" />
                <button id="submitButton">Submit</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('submitButton').onclick = () => {
                    const input = document.getElementById('customRequestInput');
                    const windowSize = [window.innerWidth, window.innerHeight]; // Use actual window size
                    const textSize = 14; // Example text size, replace as needed

                    // Send custom request to VSCode extension backend
                    vscode.postMessage({ command: 'customRequest', windowSize, textSize });
                };

                window.addEventListener('message', event => {
                    const message = event.data;

                    if (message.command === 'displaySlides') {
                        const slidesDiv = document.getElementById('slides');
                        slidesDiv.innerHTML = '';  // Clear existing slides content

                        // Handle the display of the slides
                        message.slides.forEach(slide => {
                            const div = document.createElement('div');
                            div.innerHTML = slide.image;  // Display the HTML content
                            slidesDiv.appendChild(div);
                        });
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}
