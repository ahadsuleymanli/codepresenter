import * as vscode from 'vscode';
import { getOpenTabsContexts } from './openTabs';
import { generateSlides, getShortPath } from './aiService';
import { processSlides } from './thumbnailGenerator';
import { SlideDTO, ProcessedSlideDTO } from './types';

const CULL_FULL_TAB_CONTENT = true;

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('codepresenter.showUI', async () => {
        const panel = vscode.window.createWebviewPanel(
            'codePresenter',
            'Code Presenter',
            vscode.ViewColumn.Beside,  // Open in a new editor column
            {
                enableScripts: true,
                retainContextWhenHidden: true, // Preserve state when the webview is hidden or tabbed out
            }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message) => {
			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.command === 'customRequest') {
					const userCustomPrompt = message.input;
					const tabContents = await getOpenTabsContexts(CULL_FULL_TAB_CONTENT);
					const slides: SlideDTO[] = await generateSlides(tabContents, userCustomPrompt, message.windowSize, message.textSize, panel);
			
					// Process slides into ProcessedSlideDTO
					const processedSlides = processSlides(slides);
			
					// Send processed slides to be displayed in the webview
					panel.webview.postMessage({ command: 'displaySlides', slides: processedSlides });
				}
			});

            if (message.command === 'switchTab') {
                const tabPaths: string[] = message.tabPaths.split('-');  // Use tab_paths for file paths

                const documents = await Promise.all(tabPaths.map(path => {
                    return vscode.workspace.openTextDocument(vscode.Uri.file(path));
                }));

                await vscode.window.showTextDocument(documents[0], { preview: false });

                if (documents.length > 1) {
                    await vscode.window.showTextDocument(documents[1], vscode.ViewColumn.Beside);
                }

                // Scroll to the specified starting line
                const startingLine = message.startingLine;  // Ensure startingLine is passed as a single value
                await vscode.window.activeTextEditor?.revealRange(new vscode.Range(startingLine, 0, startingLine, 0));
            }
        });
    });

    context.subscriptions.push(disposable);
}

// Function to generate webview content
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

            // Restore persisted state when the webview reloads
            const previousState = vscode.getState();
            if (previousState) {
                renderSlides(previousState.slides);
            }

            // Handle form submission
            document.getElementById('submitButton').onclick = () => {
                const input = document.getElementById('customRequestInput').value;
                const windowSize = [window.innerWidth, window.innerHeight]; // Use actual window size
                const textSize = 14; // Example text size, replace as needed

                // Send custom request to VSCode extension backend
                vscode.postMessage({ command: 'customRequest', input, windowSize, textSize });
            };

            // Handle messages from the extension backend
            window.addEventListener('message', event => {
                const message = event.data;

                if (message.command === 'displaySlides') {
                    renderSlides(message.slides);
                    // Persist the slides in the webview's state
                    vscode.setState({ slides: message.slides });
                }
            });

			function renderSlides(slides) {
				const slidesDiv = document.getElementById('slides');
				slidesDiv.innerHTML = '';  // Clear existing slides content

				slides.forEach(slide => {
					const div = document.createElement('div');
					div.className = 'slide';

					// Display the pre-calculated code snippets and talking points
					let slideContent = '<strong>' + slide.tab_names.join(', ') + '</strong><br>';
					slide.code_snippets.forEach((codeSnippet, index) => {
						const talkingPoint = slide.talking_points[index];
						slideContent += \`<div><pre>\${codeSnippet}</pre><p>\${talkingPoint}</p></div>\`;
					});

					div.innerHTML = slideContent;  // Insert the HTML content into the slide

					// Add mouseover and click functionality
					div.onmouseover = () => div.style.backgroundColor = '#e0e0e0';
					div.onmouseout = () => div.style.backgroundColor = '';
					div.onclick = () => {
						vscode.postMessage({ command: 'switchTab', tabPaths: slide.tab_paths.join('-'), startingLine: slide.starting_line });
					};

					slidesDiv.appendChild(div);
				});
			}
        </script>
    </body>
    </html>`;
}

export function deactivate() {}
