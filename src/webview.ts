export function getWebviewContent() {
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
                        if (codeSnippet.trim() !== '') {  // Only render non-empty code snippets
                            const talkingPoint = slide.talking_points[index];
                            slideContent += \`<div><pre>\${codeSnippet}</pre><p>\${talkingPoint}</p></div>\`;
                        }
                    });

                    div.innerHTML = slideContent;  // Insert the HTML content into the slide

                    // Add mouseover and click functionality
                    div.onmouseover = () => div.style.backgroundColor = '#e0e0e0';
                    div.onmouseout = () => div.style.backgroundColor = '';
                    div.onclick = () => {
                        vscode.postMessage({ command: 'switchTab', tabPaths: slide.tab_paths.join('-'), startingLines: slide.starting_lines });
                    };

                    slidesDiv.appendChild(div);
                });
            }
        </script>
    </body>
    </html>`;
}