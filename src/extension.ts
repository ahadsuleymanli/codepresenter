import * as vscode from 'vscode';
import { getOpenTabsContexts } from './openTabs';
import { generateSlides } from './aiService';

const MAX_SPLITVIEW_TABS = 2;
const CULL_FULL_TAB_CONTENT = true;

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
            if (message.command === 'customRequest') {
                const userCustomPrompt = message.input;
                const tabContents = await getOpenTabsContexts(CULL_FULL_TAB_CONTENT);
                const slides = await generateSlides(tabContents, userCustomPrompt, message.windowSize, message.textSize, panel);
				
                panel.webview.postMessage({ command: 'displaySlides', slides });
            }

			if (message.command === 'displaySlides') {
				const slidesDiv = document.getElementById('slides');
				if (!slidesDiv) {
					console.error('Slides container not found');
					return; // Exit if the slidesDiv is not found
				}
				
				slidesDiv.innerHTML = ''; // Clear existing slides content
			
				message.slides.forEach((slide: any) => {
					const div = document.createElement('div');
					div.className = 'slide';
					const tabNames = slide.tab_names.join(', ') || 'Unnamed Tab';
					const text = slide.text || 'No description available';
		
					div.innerHTML = `<strong>${tabNames}</strong><br>${text}`;
		
					// Add mouseover and click functionality
					div.onmouseover = () => div.style.backgroundColor = '#e0e0e0';
					div.onmouseout = () => div.style.backgroundColor = '';
					div.onclick = () => {
						panel.webview.postMessage({ command: 'switchTab', tabNames: slide.tab_names.join('-'), startingLines: slide.tab_code_sections });
					};
		
					slidesDiv.appendChild(div);
				});
			}

			if (message.command === 'switchTab') {
				const tabNames: string[] = message.tabNames.split('-');  // Explicitly typing tabNames as an array of strings
		
				const documents = await Promise.all(tabNames.map(name => {
					return vscode.workspace.openTextDocument(vscode.Uri.file(name));
				}));
		
				await vscode.window.showTextDocument(documents[0], { preview: false });
		
				if (documents.length > 1) {
					await vscode.window.showTextDocument(documents[1], vscode.ViewColumn.Beside);
				}
		
				// Scroll to the specified starting line
				const startingLines = message.startingLines;
				await vscode.window.activeTextEditor?.revealRange(new vscode.Range(startingLines[0][0], 0, startingLines[0][1], 0));
			}
        });
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent() {
    return `<!DOCTYPE html>
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
            .slide {
                border: 1px solid #ccc;
                padding: 10px;
                margin: 5px;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .slide:hover {
                background-color: #f0f0f0;
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
                const input = document.getElementById('customRequestInput').value;
                const windowSize = [window.innerWidth, window.innerHeight]; // Use actual window size
                const textSize = 14; // Example text size, replace as needed

                // Send custom request to VSCode extension backend
                vscode.postMessage({ command: 'customRequest', input, windowSize, textSize });
            };

            window.addEventListener('message', event => {
                const message = event.data;

                if (message.command === 'displaySlides') {
                    const slidesDiv = document.getElementById('slides');
                    slidesDiv.innerHTML = '';  // Clear existing slides content

                    message.slides.forEach(slide => {
                        const div = document.createElement('div');
                        div.className = 'slide';
                        div.innerHTML = slide.image;  // Display the HTML content

                        // Add mouseover and click functionality
                        div.onmouseover = () => div.style.backgroundColor = '#e0e0e0';
                        div.onmouseout = () => div.style.backgroundColor = '';
                        div.onclick = () => {
                            vscode.postMessage({ command: 'switchTab', tabNames: slide.tab_names.join('-'), startingLine: slide.startLine });
                        };

                        slidesDiv.appendChild(div);
                    });
                }
            });
        </script>
    </body>
    </html>`;
}

export function deactivate() {}
