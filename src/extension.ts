import * as vscode from 'vscode';
import { getOpenTabsContexts } from './openTabs';
import { generateSlides } from './aiService';
import { processSlides } from './thumbnailGenerator';
import { SlideDTO } from './types';
import { getWebviewContent } from './webview';

const CULL_FULL_TAB_CONTENT = true;

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('codepresenter.showUI', async () => {
        const panel = vscode.window.createWebviewPanel(
            'codePresenter',
            'Code Presenter',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'customRequest') {
                const userCustomPrompt = message.input;
                const tabContents = await getOpenTabsContexts(CULL_FULL_TAB_CONTENT);
                const slides: SlideDTO[] = await generateSlides(tabContents, userCustomPrompt, message.windowSize, message.textSize, panel);
                const processedSlides = processSlides(slides);
                panel.webview.postMessage({ command: 'displaySlides', slides: processedSlides });
            }

			if (message.command === 'switchTab') {
				const tabPaths: string[] = message.tabPaths.split('-');
				const startingLines: number[] = message.startingLines;
			
				const documents = await Promise.all(tabPaths.map(path => {
					return vscode.workspace.openTextDocument(vscode.Uri.file(path));
				}));
			
				// Open the first document in ViewColumn.One and scroll to its starting line
				const editor1 = await vscode.window.showTextDocument(documents[0], { preview: false, viewColumn: vscode.ViewColumn.One });
				const startingLine1 = startingLines[0];
				editor1.revealRange(new vscode.Range(startingLine1, 0, startingLine1, 0));
			
				// Open the second document in ViewColumn.Two (if it exists) and scroll to its starting line
				if (documents.length > 1) {
					const editor2 = await vscode.window.showTextDocument(documents[1], { preview: false, viewColumn: vscode.ViewColumn.Two });
					const startingLine2 = startingLines[1];
					editor2.revealRange(new vscode.Range(startingLine2, 0, startingLine2, 0));
			
					// Move CodePresenter to ViewColumn.Three and pin it
					await panel.reveal(vscode.ViewColumn.Three);
					await vscode.commands.executeCommand('workbench.action.pinEditor'); // Pin CodePresenter
				}
			
				// Manage visibility based on the number of tabs
				if (documents.length === 1) {
					// Close other editors except the active one and move CodePresenter to ViewColumn.Two
					const activeColumn = vscode.window.activeTextEditor?.viewColumn;
					const editorsToClose = vscode.window.visibleTextEditors.filter(editor => editor.viewColumn !== activeColumn);
					
					for (const editor of editorsToClose) {
						await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
					}
			
					// Move CodePresenter to ViewColumn.Two and pin it
					await panel.reveal(vscode.ViewColumn.Two);
					await vscode.commands.executeCommand('workbench.action.pinEditor'); // Pin CodePresenter
				}
			}
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
