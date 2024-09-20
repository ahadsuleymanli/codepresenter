import * as vscode from 'vscode';
import { getOpenTabsContexts } from './openTabs';
import { generateSlides, getShortPath } from './aiService';
import { processSlides } from './thumbnailGenerator';
import { SlideDTO, ProcessedSlideDTO } from './types';
import { getWebviewContent } from './webview';

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

        // Handle messages from the webview
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

            if (message.command === 'switchTab') {
                const tabPaths: string[] = message.tabPaths.split('-');  // Use tab_paths for file paths

                // Get the currently active editor
                const activeEditor = vscode.window.activeTextEditor;
                let columnToOpenIn: vscode.ViewColumn;

                // Determine which column to open the first document in
                if (activeEditor) {
                    columnToOpenIn = activeEditor.viewColumn ? activeEditor.viewColumn : vscode.ViewColumn.One; // Use the active editor's column or default to one
                } else {
                    columnToOpenIn = vscode.ViewColumn.One; // No active editor, open in the first column
                }

                const documents = await Promise.all(tabPaths.map(path => {
                    return vscode.workspace.openTextDocument(vscode.Uri.file(path));
                }));

                // Open the first document in the determined column
                await vscode.window.showTextDocument(documents[0], { preview: false, viewColumn: columnToOpenIn });

                // Open the second document in the next column
                if (documents.length > 1) {
                    await vscode.window.showTextDocument(documents[1], { preview: false, viewColumn: columnToOpenIn + 1 });
                }

                // Scroll to the specified starting line
                const startingLine = message.startingLine;  // Ensure startingLine is passed as a single value
                await vscode.window.activeTextEditor?.revealRange(new vscode.Range(startingLine, 0, startingLine, 0));
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
